import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type {
  AplicacionPago,
  CreateAplicacionPagoInput,
  UpdateAplicacionPagoInput,
  ReversarAplicacionPagoInput,
} from '@erp/contracts';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
import { deriveDocumentoEstado, isDocumentoBloqueadoParaAplicacion, roundMoney } from '../../shared/financialRules';
import { registrarEvento } from '../documentos/documentoHistorial.repository';
import { crearReciboAutomatico } from './recibo.repository';

interface Row {
  ID_APLICACION: number;
  ID_PAGO: number;
  REFERENCIA_PAGO: string | null;
  ID_DOCUMENTO: number;
  SERIE_DOCUMENTO: string | null;
  NUMERO_DOCUMENTO: string | null;
  FECHA_APLICACION: Date;
  MONTO_APLICADO: number;
  ID_EMPLEADO: number | null;
  NOMBRE_EMPLEADO: string | null;
  ESTADO: AplicacionPago['estado'];
  ID_EMPLEADO_REVERSA: number | null;
  NOMBRE_EMPLEADO_REVERSA: string | null;
  FECHA_REVERSA: Date | null;
  MOTIVO_REVERSA: string | null;
}

interface PagoLockRow {
  ID_PAGO: number;
  ID_CLIENTE: number;
  MONTO: number;
  ESTADO: string;
}

interface DocumentoLockRow {
  ID_DOCUMENTO: number;
  ID_CLIENTE: number;
  TOTAL: number;
  SALDO: number;
  ESTADO: string;
}

interface AplicacionLockRow {
  ID_APLICACION: number;
  ID_PAGO: number;
  ID_DOCUMENTO: number;
  MONTO_APLICADO: number;
  ESTADO: string;
}

const mapRow = (r: Row): AplicacionPago => ({
  idAplicacion: r.ID_APLICACION,
  idPago: r.ID_PAGO,
  referenciaPago: r.REFERENCIA_PAGO,
  idDocumento: r.ID_DOCUMENTO,
  referenciaDocumento:
    [r.SERIE_DOCUMENTO, r.NUMERO_DOCUMENTO].filter(Boolean).join('-') ||
    `Documento #${r.ID_DOCUMENTO}`,
  fechaAplicacion: r.FECHA_APLICACION?.toISOString() ?? '',
  montoAplicado: r.MONTO_APLICADO,
  idEmpleado: r.ID_EMPLEADO,
  nombreEmpleado: r.NOMBRE_EMPLEADO,
  estado: r.ESTADO,
  idEmpleadoReversa: r.ID_EMPLEADO_REVERSA,
  nombreEmpleadoReversa: r.NOMBRE_EMPLEADO_REVERSA,
  fechaReversa: r.FECHA_REVERSA?.toISOString() ?? null,
  motivoReversa: r.MOTIVO_REVERSA,
});

