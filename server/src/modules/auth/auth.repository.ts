import oracledb from 'oracledb';
import { getConnection } from '../../config/database';
import type { Rol } from '@erp/contracts';

export interface UsuarioRow {
  ID_USUARIO: number;
  USERNAME: string;
  NOMBRE: string;
  PASSWORD_HASH: string;
  ROL: Rol;
  ESTADO: 'ACTIVO' | 'INACTIVO';
  INTENTOS_FALLIDOS: number;
  /** Minutos que faltan para que termine el bloqueo (0 si no está bloqueado). */
  MIN_BLOQUEO: number;
  DEBE_CAMBIAR_CLAVE: 'S' | 'N';
}

const USUARIO_SELECT = `
  SELECT ID_USUARIO, USERNAME, NOMBRE, PASSWORD_HASH, ROL, ESTADO, INTENTOS_FALLIDOS, DEBE_CAMBIAR_CLAVE,
         CASE WHEN BLOQUEADO_HASTA IS NOT NULL AND BLOQUEADO_HASTA > SYSTIMESTAMP
              THEN CEIL((CAST(BLOQUEADO_HASTA AS DATE) - CAST(SYSTIMESTAMP AS DATE)) * 1440) ELSE 0 END AS MIN_BLOQUEO
    FROM SEG_USUARIOS`;

export async function findUsuarioByUsername(username: string): Promise<UsuarioRow | null> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<UsuarioRow>(`${USUARIO_SELECT} WHERE UPPER(USERNAME) = UPPER(:username)`, { username });
    return r.rows?.[0] ?? null;
  } finally {
    await conn.close();
  }
}

export async function findUsuarioById(id: number): Promise<UsuarioRow | null> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<UsuarioRow>(`${USUARIO_SELECT} WHERE ID_USUARIO = :id`, { id });
    return r.rows?.[0] ?? null;
  } finally {
    await conn.close();
  }
}

/** Suma un intento fallido y bloquea la cuenta al llegar al máximo. Devuelve true si quedó bloqueada. */
export async function registrarIntentoFallido(idUsuario: number, maxIntentos: number, minutosBloqueo: number): Promise<boolean> {
  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE SEG_USUARIOS
          SET INTENTOS_FALLIDOS = INTENTOS_FALLIDOS + 1,
              BLOQUEADO_HASTA = CASE WHEN INTENTOS_FALLIDOS + 1 >= :max
                                     THEN SYSTIMESTAMP + NUMTODSINTERVAL(:min, 'MINUTE') ELSE BLOQUEADO_HASTA END
        WHERE ID_USUARIO = :id`,
      { max: maxIntentos, min: minutosBloqueo, id: idUsuario },
    );
    const r = await conn.execute<{ B: number }>(
      `SELECT CASE WHEN BLOQUEADO_HASTA > SYSTIMESTAMP THEN 1 ELSE 0 END AS B FROM SEG_USUARIOS WHERE ID_USUARIO = :id`,
      { id: idUsuario },
    );
    await conn.commit();
    return (r.rows?.[0]?.B ?? 0) === 1;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

export async function registrarLoginExitoso(idUsuario: number): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE SEG_USUARIOS SET INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = NULL, ULTIMO_LOGIN = SYSTIMESTAMP WHERE ID_USUARIO = :id`,
      { id: idUsuario },
    );
    await conn.commit();
  } finally {
    await conn.close();
  }
}

