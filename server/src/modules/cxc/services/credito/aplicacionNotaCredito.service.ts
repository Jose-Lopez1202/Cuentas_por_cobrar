import { businessTodayIso } from '../../../../shared/date';
import {
  createAplicacionNotaCreditoSchema,
  reversarAplicacionNotaCreditoSchema,
  type AplicacionNotaCredito,
} from '@erp/contracts';
import * as repository from '../../repositories/credito/aplicacionNotaCredito.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';

export async function list(params: { page: number; limit: number; search?: string }) {
  return repository.findAll({
    ...params,
    page: Math.max(1, params.page),
    limit: Math.min(100, Math.max(1, params.limit)),
  });
}

export async function getOne(id: number): Promise<AplicacionNotaCredito> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de aplicación inválido');
  const aplicacion = await repository.findById(id);
  if (!aplicacion) throw new NotFoundError(`Aplicación de nota de crédito ${id} no encontrada`);
  return aplicacion;
}

export async function create(rawInput: unknown) {
  const input = createAplicacionNotaCreditoSchema.parse(rawInput);
  if (input.fechaAplicacion > businessTodayIso()) {
    throw new BadRequestError('La fecha de aplicación no puede ser futura');
  }
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleado))) {
    throw new BadRequestError('El empleado seleccionado no existe');
  }

  const id = await repository.create(input);
  return getOne(id);
}

export async function update(_id: number, _rawInput: unknown) {
  throw new ConflictError(
    'Una aplicación de nota de crédito confirmada no se edita. Para corregirla, reversa la aplicación y regístrala de nuevo.',
  );
}

export async function remove(_id: number) {
  throw new ConflictError(
    'Una aplicación de nota de crédito confirmada no se elimina físicamente. Debe reversarse para conservar trazabilidad.',
  );
}

export async function reversar(id: number, rawInput: unknown): Promise<AplicacionNotaCredito> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de aplicación inválido');
  const input = reversarAplicacionNotaCreditoSchema.parse(rawInput);
  if (input.fechaReversa && input.fechaReversa > businessTodayIso()) {
    throw new BadRequestError('La fecha de reversa no puede ser futura');
  }
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleadoReversa))) {
    throw new BadRequestError('El empleado seleccionado no existe');
  }

  await repository.reversar(id, input);
  return getOne(id);
}
