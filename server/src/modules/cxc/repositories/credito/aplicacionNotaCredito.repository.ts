import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type {
  AplicacionNotaCredito,
  CreateAplicacionNotaCreditoInput,
  UpdateAplicacionNotaCreditoInput,
  ReversarAplicacionNotaCreditoInput,
} from '@erp/contracts';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
import { deriveDocumentoEstado, isDocumentoBloqueadoParaAplicacion, roundMoney } from '../../shared/financialRules';
import { isNotaCreditoAplicable } from './notaCredito.repository';
import { registrarEvento } from '../documentos/documentoHistorial.repository';

interface AplicacionNotaCreditoRow {
  ID_APLICACION_NC: number;
  ID_NOTA_CREDITO: number;
  ID_DOCUMENTO: number;
  MONTO_APLICADO: number;
  FECHA_APLICACION: Date;
  ID_EMPLEADO: number | null;
  NOMBRE_EMPLEADO: string | null;
  ESTADO: AplicacionNotaCredito['estado'];
  ID_EMPLEADO_REVERSA: number | null;
  NOMBRE_EMPLEADO_REVERSA: string | null;
  FECHA_REVERSA: Date | null;
  MOTIVO_REVERSA: string | null;
}

interface NotaLockRow {
  ID_NOTA_CREDITO: number;
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
  ID_APLICACION_NC: number;
  ID_NOTA_CREDITO: number;
  ID_DOCUMENTO: number;
  MONTO_APLICADO: number;
  ESTADO: string;
}

const mapRow = (row: AplicacionNotaCreditoRow): AplicacionNotaCredito => ({
  idAplicacionNc: row.ID_APLICACION_NC,
  idNotaCredito: row.ID_NOTA_CREDITO,
  idDocumento: row.ID_DOCUMENTO,
  montoAplicado: row.MONTO_APLICADO,
  fechaAplicacion: row.FECHA_APLICACION?.toISOString() ?? '',
  idEmpleado: row.ID_EMPLEADO,
  nombreEmpleado: row.NOMBRE_EMPLEADO,
  estado: row.ESTADO,
  idEmpleadoReversa: row.ID_EMPLEADO_REVERSA,
  nombreEmpleadoReversa: row.NOMBRE_EMPLEADO_REVERSA,
  fechaReversa: row.FECHA_REVERSA?.toISOString() ?? null,
  motivoReversa: row.MOTIVO_REVERSA,
});

const SELECT_BASE = `
  SELECT a.ID_APLICACION_NC,
         a.ID_NOTA_CREDITO,
         a.ID_DOCUMENTO,
         a.MONTO_APLICADO,
         a.FECHA_APLICACION,
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
    FROM CXC_APLICACION_NOTA_CREDITO a
    LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = a.ID_EMPLEADO
    LEFT JOIN EMPLEADO er ON er.ID_EMPLEADO = a.ID_EMPLEADO_REVERSA
`;

