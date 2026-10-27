import oracledb, { type Connection } from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { Recibo, CreateReciboInput, UpdateReciboInput } from '@erp/contracts';
import { ConflictError, NotFoundError } from '../../../../shared/errors/AppError';

interface Row {
  ID_RECIBO: number;
  ID_CLIENTE: number;
  NOMBRE_CLIENTE: string | null;
  ID_PAGO: number;
  REFERENCIA_PAGO: string | null;
  NUMERO_RECIBO: string | null;
  FECHA: Date;
  MONTO: number;
  ESTADO: string;
}

const map = (r: Row): Recibo => ({
  idRecibo: r.ID_RECIBO,
  idCliente: r.ID_CLIENTE,
  nombreCliente: r.NOMBRE_CLIENTE,
  idPago: r.ID_PAGO,
  referenciaPago: r.REFERENCIA_PAGO,
  numeroRecibo: r.NUMERO_RECIBO,
  fecha: r.FECHA?.toISOString() ?? '',
  monto: r.MONTO,
  estado: r.ESTADO as Recibo['estado'],
});

const SELECT_BASE = `
  SELECT r.ID_RECIBO,
         r.ID_CLIENTE,
         c.NOMBRE AS NOMBRE_CLIENTE,
         r.ID_PAGO,
         p.NUMERO_REFERENCIA AS REFERENCIA_PAGO,
         r.NUMERO_RECIBO,
         r.FECHA,
         r.MONTO,
         r.ESTADO
    FROM CXC_RECIBOS r
    JOIN CLIENTE c ON c.ID_CLIENTE = r.ID_CLIENTE
    JOIN CXC_PAGOS p ON p.ID_PAGO = r.ID_PAGO
`;

export async function findAll({
  page,
  limit,
  search,
}: {
  page: number;
  limit: number;
  search?: string;
}) {
  const c = await getConnection();
  try {
    const where = search
      ? `WHERE UPPER(c.NOMBRE) LIKE UPPER(:search)
           OR UPPER(r.NUMERO_RECIBO) LIKE UPPER(:search)
           OR UPPER(r.ESTADO) LIKE UPPER(:search)
           OR UPPER(p.NUMERO_REFERENCIA) LIKE UPPER(:search)
           OR TO_CHAR(r.ID_RECIBO) LIKE :search`
      : '';
    const searchBinds = search ? { search: `%${search}%` } : {};

    const data = await c.execute<Row>(
      `${SELECT_BASE} ${where}
       ORDER BY r.FECHA DESC, r.ID_RECIBO DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBinds, offset: (page - 1) * limit, limit },
    );
    const count = await c.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) TOTAL
         FROM CXC_RECIBOS r
         JOIN CLIENTE c ON c.ID_CLIENTE = r.ID_CLIENTE
         JOIN CXC_PAGOS p ON p.ID_PAGO = r.ID_PAGO
         ${where}`,
      searchBinds,
    );
    return { data: (data.rows ?? []).map(map), total: count.rows?.[0]?.TOTAL ?? 0 };
  } finally {
    await c.close();
  }
}

export async function findById(id: number): Promise<Recibo | null> {
  const c = await getConnection();
  try {
    const result = await c.execute<Row>(
      `${SELECT_BASE} WHERE r.ID_RECIBO = :id`,
      { id },
    );
    return result.rows?.[0] ? map(result.rows[0]) : null;
  } finally {
    await c.close();
  }
}

