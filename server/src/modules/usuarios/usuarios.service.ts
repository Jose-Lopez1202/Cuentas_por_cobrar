import {
  buildPaginationMeta, crearUsuarioSchema, editarUsuarioSchema,
  type BitacoraAcceso, type PaginatedResponse, type UsuarioAdmin, type UsuarioCreado,
} from '@erp/contracts';
import type { ZodError } from 'zod';
import { AppError, BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import * as authRepo from '../auth/auth.repository';
import { olvidarSesiones, type ClientContext } from '../auth/auth.service';
import { generarClaveTemporal, hashPassword } from '../auth/password';
import type { AccessClaims } from '../auth/tokens';
import * as repo from './usuarios.repository';

const aUsuario = (r: repo.UsuarioAdminRow): UsuarioAdmin => ({
  idUsuario: r.ID_USUARIO,
  username: r.USERNAME,
  nombre: r.NOMBRE,
  email: r.EMAIL,
  rol: r.ROL,
  estado: r.ESTADO,
  debeCambiarClave: r.DEBE_CAMBIAR_CLAVE === 'S',
  minutosBloqueo: r.MIN_BLOQUEO,
  intentosFallidos: r.INTENTOS_FALLIDOS,
  sesionesActivas: r.SESIONES_ACTIVAS,
  ultimoLogin: r.ULTIMO_LOGIN ? r.ULTIMO_LOGIN.toISOString() : null,
  fechaCreacion: r.FECHA_CREACION.toISOString(),
});

/** Errores de validación por campo: el formulario los muestra en rojo bajo cada input. */
function validacion(err: ZodError): AppError {
  const details = err.issues.map((i) => ({ campo: String(i.path[0] ?? 'general'), mensaje: i.message }));
  return new AppError(details[0]?.mensaje ?? 'Datos inválidos', 400, 'VALIDATION_ERROR', true, details);
}

const campoInvalido = (campo: string, mensaje: string) =>
  new AppError(mensaje, 400, 'VALIDATION_ERROR', true, [{ campo, mensaje }]);

function auditar(actor: AccessClaims, evento: authRepo.EventoAcceso, objetivo: { id: number; username: string }, ctx: ClientContext, detalle?: string) {
  // La bitácora de administración guarda al usuario AFECTADO en ID_USUARIO/USERNAME y quién actuó en DETALLE.
  authRepo.registrarAcceso({
    idUsuario: objetivo.id, username: objetivo.username, evento, ip: ctx.ip, userAgent: ctx.userAgent,
    detalle: `Por ${actor.usr}${detalle ? `: ${detalle}` : ''}`,
  }).catch(() => undefined);
}

const paginar = (page: unknown, limit: unknown) => {
  const l = Math.min(100, Math.max(1, Number(limit) || 10));
  const p = Math.max(1, Number(page) || 1);
  return { page: p, limit: l, offset: (p - 1) * l };
};

async function existente(id: number): Promise<repo.UsuarioAdminRow> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('Identificador de usuario no válido.');
  const u = await repo.obtenerUsuarioAdmin(id);
  if (!u) throw new NotFoundError('El usuario no existe.');
  return u;
}

export async function listar(q: { page?: unknown; limit?: unknown; search?: unknown }): Promise<PaginatedResponse<UsuarioAdmin>> {
  const { page, limit, offset } = paginar(q.page, q.limit);
  const { rows, total } = await repo.listarUsuarios({ search: String(q.search ?? '').trim().slice(0, 60), offset, limit });
  return { data: rows.map(aUsuario), meta: buildPaginationMeta(total, page, limit) };
}

export async function crear(body: unknown, actor: AccessClaims, ctx: ClientContext): Promise<UsuarioCreado> {
  const parsed = crearUsuarioSchema.safeParse(body);
  if (!parsed.success) throw validacion(parsed.error);
  const { username, nombre, rol } = parsed.data;
  const email = parsed.data.email?.trim() || null;

  if (await authRepo.findUsuarioByUsername(username)) {
    throw campoInvalido('username', `Ya existe un usuario "${username}". Elige otro nombre de usuario.`);
  }

  const claveTemporal = generarClaveTemporal();
  const id = await authRepo.crearUsuario({ username, nombre, email, rol, passwordHash: await hashPassword(claveTemporal) });
  auditar(actor, 'USUARIO_CREADO', { id, username }, ctx, `rol ${rol}`);
  return { usuario: aUsuario(await existente(id)), claveTemporal };
}