const SELECT_BASE = `
  SELECT a.ID_APLICACION,
         a.ID_PAGO,
         p.NUMERO_REFERENCIA AS REFERENCIA_PAGO,
         a.ID_DOCUMENTO,
         d.SERIE AS SERIE_DOCUMENTO,
         d.NUMERO_DOCUMENTO,
         a.FECHA_APLICACION,
         a.MONTO_APLICADO,
         a.ID_EMPLEADO,
         CASE
           WHEN e.ID_EMPLEADO IS NULL THEN NULL
           ELSE TRIM(e.NOMBRE || ' ' || NVL(e.APELLIDO, ''))
         END AS NOMBRE_EMPLEADO,
         a.ESTADO,
         a.ID_EMPLEADO_REVERSA,
         CASE
           WHEN er.ID_EMPLEADO IS NULL THEN NULL
           ELSE TRIM(er.NOMBRE || ' ' || NVL(er.APELLIDO, ''))
         END AS NOMBRE_EMPLEADO_REVERSA,
         a.FECHA_REVERSA,
         a.MOTIVO_REVERSA
    FROM CXC_APLICACION_PAGOS a
    JOIN CXC_PAGOS p ON p.ID_PAGO = a.ID_PAGO
    JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = a.ID_DOCUMENTO
    LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = a.ID_EMPLEADO
    LEFT JOIN EMPLEADO er ON er.ID_EMPLEADO = a.ID_EMPLEADO_REVERSA
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
    const offset = (page - 1) * limit;
    const where = search
      ? `WHERE UPPER(NVL(p.NUMERO_REFERENCIA, '')) LIKE UPPER(:search)
          OR UPPER(NVL(d.SERIE, '')) LIKE UPPER(:search)
          OR UPPER(NVL(d.NUMERO_DOCUMENTO, '')) LIKE UPPER(:search)
          OR UPPER(NVL(e.NOMBRE, '') || ' ' || NVL(e.APELLIDO, '')) LIKE UPPER(:search)
          OR TO_CHAR(a.ID_APLICACION) LIKE :search
          OR TO_CHAR(a.ID_PAGO) LIKE :search
          OR TO_CHAR(a.ID_DOCUMENTO) LIKE :search`
      : '';
    const searchBinds = search ? { search: `%${search}%` } : {};

    const dataResult = await c.execute<Row>(
      `${SELECT_BASE}
       ${where}
       ORDER BY a.FECHA_APLICACION DESC, a.ID_APLICACION DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBinds, offset, limit },
    );

    const countResult = await c.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) TOTAL
         FROM CXC_APLICACION_PAGOS a
         JOIN CXC_PAGOS p ON p.ID_PAGO = a.ID_PAGO
         JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = a.ID_DOCUMENTO
         LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = a.ID_EMPLEADO
         ${where}`,
      searchBinds,
    );

    return {
      data: (dataResult.rows ?? []).map(mapRow),
      total: countResult.rows?.[0]?.TOTAL ?? 0,
    };
  } finally {
    await c.close();
  }
}

export async function findById(id: number) {
  const c = await getConnection();
  try {
    const result = await c.execute<Row>(
      `${SELECT_BASE} WHERE a.ID_APLICACION = :id`,
      { id },
    );
    return result.rows?.[0] ? mapRow(result.rows[0]) : null;
  } finally {
    await c.close();
  }
}

/**
 * Aplica un pago de forma atómica: bloquea pago + documento, valida disponible,
 * registra la aplicación, actualiza saldo/estado del documento y estado del pago.
 */
export async function create(i: CreateAplicacionPagoInput): Promise<number> {
  const c = await getConnection();
  try {
    const pagoResult = await c.execute<PagoLockRow>(
      `SELECT ID_PAGO, ID_CLIENTE, MONTO, ESTADO
         FROM CXC_PAGOS
        WHERE ID_PAGO = :idPago
        FOR UPDATE`,
      { idPago: i.idPago },
    );
    const pago = pagoResult.rows?.[0];
    if (!pago) throw new BadRequestError('El pago seleccionado no existe');

    const documentoResult = await c.execute<DocumentoLockRow>(
      `SELECT ID_DOCUMENTO, ID_CLIENTE, TOTAL, SALDO, ESTADO
         FROM CXC_DOCUMENTOS
        WHERE ID_DOCUMENTO = :idDocumento
        FOR UPDATE`,
      { idDocumento: i.idDocumento },
    );
    const documento = documentoResult.rows?.[0];
    if (!documento) throw new BadRequestError('El documento seleccionado no existe');

    const pagoEstado = String(pago.ESTADO ?? '').trim().toUpperCase();
    if (['ANULADO', 'REVERSADO'].includes(pagoEstado)) {
      throw new ConflictError('Un pago anulado o reversado no puede aplicarse.');
    }

    if (isDocumentoBloqueadoParaAplicacion(documento.ESTADO) || Number(documento.SALDO) <= 0) {
      throw new ConflictError('El documento ya está pagado/anulado o no tiene saldo pendiente.');
    }

    if (pago.ID_CLIENTE !== documento.ID_CLIENTE) {
      throw new BadRequestError('El pago y el documento deben pertenecer al mismo cliente');
    }

    const sumResult = await c.execute<{ TOTAL: number }>(
      `SELECT NVL(SUM(MONTO_APLICADO), 0) TOTAL
         FROM CXC_APLICACION_PAGOS
        WHERE ID_PAGO = :idPago
          AND ESTADO = 'CONFIRMADA'`,
      { idPago: i.idPago },
    );
    const yaAplicado = Number(sumResult.rows?.[0]?.TOTAL ?? 0);
    const disponiblePago = roundMoney(Number(pago.MONTO) - yaAplicado);
    const saldoDocumento = roundMoney(Number(documento.SALDO));
    const montoAplicado = roundMoney(Number(i.montoAplicado));

    if (montoAplicado <= 0) {
      throw new BadRequestError('El monto aplicado debe ser mayor a cero');
    }
    if (montoAplicado > saldoDocumento + 0.005) {
      throw new BadRequestError('El monto aplicado no puede superar el saldo del documento');
    }
    if (montoAplicado > disponiblePago + 0.005) {
      throw new BadRequestError('El monto aplicado no puede superar el monto disponible del pago');
    }

    const insert = await c.execute<{ id: number[] }>(
      `INSERT INTO CXC_APLICACION_PAGOS
         (ID_PAGO,ID_DOCUMENTO,FECHA_APLICACION,MONTO_APLICADO,ID_EMPLEADO)
       VALUES
         (:idPago,:idDocumento,TO_DATE(:fechaAplicacion,'YYYY-MM-DD'),:montoAplicado,:idEmpleado)
       RETURNING ID_APLICACION INTO :id`,
      {
        idPago: i.idPago,
        idDocumento: i.idDocumento,
        fechaAplicacion: i.fechaAplicacion,
        montoAplicado,
        idEmpleado: i.idEmpleado,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );

    const nuevoSaldo = Math.max(0, roundMoney(saldoDocumento - montoAplicado));
    const nuevoEstadoDocumento = deriveDocumentoEstado(
      Number(documento.TOTAL),
      nuevoSaldo,
      documento.ESTADO,
    );

    await c.execute(
      `UPDATE CXC_DOCUMENTOS
          SET SALDO = :saldo,
              ESTADO = :estado
        WHERE ID_DOCUMENTO = :idDocumento`,
      {
        saldo: nuevoSaldo,
        estado: nuevoEstadoDocumento,
        idDocumento: i.idDocumento,
      },
    );

    const totalAplicado = roundMoney(yaAplicado + montoAplicado);
    const nuevoEstadoPago =
      totalAplicado >= Number(pago.MONTO) - 0.005 ? 'APLICADO' : 'EN_CUENTA';

    await c.execute(
      `UPDATE CXC_PAGOS
          SET ESTADO = :estado
        WHERE ID_PAGO = :idPago`,
      { estado: nuevoEstadoPago, idPago: i.idPago },
    );

    await registrarEvento(c, {
      idDocumento: i.idDocumento,
      estadoAnterior: documento.ESTADO,
      estadoNuevo: nuevoEstadoDocumento,
      idEmpleado: i.idEmpleado,
      tipoEvento: 'APLICACION_PAGO',
      monto: montoAplicado,
      naturaleza: 'ABONO',
      descripcion: `Pago #${i.idPago} aplicado al documento`,
      fecha: i.fechaAplicacion,
    });

    await crearReciboAutomatico(c, {
      idCliente: documento.ID_CLIENTE,
      idPago: i.idPago,
      fecha: i.fechaAplicacion,
      monto: montoAplicado,
    });

    await c.commit();
    return insert.outBinds!.id[0];
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
  }
}

