import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { ConvenioCuota, UpdateConvenioCuotaInput } from '@erp/contracts';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
import { EPSILON, roundMoney, deriveDocumentoEstado } from '../../shared/financialRules';
import { businessTodayIso } from '../../../../shared/date';
import { registrarEvento } from '../documentos/documentoHistorial.repository';
import { crearReciboAutomatico } from '../pagos/recibo.repository';

interface ConvenioCuotaRow {
  ID_CUOTA: number;
  ID_CONVENIO: number;
  NUMERO_CUOTA: number;
  FECHA_VENCIMIENTO: Date;
  MONTO: number;
  SALDO: number;
  ESTADO: string;
  ID_FORMA_PAGO: number | null;
  NOMBRE_FORMA_PAGO: string | null;
  REFERENCIA_PAGO: string | null;
}

function mapRow(row: ConvenioCuotaRow): ConvenioCuota {
  const estado = row.ESTADO as ConvenioCuota['estado'];
  const fechaVencimiento = row.FECHA_VENCIMIENTO?.toISOString() ?? '';
  const saldo = Number(row.SALDO);

  // Nada transiciona PENDIENTE -> VENCIDA automáticamente (no hay
  // job/trigger); señal de lectura para la UI, igual que Documento.condicion.
  // `estado` sigue siendo lo único que registrarPago()/el CRUD pueden mutar.
  const estaVencida = estado === 'PENDIENTE' && saldo > EPSILON && fechaVencimiento.slice(0, 10) < businessTodayIso();

  return {
    idCuota: row.ID_CUOTA,
    idConvenio: row.ID_CONVENIO,
    numeroCuota: row.NUMERO_CUOTA,
    fechaVencimiento,
    monto: row.MONTO,
    saldo: row.SALDO,
    estado,
    idFormaPago: row.ID_FORMA_PAGO,
    nombreFormaPago: row.NOMBRE_FORMA_PAGO,
    referenciaPago: row.REFERENCIA_PAGO,
    estaVencida,
  };
}

const SELECT_BASE = `
  SELECT cc.ID_CUOTA, cc.ID_CONVENIO, cc.NUMERO_CUOTA, cc.FECHA_VENCIMIENTO,
         cc.MONTO, cc.SALDO, cc.ESTADO, cc.ID_FORMA_PAGO,
         fp.NOMBRE AS NOMBRE_FORMA_PAGO, cc.REFERENCIA_PAGO
  FROM CXC_CONVENIO_CUOTAS cc
  LEFT JOIN CXC_FORMAS_PAGO fp ON fp.ID_FORMA_PAGO = cc.ID_FORMA_PAGO
`;
// LEFT JOIN (no JOIN normal): las cuotas que todavía no se han pagado no
// tienen ID_FORMA_PAGO, y aun así deben aparecer en el listado.

