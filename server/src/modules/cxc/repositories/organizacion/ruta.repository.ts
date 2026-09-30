import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { Ruta, CreateRutaInput, UpdateRutaInput } from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';

interface RutaRow {
  ID_RUTA: number;
  CODIGO_RUTA: string | null;
  NOMBRE: string;
  ID_EMPLEADO: number;
  NOMBRE_EMPLEADO: string | null;
  FECHA: Date | null;
  ESTADO: string;
  OBSERVACIONES: string;
}

function mapRow(row: RutaRow): Ruta {
  return {
    idRuta: row.ID_RUTA,
    codigoRuta: row.CODIGO_RUTA,
    nombre: row.NOMBRE,
    idEmpleado: row.ID_EMPLEADO,
    nombreEmpleado: row.NOMBRE_EMPLEADO,
    fecha: row.FECHA?.toISOString() ?? null,
    estado: row.ESTADO?.trim(),
    observaciones: row.OBSERVACIONES,
  };
}

// OJO: la tabla de empleados en la base se llama EMPLEADO (no CXC_EMPLEADOS).
// LEFT JOIN (no JOIN normal): un ID_EMPLEADO huérfano no debe hacer
// desaparecer la ruta de los listados ni causar un falso 404 en findById.
const SELECT_BASE = `
  SELECT r.ID_RUTA, r.CODIGO_RUTA, r.NOMBRE, r.ID_EMPLEADO,
         (e.NOMBRE || ' ' || e.APELLIDO) AS NOMBRE_EMPLEADO,
         r.FECHA, r.ESTADO, r.OBSERVACIONES
  FROM CXC_RUTAS r
  LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = r.ID_EMPLEADO
`;

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: Ruta[]; total: number }> {
  const conn = await getConnection();
  try {
    const offset = (params.page - 1) * params.limit;
    const whereClause = params.search
      ? `WHERE UPPER(r.NOMBRE) LIKE UPPER(:search) OR UPPER(r.CODIGO_RUTA) LIKE UPPER(:search) OR UPPER(r.ESTADO) LIKE UPPER(:search)`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};

    const dataResult = await conn.execute<RutaRow>(
      `${SELECT_BASE} ${whereClause}
       ORDER BY r.FECHA DESC NULLS LAST, r.ID_RUTA DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset, limit: params.limit },
    );

    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) AS TOTAL FROM CXC_RUTAS r LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = r.ID_EMPLEADO ${whereClause}`,
      searchBind,
    );

    const total = countResult.rows?.[0]?.TOTAL ?? 0;
    return { data: (dataResult.rows ?? []).map(mapRow), total };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<Ruta | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<RutaRow>(`${SELECT_BASE} WHERE r.ID_RUTA = :id`, { id });
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(input: CreateRutaInput): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_RUTAS (CODIGO_RUTA, NOMBRE, ID_EMPLEADO, FECHA, ESTADO, OBSERVACIONES)
       VALUES (:codigoRuta, :nombre, :idEmpleado,
               NVL(TO_DATE(:fecha, 'YYYY-MM-DD'), SYSDATE),
               :estado, :observaciones)
       RETURNING ID_RUTA INTO :id`,
      {
        codigoRuta: input.codigoRuta ?? null,
        nombre: input.nombre,
        idEmpleado: input.idEmpleado,
        fecha: input.fecha ?? null,
        estado: input.estado ?? 'PLANIFICADA',
        // OBSERVACIONES es NOT NULL en Oracle: si no mandan nada, '' en vez de null.
        observaciones: input.observaciones ?? '',
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

export async function update(id: number, input: UpdateRutaInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.codigoRuta !== undefined) { fields.push('CODIGO_RUTA = :codigoRuta'); binds.codigoRuta = input.codigoRuta; }
  if (input.nombre !== undefined) { fields.push('NOMBRE = :nombre'); binds.nombre = input.nombre; }
  if (input.idEmpleado !== undefined) { fields.push('ID_EMPLEADO = :idEmpleado'); binds.idEmpleado = input.idEmpleado; }
  if (input.fecha !== undefined) { fields.push(`FECHA = TO_DATE(:fecha, 'YYYY-MM-DD')`); binds.fecha = input.fecha; }
  if (input.estado !== undefined) { fields.push('ESTADO = :estado'); binds.estado = input.estado; }
  if (input.observaciones !== undefined) { fields.push('OBSERVACIONES = :observaciones'); binds.observaciones = input.observaciones; }

  if (fields.length === 0) {
    if (!(await findById(id))) throw new NotFoundError(`Ruta ${id} no encontrada`);
    return;
  }

  const conn = await getConnection();
  try {
    const result = await conn.execute(`UPDATE CXC_RUTAS SET ${fields.join(', ')} WHERE ID_RUTA = :id`, binds);
    if (!result.rowsAffected) throw new NotFoundError(`Ruta ${id} no encontrada`);
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
    const result = await conn.execute(`DELETE FROM CXC_RUTAS WHERE ID_RUTA = :id`, { id });
    if (!result.rowsAffected) throw new NotFoundError(`Ruta ${id} no encontrada`);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}
