import { businessTodayIso } from '../../../../shared/date';
import { createMoraSchema, updateMoraSchema, type Mora } from '@erp/contracts';
import * as repository from '../../repositories/credito/mora.repository';
import * as documentoRepository from '../../repositories/documentos/documento.repository';
import { BadRequestError, NotFoundError } from '../../../../shared/errors/AppError';


async function assertDocumento(idDocumento: number, saldoVencido?: number | null) {
  const documento = await documentoRepository.findById(idDocumento);
  if (!documento) throw new BadRequestError('El documento seleccionado no existe');
  if (saldoVencido !== undefined && saldoVencido !== null && saldoVencido > documento.saldo) {
    throw new BadRequestError('El saldo vencido no puede superar el saldo actual del documento');
  }
}

export async function list(params: { page: number; limit: number; search?: string }) {
  return repository.findAll({ ...params, page: Math.max(1, params.page), limit: Math.min(100, Math.max(1, params.limit)) });
}

export async function getOne(id: number): Promise<Mora> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de mora inválido');
  const mora = await repository.findById(id);
  if (!mora) throw new NotFoundError(`Registro de mora ${id} no encontrado`);
  return mora;
}

export async function create(rawInput: unknown) {
  const input = createMoraSchema.parse(rawInput);
  if (input.fechaCalculo && input.fechaCalculo > businessTodayIso()) throw new BadRequestError('La fecha de cálculo no puede ser futura');
  await assertDocumento(input.idDocumento, input.saldoVencido);
  const id = await repository.create(input);
  return getOne(id);
}

export async function update(id: number, rawInput: unknown) {
  const current = await getOne(id);
  const input = updateMoraSchema.parse(rawInput);
  const fecha = input.fechaCalculo === undefined ? current.fechaCalculo?.slice(0, 10) : input.fechaCalculo;
  if (fecha && fecha > businessTodayIso()) throw new BadRequestError('La fecha de cálculo no puede ser futura');
  if (input.idDocumento !== undefined || input.saldoVencido !== undefined) {
    await assertDocumento(input.idDocumento ?? current.idDocumento, input.saldoVencido === undefined ? current.saldoVencido : input.saldoVencido);
  }
  await repository.update(id, input);
  return getOne(id);
}

export async function remove(id: number) {
  await getOne(id);
  await repository.remove(id);
}

export async function recalcular() {
  return repository.recalcularPendientes();
}
