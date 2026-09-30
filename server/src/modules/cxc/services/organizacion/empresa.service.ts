import {
  createEmpresaSchema,
  updateEmpresaSchema,
  buildPaginationMeta,
  type PaginatedResponse,
  type Empresa,
} from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';
import * as empresaRepository from '../../repositories/organizacion/empresa.repository';

export async function listEmpresas(query: {
  page?: string;
  limit?: string;
  search?: string;
}): Promise<PaginatedResponse<Empresa>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

  const { data, total } = await empresaRepository.findAll({ page, limit, search: query.search });

  return { data, meta: buildPaginationMeta(total, page, limit) };
}

export async function getEmpresa(id: number): Promise<Empresa> {
  const empresa = await empresaRepository.findById(id);
  if (!empresa) {
    throw new NotFoundError(`Empresa ${id} no encontrada`);
  }
  return empresa;
}

export async function createEmpresa(rawInput: unknown): Promise<Empresa> {
  const input = createEmpresaSchema.parse(rawInput);
  const id = await empresaRepository.create(input);
  return getEmpresa(id);
}

export async function updateEmpresa(id: number, rawInput: unknown): Promise<Empresa> {
  const input = updateEmpresaSchema.parse(rawInput);
  await empresaRepository.update(id, input);
  return getEmpresa(id);
}

export async function deleteEmpresa(id: number): Promise<void> {
  await empresaRepository.remove(id);
}

export async function listEmpresaOptions() {
  return empresaRepository.findAllOptions();
}