export async function actualizarClave(idUsuario: number, passwordHash: string): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE SEG_USUARIOS
          SET PASSWORD_HASH = :hash, DEBE_CAMBIAR_CLAVE = 'N', FECHA_CLAVE = SYSTIMESTAMP,
              INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = NULL
        WHERE ID_USUARIO = :id`,
      { hash: passwordHash, id: idUsuario },
    );
    await conn.commit();
  } finally {
    await conn.close();
  }
}

export async function crearUsuario(input: {
  username: string; nombre: string; email?: string | null; passwordHash: string; rol: Rol; idEmpleado?: number | null;
}): Promise<number> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<{ id: number[] }>(
      `INSERT INTO SEG_USUARIOS (USERNAME, NOMBRE, EMAIL, PASSWORD_HASH, ROL, ID_EMPLEADO, DEBE_CAMBIAR_CLAVE)
       VALUES (:username, :nombre, :email, :hash, :rol, :idEmpleado, 'S')
       RETURNING ID_USUARIO INTO :id`,
      {
        username: input.username, nombre: input.nombre, email: input.email ?? null, hash: input.passwordHash,
        rol: input.rol, idEmpleado: input.idEmpleado ?? null, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    await conn.commit();
    return r.outBinds!.id[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

// --- Sesiones ------------------------------------------------------------------

export interface SesionRow {
  ID_SESION: string;
  ID_USUARIO: number;
  TOKEN_HASH: string;
  REVOCADA: number;
  EXPIRADA: number;
  INACTIVA: number;
}

export async function crearSesion(p: {
  idSesion: string; idUsuario: number; tokenHash: string; maxHoras: number; ip: string | null; userAgent: string | null;
}): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.execute(
      `INSERT INTO SEG_SESIONES (ID_SESION, ID_USUARIO, TOKEN_HASH, FECHA_EXPIRA, IP, USER_AGENT)
       VALUES (:id, :idUsuario, :hash, SYSTIMESTAMP + NUMTODSINTERVAL(:horas, 'HOUR'), :ip, :ua)`,
      { id: p.idSesion, idUsuario: p.idUsuario, hash: p.tokenHash, horas: p.maxHoras, ip: p.ip, ua: p.userAgent?.slice(0, 300) ?? null },
    );
    await conn.commit();
  } finally {
    await conn.close();
  }
}

/**
 * Bloquea la sesión y la rota en una sola transacción. Devuelve:
 *  - 'ok' con el idUsuario si el token era el vigente,
 *  - 'reuso' si el token ya había sido rotado (posible robo): la sesión queda revocada,
 *  - 'invalida' si no existe, expiró, está inactiva o fue revocada.
 */
export async function rotarSesion(
  idSesion: string, presentedHash: string, newHash: string, idleMinutes: number, hashEquals: (a: string, b: string) => boolean,
): Promise<{ estado: 'ok'; idUsuario: number } | { estado: 'reuso' | 'invalida'; idUsuario?: number }> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<SesionRow>(
      `SELECT ID_SESION, ID_USUARIO, TOKEN_HASH,
              CASE WHEN FECHA_REVOCADA IS NOT NULL THEN 1 ELSE 0 END AS REVOCADA,
              CASE WHEN FECHA_EXPIRA <= SYSTIMESTAMP THEN 1 ELSE 0 END AS EXPIRADA,
              CASE WHEN FECHA_ULTIMO_USO < SYSTIMESTAMP - NUMTODSINTERVAL(:idle, 'MINUTE') THEN 1 ELSE 0 END AS INACTIVA
         FROM SEG_SESIONES WHERE ID_SESION = :id FOR UPDATE`,
      { id: idSesion, idle: idleMinutes },
    );
    const s = r.rows?.[0];
    if (!s || s.REVOCADA || s.EXPIRADA) { await conn.rollback(); return { estado: 'invalida', idUsuario: s?.ID_USUARIO }; }
    if (s.INACTIVA) {
      await conn.execute(`UPDATE SEG_SESIONES SET FECHA_REVOCADA = SYSTIMESTAMP, MOTIVO_REVOCACION = 'INACTIVIDAD' WHERE ID_SESION = :id`, { id: idSesion });
      await conn.commit();
      return { estado: 'invalida', idUsuario: s.ID_USUARIO };
    }
    if (!hashEquals(s.TOKEN_HASH, presentedHash)) {
      await conn.execute(`UPDATE SEG_SESIONES SET FECHA_REVOCADA = SYSTIMESTAMP, MOTIVO_REVOCACION = 'REUSO_TOKEN' WHERE ID_SESION = :id`, { id: idSesion });
      await conn.commit();
      return { estado: 'reuso', idUsuario: s.ID_USUARIO };
    }
    await conn.execute(`UPDATE SEG_SESIONES SET TOKEN_HASH = :hash, FECHA_ULTIMO_USO = SYSTIMESTAMP WHERE ID_SESION = :id`, { hash: newHash, id: idSesion });
    await conn.commit();
    return { estado: 'ok', idUsuario: s.ID_USUARIO };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

/** Cambia el secreto de la sesión sin validar el anterior (el llamador ya autenticó al usuario). */
export async function rotarSesionForzada(idSesion: string, newHash: string): Promise<boolean> {
  const conn = await getConnection();
  try {
    const r = await conn.execute(
      `UPDATE SEG_SESIONES SET TOKEN_HASH = :hash, FECHA_ULTIMO_USO = SYSTIMESTAMP WHERE ID_SESION = :id AND FECHA_REVOCADA IS NULL`,
      { hash: newHash, id: idSesion },
    );
    await conn.commit();
    return (r.rowsAffected ?? 0) > 0;
  } finally {
    await conn.close();
  }
}

export async function revocarSesion(idSesion: string, motivo: string): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE SEG_SESIONES SET FECHA_REVOCADA = SYSTIMESTAMP, MOTIVO_REVOCACION = :motivo WHERE ID_SESION = :id AND FECHA_REVOCADA IS NULL`,
      { motivo, id: idSesion },
    );
    await conn.commit();
  } finally {
    await conn.close();
  }
}

