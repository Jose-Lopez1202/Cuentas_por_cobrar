import {
  createCondicionCreditoSchema,
  updateCondicionCreditoSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type CondicionCredito,
} from '@erp/contracts';

import { NotFoundError } from '../../../../shared/errors/AppError';
import * as condicionCreditoRepository from '../../repositories/credito/condicionCredito.repository';

export async function listCondiciones(query: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<CondicionCredito>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

  const { data, total } = await condicionCreditoRepository.findAll({
    page,
    limit,
    search: query.search,
  });

  return {
    data,
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getCondicion(
  id: number,
): Promise<CondicionCredito> {
  const condicion = await condicionCreditoRepository.findById(id);

  if (!condicion) {
    throw new NotFoundError(
      `Condición de crédito ${id} no encontrada`,
    );
  }

  return condicion;
}

export async function createCondicion(
  rawInput: unknown,
): Promise<CondicionCredito> {
  const input = createCondicionCreditoSchema.parse(rawInput);

  const id = await condicionCreditoRepository.create(input);

  return getCondicion(id);
}

export async function updateCondicion(
  id: number,
  rawInput: unknown,
): Promise<CondicionCredito> {
  const input = updateCondicionCreditoSchema.parse(rawInput);

  await condicionCreditoRepository.update(id, input);

  return getCondicion(id);
}

export async function deleteCondicion(id: number): Promise<void> {
  await condicionCreditoRepository.remove(id);
}
