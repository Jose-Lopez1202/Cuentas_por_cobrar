import { randomUUID } from 'crypto';
import {
  cambiarClaveSchema,
  clavePermitida,
  loginSchema,
  type SesionRespuesta,
  type UsuarioSesion,
} from '@erp/contracts';
import { config } from '../../config';
import { logger } from '../../shared/logger';
import { BadRequestError, TooManyRequestsError, UnauthorizedError } from '../../shared/errors/AppError';
import * as repo from './auth.repository';
import { hashPassword, verifyDecoy, verifyPassword } from './password';
import { RateLimiter } from './rateLimit';
import {
  buildRefreshToken, hashSecret, newRefreshSecret, parseRefreshToken, safeEqualHex, signAccessToken, type AccessClaims,
} from './tokens';

export interface ClientContext { ip: string | null; userAgent: string | null }

export interface ResultadoSesion {
  respuesta: SesionRespuesta;
  /** Valor de la cookie de renovación (null = no tocarla). */
  refreshToken: string | null;
  refreshMaxAgeSeconds: number;
}

const VENTANA = 15 * 60_000;
const porIp = new RateLimiter(VENTANA);
const porUsuario = new RateLimiter(VENTANA);
const MAX_INTENTOS_IP = 30;
const MAX_INTENTOS_USUARIO = 8;

// Caché corta de "la sesión sigue activa" para no ir a la BD en cada petición.
const cacheSesiones = new Map<string, number>();
const CACHE_MS = 15_000;

export async function sesionVigente(sid: string): Promise<boolean> {
  const hasta = cacheSesiones.get(sid);
  if (hasta && hasta > Date.now()) return true;
  const ok = await repo.sesionActiva(sid);
  if (ok) cacheSesiones.set(sid, Date.now() + CACHE_MS);
  else cacheSesiones.delete(sid);
  return ok;
}

export const olvidarSesiones = (ids: string[]) => ids.forEach((id) => cacheSesiones.delete(id));

/** Una falla de bitácora jamás debe impedir iniciar o cerrar sesión. */
function auditar(e: Parameters<typeof repo.registrarAcceso>[0]) {
  repo.registrarAcceso(e).catch((err) => logger.error('auth_bitacora_fallo', { error: err instanceof Error ? err.message : String(err) }));
}

const aSesion = (u: repo.UsuarioRow): UsuarioSesion => ({
  idUsuario: u.ID_USUARIO,
  username: u.USERNAME,
  nombre: u.NOMBRE,
  rol: u.ROL,
  debeCambiarClave: u.DEBE_CAMBIAR_CLAVE === 'S',
});

function emitirAccess(u: repo.UsuarioRow, sid: string): SesionRespuesta {
  const claims: AccessClaims = { sub: u.ID_USUARIO, usr: u.USERNAME, nom: u.NOMBRE, rol: u.ROL, sid, dcc: u.DEBE_CAMBIAR_CLAVE === 'S' };
  const { token, expiresIn } = signAccessToken(claims);
  return { accessToken: token, expiresIn, usuario: aSesion(u) };
}

const refreshMaxAge = () => config.auth.sessionMaxHours * 3600;