export async function findAll(params: { page: number; limit: number; search?: string }) {
  const conn = await getConnection();
  try {
    const offset = (params.page - 1) * params.limit;
    const whereClause = params.search
      ? `WHERE TO_CHAR(ID_APLICACION_NC) LIKE :search
          OR TO_CHAR(ID_NOTA_CREDITO) LIKE :search
          OR TO_CHAR(ID_DOCUMENTO) LIKE :search`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};

    const dataResult = await conn.execute<AplicacionNotaCreditoRow>(
      `${SELECT_BASE}
       ${whereClause}
       ORDER BY FECHA_APLICACION DESC, ID_APLICACION_NC DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset, limit: params.limit },
    );
    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) TOTAL FROM CXC_APLICACION_NOTA_CREDITO ${whereClause}`,
      searchBind,
    );
    return { data: (dataResult.rows ?? []).map(mapRow), total: countResult.rows?.[0]?.TOTAL ?? 0 };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<AplicacionNotaCredito | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<AplicacionNotaCreditoRow>(
      `${SELECT_BASE} WHERE ID_APLICACION_NC = :id`,
      { id },
    );
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

/**
 * Aplica una NC de forma atómica y segura frente a concurrencia.
 * La nota no afecta saldo hasta este punto.
 */
export async function create(input: CreateAplicacionNotaCreditoInput): Promise<number> {
  const conn = await getConnection();
  try {
    const notaResult = await conn.execute<NotaLockRow>(
      `SELECT ID_NOTA_CREDITO, ID_CLIENTE, MONTO, ESTADO
         FROM CXC_NOTAS_CREDITO
        WHERE ID_NOTA_CREDITO = :idNotaCredito
        FOR UPDATE`,
      { idNotaCredito: input.idNotaCredito },
    );
    const nota = notaResult.rows?.[0];
    if (!nota) throw new BadRequestError('La nota de crédito seleccionada no existe');

    const documentoResult = await conn.execute<DocumentoLockRow>(
      `SELECT ID_DOCUMENTO, ID_CLIENTE, TOTAL, SALDO, ESTADO
         FROM CXC_DOCUMENTOS
        WHERE ID_DOCUMENTO = :idDocumento
        FOR UPDATE`,
      { idDocumento: input.idDocumento },
    );
    const documento = documentoResult.rows?.[0];
    if (!documento) throw new BadRequestError('El documento seleccionado no existe');

    const notaEstado = String(nota.ESTADO ?? '').trim().toUpperCase();
    if (notaEstado === 'ANULADA') throw new ConflictError('Una nota de crédito anulada no puede aplicarse.');
    if (notaEstado === 'APLICADA') throw new ConflictError('La nota de crédito ya está totalmente aplicada.');
    if (!isNotaCreditoAplicable(notaEstado)) {
      throw new ConflictError(`La nota de crédito está en un estado no aplicable: ${notaEstado || 'SIN ESTADO'}.`);
    }

    if (isDocumentoBloqueadoParaAplicacion(documento.ESTADO) || Number(documento.SALDO) <= 0) {
      throw new ConflictError('El documento ya está pagado/anulado o no tiene saldo pendiente.');
    }

    if (nota.ID_CLIENTE !== documento.ID_CLIENTE) {
      throw new BadRequestError('La nota de crédito y el documento deben pertenecer al mismo cliente');
    }

    const sumResult = await conn.execute<{ TOTAL: number }>(
      `SELECT NVL(SUM(MONTO_APLICADO), 0) TOTAL
         FROM CXC_APLICACION_NOTA_CREDITO
        WHERE ID_NOTA_CREDITO = :idNotaCredito
          AND ESTADO = 'CONFIRMADA'`,
      { idNotaCredito: input.idNotaCredito },
    );
    const yaAplicado = Number(sumResult.rows?.[0]?.TOTAL ?? 0);
    const disponibleNota = roundMoney(Number(nota.MONTO) - yaAplicado);
    const saldoDocumento = roundMoney(Number(documento.SALDO));
    const montoAplicado = roundMoney(Number(input.montoAplicado));

    if (montoAplicado <= 0) throw new BadRequestError('El monto aplicado debe ser mayor a cero');
    if (montoAplicado > saldoDocumento + 0.005) {
      throw new BadRequestError('El monto aplicado no puede superar el saldo del documento');
    }
    if (montoAplicado > disponibleNota + 0.005) {
      throw new BadRequestError('El monto aplicado no puede superar el monto disponible de la nota de crédito');
    }

    const insert = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_APLICACION_NOTA_CREDITO
        (ID_NOTA_CREDITO, ID_DOCUMENTO, MONTO_APLICADO, FECHA_APLICACION, ID_EMPLEADO)
       VALUES
        (:idNotaCredito, :idDocumento, :montoAplicado, TO_DATE(:fechaAplicacion, 'YYYY-MM-DD'), :idEmpleado)
       RETURNING ID_APLICACION_NC INTO :id`,
      {
        idNotaCredito: input.idNotaCredito,
        idDocumento: input.idDocumento,
        montoAplicado,
        fechaAplicacion: input.fechaAplicacion,
        idEmpleado: input.idEmpleado,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );

    const nuevoSaldo = Math.max(0, roundMoney(saldoDocumento - montoAplicado));
    const nuevoEstadoDocumento = deriveDocumentoEstado(Number(documento.TOTAL), nuevoSaldo, documento.ESTADO);
    await conn.execute(
      `UPDATE CXC_DOCUMENTOS
          SET SALDO = :saldo,
              ESTADO = :estado
        WHERE ID_DOCUMENTO = :idDocumento`,
      { saldo: nuevoSaldo, estado: nuevoEstadoDocumento, idDocumento: input.idDocumento },
    );

    const totalAplicado = roundMoney(yaAplicado + montoAplicado);
    const nuevoEstadoNota = totalAplicado >= Number(nota.MONTO) - 0.005 ? 'APLICADA' : 'PENDIENTE';
    await conn.execute(
      `UPDATE CXC_NOTAS_CREDITO SET ESTADO = :estado WHERE ID_NOTA_CREDITO = :idNotaCredito`,
      { estado: nuevoEstadoNota, idNotaCredito: input.idNotaCredito },
    );

    await registrarEvento(conn, {
      idDocumento: input.idDocumento,
      estadoAnterior: documento.ESTADO,
      estadoNuevo: nuevoEstadoDocumento,
      idEmpleado: input.idEmpleado,
      tipoEvento: 'APLICACION_NOTA_CREDITO',
      monto: montoAplicado,
      naturaleza: 'ABONO',
      descripcion: `Nota de crédito #${input.idNotaCredito} aplicada al documento`,
      fecha: input.fechaAplicacion,
    });

    await conn.commit();
    return insert.outBinds!.id[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

// Se conservan por compatibilidad de interfaz, pero las operaciones financieras
// confirmadas son inmutables desde el CRUD; el service las bloquea siempre
// con ConflictError. A diferencia de create()/reversar(), estas NO recalculan
// CXC_DOCUMENTOS.SALDO/ESTADO ni CXC_NOTAS_CREDITO.ESTADO ni toman FOR UPDATE.
// Deshacer una aplicación confirmada es reversar(), no update()/remove().
export async function update(id: number, input: UpdateAplicacionNotaCreditoInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.idNotaCredito !== undefined) { fields.push('ID_NOTA_CREDITO = :idNotaCredito'); binds.idNotaCredito = input.idNotaCredito; }
  if (input.idDocumento !== undefined) { fields.push('ID_DOCUMENTO = :idDocumento'); binds.idDocumento = input.idDocumento; }
  if (input.montoAplicado !== undefined) { fields.push('MONTO_APLICADO = :montoAplicado'); binds.montoAplicado = input.montoAplicado; }
  if (input.fechaAplicacion !== undefined) { fields.push(`FECHA_APLICACION = TO_DATE(:fechaAplicacion, 'YYYY-MM-DD')`); binds.fechaAplicacion = input.fechaAplicacion; }
  if (!fields.length) return;

  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE CXC_APLICACION_NOTA_CREDITO SET ${fields.join(', ')} WHERE ID_APLICACION_NC = :id`,
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
    await conn.execute(`DELETE FROM CXC_APLICACION_NOTA_CREDITO WHERE ID_APLICACION_NC = :id`, { id });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

/**
 * Reversa una aplicación CONFIRMADA: bloquea aplicación + documento + nota
 * (mismo orden que create()), le devuelve el saldo al documento y recalcula
 * el estado de la nota a partir de lo que sigue CONFIRMADA. Una transacción,
 * con trazabilidad (quién, cuándo, por qué).
 */
export async function reversar(id: number, input: ReversarAplicacionNotaCreditoInput): Promise<void> {
  const conn = await getConnection();
  try {
    const aplicacionResult = await conn.execute<AplicacionLockRow>(
      `SELECT ID_APLICACION_NC, ID_NOTA_CREDITO, ID_DOCUMENTO, MONTO_APLICADO, ESTADO
         FROM CXC_APLICACION_NOTA_CREDITO
        WHERE ID_APLICACION_NC = :id
        FOR UPDATE`,
      { id },
    );
    const aplicacion = aplicacionResult.rows?.[0];
    if (!aplicacion) throw new NotFoundError(`Aplicación de nota de crédito ${id} no encontrada`);
    if (String(aplicacion.ESTADO).trim().toUpperCase() !== 'CONFIRMADA') {
      throw new ConflictError('Esta aplicación ya fue reversada.');
    }

    const documentoResult = await conn.execute<DocumentoLockRow>(
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

    const notaResult = await conn.execute<NotaLockRow>(
      `SELECT ID_NOTA_CREDITO, ID_CLIENTE, MONTO, ESTADO
         FROM CXC_NOTAS_CREDITO
        WHERE ID_NOTA_CREDITO = :idNotaCredito
        FOR UPDATE`,
      { idNotaCredito: aplicacion.ID_NOTA_CREDITO },
    );
    const nota = notaResult.rows?.[0];
    if (!nota) throw new BadRequestError('La nota de crédito de la aplicación ya no existe');

    const montoAplicado = roundMoney(Number(aplicacion.MONTO_APLICADO));
    const nuevoSaldo = roundMoney(Number(documento.SALDO) + montoAplicado);
    const nuevoEstadoDocumento = deriveDocumentoEstado(Number(documento.TOTAL), nuevoSaldo, documento.ESTADO);
    await conn.execute(
      `UPDATE CXC_DOCUMENTOS SET SALDO = :saldo, ESTADO = :estado WHERE ID_DOCUMENTO = :idDocumento`,
      { saldo: nuevoSaldo, estado: nuevoEstadoDocumento, idDocumento: aplicacion.ID_DOCUMENTO },
    );

    const sumResult = await conn.execute<{ TOTAL: number }>(
      `SELECT NVL(SUM(MONTO_APLICADO), 0) TOTAL
         FROM CXC_APLICACION_NOTA_CREDITO
        WHERE ID_NOTA_CREDITO = :idNotaCredito
          AND ESTADO = 'CONFIRMADA'
          AND ID_APLICACION_NC <> :id`,
      { idNotaCredito: aplicacion.ID_NOTA_CREDITO, id },
    );
    const totalConfirmadoRestante = roundMoney(Number(sumResult.rows?.[0]?.TOTAL ?? 0));
    const notaEstadoActual = String(nota.ESTADO ?? '').trim().toUpperCase();
    const nuevoEstadoNota = notaEstadoActual === 'ANULADA'
      ? notaEstadoActual
      : totalConfirmadoRestante >= Number(nota.MONTO) - 0.005
        ? 'APLICADA'
        : 'PENDIENTE';
    await conn.execute(
      `UPDATE CXC_NOTAS_CREDITO SET ESTADO = :estado WHERE ID_NOTA_CREDITO = :idNotaCredito`,
      { estado: nuevoEstadoNota, idNotaCredito: aplicacion.ID_NOTA_CREDITO },
    );

    await conn.execute(
      `UPDATE CXC_APLICACION_NOTA_CREDITO
          SET ESTADO = 'REVERSADA',
              ID_EMPLEADO_REVERSA = :idEmpleadoReversa,
              FECHA_REVERSA = NVL(TO_DATE(:fechaReversa, 'YYYY-MM-DD'), SYSDATE),
              MOTIVO_REVERSA = :motivoReversa
        WHERE ID_APLICACION_NC = :id`,
      {
        idEmpleadoReversa: input.idEmpleadoReversa,
        fechaReversa: input.fechaReversa ?? null,
        motivoReversa: input.motivoReversa,
        id,
      },
    );

    await registrarEvento(conn, {
      idDocumento: aplicacion.ID_DOCUMENTO,
      estadoAnterior: documento.ESTADO,
      estadoNuevo: nuevoEstadoDocumento,
      idEmpleado: input.idEmpleadoReversa,
      tipoEvento: 'REVERSA_APLICACION_NOTA_CREDITO',
      monto: montoAplicado,
      naturaleza: 'CARGO',
      descripcion: input.motivoReversa,
      fecha: input.fechaReversa,
    });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}
