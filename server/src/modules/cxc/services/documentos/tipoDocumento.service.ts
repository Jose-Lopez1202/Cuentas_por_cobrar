import {
  createTipoDocumentoSchema,
  updateTipoDocumentoSchema,
  buildPaginationMeta,
  type TipoDocumento,
  type PaginatedResponse,
} from '@erp/contracts';
import * as tipoDocumentoRepository from '../../repositories/documentos/tipoDocumento.repository';
import { NotFoundError } from './documento.service';

export async function listTiposDocumento(query: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<TipoDocumento>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const { data, total } = await tipoDocumentoRepository.findAll({ page, limit, search: query.search });
  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getTipoDocumento(id: number): Promise<TipoDocumento> {
  const tipo = await tipoDocumentoRepository.findById(id);
  if (!tipo) throw new NotFoundError(`Tipo de documento ${id} no encontrado`);
  return tipo;
}

export async function createTipoDocumento(rawInput: unknown): Promise<TipoDocumento> {
  const input = createTipoDocumentoSchema.parse(rawInput);
  const id = await tipoDocumentoRepository.create(input);
  return getTipoDocumento(id);
}

export async function updateTipoDocumento(id: number, rawInput: unknown): Promise<TipoDocumento> {
  const input = updateTipoDocumentoSchema.parse(rawInput);
  await tipoDocumentoRepository.update(id, input);
  return getTipoDocumento(id);
}

export async function deleteTipoDocumento(id: number): Promise<void> {
  await tipoDocumentoRepository.remove(id);
}
