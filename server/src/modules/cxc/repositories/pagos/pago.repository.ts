import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { Pago, CreatePagoInput, UpdatePagoInput, AnularPagoInput } from '@erp/contracts';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';

interface Row {
  ID_PAGO: number;
  ID_CLIENTE: number;
  NOMBRE_CLIENTE: string | null;
  ID_FORMA_PAGO: number;
  ID_MONEDA: number;
  ID_BANCO: number | null;
  NOMBRE_BANCO: string | null;
  FECHA_PAGO: Date;
  MONTO: number;
  MONTO_APLICADO: number;
  MONTO_DISPONIBLE: number;
  NUMERO_REFERENCIA: string | null;
  ESTADO: string;
  ID_EMPLEADO_ANULACION: number | null;
  NOMBRE_EMPLEADO_ANULACION: string | null;
  FECHA_ANULACION: Date | null;
  MOTIVO_ANULACION: string | null;
}

const mapRow = (r: Row): Pago => ({
  idPago: r.ID_PAGO,
  idCliente: r.ID_CLIENTE,
  nombreCliente: r.NOMBRE_CLIENTE,
  idFormaPago: r.ID_FORMA_PAGO,
  idMoneda: r.ID_MONEDA,
  idBanco: r.ID_BANCO,
  nombreBanco: r.NOMBRE_BANCO,
  fechaPago: r.FECHA_PAGO?.toISOString() ?? '',
  monto: r.MONTO,
  montoAplicado: Number(r.MONTO_APLICADO ?? 0),
  montoDisponible: Number(r.MONTO_DISPONIBLE ?? r.MONTO),
  numeroReferencia: r.NUMERO_REFERENCIA,
  estado: r.ESTADO,
  idEmpleadoAnulacion: r.ID_EMPLEADO_ANULACION,
  nombreEmpleadoAnulacion: r.NOMBRE_EMPLEADO_ANULACION,
  fechaAnulacion: r.FECHA_ANULACION?.toISOString() ?? null,
  motivoAnulacion: r.MOTIVO_ANULACION,
});

const SELECT_BASE = `
  SELECT p.ID_PAGO,
         p.ID_CLIENTE,
         c.NOMBRE AS NOMBRE_CLIENTE,
         p.ID_FORMA_PAGO,
         p.ID_MONEDA,
         p.ID_BANCO,
         b.NOMBRE AS NOMBRE_BANCO,
         p.FECHA_PAGO,
         p.MONTO,
         NVL((SELECT SUM(a.MONTO_APLICADO)
                FROM CXC_APLICACION_PAGOS a
               WHERE a.ID_PAGO = p.ID_PAGO AND a.ESTADO = 'CONFIRMADA'), 0) AS MONTO_APLICADO,
         GREATEST(
           p.MONTO - NVL((SELECT SUM(a.MONTO_APLICADO)
                            FROM CXC_APLICACION_PAGOS a
                           WHERE a.ID_PAGO = p.ID_PAGO AND a.ESTADO = 'CONFIRMADA'), 0),
           0
         ) AS MONTO_DISPONIBLE,
         p.NUMERO_REFERENCIA,
         p.ESTADO,
         p.ID_EMPLEADO_ANULACION,
         CASE
           WHEN ea.ID_EMPLEADO IS NULL THEN NULL
           ELSE TRIM(ea.NOMBRE || ' ' || NVL(ea.APELLIDO, ''))
         END AS NOMBRE_EMPLEADO_ANULACION,
         p.FECHA_ANULACION,
         p.MOTIVO_ANULACION
    FROM CXC_PAGOS p
    LEFT JOIN CLIENTE c ON c.ID_CLIENTE = p.ID_CLIENTE
    LEFT JOIN MB_BANCO b ON b.BANCO_ID = p.ID_BANCO
    LEFT JOIN EMPLEADO ea ON ea.ID_EMPLEADO = p.ID_EMPLEADO_ANULACION
`;

export async function findAll({ page, limit, search }: { page: number; limit: number; search?: string }) {
  const c = await getConnection();
  try {
    const offset = (page - 1) * limit;
    const where = search
      ? `WHERE UPPER(NVL(p.NUMERO_REFERENCIA,'')) LIKE UPPER(:search)
          OR UPPER(NVL(p.ESTADO,'')) LIKE UPPER(:search)
          OR UPPER(NVL(c.NOMBRE,'')) LIKE UPPER(:search)
          OR TO_CHAR(p.ID_PAGO) LIKE :search`
      : '';
    const sb = search ? { search: `%${search}%` } : {};
    const data = await c.execute<Row>(
      `${SELECT_BASE}
       ${where}
       ORDER BY p.FECHA_PAGO DESC,p.ID_PAGO DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...sb, offset, limit },
    );
    const cnt = await c.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) TOTAL
         FROM CXC_PAGOS p
         LEFT JOIN CLIENTE c ON c.ID_CLIENTE = p.ID_CLIENTE
         ${where}`,
      sb,
    );
    return { data: (data.rows ?? []).map(mapRow), total: cnt.rows?.[0]?.TOTAL ?? 0 };
  } finally {
    await c.close();
  }
}