export async function editar(id: number, body: unknown, actor: AccessClaims, ctx: ClientContext): Promise<UsuarioAdmin> {
  const parsed = editarUsuarioSchema.safeParse(body);
  if (!parsed.success) throw validacion(parsed.error);
  const actual = await existente(id);
  const { nombre, rol, estado } = parsed.data;
  const email = parsed.data.email?.trim() || null;

  const pierdeAdmin = actual.ROL === 'ADMIN' && actual.ESTADO === 'ACTIVO' && (rol !== 'ADMIN' || estado !== 'ACTIVO');
  if (pierdeAdmin) {
    const campo = rol !== 'ADMIN' ? 'rol' : 'estado';
    if (id === actor.sub) {
      throw campoInvalido(campo, 'No puedes quitarte a ti mismo el rol de administrador ni desactivar tu propia cuenta. Pídelo a otro administrador.');
    }
    if ((await repo.contarAdminsActivos(id)) === 0) {
      throw campoInvalido(campo, 'Debe quedar al menos un administrador activo en el sistema.');
    }
  }

  await repo.actualizarUsuario(id, { nombre, email, rol, estado });

  // Cambiar el rol o desactivar la cuenta cierra sus sesiones: el cambio rige de inmediato.
  if (rol !== actual.ROL || estado !== actual.ESTADO) {
    olvidarSesiones(await authRepo.revocarSesionesDeUsuario(id, estado !== 'ACTIVO' ? 'USUARIO_INACTIVO' : 'CAMBIO_ROL'));
  }
  const cambios = [
    rol !== actual.ROL ? `rol ${actual.ROL} a ${rol}` : '',
    estado !== actual.ESTADO ? `estado ${actual.ESTADO} a ${estado}` : '',
  ].filter(Boolean).join(', ');
  auditar(actor, 'USUARIO_MODIFICADO', { id, username: actual.USERNAME }, ctx, cambios || 'datos generales');
  return aUsuario(await existente(id));
}

export async function restablecerClave(id: number, actor: AccessClaims, ctx: ClientContext): Promise<{ claveTemporal: string }> {
  const u = await existente(id);
  if (id === actor.sub) {
    throw new BadRequestError('Para cambiar tu propia contraseña usa la opción "Cambiar contraseña" del menú lateral.');
  }
  if (u.ESTADO !== 'ACTIVO') throw new BadRequestError('El usuario está inactivo. Actívalo antes de restablecer su contraseña.');

  const claveTemporal = generarClaveTemporal();
  await repo.asignarClaveTemporal(id, await hashPassword(claveTemporal));
  olvidarSesiones(await authRepo.revocarSesionesDeUsuario(id, 'CLAVE_RESTABLECIDA'));
  auditar(actor, 'CLAVE_RESTABLECIDA', { id, username: u.USERNAME }, ctx);
  return { claveTemporal };
}

export async function desbloquear(id: number, actor: AccessClaims, ctx: ClientContext): Promise<UsuarioAdmin> {
  const u = await existente(id);
  if (u.MIN_BLOQUEO <= 0 && u.INTENTOS_FALLIDOS === 0) throw new BadRequestError('La cuenta no está bloqueada.');
  await repo.desbloquearUsuario(id);
  auditar(actor, 'USUARIO_DESBLOQUEADO', { id, username: u.USERNAME }, ctx);
  return aUsuario(await existente(id));
}

export async function cerrarSesiones(id: number, actor: AccessClaims, ctx: ClientContext): Promise<{ cerradas: number }> {
  const u = await existente(id);
  const ids = await authRepo.revocarSesionesDeUsuario(id, 'CERRADA_POR_ADMIN');
  olvidarSesiones(ids);
  auditar(actor, 'SESIONES_CERRADAS', { id, username: u.USERNAME }, ctx, `${ids.length} sesión(es)`);
  return { cerradas: ids.length };
}

export async function bitacora(q: { page?: unknown; limit?: unknown; search?: unknown }): Promise<PaginatedResponse<BitacoraAcceso>> {
  const { page, limit, offset } = paginar(q.page, q.limit);
  const { rows, total } = await repo.listarBitacora({ search: String(q.search ?? '').trim().slice(0, 60), offset, limit });
  return {
    data: rows.map((r) => ({
      idBitacora: r.ID_BITACORA, username: r.USERNAME, evento: r.EVENTO, ip: r.IP, userAgent: r.USER_AGENT,
      detalle: r.DETALLE, fecha: r.FECHA.toISOString(),
    })),
    meta: buildPaginationMeta(total, page, limit),
  };
}