/** Revoca todas las sesiones activas de un usuario (opcionalmente conservando una). Devuelve los ids revocados. */
export async function revocarSesionesDeUsuario(idUsuario: number, motivo: string, excepto?: string): Promise<string[]> {
  const conn = await getConnection();
  try {
    const ids = await conn.execute<{ ID_SESION: string }>(
      `SELECT ID_SESION FROM SEG_SESIONES WHERE ID_USUARIO = :id AND FECHA_REVOCADA IS NULL AND FECHA_EXPIRA > SYSTIMESTAMP
          AND (:excepto IS NULL OR ID_SESION <> :excepto)`,
      { id: idUsuario, excepto: excepto ?? null },
    );
    await conn.execute(
      `UPDATE SEG_SESIONES SET FECHA_REVOCADA = SYSTIMESTAMP, MOTIVO_REVOCACION = :motivo
        WHERE ID_USUARIO = :id AND FECHA_REVOCADA IS NULL AND (:excepto IS NULL OR ID_SESION <> :excepto)`,
      { motivo, id: idUsuario, excepto: excepto ?? null },
    );
    await conn.commit();
    return (ids.rows ?? []).map((x) => x.ID_SESION);
  } finally {
    await conn.close();
  }
}

export async function sesionActiva(idSesion: string): Promise<boolean> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<{ N: number }>(
      `SELECT COUNT(*) AS N FROM SEG_SESIONES WHERE ID_SESION = :id AND FECHA_REVOCADA IS NULL AND FECHA_EXPIRA > SYSTIMESTAMP`,
      { id: idSesion },
    );
    return (r.rows?.[0]?.N ?? 0) > 0;
  } finally {
    await conn.close();
  }
}

// --- Bitácora ------------------------------------------------------------------

export type EventoAcceso =
  | 'LOGIN_OK' | 'LOGIN_FALLIDO' | 'CUENTA_BLOQUEADA' | 'LOGIN_BLOQUEADO' | 'LOGOUT'
  | 'CAMBIO_CLAVE' | 'REFRESH_REUSO' | 'SESION_EXPIRADA'
  | 'RECUPERACION_SOLICITADA' | 'CLAVE_RECUPERADA'
  | 'USUARIO_CREADO' | 'USUARIO_MODIFICADO' | 'CLAVE_RESTABLECIDA' | 'USUARIO_DESBLOQUEADO' | 'SESIONES_CERRADAS';

/** La bitácora nunca debe romper el login: si falla, se ignora (el servicio lo registra en el log). */
export async function registrarAcceso(e: {
  idUsuario?: number | null; username?: string | null; evento: EventoAcceso; ip?: string | null; userAgent?: string | null; detalle?: string | null;
}): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.execute(
      `INSERT INTO SEG_BITACORA_ACCESO (ID_USUARIO, USERNAME, EVENTO, IP, USER_AGENT, DETALLE)
       VALUES (:idUsuario, :username, :evento, :ip, :ua, :detalle)`,
      {
        idUsuario: e.idUsuario ?? null, username: e.username?.slice(0, 50) ?? null, evento: e.evento,
        ip: e.ip?.slice(0, 64) ?? null, ua: e.userAgent?.slice(0, 300) ?? null, detalle: e.detalle?.slice(0, 250) ?? null,
      },
    );
    await conn.commit();
  } finally {
    await conn.close();
  }
}

