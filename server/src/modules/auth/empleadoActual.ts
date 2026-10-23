import type { Request } from 'express';
import { getConnection } from '../../config/database';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/AppError';

/**
 * Devuelve el ID_EMPLEADO ligado al usuario que inició sesión (SEG_USUARIOS.ID_EMPLEADO).
 * Se usa para registrar automáticamente quién crea un registro, en lugar de
 * pedirlo en el formulario. Se consulta en cada petición para respetar
 * cambios de asignación sin esperar a que expire el token.
 */
export async function empleadoDelUsuario(req: Request): Promise<number> {
  const idUsuario = req.auth?.sub;
  if (!idUsuario) throw new UnauthorizedError('Inicia sesión para continuar.');
  const conn = await getConnection();
  try {
    const r = await conn.execute<{ ID_EMPLEADO: number | null }>(
      'SELECT ID_EMPLEADO FROM SEG_USUARIOS WHERE ID_USUARIO = :id',
      { id: idUsuario },
    );
    const idEmpleado = r.rows?.[0]?.ID_EMPLEADO ?? null;
    if (!idEmpleado) {
      throw new BadRequestError(
        'Tu usuario no tiene un empleado asignado. Pide al administrador que lo asigne para poder registrar información.',
      );
    }
    return Number(idEmpleado);
  } finally {
    await conn.close();
  }
}

/** Copia el body agregando el empleado del usuario logueado en el campo indicado. */
export async function conEmpleadoActual<T extends object>(req: Request, campo = 'idEmpleado'): Promise<T & Record<string, number>> {
  const idEmpleado = await empleadoDelUsuario(req);
  return { ...(req.body ?? {}), [campo]: idEmpleado } as T & Record<string, number>;
}