// Se conservan por compatibilidad de interfaz, pero las operaciones financieras
// confirmadas son inmutables desde el CRUD; el service las bloquea.
export async function update(id: number, i: UpdateAplicacionPagoInput) {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };
  if (i.idPago !== undefined) { fields.push('ID_PAGO=:idPago'); binds.idPago = i.idPago; }
  if (i.idDocumento !== undefined) { fields.push('ID_DOCUMENTO=:idDocumento'); binds.idDocumento = i.idDocumento; }
  if (i.fechaAplicacion !== undefined) {
    fields.push(`FECHA_APLICACION=TO_DATE(:fechaAplicacion,'YYYY-MM-DD')`);
    binds.fechaAplicacion = i.fechaAplicacion;
  }
  if (i.montoAplicado !== undefined) {
    fields.push('MONTO_APLICADO=:montoAplicado');
    binds.montoAplicado = i.montoAplicado;
  }
  if (i.idEmpleado !== undefined) {
    fields.push('ID_EMPLEADO=:idEmpleado');
    binds.idEmpleado = i.idEmpleado;
  }
  if (!fields.length) return;

  const c = await getConnection();
  try {
    await c.execute(
      `UPDATE CXC_APLICACION_PAGOS SET ${fields.join(',')} WHERE ID_APLICACION=:id`,
      binds,
    );
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
    await c.execute(
      `DELETE FROM CXC_APLICACION_PAGOS WHERE ID_APLICACION=:id`,
      { id },
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
  }
}

