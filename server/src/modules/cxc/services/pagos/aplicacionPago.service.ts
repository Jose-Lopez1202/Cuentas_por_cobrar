import {
  createAplicacionPagoSchema,
  reversarAplicacionPagoSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type AplicacionPago,
} from '@erp/contracts';
import { businessTodayIso } from '../../../../shared/date';
import * as repository from '../../repositories/pagos/aplicacionPago.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';

export async function listAplicacionesPago(q: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<AplicacionPago>> {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const { data, total } = await repository.findAll({ page, limit, search: q.search });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getAplicacionPago(id: number): Promise<AplicacionPago> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de aplicación inválido');
  const item = await repository.findById(id);
  if (!item) throw new NotFoundError(`Aplicación de pago ${id} no encontrada`);
  return item;
}

export async function createAplicacionPago(raw: unknown): Promise<AplicacionPago> {
  const input = createAplicacionPagoSchema.parse(raw);
  if (input.fechaAplicacion > businessTodayIso()) {
    throw new BadRequestError('La fecha de aplicación no puede ser futura');
  }
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleado))) {
    throw new BadRequestError('El empleado seleccionado no existe');
  }

  // repository.create ejecuta la operación completa en una única transacción
  // y bloquea pago/documento para evitar sobre-aplicaciones concurrentes.
  const id = await repository.create(input);
  return getAplicacionPago(id);
}

export async function updateAplicacionPago(_id: number, _raw: unknown): Promise<AplicacionPago> {
  throw new ConflictError(
    'Una aplicación confirmada no se edita. Para corregirla, reversa la aplicación y regístrala de nuevo.',
  );
}

export async function deleteAplicacionPago(_id: number): Promise<void> {
  throw new ConflictError(
    'Una aplicación confirmada no se elimina físicamente. Debe reversarse para conservar trazabilidad.',
  );
}

export async function reversarAplicacionPago(id: number, rawInput: unknown): Promise<AplicacionPago> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de aplicación inválido');
  const input = reversarAplicacionPagoSchema.parse(rawInput);
  if (input.fechaReversa && input.fechaReversa > businessTodayIso()) {
    throw new BadRequestError('La fecha de reversa no puede ser futura');
  }
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleadoReversa))) {
    throw new BadRequestError('El empleado seleccionado no existe');
  }

  // repository.reversar() vuelve a validar todo (estado CONFIRMADA, documento
  // no anulado) bajo FOR UPDATE, con datos frescos.
  await repository.reversar(id, input);
  return getAplicacionPago(id);
}
