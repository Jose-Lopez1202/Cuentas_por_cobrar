import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { GestionCobro, CreateGestionCobroInput, UpdateGestionCobroInput } from '@erp/contracts';

interface GestionCobroRow {
  ID_GESTION: number;
  ID_CLIENTE: number;
  NOMBRE_CLIENTE: string | null;
  ID_DOCUMENTO: number | null;
  ID_EMPLEADO: number;
  NOMBRE_EMPLEADO: string | null;
  FECHA_GESTION: Date;
  TIPO_GESTION: GestionCobro['tipoGestion'];
  RESULTADO: string | null;
  OBSERVACION: string | null;
  FECHA_COMPROMISO: Date | null;
  MONTO_COMPROMISO: number | null;
}

function mapRow(row: GestionCobroRow): GestionCobro {
  return {
    idGestion: row.ID_GESTION,
    idCliente: row.ID_CLIENTE,
    nombreCliente: row.NOMBRE_CLIENTE,
    idDocumento: row.ID_DOCUMENTO,
    idEmpleado: row.ID_EMPLEADO,
    nombreEmpleado: row.NOMBRE_EMPLEADO,
    fechaGestion: row.FECHA_GESTION?.toISOString() ?? '',
    tipoGestion: row.TIPO_GESTION,
    resultado: row.RESULTADO,
    observacion: row.OBSERVACION,
    fechaCompromiso: row.FECHA_COMPROMISO?.toISOString() ?? null,
    montoCompromiso: row.MONTO_COMPROMISO,
  };
}

const SELECT_BASE = `
  SELECT g.ID_GESTION, g.ID_CLIENTE, c.NOMBRE AS NOMBRE_CLIENTE, g.ID_DOCUMENTO,
         g.ID_EMPLEADO, (e.NOMBRE || ' ' || e.APELLIDO) AS NOMBRE_EMPLEADO,
         g.FECHA_GESTION, g.TIPO_GESTION, g.RESULTADO, g.OBSERVACION,
         g.FECHA_COMPROMISO, g.MONTO_COMPROMISO
  FROM CXC_GESTIONES_COBRO g
  JOIN CLIENTE c ON c.ID_CLIENTE = g.ID_CLIENTE
  JOIN EMPLEADO e ON e.ID_EMPLEADO = g.ID_EMPLEADO
`;

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: GestionCobro[]; total: number }> {
  const conn = await getConnection();
  try {
    const offset = (params.page - 1) * params.limit;
    const whereClause = params.search
      ? `WHERE UPPER(c.NOMBRE) LIKE UPPER(:search) OR UPPER(g.TIPO_GESTION) LIKE UPPER(:search) OR UPPER(g.RESULTADO) LIKE UPPER(:search)`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};

    const dataResult = await conn.execute<GestionCobroRow>(
      `${SELECT_BASE} ${whereClause}
       ORDER BY g.FECHA_GESTION DESC, g.ID_GESTION DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset, limit: params.limit },
    );

    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) AS TOTAL
       FROM CXC_GESTIONES_COBRO g
       JOIN CLIENTE c ON c.ID_CLIENTE = g.ID_CLIENTE
       ${whereClause}`,
      searchBind,
    );

    const total = countResult.rows?.[0]?.TOTAL ?? 0;
    return { data: (dataResult.rows ?? []).map(mapRow), total };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<GestionCobro | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<GestionCobroRow>(
      `${SELECT_BASE} WHERE g.ID_GESTION = :id`,
      { id },
    );
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(input: CreateGestionCobroInput): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_GESTIONES_COBRO
         (ID_CLIENTE, ID_DOCUMENTO, ID_EMPLEADO, FECHA_GESTION, TIPO_GESTION,
          RESULTADO, OBSERVACION, FECHA_COMPROMISO, MONTO_COMPROMISO)
       VALUES
         (:idCliente, :idDocumento, :idEmpleado,
          NVL(TO_DATE(:fechaGestion, 'YYYY-MM-DD'), SYSDATE),
          :tipoGestion, :resultado, :observacion,
          TO_DATE(:fechaCompromiso, 'YYYY-MM-DD'), :montoCompromiso)
       RETURNING ID_GESTION INTO :id`,
      {
        idCliente: input.idCliente,
        idDocumento: input.idDocumento ?? null,
        idEmpleado: input.idEmpleado,
        fechaGestion: input.fechaGestion ?? null,
        tipoGestion: input.tipoGestion ?? null,
        resultado: input.resultado ?? null,
        observacion: input.observacion ?? null,
        fechaCompromiso: input.fechaCompromiso ?? null,
        montoCompromiso: input.montoCompromiso ?? null,
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

export async function update(id: number, input: UpdateGestionCobroInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.idCliente !== undefined) { fields.push('ID_CLIENTE = :idCliente'); binds.idCliente = input.idCliente; }
  if (input.idDocumento !== undefined) { fields.push('ID_DOCUMENTO = :idDocumento'); binds.idDocumento = input.idDocumento; }
  if (input.idEmpleado !== undefined) { fields.push('ID_EMPLEADO = :idEmpleado'); binds.idEmpleado = input.idEmpleado; }
  if (input.tipoGestion !== undefined) { fields.push('TIPO_GESTION = :tipoGestion'); binds.tipoGestion = input.tipoGestion; }
  if (input.resultado !== undefined) { fields.push('RESULTADO = :resultado'); binds.resultado = input.resultado; }
  if (input.observacion !== undefined) { fields.push('OBSERVACION = :observacion'); binds.observacion = input.observacion; }
  if (input.fechaCompromiso !== undefined) { fields.push(`FECHA_COMPROMISO = TO_DATE(:fechaCompromiso, 'YYYY-MM-DD')`); binds.fechaCompromiso = input.fechaCompromiso; }
  if (input.montoCompromiso !== undefined) { fields.push('MONTO_COMPROMISO = :montoCompromiso'); binds.montoCompromiso = input.montoCompromiso; }

  if (fields.length === 0) return;

  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE CXC_GESTIONES_COBRO SET ${fields.join(', ')} WHERE ID_GESTION = :id`,
      binds,
    );
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
    await conn.execute(`DELETE FROM CXC_GESTIONES_COBRO WHERE ID_GESTION = :id`, { id });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}