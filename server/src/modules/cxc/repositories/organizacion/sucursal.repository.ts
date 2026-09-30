import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { Sucursal, CreateSucursalInput, UpdateSucursalInput } from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';

interface SucursalRow {
  ID_SUCURSAL: number;
  ID_EMPRESA: number;
  NOMBRE_EMPRESA: string | null;
  NOMBRE: string;
  DIRECCION: string | null;
  ESTADO: string;
}

function mapRow(row: SucursalRow): Sucursal {
  return {
    idSucursal: row.ID_SUCURSAL,
    idEmpresa: row.ID_EMPRESA,
    nombreEmpresa: row.NOMBRE_EMPRESA,
    nombre: row.NOMBRE,
    direccion: row.DIRECCION,
    estado: row.ESTADO?.trim(),
  };
}

// LEFT JOIN (no JOIN normal): consistente con el resto de repositorios de
// organización; una empresa referenciada que no resuelva no debe ocultar la
// sucursal del listado ni causar un falso 404 en findById.
const SELECT_BASE = `
  SELECT s.ID_SUCURSAL, s.ID_EMPRESA, e.NOMBRE AS NOMBRE_EMPRESA,
         s.NOMBRE, s.DIRECCION, s.ESTADO
  FROM CXC_SUCURSALES s
  LEFT JOIN CXC_EMPRESAS e ON e.ID_EMPRESA = s.ID_EMPRESA
`;

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: Sucursal[]; total: number }> {
  const conn = await getConnection();
  try {
    const offset = (params.page - 1) * params.limit;
    const whereClause = params.search
      ? `WHERE UPPER(s.NOMBRE) LIKE UPPER(:search) OR UPPER(e.NOMBRE) LIKE UPPER(:search)`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};

    const dataResult = await conn.execute<SucursalRow>(
      `${SELECT_BASE} ${whereClause}
       ORDER BY s.NOMBRE ASC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset, limit: params.limit },
    );

    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) AS TOTAL FROM CXC_SUCURSALES s LEFT JOIN CXC_EMPRESAS e ON e.ID_EMPRESA = s.ID_EMPRESA ${whereClause}`,
      searchBind,
    );

    const total = countResult.rows?.[0]?.TOTAL ?? 0;
    return { data: (dataResult.rows ?? []).map(mapRow), total };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<Sucursal | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<SucursalRow>(`${SELECT_BASE} WHERE s.ID_SUCURSAL = :id`, { id });
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(input: CreateSucursalInput): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_SUCURSALES (ID_EMPRESA, NOMBRE, DIRECCION, ESTADO)
       VALUES (:idEmpresa, :nombre, :direccion, :estado)
       RETURNING ID_SUCURSAL INTO :id`,
      {
        idEmpresa: input.idEmpresa,
        nombre: input.nombre,
        direccion: input.direccion ?? null,
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

export async function update(id: number, input: UpdateSucursalInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.idEmpresa !== undefined) { fields.push('ID_EMPRESA = :idEmpresa'); binds.idEmpresa = input.idEmpresa; }
  if (input.nombre !== undefined) { fields.push('NOMBRE = :nombre'); binds.nombre = input.nombre; }
  if (input.direccion !== undefined) { fields.push('DIRECCION = :direccion'); binds.direccion = input.direccion; }
  if (input.estado !== undefined) { fields.push('ESTADO = :estado'); binds.estado = input.estado; }

  if (fields.length === 0) {
    if (!(await findById(id))) throw new NotFoundError(`Sucursal ${id} no encontrada`);
    return;
  }

  const conn = await getConnection();
  try {
    const result = await conn.execute(`UPDATE CXC_SUCURSALES SET ${fields.join(', ')} WHERE ID_SUCURSAL = :id`, binds);
    if (!result.rowsAffected) throw new NotFoundError(`Sucursal ${id} no encontrada`);
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
    const result = await conn.execute(`DELETE FROM CXC_SUCURSALES WHERE ID_SUCURSAL = :id`, { id });
    if (!result.rowsAffected) throw new NotFoundError(`Sucursal ${id} no encontrada`);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}
