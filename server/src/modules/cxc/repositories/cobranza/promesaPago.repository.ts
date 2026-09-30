import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { PromesaPago, CreatePromesaPagoInput, UpdatePromesaPagoInput } from '@erp/contracts';
import { businessTodayIso } from '../../../../shared/date';

interface PromesaPagoRow {
  ID_PROMESA: number;
  ID_CLIENTE: number;
  NOMBRE_CLIENTE: string | null;
  ID_DOCUMENTO: number | null;
  ID_GESTION: number | null;
  FECHA_PROMESA: Date;
  FECHA_COMPROMISO: Date | null;
  MONTO_COMPROMETIDO: number;
  ESTADO: string;
  OBSERVACIONES: string | null;
}

function mapRow(row: PromesaPagoRow): PromesaPago {
  const estado = row.ESTADO as PromesaPago['estado'];
  const fechaCompromiso = row.FECHA_COMPROMISO?.toISOString() ?? null;

  // Nada transiciona PENDIENTE -> INCUMPLIDA automáticamente (no hay
  // job/trigger); esto es solo una señal de lectura para la UI, calculada
  // igual que Documento.condicion. `estado` sigue siendo lo único que el
  // CRUD puede editar.
  const estaVencida = estado === 'PENDIENTE' && !!fechaCompromiso && fechaCompromiso.slice(0, 10) < businessTodayIso();

  return {
    idPromesa: row.ID_PROMESA,
    idCliente: row.ID_CLIENTE,
    nombreCliente: row.NOMBRE_CLIENTE,
    idDocumento: row.ID_DOCUMENTO,
    idGestion: row.ID_GESTION,
    fechaPromesa: row.FECHA_PROMESA?.toISOString() ?? '',
    fechaCompromiso,
    montoComprometido: row.MONTO_COMPROMETIDO,
    estado,
    observaciones: row.OBSERVACIONES,
    estaVencida,
  };
}

const SELECT_BASE = `
  SELECT p.ID_PROMESA, p.ID_CLIENTE, c.NOMBRE AS NOMBRE_CLIENTE, p.ID_DOCUMENTO,
         p.ID_GESTION, p.FECHA_PROMESA, p.FECHA_COMPROMISO, p.MONTO_COMPROMETIDO,
         p.ESTADO, p.OBSERVACIONES
  FROM CXC_PROMESAS_PAGO p
  JOIN CLIENTE c ON c.ID_CLIENTE = p.ID_CLIENTE
`;

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: PromesaPago[]; total: number }> {
  const conn = await getConnection();
  try {
    const offset = (params.page - 1) * params.limit;
    const whereClause = params.search
      ? `WHERE UPPER(c.NOMBRE) LIKE UPPER(:search) OR UPPER(p.ESTADO) LIKE UPPER(:search)`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};

    const dataResult = await conn.execute<PromesaPagoRow>(
      `${SELECT_BASE} ${whereClause}
       ORDER BY p.FECHA_PROMESA DESC, p.ID_PROMESA DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset, limit: params.limit },
    );

    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) AS TOTAL FROM CXC_PROMESAS_PAGO p JOIN CLIENTE c ON c.ID_CLIENTE = p.ID_CLIENTE ${whereClause}`,
      searchBind,
    );

    const total = countResult.rows?.[0]?.TOTAL ?? 0;
    return { data: (dataResult.rows ?? []).map(mapRow), total };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<PromesaPago | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<PromesaPagoRow>(`${SELECT_BASE} WHERE p.ID_PROMESA = :id`, { id });
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(input: CreatePromesaPagoInput): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_PROMESAS_PAGO
         (ID_CLIENTE, ID_DOCUMENTO, ID_GESTION, FECHA_PROMESA, FECHA_COMPROMISO,
          MONTO_COMPROMETIDO, ESTADO, OBSERVACIONES)
       VALUES
         (:idCliente, :idDocumento, :idGestion,
          TO_DATE(:fechaPromesa, 'YYYY-MM-DD'), TO_DATE(:fechaCompromiso, 'YYYY-MM-DD'),
          :montoComprometido, :estado, :observaciones)
       RETURNING ID_PROMESA INTO :id`,
      {
        idCliente: input.idCliente,
        idDocumento: input.idDocumento ?? null,
        idGestion: input.idGestion ?? null,
        fechaPromesa: input.fechaPromesa,
        fechaCompromiso: input.fechaCompromiso ?? null,
        montoComprometido: input.montoComprometido,
        estado: input.estado ?? 'PENDIENTE',
        observaciones: input.observaciones ?? null,
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

export async function update(id: number, input: UpdatePromesaPagoInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.idCliente !== undefined) { fields.push('ID_CLIENTE = :idCliente'); binds.idCliente = input.idCliente; }
  if (input.idDocumento !== undefined) { fields.push('ID_DOCUMENTO = :idDocumento'); binds.idDocumento = input.idDocumento; }
  if (input.idGestion !== undefined) { fields.push('ID_GESTION = :idGestion'); binds.idGestion = input.idGestion; }
  if (input.fechaCompromiso !== undefined) { fields.push(`FECHA_COMPROMISO = TO_DATE(:fechaCompromiso, 'YYYY-MM-DD')`); binds.fechaCompromiso = input.fechaCompromiso; }
  if (input.montoComprometido !== undefined) { fields.push('MONTO_COMPROMETIDO = :montoComprometido'); binds.montoComprometido = input.montoComprometido; }
  if (input.estado !== undefined) { fields.push('ESTADO = :estado'); binds.estado = input.estado; }
  if (input.observaciones !== undefined) { fields.push('OBSERVACIONES = :observaciones'); binds.observaciones = input.observaciones; }

  if (fields.length === 0) return;

  const conn = await getConnection();
  try {
    await conn.execute(`UPDATE CXC_PROMESAS_PAGO SET ${fields.join(', ')} WHERE ID_PROMESA = :id`, binds);
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
    await conn.execute(`DELETE FROM CXC_PROMESAS_PAGO WHERE ID_PROMESA = :id`, { id });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}