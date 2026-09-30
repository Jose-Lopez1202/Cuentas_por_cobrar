import { businessTodayIso } from '../../../../shared/date';
import {
  createPromesaPagoSchema,
  updatePromesaPagoSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type PromesaPago,
} from '@erp/contracts';
import * as promesaPagoRepository from '../../repositories/cobranza/promesaPago.repository';
import * as catalogosRepository from '../../repositories/catalogos.repository';
import { BadRequestError, NotFoundError } from '../../../../shared/errors/AppError';


async function assertDocumentoCliente(idCliente: number, idDocumento: number | null | undefined, monto: number) {
  if (!idDocumento) return;
  const documento = await catalogosRepository.findDocumentoPendienteDeCliente(idCliente, idDocumento);
  if (!documento) throw new BadRequestError('El documento debe pertenecer al cliente y tener saldo pendiente');
  if (documento.saldo !== undefined && monto > Number(documento.saldo)) {
    throw new BadRequestError('El monto comprometido no puede superar el saldo pendiente del documento');
  }
}

export async function listPromesas(query: { page?: string; limit?: string; search?: string }): Promise<PaginatedResponse<PromesaPago>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const { data, total } = await promesaPagoRepository.findAll({ page, limit, search: query.search });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getPromesa(id: number): Promise<PromesaPago> {
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError('ID de promesa inválido');
  const promesa = await promesaPagoRepository.findById(id);
  if (!promesa) throw new NotFoundError(`Promesa de pago ${id} no encontrada`);
  return promesa;
}

export async function createPromesa(rawInput: unknown): Promise<PromesaPago> {
  const input = createPromesaPagoSchema.parse(rawInput);
  if (input.fechaPromesa > businessTodayIso()) throw new BadRequestError('La fecha de la promesa no puede ser futura');
  await assertDocumentoCliente(input.idCliente, input.idDocumento, input.montoComprometido);
  const id = await promesaPagoRepository.create(input);
  return getPromesa(id);
}

export async function updatePromesa(id: number, rawInput: unknown): Promise<PromesaPago> {
  const current = await getPromesa(id);
  const input = updatePromesaPagoSchema.parse(rawInput);
  const fechaPromesa = input.fechaPromesa ?? current.fechaPromesa.slice(0, 10);
  const fechaCompromiso = input.fechaCompromiso === undefined ? current.fechaCompromiso?.slice(0, 10) : input.fechaCompromiso;
  if (fechaPromesa > businessTodayIso()) throw new BadRequestError('La fecha de la promesa no puede ser futura');
  if (fechaCompromiso && fechaCompromiso < fechaPromesa) throw new BadRequestError('La fecha comprometida no puede ser anterior a la fecha de la promesa');
  if (input.idCliente !== undefined || input.idDocumento !== undefined || input.montoComprometido !== undefined) {
    await assertDocumentoCliente(
      input.idCliente ?? current.idCliente,
      input.idDocumento === undefined ? current.idDocumento : input.idDocumento,
      input.montoComprometido ?? current.montoComprometido,
    );
  }
  await promesaPagoRepository.update(id, input);
  return getPromesa(id);
}

export async function deletePromesa(id: number): Promise<void> {
  await getPromesa(id);
  await promesaPagoRepository.remove(id);
}
