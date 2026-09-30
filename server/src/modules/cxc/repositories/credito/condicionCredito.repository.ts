import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type {
  CondicionCredito,
  CreateCondicionCreditoInput,
  UpdateCondicionCreditoInput,
} from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';

interface CondicionCreditoRow {
  ID_CONDICION: number;
  DIAS_CREDITO: number;
  PORCENTAJE_MORA: number;
  DIAS_GRACIA: number;
  ESTADO: 'A' | 'I';
}

function mapRow(row: CondicionCreditoRow): CondicionCredito {
  return {
    idCondicion: row.ID_CONDICION,
    diasCredito: row.DIAS_CREDITO,
    porcentajeMora: row.PORCENTAJE_MORA,
    diasGracia: row.DIAS_GRACIA,
    estado: row.ESTADO,
  };
}

const SELECT_BASE = `
  SELECT
    ID_CONDICION,
    DIAS_CREDITO,
    PORCENTAJE_MORA,
    DIAS_GRACIA,
    ESTADO
  FROM CXC_CONDICIONES_CREDITO
`;

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: CondicionCredito[]; total: number }> {
  const conn = await getConnection();

  try {
    const offset = (params.page - 1) * params.limit;

    const whereClause = params.search
      ? `WHERE TO_CHAR(DIAS_CREDITO) LIKE :search
         OR TO_CHAR(PORCENTAJE_MORA) LIKE :search
         OR TO_CHAR(DIAS_GRACIA) LIKE :search
         OR UPPER(ESTADO) LIKE UPPER(:search)`
      : '';

    const searchBind = params.search
      ? { search: `%${params.search}%` }
      : {};

    const dataResult = await conn.execute<CondicionCreditoRow>(
      `${SELECT_BASE}
       ${whereClause}
       ORDER BY ID_CONDICION DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      {
        ...searchBind,
        offset,
        limit: params.limit,
      },
    );

    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) AS TOTAL
       FROM CXC_CONDICIONES_CREDITO
       ${whereClause}`,
      searchBind,
    );

    const total = countResult.rows?.[0]?.TOTAL ?? 0;

    return {
      data: (dataResult.rows ?? []).map(mapRow),
      total,
    };
  } finally {
    await conn.close();
  }
}

export async function findById(
  id: number,
): Promise<CondicionCredito | null> {
  const conn = await getConnection();

  try {
    const result = await conn.execute<CondicionCreditoRow>(
      `${SELECT_BASE}
       WHERE ID_CONDICION = :id`,
      { id },
    );

    const row = result.rows?.[0];

    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(
  input: CreateCondicionCreditoInput,
): Promise<number> {
  const conn = await getConnection();

  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_CONDICIONES_CREDITO
         (
           DIAS_CREDITO,
           PORCENTAJE_MORA,
           DIAS_GRACIA,
           ESTADO
         )
       VALUES
         (
           :diasCredito,
           :porcentajeMora,
           :diasGracia,
           :estado
         )
       RETURNING ID_CONDICION INTO :id`,
      {
        diasCredito: input.diasCredito,
        porcentajeMora: input.porcentajeMora,
        diasGracia: input.diasGracia,
        estado: input.estado ?? 'A',
        id: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER,
        },
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

export async function update(
  id: number,
  input: UpdateCondicionCreditoInput,
): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.diasCredito !== undefined) {
    fields.push('DIAS_CREDITO = :diasCredito');
    binds.diasCredito = input.diasCredito;
  }

  if (input.porcentajeMora !== undefined) {
    fields.push('PORCENTAJE_MORA = :porcentajeMora');
    binds.porcentajeMora = input.porcentajeMora;
  }

  if (input.diasGracia !== undefined) {
    fields.push('DIAS_GRACIA = :diasGracia');
    binds.diasGracia = input.diasGracia;
  }

  if (input.estado !== undefined) {
    fields.push('ESTADO = :estado');
    binds.estado = input.estado;
  }

  if (fields.length === 0) {
    if (!(await findById(id))) throw new NotFoundError(`Condición de crédito ${id} no encontrada`);
    return;
  }

  const conn = await getConnection();

  try {
    const result = await conn.execute(
      `UPDATE CXC_CONDICIONES_CREDITO
       SET ${fields.join(', ')}
       WHERE ID_CONDICION = :id`,
      binds,
    );
    if (!result.rowsAffected) throw new NotFoundError(`Condición de crédito ${id} no encontrada`);

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
    const result = await conn.execute(
      `DELETE FROM CXC_CONDICIONES_CREDITO
       WHERE ID_CONDICION = :id`,
      { id },
    );
    if (!result.rowsAffected) throw new NotFoundError(`Condición de crédito ${id} no encontrada`);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}