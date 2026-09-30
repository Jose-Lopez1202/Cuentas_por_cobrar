import { businessTodayIso } from '../../../../shared/date';
import {
  createReciboSchema,
  updateReciboSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type Recibo,
} from '@erp/contracts';
import * as repository from '../../repositories/pagos/recibo.repository';
import * as pagoRepository from '../../repositories/pagos/pago.repository';
import { BadRequestError, NotFoundError } from '../../../../shared/errors/AppError';


export async function listRecibos(q: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<Recibo>> {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const { data, total } = await repository.findAll({ page, limit, search: q.search });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getRecibo(id: number): Promise<Recibo> {
  const item = await repository.findById(id);
  if (!item) throw new NotFoundError(`Recibo ${id} no encontrado`);
  return item;
}

async function assertPagoCliente(idPago: number, idCliente: number, monto: number) {
  const pago = await pagoRepository.findById(idPago);
  if (!pago) throw new BadRequestError('El pago seleccionado no existe');
  if (pago.idCliente !== idCliente) {
    throw new BadRequestError('El recibo y el pago deben pertenecer al mismo cliente');
  }
  if (monto > pago.monto) {
    throw new BadRequestError('El monto del recibo no puede superar el monto del pago');
  }
}

export async function createRecibo(raw: unknown): Promise<Recibo> {
  const input = createReciboSchema.parse(raw);
  if (input.fecha > businessTodayIso()) throw new BadRequestError('La fecha del recibo no puede ser futura');
  await assertPagoCliente(input.idPago, input.idCliente, input.monto);
  const id = await repository.create(input);
  return getRecibo(id);
}

export async function updateRecibo(id: number, raw: unknown): Promise<Recibo> {
  const current = await getRecibo(id);
  const input = updateReciboSchema.parse(raw);
  const finalFecha = input.fecha ?? current.fecha.slice(0, 10);
  if (finalFecha > businessTodayIso()) throw new BadRequestError('La fecha del recibo no puede ser futura');
  const idPago = input.idPago ?? current.idPago;
  const idCliente = input.idCliente ?? current.idCliente;
  const monto = input.monto ?? current.monto;
  await assertPagoCliente(idPago, idCliente, monto);
  await repository.update(id, input);
  return getRecibo(id);
}

export async function deleteRecibo(id: number): Promise<void> {
  await getRecibo(id);
  await repository.remove(id);
}