export async function findById(id: number) {
  const c = await getConnection();
  try {
    const r = await c.execute<Row>(`${SELECT_BASE} WHERE p.ID_PAGO=:id`, { id });
    return r.rows?.[0] ? mapRow(r.rows[0]) : null;
  } finally {
    await c.close();
  }
}

export async function create(i: CreatePagoInput) {
  const c = await getConnection();
  try {
    const r = await c.execute<{ id: number[] }>(
      `INSERT INTO CXC_PAGOS
         (ID_CLIENTE,ID_FORMA_PAGO,ID_MONEDA,ID_BANCO,FECHA_PAGO,MONTO,NUMERO_REFERENCIA,ESTADO)
       VALUES
         (:idCliente,:idFormaPago,:idMoneda,:idBanco,TO_DATE(:fechaPago,'YYYY-MM-DD'),:monto,:numeroReferencia,:estado)
       RETURNING ID_PAGO INTO :id`,
      {
        idCliente: i.idCliente,
        idFormaPago: i.idFormaPago,
        idMoneda: i.idMoneda,
        idBanco: i.idBanco ?? null,
        fechaPago: i.fechaPago,
        monto: i.monto,
        numeroReferencia: i.numeroReferencia ?? null,
        estado: i.estado ?? 'NO_APLICADO',
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    await c.commit();
    return r.outBinds!.id[0];
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
  }
}

/**
 * Bloquea el pago (FOR UPDATE) y revalida bajo esa misma conexión que sigue
 * sin aplicaciones CONFIRMADA antes de escribir. Una lectura suelta aquí
 * (como antes) quedaría obsoleta frente a una aplicación concurrente.
 */
async function lockYValidarSinAplicaciones(c: oracledb.Connection, id: number, mensajeSiAplicado: string): Promise<{ ESTADO: string }> {
  const lockResult = await c.execute<{ ESTADO: string }>(
    `SELECT ESTADO FROM CXC_PAGOS WHERE ID_PAGO = :id FOR UPDATE`,
    { id },
  );
  const row = lockResult.rows?.[0];
  if (!row) throw new NotFoundError(`Pago ${id} no encontrado`);

  const sumResult = await c.execute<{ TOTAL: number }>(
    `SELECT NVL(SUM(MONTO_APLICADO), 0) AS TOTAL FROM CXC_APLICACION_PAGOS WHERE ID_PAGO = :id AND ESTADO = 'CONFIRMADA'`,
    { id },
  );
  if (Number(sumResult.rows?.[0]?.TOTAL ?? 0) > 0.005) {
    throw new ConflictError(mensajeSiAplicado);
  }
  return row;
}

export async function update(id: number, i: UpdatePagoInput) {
  const f: string[] = [];
  const b: Record<string, any> = { id };
  if (i.idCliente !== undefined) { f.push('ID_CLIENTE=:idCliente'); b.idCliente = i.idCliente; }
  if (i.idFormaPago !== undefined) { f.push('ID_FORMA_PAGO=:idFormaPago'); b.idFormaPago = i.idFormaPago; }
  if (i.idMoneda !== undefined) { f.push('ID_MONEDA=:idMoneda'); b.idMoneda = i.idMoneda; }
  if (i.idBanco !== undefined) { f.push('ID_BANCO=:idBanco'); b.idBanco = i.idBanco; }
  if (i.fechaPago !== undefined) { f.push(`FECHA_PAGO=TO_DATE(:fechaPago,'YYYY-MM-DD')`); b.fechaPago = i.fechaPago; }
  if (i.monto !== undefined) { f.push('MONTO=:monto'); b.monto = i.monto; }
  if (i.numeroReferencia !== undefined) { f.push('NUMERO_REFERENCIA=:numeroReferencia'); b.numeroReferencia = i.numeroReferencia; }
  if (i.estado !== undefined) { f.push('ESTADO=:estado'); b.estado = i.estado; }
  if (!f.length) return;

  const c = await getConnection();
  try {
    await lockYValidarSinAplicaciones(
      c,
      id,
      'El pago ya tiene aplicaciones y no puede editarse directamente. Primero debe reversarse la aplicación.',
    );
    await c.execute(`UPDATE CXC_PAGOS SET ${f.join(',')} WHERE ID_PAGO=:id`, b);
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
  }
}

export async function remove(id: number) {
  const c = await getConnection();
  try {
    const row = await lockYValidarSinAplicaciones(
      c,
      id,
      'Un pago con aplicaciones no se elimina. Debe reversarse para conservar trazabilidad.',
    );
    const estado = String(row.ESTADO ?? '').trim().toUpperCase();
    if (!['NO_IDENTIFICADO', 'NO_APLICADO'].includes(estado)) {
      throw new ConflictError('Solo pagos sin aplicar pueden eliminarse físicamente. Los demás deben anularse/reversarse.');
    }
    await c.execute(`DELETE FROM CXC_PAGOS WHERE ID_PAGO=:id`, { id });
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
  }
}

export async function listOptions(idCliente?: number) {
  const c = await getConnection();
  try {
    const where = idCliente ? 'WHERE p.ID_CLIENTE = :idCliente' : '';
    const r = await c.execute<{
      ID_PAGO: number;
      ID_CLIENTE: number;
      NUMERO_REFERENCIA: string | null;
      MONTO: number;
      DISPONIBLE: number;
      ESTADO: string;
    }>(
      `SELECT p.ID_PAGO,
              p.ID_CLIENTE,
              p.NUMERO_REFERENCIA,
              p.MONTO,
              GREATEST(p.MONTO - NVL(SUM(a.MONTO_APLICADO),0),0) DISPONIBLE,
              p.ESTADO
         FROM CXC_PAGOS p
         LEFT JOIN CXC_APLICACION_PAGOS a ON a.ID_PAGO = p.ID_PAGO AND a.ESTADO = 'CONFIRMADA'
         ${where}
        GROUP BY p.ID_PAGO,p.ID_CLIENTE,p.NUMERO_REFERENCIA,p.MONTO,p.ESTADO
       HAVING GREATEST(p.MONTO - NVL(SUM(a.MONTO_APLICADO),0),0) > 0
          AND UPPER(NVL(p.ESTADO,'NO_APLICADO')) NOT IN ('ANULADO','REVERSADO')
        ORDER BY p.ID_PAGO DESC`,
      idCliente ? { idCliente } : {},
    );
    return (r.rows ?? []).map((x) => ({
      id: x.ID_PAGO,
      idCliente: x.ID_CLIENTE,
      label: `Pago #${x.ID_PAGO}${x.NUMERO_REFERENCIA ? ` · ${x.NUMERO_REFERENCIA}` : ''} · Disponible Q ${Number(x.DISPONIBLE).toFixed(2)}`,
      monto: x.MONTO,
      saldo: x.DISPONIBLE,
      estado: x.ESTADO,
    }));
  } finally {
    await c.close();
  }
}

/**
 * Anulación formal: solo permitida sin aplicaciones CONFIRMADA vigentes
 * (reversar primero cada aplicación si las tiene). No borra la fila; deja
 * ESTADO='ANULADO' con trazabilidad. Bloquea la fila para serializar contra
 * una aplicación concurrente.
 */
export async function anular(id: number, input: AnularPagoInput): Promise<void> {
  const c = await getConnection();
  try {
    const result = await c.execute<{ ESTADO: string }>(
      `SELECT ESTADO FROM CXC_PAGOS WHERE ID_PAGO = :id FOR UPDATE`,
      { id },
    );
    const row = result.rows?.[0];
    if (!row) throw new NotFoundError(`Pago ${id} no encontrado`);

    const estadoActual = String(row.ESTADO ?? '').trim().toUpperCase();
    if (estadoActual === 'ANULADO') throw new ConflictError('Este pago ya está anulado.');

    const aplicadoResult = await c.execute<{ TOTAL: number }>(
      `SELECT NVL(SUM(MONTO_APLICADO), 0) TOTAL
         FROM CXC_APLICACION_PAGOS
        WHERE ID_PAGO = :id AND ESTADO = 'CONFIRMADA'`,
      { id },
    );
    if (Number(aplicadoResult.rows?.[0]?.TOTAL ?? 0) > 0.005) {
      throw new ConflictError('Este pago tiene aplicaciones vigentes. Reversa cada aplicación antes de anularlo.');
    }

    await c.execute(
      `UPDATE CXC_PAGOS
          SET ESTADO = 'ANULADO',
              ID_EMPLEADO_ANULACION = :idEmpleadoAnulacion,
              FECHA_ANULACION = NVL(TO_DATE(:fechaAnulacion, 'YYYY-MM-DD'), SYSDATE),
              MOTIVO_ANULACION = :motivoAnulacion
        WHERE ID_PAGO = :id`,
      {
        idEmpleadoAnulacion: input.idEmpleadoAnulacion,
        fechaAnulacion: input.fechaAnulacion ?? null,
        motivoAnulacion: input.motivoAnulacion,
        id,
      },
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
  }
}
