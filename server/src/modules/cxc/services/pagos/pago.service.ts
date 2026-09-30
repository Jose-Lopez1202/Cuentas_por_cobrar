import { businessTodayIso } from '../../../../shared/date';
import {
  createPagoSchema,
  updatePagoSchema,
  anularPagoSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type Pago,
} from '@erp/contracts';
import * as repository from '../../repositories/pagos/pago.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';
import { BadRequestError, NotFoundError } from '../../../../shared/errors/AppError';

async function assertCatalogos(
  idCliente: number,
  idFormaPago: number,
  idMoneda: number,
  numeroReferencia?: string | null,
  idBanco?: number | null,
) {
  const [clienteOk, formas, monedas, bancoOk] = await Promise.all([
    catalogosRepository.clienteExiste(idCliente),
    catalogosRepository.listFormasPagoActivas(),
    catalogosRepository.listMonedas(),
    idBanco ? catalogosRepository.bancoExiste(idBanco) : Promise.resolve(true),
  ]);
  if (!clienteOk) throw new BadRequestError('El cliente seleccionado no existe');
  const forma = formas.find((x) => x.id === idFormaPago);
  if (!forma) throw new BadRequestError('La forma de pago no existe o está inactiva');
  if (!monedas.some((x) => x.id === idMoneda)) throw new BadRequestError('La moneda seleccionada no existe');
  if (idBanco && !bancoOk) throw new BadRequestError('El banco seleccionado no existe o está inactivo');
  if (forma.requiereReferencia && !numeroReferencia) {
    throw new BadRequestError(`${forma.label} requiere un número de referencia`);
  }
}

export async function listPagos(q: { page?: string; limit?: string; search?: string }): Promise<PaginatedResponse<Pago>> {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const { data, total } = await repository.findAll({ page, limit, search: q.search });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getPago(id: number): Promise<Pago> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de pago inválido');
  const item = await repository.findById(id);
  if (!item) throw new NotFoundError(`Pago ${id} no encontrado`);
  return item;
}

export async function createPago(raw: unknown): Promise<Pago> {
  const input = createPagoSchema.parse(raw);
  if (input.fechaPago > businessTodayIso()) throw new BadRequestError('La fecha de pago no puede ser futura');
  await assertCatalogos(input.idCliente, input.idFormaPago, input.idMoneda, input.numeroReferencia, input.idBanco);
  const id = await repository.create(input);
  return getPago(id);
}

export async function updatePago(id: number, raw: unknown): Promise<Pago> {
  const current = await getPago(id);
  const input = updatePagoSchema.parse(raw);
  const final = {
    idCliente: input.idCliente ?? current.idCliente,
    idFormaPago: input.idFormaPago ?? current.idFormaPago,
    idMoneda: input.idMoneda ?? current.idMoneda,
    idBanco: input.idBanco === undefined ? current.idBanco : input.idBanco,
    numeroReferencia: input.numeroReferencia === undefined ? current.numeroReferencia : input.numeroReferencia,
    fechaPago: input.fechaPago ?? current.fechaPago.slice(0, 10),
  };
  if (final.fechaPago > businessTodayIso()) throw new BadRequestError('La fecha de pago no puede ser futura');
  await assertCatalogos(final.idCliente, final.idFormaPago, final.idMoneda, final.numeroReferencia, final.idBanco);
  // repository.update() bloquea la fila (FOR UPDATE) y revalida bajo esa
  // misma conexión que el pago sigue sin aplicaciones CONFIRMADA.
  await repository.update(id, input);
  return getPago(id);
}

export async function deletePago(id: number): Promise<void> {
  await getPago(id);
  // repository.remove() bloquea la fila, revalida aplicaciones y estado bajo
  // FOR UPDATE antes de borrar.
  await repository.remove(id);
}

export async function anularPago(id: number, rawInput: unknown): Promise<Pago> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de pago inválido');
  const input = anularPagoSchema.parse(rawInput);
  if (input.fechaAnulacion && input.fechaAnulacion > businessTodayIso()) {
    throw new BadRequestError('La fecha de anulación no puede ser futura');
  }
  if (!(await catalogosRepository.empleadoExiste(input.idEmpleadoAnulacion))) {
    throw new BadRequestError('El empleado seleccionado no existe');
  }

  await getPago(id);
  await repository.anular(id, input);
  return getPago(id);
}
