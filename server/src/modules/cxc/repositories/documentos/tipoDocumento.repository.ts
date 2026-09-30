import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type {
  TipoDocumento,
  CreateTipoDocumentoInput,
  UpdateTipoDocumentoInput,
} from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';

interface TipoDocumentoRow {
  ID_TIPO_DOCUMENTO: number;
  CODIGO: string;
  NOMBRE: string;
  NATURALEZA: string | null;
  ESTADO: string;
}

function mapRow(row: TipoDocumentoRow): TipoDocumento {
  return {
    idTipoDocumento: row.ID_TIPO_DOCUMENTO,
    codigo: row.CODIGO,
    nombre: row.NOMBRE,
    naturaleza: row.NATURALEZA,
    estado: row.ESTADO?.trim(),
  };
}

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: TipoDocumento[]; total: number }> {
  const conn = await getConnection();
  try {
    const offset = (params.page - 1) * params.limit;
    const whereClause = params.search
      ? `WHERE UPPER(CODIGO) LIKE UPPER(:search)
          OR UPPER(NOMBRE) LIKE UPPER(:search)
          OR UPPER(NATURALEZA) LIKE UPPER(:search)`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};

    const dataResult = await conn.execute<TipoDocumentoRow>(
      `SELECT ID_TIPO_DOCUMENTO, CODIGO, NOMBRE, NATURALEZA, ESTADO
       FROM CXC_TIPOS_DOCUMENTO
       ${whereClause}
       ORDER BY NOMBRE ASC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset, limit: params.limit },
    );

    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) AS TOTAL
       FROM CXC_TIPOS_DOCUMENTO
       ${whereClause}`,
      searchBind,
    );

    return {
      data: (dataResult.rows ?? []).map(mapRow),
      total: countResult.rows?.[0]?.TOTAL ?? 0,
    };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<TipoDocumento | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<TipoDocumentoRow>(
      `SELECT ID_TIPO_DOCUMENTO, CODIGO, NOMBRE, NATURALEZA, ESTADO
       FROM CXC_TIPOS_DOCUMENTO
       WHERE ID_TIPO_DOCUMENTO = :id`,
      { id },
    );
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(input: CreateTipoDocumentoInput): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_TIPOS_DOCUMENTO (CODIGO, NOMBRE, NATURALEZA, ESTADO)
       VALUES (:codigo, :nombre, :naturaleza, :estado)
       RETURNING ID_TIPO_DOCUMENTO INTO :id`,
      {
        codigo: input.codigo,
        nombre: input.nombre,
        naturaleza: input.naturaleza ?? null,
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

export async function update(id: number, input: UpdateTipoDocumentoInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.codigo !== undefined) { fields.push('CODIGO = :codigo'); binds.codigo = input.codigo; }
  if (input.nombre !== undefined) { fields.push('NOMBRE = :nombre'); binds.nombre = input.nombre; }
  if (input.naturaleza !== undefined) { fields.push('NATURALEZA = :naturaleza'); binds.naturaleza = input.naturaleza; }
  if (input.estado !== undefined) { fields.push('ESTADO = :estado'); binds.estado = input.estado; }

  if (fields.length === 0) {
    if (!(await findById(id))) throw new NotFoundError(`Tipo de documento ${id} no encontrado`);
    return;
  }

  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `UPDATE CXC_TIPOS_DOCUMENTO SET ${fields.join(', ')} WHERE ID_TIPO_DOCUMENTO = :id`,
      binds,
    );
    if (!result.rowsAffected) throw new NotFoundError(`Tipo de documento ${id} no encontrado`);
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
      `DELETE FROM CXC_TIPOS_DOCUMENTO WHERE ID_TIPO_DOCUMENTO = :id`,
      { id },
    );
    if (!result.rowsAffected) throw new NotFoundError(`Tipo de documento ${id} no encontrado`);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}
