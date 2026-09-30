import { businessTodayIso } from '../../../../shared/date';
import {
  createNotaCreditoSchema,
  updateNotaCreditoSchema,
  anularNotaCreditoSchema,
  type NotaCredito,
} from '@erp/contracts';
import * as repository from '../../repositories/credito/notaCredito.repository';
import * as documentoRepository from '../../repositories/documentos/documento.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
import { isDocumentoBloqueadoParaAplicacion } from '../../shared/financialRules';

async function assertDocumentoReferencia(idCliente: number, idDocumento: number | null | undefined, monto: number) {
  if (!idDocumento) return;
  const documento = await documentoRepository.findById(idDocumento);
  if (!documento) throw new BadRequestError('El documento de referencia no existe');
  if (documento.idCliente !== idCliente) throw new BadRequestError('El documento de referencia debe pertenecer al cliente seleccionado');
  if (documento.saldo <= 0) throw new BadRequestError('El documento de referencia ya no tiene saldo pendiente');
  if (monto > documento.saldo) throw new BadRequestError('El monto de la nota no puede superar el saldo del documento de referencia');
  if (isDocumentoBloqueadoParaAplicacion(documento.estado)) {
    throw new ConflictError('No se puede registrar una nota contra un documento pagado o anulado.');
  }
}

export async function list(params: { page: number; limit: number; search?: string }) {
  return repository.findAll({
    ...params,
    page: Math.max(1, params.page),
    limit: Math.min(100, Math.max(1, params.limit)),
  });
}

export async function getOne(id: number): Promise<NotaCredito> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de nota de crédito inválido');
  const nota = await repository.findById(id);
  if (!nota) throw new NotFoundError(`Nota de crédito ${id} no encontrada`);
  return nota;
}

export async function create(rawInput: unknown) {
  const input = createNotaCreditoSchema.parse(rawInput);
  if (input.fecha > businessTodayIso()) throw new BadRequestError('La fecha de la nota de crédito no puede ser futura');
  await assertDocumentoReferencia(input.idCliente, input.idDocumentoReferencia, input.monto);
  const id = await repository.create(input);
  return getOne(id);
}

export async function update(id: number, rawInput: unknown) {
  const current = await getOne(id);
  const input = updateNotaCreditoSchema.parse(rawInput);
  const finalFecha = input.fecha ?? current.fecha.slice(0, 10);
  if (finalFecha > businessTodayIso()) throw new BadRequestError('La fecha de la nota de crédito no puede ser futura');

  if (input.idCliente !== undefined || input.idDocumentoReferencia !== undefined || input.monto !== undefined) {
    await assertDocumentoReferencia(
      input.idCliente ?? current.idCliente,
      input.idDocumentoReferencia === undefined ? current.idDocumentoReferencia : input.idDocumentoReferencia,
      input.monto ?? current.monto,
    );
  }

  // repository.update() bloquea la fila (FOR UPDATE) y revalida bajo esa
  // misma conexión que la nota sigue sin aplicaciones: una lectura suelta
  // aquí (como antes) quedaría obsoleta frente a una aplicación concurrente.
  await repository.update(id, input);
  return getOne(id);
}

export async function remove(id: number) {
  await getOne(id);
  // repository.remove() bloquea la fila, revalida aplicaciones y estado bajo
  // FOR UPDATE antes de borrar.
  await repository.remove(id);
}

export async function anular(id: number, rawInput: unknown): Promise<NotaCredito> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de nota de crédito inválido');
  const input = anularNotaCreditoSchema.parse(rawInput);
  if (input.fechaAnulacion && input.fechaAnulacion > businessTodayIso()) {
    throw new BadRequestError('La fecha de anulación no puede ser futura');
  }
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleadoAnulacion))) {
    throw new BadRequestError('El empleado seleccionado no existe');
  }

  await repository.anular(id, input);
  return getOne(id);
}