export async function findByConvenio(idConvenio: number): Promise<ConvenioCuota[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<ConvenioCuotaRow>(
      `${SELECT_BASE} WHERE cc.ID_CONVENIO = :idConvenio ORDER BY cc.NUMERO_CUOTA ASC`,
      { idConvenio },
    );
    return (result.rows ?? []).map(mapRow);
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<ConvenioCuota | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<ConvenioCuotaRow>(
      `${SELECT_BASE} WHERE cc.ID_CUOTA = :id`,
      { id },
    );
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function update(id: number, input: UpdateConvenioCuotaInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.fechaVencimiento !== undefined) { fields.push(`FECHA_VENCIMIENTO = TO_DATE(:fechaVencimiento, 'YYYY-MM-DD')`); binds.fechaVencimiento = input.fechaVencimiento; }
  if (input.monto !== undefined) { fields.push('MONTO = :monto'); binds.monto = input.monto; }
  if (input.saldo !== undefined) { fields.push('SALDO = :saldo'); binds.saldo = input.saldo; }
  if (input.estado !== undefined) { fields.push('ESTADO = :estado'); binds.estado = input.estado; }

  if (fields.length === 0) return;

  const conn = await getConnection();
  try {
    await conn.execute(`UPDATE CXC_CONVENIO_CUOTAS SET ${fields.join(', ')} WHERE ID_CUOTA = :id`, binds);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

interface ConvenioDocumentoLockRow {
  ID_DOCUMENTO: number;
  ID_MONEDA: number;
  TOTAL: number;
  SALDO: number;
  ESTADO: string;
}

/**
 * Registra un abono a la cuota: bloquea la cuota, el convenio y todos los
 * documentos reales que el convenio cubre (CXC_CONVENIO_DOCUMENTOS), y
 * distribuye el monto pagado entre esos documentos (el más antiguo primero)
 * exactamente igual que una aplicación de pago normal — crea un CXC_PAGOS,
 * una CXC_APLICACION_PAGOS por cada documento tocado, actualiza SALDO/ESTADO
 * de cada documento, deja historial automático y genera recibo automático.
 * Antes de este cambio, pagar una cuota solo bajaba el saldo interno de la
 * cuota sin tocar nunca el saldo real de ningún documento. Si al terminar
 * todas las cuotas del convenio quedan pagadas, el convenio pasa a CUMPLIDO
 * automáticamente. Una sola conexión, un solo commit.
 */
export async function registrarPago(
  id: number,
  montoPagado: number,
  idFormaPago: number,
  referenciaPago: string | undefined,
  idEmpleado: number,
): Promise<ConvenioCuota> {
  const conn = await getConnection();
  try {
    const current = await conn.execute<{ ID_CONVENIO: number; SALDO: number; ESTADO: string; NUMERO_CUOTA: number }>(
      `SELECT ID_CONVENIO, SALDO, ESTADO, NUMERO_CUOTA FROM CXC_CONVENIO_CUOTAS WHERE ID_CUOTA = :id FOR UPDATE`,
      { id },
    );
    const row = current.rows?.[0];
    if (!row) throw new NotFoundError(`Cuota ${id} no encontrada`);

    const saldoActual = Number(row.SALDO);
    if (saldoActual <= 0 || row.ESTADO === 'PAGADA') {
      throw new BadRequestError('La cuota ya está pagada');
    }
    if (montoPagado > saldoActual + EPSILON) {
      throw new BadRequestError('El monto pagado no puede superar el saldo de la cuota');
    }

    const convenioResult = await conn.execute<{ ID_CLIENTE: number; ESTADO: string }>(
      `SELECT ID_CLIENTE, ESTADO FROM CXC_CONVENIOS_PAGO WHERE ID_CONVENIO = :idConvenio FOR UPDATE`,
      { idConvenio: row.ID_CONVENIO },
    );
    const convenio = convenioResult.rows?.[0];
    if (!convenio) throw new BadRequestError('El convenio de esta cuota ya no existe');
    if (convenio.ESTADO === 'CANCELADO') {
      throw new ConflictError('No se puede registrar un pago sobre un convenio cancelado.');
    }

    const documentosResult = await conn.execute<ConvenioDocumentoLockRow>(
      `SELECT d.ID_DOCUMENTO, d.ID_MONEDA, d.TOTAL, d.SALDO, d.ESTADO
         FROM CXC_CONVENIO_DOCUMENTOS cvd
         JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = cvd.ID_DOCUMENTO
        WHERE cvd.ID_CONVENIO = :idConvenio
          AND d.SALDO > 0
        ORDER BY d.FECHA_VENCIMIENTO ASC
        FOR UPDATE OF d.SALDO`,
      { idConvenio: row.ID_CONVENIO },
    );
    const documentos = documentosResult.rows ?? [];
    if (documentos.length === 0) {
      throw new ConflictError('Los documentos que cubre este convenio ya no tienen saldo pendiente (se pagaron por otro medio); no hay nada que aplicar.');
    }

    const fechaHoy = businessTodayIso();
    const pagoInsert = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_PAGOS (ID_CLIENTE, ID_FORMA_PAGO, ID_MONEDA, FECHA_PAGO, MONTO, NUMERO_REFERENCIA, ESTADO)
       VALUES (:idCliente, :idFormaPago, :idMoneda, TO_DATE(:fechaPago, 'YYYY-MM-DD'), :monto, :numeroReferencia, 'NO_APLICADO')
       RETURNING ID_PAGO INTO :id`,
      {
        idCliente: convenio.ID_CLIENTE,
        idFormaPago,
        idMoneda: documentos[0].ID_MONEDA,
        fechaPago: fechaHoy,
        monto: montoPagado,
        numeroReferencia: referenciaPago ?? null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    const idPago = pagoInsert.outBinds!.id[0];

    let restante = roundMoney(montoPagado);
    let totalAplicado = 0;
    for (const doc of documentos) {
      if (restante <= EPSILON) break;
      const saldoDoc = roundMoney(Number(doc.SALDO));
      const montoAplicar = roundMoney(Math.min(restante, saldoDoc));
      if (montoAplicar <= EPSILON) continue;

      await conn.execute(
        `INSERT INTO CXC_APLICACION_PAGOS (ID_PAGO, ID_DOCUMENTO, FECHA_APLICACION, MONTO_APLICADO, ID_EMPLEADO)
         VALUES (:idPago, :idDocumento, TO_DATE(:fecha, 'YYYY-MM-DD'), :monto, :idEmpleado)`,
        { idPago, idDocumento: doc.ID_DOCUMENTO, fecha: fechaHoy, monto: montoAplicar, idEmpleado },
      );

      const nuevoSaldoDoc = Math.max(0, roundMoney(saldoDoc - montoAplicar));
      const nuevoEstadoDoc = deriveDocumentoEstado(Number(doc.TOTAL), nuevoSaldoDoc, doc.ESTADO);
      await conn.execute(
        `UPDATE CXC_DOCUMENTOS SET SALDO = :saldo, ESTADO = :estado WHERE ID_DOCUMENTO = :idDocumento`,
        { saldo: nuevoSaldoDoc, estado: nuevoEstadoDoc, idDocumento: doc.ID_DOCUMENTO },
      );

      await registrarEvento(conn, {
        idDocumento: doc.ID_DOCUMENTO,
        estadoAnterior: doc.ESTADO,
        estadoNuevo: nuevoEstadoDoc,
        idEmpleado,
        tipoEvento: 'APLICACION_PAGO',
        monto: montoAplicar,
        naturaleza: 'ABONO',
        descripcion: `Pago de cuota #${row.NUMERO_CUOTA} del convenio #${row.ID_CONVENIO}`,
        fecha: fechaHoy,
      });

      await crearReciboAutomatico(conn, {
        idCliente: convenio.ID_CLIENTE,
        idPago,
        fecha: fechaHoy,
        monto: montoAplicar,
      });

      restante = roundMoney(restante - montoAplicar);
      totalAplicado = roundMoney(totalAplicado + montoAplicar);
    }

    const nuevoEstadoPago =
      totalAplicado <= EPSILON ? 'NO_APLICADO' : totalAplicado >= montoPagado - EPSILON ? 'APLICADO' : 'EN_CUENTA';
    await conn.execute(`UPDATE CXC_PAGOS SET ESTADO = :estado WHERE ID_PAGO = :idPago`, { estado: nuevoEstadoPago, idPago });

    const nuevoSaldoCuota = Math.max(0, roundMoney(saldoActual - montoPagado));
    const nuevoEstadoCuota = nuevoSaldoCuota <= EPSILON ? 'PAGADA' : row.ESTADO;
    await conn.execute(
      `UPDATE CXC_CONVENIO_CUOTAS
          SET SALDO = :saldo, ESTADO = :estado, ID_FORMA_PAGO = :idFormaPago, REFERENCIA_PAGO = :referenciaPago
        WHERE ID_CUOTA = :id`,
      { saldo: nuevoSaldoCuota, estado: nuevoEstadoCuota, idFormaPago, referenciaPago: referenciaPago ?? null, id },
    );

    if (nuevoEstadoCuota === 'PAGADA') {
      const pendientesResult = await conn.execute<{ TOTAL: number }>(
        `SELECT COUNT(*) TOTAL FROM CXC_CONVENIO_CUOTAS WHERE ID_CONVENIO = :idConvenio AND ID_CUOTA <> :id AND SALDO > :epsilon`,
        { idConvenio: row.ID_CONVENIO, id, epsilon: EPSILON },
      );
      if (Number(pendientesResult.rows?.[0]?.TOTAL ?? 0) === 0) {
        await conn.execute(
          `UPDATE CXC_CONVENIOS_PAGO SET ESTADO = 'CUMPLIDO' WHERE ID_CONVENIO = :idConvenio`,
          { idConvenio: row.ID_CONVENIO },
        );
      }
    }

    const reloaded = await conn.execute<ConvenioCuotaRow>(`${SELECT_BASE} WHERE cc.ID_CUOTA = :id`, { id });
    await conn.commit();
    return mapRow(reloaded.rows![0]);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}