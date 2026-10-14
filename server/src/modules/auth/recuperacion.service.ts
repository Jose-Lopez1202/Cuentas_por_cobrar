import { randomBytes } from 'crypto';
import { clavePermitida, recuperarClaveSchema, restablecerClaveSchema } from '@erp/contracts';
import { config } from '../../config';
import { logger } from '../../shared/logger';
import { BadRequestError, TooManyRequestsError, AppError } from '../../shared/errors/AppError';
import * as repo from './auth.repository';
import { olvidarSesiones, type ClientContext } from './auth.service';
import { enviarCorreoRecuperacion } from './mailer';
import { hashPassword } from './password';
import { RateLimiter } from './rateLimit';
import { hashSecret } from './tokens';

const porIp = new RateLimiter(15 * 60_000);
const porIdentificador = new RateLimiter(60 * 60_000);
const intentosToken = new RateLimiter(15 * 60_000);

const ENLACE_INVALIDO = 'El enlace de recuperación no es válido o ya venció. Solicita uno nuevo.';

function auditar(e: Parameters<typeof repo.registrarAcceso>[0]) {
  repo.registrarAcceso(e).catch((err) => logger.error('auth_bitacora_fallo', { error: err instanceof Error ? err.message : String(err) }));
}

/**
 * Siempre responde igual (exista o no la cuenta) y el trabajo real se hace DESPUÉS de responder:
 * así ni el mensaje ni el tiempo de respuesta revelan qué usuarios o correos existen.
 */
export async function solicitar(rawBody: unknown, ctx: ClientContext): Promise<void> {
  const parsed = recuperarClaveSchema.safeParse(rawBody);
  if (!parsed.success) throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Ingresa tu usuario o tu correo.');
  const identificador = parsed.data.identificador.toLowerCase();

  const ipKey = `rec:${ctx.ip ?? 'desconocida'}`;
  const espera = Math.max(porIp.retryAfter(ipKey, 5), porIdentificador.retryAfter(`rec:${identificador}`, 3));
  if (espera) throw new TooManyRequestsError('Hiciste demasiadas solicitudes. Espera unos minutos antes de intentarlo de nuevo.', espera);
  porIp.hit(ipKey);
  porIdentificador.hit(`rec:${identificador}`);

  void procesar(identificador, ctx).catch((err) =>
    logger.error('auth_recuperacion_fallo', { error: err instanceof Error ? err.message : String(err) }));
}

async function procesar(identificador: string, ctx: ClientContext): Promise<void> {
  const candidatos = await repo.buscarParaRecuperacion(identificador);
  // Si un correo lo comparten varias cuentas no se adivina cuál es: se pide ayuda a un administrador.
  if (candidatos.length !== 1) {
    auditar({ username: identificador.slice(0, 50), evento: 'RECUPERACION_SOLICITADA', ip: ctx.ip, userAgent: ctx.userAgent, detalle: candidatos.length ? 'Correo ambiguo' : 'Sin coincidencia' });
    return;
  }
  const u = candidatos[0];
  const secreto = randomBytes(32).toString('base64url');
  await repo.crearTokenRecuperacion(u.ID_USUARIO, hashSecret(secreto), config.auth.recoveryTtlMinutes, ctx.ip);
  auditar({ idUsuario: u.ID_USUARIO, username: u.USERNAME, evento: 'RECUPERACION_SOLICITADA', ip: ctx.ip, userAgent: ctx.userAgent });
  await enviarCorreoRecuperacion({ email: u.EMAIL, nombre: u.NOMBRE }, `${config.appUrl}/restablecer-clave?token=${secreto}`, config.auth.recoveryTtlMinutes);
}

function limitarIntentos(ctx: ClientContext) {
  const key = `rectoken:${ctx.ip ?? 'desconocida'}`;
  const espera = intentosToken.retryAfter(key, 20);
  if (espera) throw new TooManyRequestsError('Demasiados intentos. Espera unos minutos.', espera);
  intentosToken.hit(key);
}

export async function verificarEnlace(token: unknown, ctx: ClientContext): Promise<{ valido: boolean }> {
  limitarIntentos(ctx);
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return { valido: false };
  return { valido: await repo.tokenRecuperacionValido(hashSecret(token)) };
}

export async function restablecer(rawBody: unknown, ctx: ClientContext): Promise<void> {
  limitarIntentos(ctx);
  const parsed = restablecerClaveSchema.safeParse(rawBody);
  if (!parsed.success) throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
  const { token, claveNueva } = parsed.data;
  const tokenHash = hashSecret(token);

  if (!(await repo.tokenRecuperacionValido(tokenHash))) throw new AppError(ENLACE_INVALIDO, 400, 'RECOVERY_LINK_INVALID');

  // La política se valida ANTES de gastar el enlace: una clave débil no lo quema.
  const candidatos = await repo.findUsuarioPorToken(tokenHash);
  if (!candidatos) throw new AppError(ENLACE_INVALIDO, 400, 'RECOVERY_LINK_INVALID');
  if (!clavePermitida(claveNueva, candidatos.USERNAME)) throw new BadRequestError('La contraseña nueva no cumple los requisitos de seguridad.');

  const idUsuario = await repo.consumirTokenRecuperacion(tokenHash);
  if (!idUsuario) throw new AppError(ENLACE_INVALIDO, 400, 'RECOVERY_LINK_INVALID');

  await repo.actualizarClave(idUsuario, await hashPassword(claveNueva));
  // Si alguien más tenía la clave anterior (o una sesión abierta), queda fuera.
  olvidarSesiones(await repo.revocarSesionesDeUsuario(idUsuario, 'CLAVE_RECUPERADA'));
  auditar({ idUsuario, username: candidatos.USERNAME, evento: 'CLAVE_RECUPERADA', ip: ctx.ip, userAgent: ctx.userAgent });
}
