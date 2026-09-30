import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { Empresa, CreateEmpresaInput, UpdateEmpresaInput } from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';

interface EmpresaRow {
  ID_EMPRESA: number;
  NOMBRE: string;
  NIT: string | null;
  ESTADO: string;
}

function mapRow(row: EmpresaRow): Empresa {
  return {
    idEmpresa: row.ID_EMPRESA,
    nombre: row.NOMBRE,
    nit: row.NIT,
    estado: row.ESTADO?.trim(),
  };
}

const SELECT_BASE = `
  SELECT ID_EMPRESA, NOMBRE, NIT, ESTADO
  FROM CXC_EMPRESAS
`;

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: Empresa[]; total: number }> {
  const conn = await getConnection();
  try {
    const offset = (params.page - 1) * params.limit;
    const whereClause = params.search
      ? `WHERE UPPER(NOMBRE) LIKE UPPER(:search) OR UPPER(NIT) LIKE UPPER(:search)`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};

    const dataResult = await conn.execute<EmpresaRow>(
      `${SELECT_BASE} ${whereClause}
       ORDER BY NOMBRE ASC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset, limit: params.limit },
    );

    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) AS TOTAL FROM CXC_EMPRESAS ${whereClause}`,
      searchBind,
    );

    const total = countResult.rows?.[0]?.TOTAL ?? 0;
    return { data: (dataResult.rows ?? []).map(mapRow), total };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<Empresa | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<EmpresaRow>(`${SELECT_BASE} WHERE ID_EMPRESA = :id`, { id });
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(input: CreateEmpresaInput): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_EMPRESAS (NOMBRE, NIT, ESTADO)
       VALUES (:nombre, :nit, :estado)
       RETURNING ID_EMPRESA INTO :id`,
      {
        nombre: input.nombre,
        nit: input.nit ?? null,
        estado: input.estado ?? 'A',
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    await conn.commit();
    return result.outBinds!.id[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

export async function update(id: number, input: UpdateEmpresaInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.nombre !== undefined) { fields.push('NOMBRE = :nombre'); binds.nombre = input.nombre; }
  if (input.nit !== undefined) { fields.push('NIT = :nit'); binds.nit = input.nit; }
  if (input.estado !== undefined) { fields.push('ESTADO = :estado'); binds.estado = input.estado; }

  if (fields.length === 0) {
    if (!(await findById(id))) throw new NotFoundError(`Empresa ${id} no encontrada`);
    return;
  }

  const conn = await getConnection();
  try {
    const result = await conn.execute(`UPDATE CXC_EMPRESAS SET ${fields.join(', ')} WHERE ID_EMPRESA = :id`, binds);
    if (!result.rowsAffected) throw new NotFoundError(`Empresa ${id} no encontrada`);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

export async function remove(id: number): Promise<void> {
  const conn = await getConnection();
  try {
    const result = await conn.execute(`DELETE FROM CXC_EMPRESAS WHERE ID_EMPRESA = :id`, { id });
    if (!result.rowsAffected) throw new NotFoundError(`Empresa ${id} no encontrada`);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

/** Catálogo simple para el <Select> de Empresa en el formulario de Sucursales. */
export async function findAllOptions(): Promise<{ id: number; label: string }[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ ID_EMPRESA: number; NOMBRE: string }>(
      `SELECT ID_EMPRESA, NOMBRE FROM CXC_EMPRESAS WHERE TRIM(ESTADO) = 'A' ORDER BY NOMBRE ASC`,
    );
    return (result.rows ?? []).map((r) => ({ id: r.ID_EMPRESA, label: r.NOMBRE }));
  } finally {
    await conn.close();
  }
}
