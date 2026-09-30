import {
  createRutaSchema,
  updateRutaSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type Ruta,
} from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';
import * as rutaRepository from '../../repositories/organizacion/ruta.repository';

export async function listRutas(query: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<Ruta>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

  const { data, total } = await rutaRepository.findAll({ page, limit, search: query.search });

  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getRuta(id: number): Promise<Ruta> {
  const ruta = await rutaRepository.findById(id);
  if (!ruta) {
    throw new NotFoundError(`Ruta ${id} no encontrada`);
  }
  return ruta;
}

export async function createRuta(rawInput: unknown): Promise<Ruta> {
  const input = createRutaSchema.parse(rawInput);
  const id = await rutaRepository.create(input);
  return getRuta(id);
}

export async function updateRuta(id: number, rawInput: unknown): Promise<Ruta> {
  const input = updateRutaSchema.parse(rawInput);
  // El repositorio lanza NotFoundError si rowsAffected=0; evita un SELECT
  // adicional solo para el chequeo 404 antes de escribir.
  await rutaRepository.update(id, input);
  return getRuta(id);
}

export async function deleteRuta(id: number): Promise<void> {
  await rutaRepository.remove(id);
}