export async function login(rawBody: unknown, ctx: ClientContext): Promise<ResultadoSesion> {
  const parsed = loginSchema.safeParse(rawBody);
  if (!parsed.success) throw new BadRequestError('Ingresa tu usuario y tu contraseña.');
  const { username, password } = parsed.data;
  const clave = username.toLowerCase();
  const ipKey = `ip:${ctx.ip ?? 'desconocida'}`;
  const userKey = `user:${clave}`;

  // Límite por IP (cualquier intento) y por usuario (solo fallos). La respuesta es la
  // misma exista o no el usuario, para no revelar qué cuentas existen.
  const esperaIp = porIp.retryAfter(ipKey, MAX_INTENTOS_IP);
  const esperaUser = porUsuario.retryAfter(userKey, MAX_INTENTOS_USUARIO);
  if (esperaIp || esperaUser) {
    auditar({ username, evento: 'LOGIN_BLOQUEADO', ip: ctx.ip, userAgent: ctx.userAgent, detalle: 'Límite de intentos' });
    throw new TooManyRequestsError('Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.', Math.max(esperaIp, esperaUser));
  }
  porIp.hit(ipKey);

  const usuario = await repo.findUsuarioByUsername(username);

  if (!usuario) {
    await verifyDecoy(password);
    porUsuario.hit(userKey);
    auditar({ username, evento: 'LOGIN_FALLIDO', ip: ctx.ip, userAgent: ctx.userAgent, detalle: 'Usuario inexistente' });
    throw new UnauthorizedError('Usuario o contraseña incorrectos.');
  }

  if (usuario.MIN_BLOQUEO > 0) {
    auditar({ idUsuario: usuario.ID_USUARIO, username, evento: 'LOGIN_BLOQUEADO', ip: ctx.ip, userAgent: ctx.userAgent, detalle: 'Cuenta bloqueada' });
    throw new TooManyRequestsError('Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.', usuario.MIN_BLOQUEO * 60);
  }

  const correcta = await verifyPassword(password, usuario.PASSWORD_HASH);
  if (!correcta || usuario.ESTADO !== 'ACTIVO') {
    porUsuario.hit(userKey);
    if (usuario.ESTADO === 'ACTIVO') {
      const bloqueada = await repo.registrarIntentoFallido(usuario.ID_USUARIO, config.auth.maxFailedAttempts, config.auth.lockMinutes);
      auditar({
        idUsuario: usuario.ID_USUARIO, username, evento: bloqueada ? 'CUENTA_BLOQUEADA' : 'LOGIN_FALLIDO',
        ip: ctx.ip, userAgent: ctx.userAgent, detalle: bloqueada ? `Bloqueada ${config.auth.lockMinutes} min` : 'Contraseña incorrecta',
      });
    } else {
      auditar({ idUsuario: usuario.ID_USUARIO, username, evento: 'LOGIN_FALLIDO', ip: ctx.ip, userAgent: ctx.userAgent, detalle: 'Cuenta inactiva' });
    }
    throw new UnauthorizedError('Usuario o contraseña incorrectos.');
  }

  await repo.registrarLoginExitoso(usuario.ID_USUARIO);
  porUsuario.reset(userKey);

  const sid = randomUUID();
  const secreto = newRefreshSecret();
  await repo.crearSesion({
    idSesion: sid, idUsuario: usuario.ID_USUARIO, tokenHash: hashSecret(secreto),
    maxHoras: config.auth.sessionMaxHours, ip: ctx.ip, userAgent: ctx.userAgent,
  });
  auditar({ idUsuario: usuario.ID_USUARIO, username: usuario.USERNAME, evento: 'LOGIN_OK', ip: ctx.ip, userAgent: ctx.userAgent });
  logger.info('auth_login_ok', { idUsuario: usuario.ID_USUARIO });

  return { respuesta: emitirAccess(usuario, sid), refreshToken: buildRefreshToken(sid, secreto), refreshMaxAgeSeconds: refreshMaxAge() };
}

export async function refresh(rawCookie: string | undefined, ctx: ClientContext): Promise<ResultadoSesion> {
  const token = parseRefreshToken(rawCookie);
  if (!token) throw new UnauthorizedError('Tu sesión no es válida. Inicia sesión de nuevo.', 'SESSION_INVALID');

  const ipKey = `refresh:${ctx.ip ?? 'desconocida'}`;
  if (porIp.retryAfter(ipKey, 120)) throw new TooManyRequestsError('Demasiadas solicitudes. Espera un momento.', 60);
  porIp.hit(ipKey);

  const nuevoSecreto = newRefreshSecret();
  const r = await repo.rotarSesion(token.idSesion, hashSecret(token.secret), hashSecret(nuevoSecreto), config.auth.sessionIdleMinutes, safeEqualHex);

  if (r.estado === 'reuso') {
    // Un token ya usado reapareció: alguien lo copió. Se cierran todas las sesiones del usuario.
    olvidarSesiones(await repo.revocarSesionesDeUsuario(r.idUsuario!, 'REUSO_TOKEN'));
    cacheSesiones.delete(token.idSesion);
    auditar({ idUsuario: r.idUsuario, evento: 'REFRESH_REUSO', ip: ctx.ip, userAgent: ctx.userAgent, detalle: 'Token de renovación reutilizado' });
    logger.warn('auth_refresh_reuso', { idUsuario: r.idUsuario });
    throw new UnauthorizedError('Tu sesión fue cerrada por seguridad. Inicia sesión de nuevo.', 'SESSION_INVALID');
  }
  if (r.estado !== 'ok') {
    cacheSesiones.delete(token.idSesion);
    if (r.idUsuario) auditar({ idUsuario: r.idUsuario, evento: 'SESION_EXPIRADA', ip: ctx.ip, userAgent: ctx.userAgent });
    throw new UnauthorizedError('Tu sesión expiró. Inicia sesión de nuevo.', 'SESSION_INVALID');
  }

  const usuario = await repo.findUsuarioById(r.idUsuario);
  if (!usuario || usuario.ESTADO !== 'ACTIVO') {
    await repo.revocarSesion(token.idSesion, 'USUARIO_INACTIVO');
    cacheSesiones.delete(token.idSesion);
    throw new UnauthorizedError('Tu sesión no es válida. Inicia sesión de nuevo.', 'SESSION_INVALID');
  }

  return { respuesta: emitirAccess(usuario, token.idSesion), refreshToken: buildRefreshToken(token.idSesion, nuevoSecreto), refreshMaxAgeSeconds: refreshMaxAge() };
}

