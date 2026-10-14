import { getConnection } from '../../config/database';
import type { Rol } from '@erp/contracts';

export interface UsuarioAdminRow {
  ID_USUARIO: number;
  USERNAME: string;
  NOMBRE: string;
  EMAIL: string | null;
  ROL: Rol;
  ESTADO: 'ACTIVO' | 'INACTIVO';
  DEBE_CAMBIAR_CLAVE: 'S' | 'N';
  INTENTOS_FALLIDOS: number;
  MIN_BLOQUEO: number;
  SESIONES_ACTIVAS: number;
  ULTIMO_LOGIN: Date | null;
  FECHA_CREACION: Date;
}

const SELECT_USUARIO = `
  SELECT u.ID_USUARIO, u.USERNAME, u.NOMBRE, u.EMAIL, u.ROL, u.ESTADO, u.DEBE_CAMBIAR_CLAVE, u.INTENTOS_FALLIDOS,
         u.ULTIMO_LOGIN, u.FECHA_CREACION,
         CASE WHEN u.BLOQUEADO_HASTA IS NOT NULL AND u.BLOQUEADO_HASTA > SYSTIMESTAMP
              THEN CEIL((CAST(u.BLOQUEADO_HASTA AS DATE) - CAST(SYSTIMESTAMP AS DATE)) * 1440) ELSE 0 END AS MIN_BLOQUEO,
         (SELECT COUNT(*) FROM SEG_SESIONES s
           WHERE s.ID_USUARIO = u.ID_USUARIO AND s.FECHA_REVOCADA IS NULL AND s.FECHA_EXPIRA > SYSTIMESTAMP) AS SESIONES_ACTIVAS
    FROM SEG_USUARIOS u`;

export async function listarUsuarios(p: { search: string; offset: number; limit: number }): Promise<{ rows: UsuarioAdminRow[]; total: number }> {
  const conn = await getConnection();
  try {
    const filtro = p.search
      ? `WHERE UPPER(u.USERNAME) LIKE :q OR UPPER(u.NOMBRE) LIKE :q OR UPPER(NVL(u.EMAIL, ' ')) LIKE :q`
      : '';
    const binds: Record<string, string> = p.search ? { q: `%${p.search.toUpperCase()}%` } : {};
    const total = await conn.execute<{ N: number }>(`SELECT COUNT(*) AS N FROM SEG_USUARIOS u ${filtro}`, binds);
    const r = await conn.execute<UsuarioAdminRow>(
      `${SELECT_USUARIO} ${filtro} ORDER BY u.ESTADO ASC, u.NOMBRE ASC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...binds, offset: p.offset, limit: p.limit },
    );
    return { rows: r.rows ?? [], total: total.rows?.[0]?.N ?? 0 };
  } finally {
    await conn.close();
  }
}

export async function obtenerUsuarioAdmin(id: number): Promise<UsuarioAdminRow | null> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<UsuarioAdminRow>(`${SELECT_USUARIO} WHERE u.ID_USUARIO = :id`, { id });
    return r.rows?.[0] ?? null;
  } finally {
    await conn.close();
  }
}

/** Cuántos administradores activos hay, sin contar a `excluirId` (para no dejar el sistema sin ADMIN). */
export async function contarAdminsActivos(excluirId: number): Promise<number> {
  const conn = await getConnection();
  try {
    const r = await conn.execute<{ N: number }>(
      `SELECT COUNT(*) AS N FROM SEG_USUARIOS WHERE ROL = 'ADMIN' AND ESTADO = 'ACTIVO' AND ID_USUARIO <> :id`,
      { id: excluirId },
    );
    return r.rows?.[0]?.N ?? 0;
  } finally {
    await conn.close();
  }
}

export async function actualizarUsuario(id: number, d: { nombre: string; email: string | null; rol: Rol; estado: 'ACTIVO' | 'INACTIVO' }): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE SEG_USUARIOS SET NOMBRE = :nombre, EMAIL = :email, ROL = :rol, ESTADO = :estado WHERE ID_USUARIO = :id`,
      { nombre: d.nombre, email: d.email, rol: d.rol, estado: d.estado, id },
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

/** Deja una clave temporal: obliga a cambiarla y levanta cualquier bloqueo. */
export async function asignarClaveTemporal(id: number, passwordHash: string): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE SEG_USUARIOS
          SET PASSWORD_HASH = :hash, DEBE_CAMBIAR_CLAVE = 'S', FECHA_CLAVE = SYSTIMESTAMP,
              INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = NULL
        WHERE ID_USUARIO = :id`,
      { hash: passwordHash, id },
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

export async function desbloquearUsuario(id: number): Promise<void> {
  const conn = await getConnection();
  try {
    await conn.execute(`UPDATE SEG_USUARIOS SET INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = NULL WHERE ID_USUARIO = :id`, { id });
    await conn.commit();
  } finally {
    await conn.close();
  }
}

export interface BitacoraRow {
  ID_BITACORA: number;
  USERNAME: string | null;
  EVENTO: string;
  IP: string | null;
  USER_AGENT: string | null;
  DETALLE: string | null;
  FECHA: Date;
}

export async function listarBitacora(p: { search: string; offset: number; limit: number }): Promise<{ rows: BitacoraRow[]; total: number }> {
  const conn = await getConnection();
  try {
    const filtro = p.search
      ? `WHERE UPPER(NVL(USERNAME, ' ')) LIKE :q OR UPPER(EVENTO) LIKE :q OR UPPER(NVL(IP, ' ')) LIKE :q OR UPPER(NVL(DETALLE, ' ')) LIKE :q`
      : '';
    const binds: Record<string, string> = p.search ? { q: `%${p.search.toUpperCase()}%` } : {};
    const total = await conn.execute<{ N: number }>(`SELECT COUNT(*) AS N FROM SEG_BITACORA_ACCESO ${filtro}`, binds);
    const r = await conn.execute<BitacoraRow>(
      `SELECT ID_BITACORA, USERNAME, EVENTO, IP, USER_AGENT, DETALLE, FECHA
         FROM SEG_BITACORA_ACCESO ${filtro} ORDER BY FECHA DESC, ID_BITACORA DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...binds, offset: p.offset, limit: p.limit },
    );
    return { rows: r.rows ?? [], total: total.rows?.[0]?.N ?? 0 };
  } finally {
    await conn.close();
  }
}