// --- Recuperación de contraseña ----------------------------------------------------

export interface UsuarioRecuperacionRow { ID_USUARIO: number; USERNAME: string; NOMBRE: string; EMAIL: string }

/** Usuarios ACTIVOS con correo cuyo usuario o correo coincide con lo que escribió la persona. */
export async function buscarParaRecuperacion(identificador: string): Promise<UsuarioRecuperacionRow[]> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<UsuarioRecuperacionRow>(
      `SELECT ID_USUARIO, USERNAME, NOMBRE, EMAIL FROM SEG_USUARIOS
        WHERE ESTADO = 'ACTIVO' AND EMAIL IS NOT NULL
          AND (UPPER(USERNAME) = UPPER(:id) OR UPPER(EMAIL) = UPPER(:id))`,
      { id: identificador },
    );
    return r.rows ?? [];
  } finally {
    await conn.close();
  }
}

/** Invalida los enlaces anteriores sin usar y guarda el nuevo (solo su hash). */
export async function crearTokenRecuperacion(idUsuario: number, tokenHash: string, minutos: number, ip: string | null): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.execute(`UPDATE SEG_RECUPERACION SET FECHA_USO = SYSTIMESTAMP WHERE ID_USUARIO = :id AND FECHA_USO IS NULL`, { id: idUsuario });
    await conn.execute(
      `INSERT INTO SEG_RECUPERACION (ID_USUARIO, TOKEN_HASH, FECHA_EXPIRA, IP)
       VALUES (:id, :hash, SYSTIMESTAMP + NUMTODSINTERVAL(:min, 'MINUTE'), :ip)`,
      { id: idUsuario, hash: tokenHash, min: minutos, ip },
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

export async function tokenRecuperacionValido(tokenHash: string): Promise<boolean> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<{ N: number }>(
      `SELECT COUNT(*) AS N FROM SEG_RECUPERACION WHERE TOKEN_HASH = :hash AND FECHA_USO IS NULL AND FECHA_EXPIRA > SYSTIMESTAMP`,
      { hash: tokenHash },
    );
    return (r.rows?.[0]?.N ?? 0) > 0;
  } finally {
    await conn.close();
  }
}

/** Marca el enlace como usado de forma atómica (dos clics a la vez no pueden usarlo dos veces). */
export async function consumirTokenRecuperacion(tokenHash: string): Promise<number | null> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<{ id: number[] }>(
      `UPDATE SEG_RECUPERACION SET FECHA_USO = SYSTIMESTAMP
        WHERE TOKEN_HASH = :hash AND FECHA_USO IS NULL AND FECHA_EXPIRA > SYSTIMESTAMP
        RETURNING ID_USUARIO INTO :id`,
      { hash: tokenHash, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
    );
    await conn.commit();
    return (r.rowsAffected ?? 0) > 0 ? r.outBinds!.id[0] : null;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

/** Dueño ACTIVO de un enlace de recuperación vigente (null si no existe, venció, se usó o la cuenta está inactiva). */
export async function findUsuarioPorToken(tokenHash: string): Promise<{ ID_USUARIO: number; USERNAME: string } | null> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<{ ID_USUARIO: number; USERNAME: string }>(
      `SELECT u.ID_USUARIO, u.USERNAME FROM SEG_RECUPERACION t JOIN SEG_USUARIOS u ON u.ID_USUARIO = t.ID_USUARIO
        WHERE t.TOKEN_HASH = :hash AND t.FECHA_USO IS NULL AND t.FECHA_EXPIRA > SYSTIMESTAMP AND u.ESTADO = 'ACTIVO'`,
      { hash: tokenHash },
    );
    return r.rows?.[0] ?? null;
  } finally {
    await conn.close();
  }
}
