// Contrato de paginación compartido por TODO el sistema. No lo recrees en un
// módulo específico: cualquier endpoint que devuelva una lista paginada debe
// usar PaginatedResponse<T>, y cualquier endpoint que reciba filtros de
// listado debe extender ListQueryParams.

export interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