export async function sumAplicadoPorPago(idPago: number, excludeId?: number): Promise<number> {
  const c = await getConnection();
  try {
    const result = await c.execute<{ TOTAL: number }>(
      `SELECT NVL(SUM(MONTO_APLICADO), 0) AS TOTAL
         FROM CXC_APLICACION_PAGOS
        WHERE ID_PAGO = :idPago
          AND ESTADO = 'CONFIRMADA'
          AND (:excludeId IS NULL OR ID_APLICACION <> :excludeId)`,
      { idPago, excludeId: excludeId ?? null },
    );
    return Number(result.rows?.[0]?.TOTAL ?? 0);
  } finally {
    await c.close();
  }
}

/**
 * Reversa una aplicación CONFIRMADA: bloquea aplicación + documento + pago
 * (mismo orden de locks que create(), para evitar deadlocks con aplicaciones
 * concurrentes sobre el mismo par pago/documento), revierte el efecto en el
 * documento (le devuelve el saldo) y recalcula el estado del pago a partir
 * de lo que sigue CONFIRMADA. Una sola transacción, con trazabilidad
 * (quién, cuándo, por qué).
 */
export async function reversar(id: number, input: ReversarAplicacionPagoInput): Promise<void> {
  const c = await getConnection();
  try {
    const aplicacionResult = await c.execute<AplicacionLockRow>(
      `SELECT ID_APLICACION, ID_PAGO, ID_DOCUMENTO, MONTO_APLICADO, ESTADO
         FROM CXC_APLICACION_PAGOS
        WHERE ID_APLICACION = :id
        FOR UPDATE`,
      { id },
    );
    const aplicacion = aplicacionResult.rows?.[0];
    if (!aplicacion) throw new NotFoundError(`Aplicación de pago ${id} no encontrada`);
    if (String(aplicacion.ESTADO).trim().toUpperCase() !== 'CONFIRMADA') {
      throw new ConflictError('Esta aplicación ya fue reversada.');
    }

    const documentoResult = await c.execute<DocumentoLockRow>(
      `SELECT ID_DOCUMENTO, ID_CLIENTE, TOTAL, SALDO, ESTADO
         FROM CXC_DOCUMENTOS
        WHERE ID_DOCUMENTO = :idDocumento
        FOR UPDATE`,
      { idDocumento: aplicacion.ID_DOCUMENTO },
    );
    const documento = documentoResult.rows?.[0];
    if (!documento) throw new BadRequestError('El documento de la aplicación ya no existe');

    const docEstado = String(documento.ESTADO ?? '').trim().toUpperCase();
    if (docEstado === 'ANULADO' || docEstado === 'ANULADA') {
      throw new ConflictError('No se puede reversar una aplicación sobre un documento anulado.');
    }

    const pagoResult = await c.execute<PagoLockRow>(
      `SELECT ID_PAGO, ID_CLIENTE, MONTO, ESTADO
         FROM CXC_PAGOS
        WHERE ID_PAGO = :idPago
        FOR UPDATE`,
      { idPago: aplicacion.ID_PAGO },
    );
    const pago = pagoResult.rows?.[0];
    if (!pago) throw new BadRequestError('El pago de la aplicación ya no existe');

    const montoAplicado = roundMoney(Number(aplicacion.MONTO_APLICADO));
    const nuevoSaldo = roundMoney(Number(documento.SALDO) + montoAplicado);
    const nuevoEstadoDocumento = deriveDocumentoEstado(Number(documento.TOTAL), nuevoSaldo, documento.ESTADO);
    await c.execute(
      `UPDATE CXC_DOCUMENTOS SET SALDO = :saldo, ESTADO = :estado WHERE ID_DOCUMENTO = :idDocumento`,
      { saldo: nuevoSaldo, estado: nuevoEstadoDocumento, idDocumento: aplicacion.ID_DOCUMENTO },
    );

    const sumResult = await c.execute<{ TOTAL: number }>(
      `SELECT NVL(SUM(MONTO_APLICADO), 0) TOTAL
         FROM CXC_APLICACION_PAGOS
        WHERE ID_PAGO = :idPago
          AND ESTADO = 'CONFIRMADA'
          AND ID_APLICACION <> :id`,
      { idPago: aplicacion.ID_PAGO, id },
    );
    const totalConfirmadoRestante = roundMoney(Number(sumResult.rows?.[0]?.TOTAL ?? 0));
    const pagoEstadoActual = String(pago.ESTADO ?? '').trim().toUpperCase();
    const nuevoEstadoPago = ['ANULADO'].includes(pagoEstadoActual)
      ? pagoEstadoActual
      : totalConfirmadoRestante <= 0.005
        ? 'NO_APLICADO'
        : totalConfirmadoRestante >= Number(pago.MONTO) - 0.005
          ? 'APLICADO'
          : 'EN_CUENTA';
    await c.execute(
      `UPDATE CXC_PAGOS SET ESTADO = :estado WHERE ID_PAGO = :idPago`,
      { estado: nuevoEstadoPago, idPago: aplicacion.ID_PAGO },
    );

    await c.execute(
      `UPDATE CXC_APLICACION_PAGOS
          SET ESTADO = 'REVERSADA',
              ID_EMPLEADO_REVERSA = :idEmpleadoReversa,
              FECHA_REVERSA = NVL(TO_DATE(:fechaReversa, 'YYYY-MM-DD'), SYSDATE),
              MOTIVO_REVERSA = :motivoReversa
        WHERE ID_APLICACION = :id`,
      {
        idEmpleadoReversa: input.idEmpleadoReversa,
        fechaReversa: input.fechaReversa ?? null,
        motivoReversa: input.motivoReversa,
        id,
      },
    );

    await registrarEvento(c, {
      idDocumento: aplicacion.ID_DOCUMENTO,
      estadoAnterior: documento.ESTADO,
      estadoNuevo: nuevoEstadoDocumento,
      idEmpleado: input.idEmpleadoReversa,
      tipoEvento: 'REVERSA_APLICACION_PAGO',
      monto: montoAplicado,
      naturaleza: 'CARGO',
      descripcion: input.motivoReversa,
      fecha: input.fechaReversa,
    });

    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.close();
  }
}