export async function logout(claims: AccessClaims | null, rawCookie: string | undefined, ctx: ClientContext): Promise<void> {
  const token = parseRefreshToken(rawCookie);
  const sid = token?.idSesion ?? claims?.sid;
  if (!sid) return;
  await repo.revocarSesion(sid, 'LOGOUT');
  cacheSesiones.delete(sid);
  if (claims) auditar({ idUsuario: claims.sub, username: claims.usr, evento: 'LOGOUT', ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function cambiarClave(claims: AccessClaims, rawBody: unknown, ctx: ClientContext): Promise<ResultadoSesion> {
  const parsed = cambiarClaveSchema.safeParse(rawBody);
  if (!parsed.success) throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  const { claveActual, claveNueva } = parsed.data;

  const usuario = await repo.findUsuarioById(claims.sub);
  if (!usuario || usuario.ESTADO !== 'ACTIVO') throw new UnauthorizedError('Tu sesión no es válida.', 'SESSION_INVALID');

  const ipKey = `clave:${claims.sub}`;
  if (porUsuario.retryAfter(ipKey, 5)) throw new TooManyRequestsError('Demasiados intentos. Espera unos minutos.', 300);

  if (!(await verifyPassword(claveActual, usuario.PASSWORD_HASH))) {
    porUsuario.hit(ipKey);
    throw new UnauthorizedError('La contraseña actual no es correcta.', 'WRONG_PASSWORD');
  }
  porUsuario.reset(ipKey);
  if (claveActual === claveNueva) throw new BadRequestError('La contraseña nueva debe ser distinta de la actual.');
  if (!clavePermitida(claveNueva, usuario.USERNAME)) throw new BadRequestError('La contraseña nueva no cumple los requisitos de seguridad.');

  await repo.actualizarClave(usuario.ID_USUARIO, await hashPassword(claveNueva));
  // Cierra las demás sesiones: si alguien más tenía la clave anterior, queda fuera.
  olvidarSesiones(await repo.revocarSesionesDeUsuario(usuario.ID_USUARIO, 'CAMBIO_CLAVE', claims.sid));
  auditar({ idUsuario: usuario.ID_USUARIO, username: usuario.USERNAME, evento: 'CAMBIO_CLAVE', ip: ctx.ip, userAgent: ctx.userAgent });

  const actualizado = (await repo.findUsuarioById(usuario.ID_USUARIO))!;
  // Se rota el token de renovación para que la sesión actual siga con un secreto nuevo.
  const secreto = newRefreshSecret();
  const rot = await repo.rotarSesionForzada(claims.sid, hashSecret(secreto));
  if (!rot) throw new UnauthorizedError('Tu sesión no es válida.', 'SESSION_INVALID');
  return { respuesta: emitirAccess(actualizado, claims.sid), refreshToken: buildRefreshToken(claims.sid, secreto), refreshMaxAgeSeconds: refreshMaxAge() };
}

export async function me(claims: AccessClaims): Promise<UsuarioSesion> {
  const usuario = await repo.findUsuarioById(claims.sub);
  if (!usuario || usuario.ESTADO !== 'ACTIVO') throw new UnauthorizedError('Tu sesión no es válida.', 'SESSION_INVALID');
  return aSesion(usuario);
}