// Creacion manual: conserva el contrato y las comprobaciones del servicio.
export async function create(input: CreateReciboInput): Promise<number> {
  const c = await getConnection();
  try {
    const result = await c.execute<{ id: number[] }>(
      `INSERT INTO CXC_RECIBOS
         (ID_CLIENTE, ID_PAGO, NUMERO_RECIBO, FECHA, MONTO, ESTADO)
       VALUES
         (:idCliente, :idPago, :numeroRecibo,
          TO_DATE(:fecha, 'YYYY-MM-DD'), :monto, :estado)
       RETURNING ID_RECIBO INTO :id`,
      {
        idCliente: input.idCliente,
        idPago: input.idPago,
        numeroRecibo: input.numeroRecibo ?? null,
        fecha: input.fecha,
        monto: input.monto,
        estado: input.estado,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    await c.commit();
    return result.outBinds!.id[0];
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    await c.close();
  }
}

async function lockYValidarReciboEditable(
  c: Connection,
  id: number,
  operacion: 'modificar' | 'eliminar',
): Promise<void> {
  const result = await c.execute<{ ESTADO: string }>(
    `SELECT ESTADO FROM CXC_RECIBOS WHERE ID_RECIBO = :id FOR UPDATE`,
    { id },
  );
  const row = result.rows?.[0];
  if (!row) throw new NotFoundError(`Recibo ${id} no encontrado`);

  if (String(row.ESTADO ?? '').trim().toUpperCase() === 'EMITIDO') {
    throw new ConflictError(
      operacion === 'modificar'
        ? 'Un recibo emitido no puede modificarse directamente.'
        : 'Un recibo emitido no puede eliminarse fisicamente.',
    );
  }
}

export async function update(id: number, input: UpdateReciboInput): Promise<void> {
  const fields: string[] = [];
  // Usar valores primitivos para los binds. BindParameter NO acepta
  // directamente numeros o cadenas y BindData no existe en esta version.
  const binds: Record<string, string | number | null> = { id };

  const columnas = [
    ['idCliente', 'ID_CLIENTE'],
    ['idPago', 'ID_PAGO'],
    ['numeroRecibo', 'NUMERO_RECIBO'],
    ['monto', 'MONTO'],
    ['estado', 'ESTADO'],
  ] as const;

  for (const [key, columna] of columnas) {
    const value = input[key];
    if (value !== undefined) {
      fields.push(`${columna} = :${key}`);
      binds[key] = value;
    }
  }

  if (input.fecha !== undefined) {
    fields.push("FECHA = TO_DATE(:fecha, 'YYYY-MM-DD')");
    binds.fecha = input.fecha;
  }

  if (fields.length === 0) return;

  const c = await getConnection();
  try {
    await lockYValidarReciboEditable(c, id, 'modificar');
    const sql = `UPDATE CXC_RECIBOS SET ${fields.join(', ')} WHERE ID_RECIBO = :id`;
    await c.execute(sql, binds);
    await c.commit();
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    await c.close();
  }
}

export async function remove(id: number): Promise<void> {
  const c = await getConnection();
  try {
    await lockYValidarReciboEditable(c, id, 'eliminar');
    await c.execute(`DELETE FROM CXC_RECIBOS WHERE ID_RECIBO = :id`, { id });
    await c.commit();
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    await c.close();
  }
}

/**
 * Genera un recibo dentro de la misma transaccion de la aplicacion del pago.
 * No abre una nueva conexion ni realiza commit.
 * La numeracion REC-AAAA-000001 es interna del ERP, no es FEL/SAT.
 */
export async function crearReciboAutomatico(
  conn: Connection,
  input: { idCliente: number; idPago: number; fecha: string; monto: number },
): Promise<number> {
  const insert = await conn.execute<{ id: number[] }>(
    `INSERT INTO CXC_RECIBOS (ID_CLIENTE, ID_PAGO, FECHA, MONTO, ESTADO)
     VALUES (:idCliente, :idPago, TO_DATE(:fecha, 'YYYY-MM-DD'), :monto, 'EMITIDO')
     RETURNING ID_RECIBO INTO :id`,
    {
      idCliente: input.idCliente,
      idPago: input.idPago,
      fecha: input.fecha,
      monto: input.monto,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
  );
  const idRecibo = insert.outBinds!.id[0];
  await conn.execute(
    `UPDATE CXC_RECIBOS
        SET NUMERO_RECIBO = 'REC-' || TO_CHAR(FECHA, 'YYYY') || '-' ||
                            LPAD(TO_CHAR(:idRecibo), 6, '0')
      WHERE ID_RECIBO = :idRecibo`,
    { idRecibo },
  );
  return idRecibo;
}
