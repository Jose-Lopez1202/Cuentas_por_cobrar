import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type {
  AplicacionAnticipo,
  CreateAplicacionAnticipoInput,
  UpdateAplicacionAnticipoInput,
  ReversarAplicacionAnticipoInput,
} from '@erp/contracts';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
import { deriveDocumentoEstado, isDocumentoBloqueadoParaAplicacion, roundMoney } from '../../shared/financialRules';
import { registrarEvento } from '../documentos/documentoHistorial.repository';

interface Row {
  ID_APLICACION_ANTICIPO: number;
  ID_ANTICIPO: number;
  ID_DOCUMENTO: number;
  FECHA_APLICACION: Date;
  MONTO_APLICADO: number;
  ID_EMPLEADO: number | null;
  NOMBRE_EMPLEADO: string | null;
  ESTADO: AplicacionAnticipo['estado'];
  ID_EMPLEADO_REVERSA: number | null;
  NOMBRE_EMPLEADO_REVERSA: string | null;
  FECHA_REVERSA: Date | null;
  MOTIVO_REVERSA: string | null;
}

interface AnticipoLockRow {
  ID_ANTICIPO: number;
  ID_CLIENTE: number;
  MONTO_ORIGINAL: number;
  MONTO_DISPONIBLE: number;
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
  ID_APLICACION_ANTICIPO: number;
  ID_ANTICIPO: number;
  ID_DOCUMENTO: number;
  MONTO_APLICADO: number;
  ESTADO: string;
}

const mapRow = (r: Row): AplicacionAnticipo => ({
  idAplicacionAnticipo: r.ID_APLICACION_ANTICIPO,
  idAnticipo: r.ID_ANTICIPO,
  idDocumento: r.ID_DOCUMENTO,
  montoAplicado: r.MONTO_APLICADO,
  fechaAplicacion: r.FECHA_APLICACION?.toISOString() ?? '',
  idEmpleado: r.ID_EMPLEADO,
  nombreEmpleado: r.NOMBRE_EMPLEADO,
  estado: r.ESTADO,
  idEmpleadoReversa: r.ID_EMPLEADO_REVERSA,
  nombreEmpleadoReversa: r.NOMBRE_EMPLEADO_REVERSA,
  fechaReversa: r.FECHA_REVERSA?.toISOString() ?? null,
  motivoReversa: r.MOTIVO_REVERSA,
});

const SELECT_BASE = `
  SELECT a.ID_APLICACION_ANTICIPO, a.ID_ANTICIPO, a.ID_DOCUMENTO, a.FECHA_APLICACION, a.MONTO_APLICADO,
         a.ID_EMPLEADO,
         CASE
           WHEN e.ID_EMPLEADO IS NULL THEN NULL
           ELSE TRIM(e.NOMBRE || ' ' || NVL(e.APELLIDO, ''))
         END AS NOMBRE_EMPLEADO,
         a.ESTADO, a.ID_EMPLEADO_REVERSA,
         CASE
           WHEN er.ID_EMPLEADO IS NULL THEN NULL
           ELSE TRIM(er.NOMBRE || ' ' || NVL(er.APELLIDO, ''))
         END AS NOMBRE_EMPLEADO_REVERSA,
         a.FECHA_REVERSA, a.MOTIVO_REVERSA
    FROM CXC_APLICACION_ANTICIPO a
    LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = a.ID_EMPLEADO
    LEFT JOIN EMPLEADO er ON er.ID_EMPLEADO = a.ID_EMPLEADO_REVERSA
`;

export async function findAll(params: { page: number; limit: number; search?: string }) {
  const conn = await getConnection();
  try {
    const offset = (params.page - 1) * params.limit;
    const whereClause = params.search
      ? `WHERE TO_CHAR(ID_APLICACION_ANTICIPO) LIKE :search
          OR TO_CHAR(ID_ANTICIPO) LIKE :search
          OR TO_CHAR(ID_DOCUMENTO) LIKE :search`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};

    const dataResult = await conn.execute<Row>(
      `${SELECT_BASE}
       ${whereClause}
       ORDER BY FECHA_APLICACION DESC, ID_APLICACION_ANTICIPO DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset, limit: params.limit },
    );
    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) TOTAL FROM CXC_APLICACION_ANTICIPO ${whereClause}`,
      searchBind,
    );
    return { data: (dataResult.rows ?? []).map(mapRow), total: countResult.rows?.[0]?.TOTAL ?? 0 };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<AplicacionAnticipo | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<Row>(`${SELECT_BASE} WHERE ID_APLICACION_ANTICIPO = :id`, { id });
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

/**
 * Aplica un anticipo de forma atómica: bloquea anticipo + documento, valida
 * disponible, registra la aplicación, decrementa el saldo del anticipo (es
 * columna física, no una suma como en pagos/NC) y actualiza saldo/estado del
 * documento. Una sola conexión, un solo commit.
 */
export async function create(input: CreateAplicacionAnticipoInput): Promise<number> {
  const conn = await getConnection();
  try {
    const anticipoResult = await conn.execute<AnticipoLockRow>(
      `SELECT ID_ANTICIPO, ID_CLIENTE, MONTO_ORIGINAL, MONTO_DISPONIBLE, ESTADO
         FROM CXC_ANTICIPOS
        WHERE ID_ANTICIPO = :idAnticipo
        FOR UPDATE`,
      { idAnticipo: input.idAnticipo },
    );
    const anticipo = anticipoResult.rows?.[0];
    if (!anticipo) throw new BadRequestError('El anticipo seleccionado no existe');

    const documentoResult = await conn.execute<DocumentoLockRow>(
      `SELECT ID_DOCUMENTO, ID_CLIENTE, TOTAL, SALDO, ESTADO
         FROM CXC_DOCUMENTOS
        WHERE ID_DOCUMENTO = :idDocumento
        FOR UPDATE`,
      { idDocumento: input.idDocumento },
    );
    const documento = documentoResult.rows?.[0];
    if (!documento) throw new BadRequestError('El documento seleccionado no existe');

    const anticipoEstado = String(anticipo.ESTADO ?? '').trim().toUpperCase();
    if (anticipoEstado === 'CANCELADO') throw new ConflictError('Un anticipo cancelado no puede aplicarse.');
    if (anticipoEstado === 'AGOTADO') throw new ConflictError('El anticipo ya está totalmente aplicado.');

    if (isDocumentoBloqueadoParaAplicacion(documento.ESTADO) || Number(documento.SALDO) <= 0) {
      throw new ConflictError('El documento ya está pagado/anulado o no tiene saldo pendiente.');
    }

    if (anticipo.ID_CLIENTE !== documento.ID_CLIENTE) {
      throw new BadRequestError('El anticipo y el documento deben pertenecer al mismo cliente');
    }

    const disponibleAnticipo = roundMoney(Number(anticipo.MONTO_DISPONIBLE));
    const saldoDocumento = roundMoney(Number(documento.SALDO));
    const montoAplicado = roundMoney(Number(input.montoAplicado));

    if (montoAplicado <= 0) throw new BadRequestError('El monto aplicado debe ser mayor a cero');
    if (montoAplicado > saldoDocumento + 0.005) {
      throw new BadRequestError('El monto aplicado no puede superar el saldo del documento');
    }
    if (montoAplicado > disponibleAnticipo + 0.005) {
      throw new BadRequestError('El monto aplicado no puede superar el monto disponible del anticipo');
    }

    const insert = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_APLICACION_ANTICIPO
         (ID_ANTICIPO, ID_DOCUMENTO, FECHA_APLICACION, MONTO_APLICADO, ID_EMPLEADO)
       VALUES
         (:idAnticipo, :idDocumento, TO_DATE(:fechaAplicacion, 'YYYY-MM-DD'), :montoAplicado, :idEmpleado)
       RETURNING ID_APLICACION_ANTICIPO INTO :id`,
      {
        idAnticipo: input.idAnticipo,
        idDocumento: input.idDocumento,
        fechaAplicacion: input.fechaAplicacion,
        montoAplicado,
        idEmpleado: input.idEmpleado,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );

    const nuevoSaldoDocumento = Math.max(0, roundMoney(saldoDocumento - montoAplicado));
    const nuevoEstadoDocumento = deriveDocumentoEstado(Number(documento.TOTAL), nuevoSaldoDocumento, documento.ESTADO);
    await conn.execute(
      `UPDATE CXC_DOCUMENTOS SET SALDO = :saldo, ESTADO = :estado WHERE ID_DOCUMENTO = :idDocumento`,
      { saldo: nuevoSaldoDocumento, estado: nuevoEstadoDocumento, idDocumento: input.idDocumento },
    );

    const nuevoDisponibleAnticipo = Math.max(0, roundMoney(disponibleAnticipo - montoAplicado));
    const nuevoEstadoAnticipo = nuevoDisponibleAnticipo <= 0.005 ? 'AGOTADO' : 'APLICADO';
    await conn.execute(
      `UPDATE CXC_ANTICIPOS SET MONTO_DISPONIBLE = :disponible, ESTADO = :estado WHERE ID_ANTICIPO = :idAnticipo`,
      { disponible: nuevoDisponibleAnticipo, estado: nuevoEstadoAnticipo, idAnticipo: input.idAnticipo },
    );

    await registrarEvento(conn, {
      idDocumento: input.idDocumento,
      estadoAnterior: documento.ESTADO,
      estadoNuevo: nuevoEstadoDocumento,
      idEmpleado: input.idEmpleado,
      tipoEvento: 'APLICACION_ANTICIPO',
      monto: montoAplicado,
      naturaleza: 'ABONO',
      descripcion: `Anticipo #${input.idAnticipo} aplicado al documento`,
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

// Se conservan por compatibilidad de interfaz, pero el service las bloquea:
// las aplicaciones confirmadas son inmutables (mismo criterio que
// aplicacion-pago / aplicacion-nota-credito). Deshacer una aplicación
// confirmada es reversar(), no update()/remove().
export async function update(id: number, input: UpdateAplicacionAnticipoInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };
  if (input.idAnticipo !== undefined) { fields.push('ID_ANTICIPO = :idAnticipo'); binds.idAnticipo = input.idAnticipo; }
  if (input.idDocumento !== undefined) { fields.push('ID_DOCUMENTO = :idDocumento'); binds.idDocumento = input.idDocumento; }
  if (input.montoAplicado !== undefined) { fields.push('MONTO_APLICADO = :montoAplicado'); binds.montoAplicado = input.montoAplicado; }
  if (input.fechaAplicacion !== undefined) { fields.push(`FECHA_APLICACION = TO_DATE(:fechaAplicacion, 'YYYY-MM-DD')`); binds.fechaAplicacion = input.fechaAplicacion; }
  if (!fields.length) return;

  const conn = await getConnection();
  try {
    await conn.execute(`UPDATE CXC_APLICACION_ANTICIPO SET ${fields.join(', ')} WHERE ID_APLICACION_ANTICIPO = :id`, binds);
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
    await conn.execute(`DELETE FROM CXC_APLICACION_ANTICIPO WHERE ID_APLICACION_ANTICIPO = :id`, { id });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

export async function sumAplicadoPorAnticipo(idAnticipo: number, excludeId?: number): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ TOTAL: number }>(
      `SELECT NVL(SUM(MONTO_APLICADO), 0) AS TOTAL
         FROM CXC_APLICACION_ANTICIPO
        WHERE ID_ANTICIPO = :idAnticipo
          AND ESTADO = 'CONFIRMADA'
          AND (:excludeId IS NULL OR ID_APLICACION_ANTICIPO <> :excludeId)`,
      { idAnticipo, excludeId: excludeId ?? null },
    );
    return Number(result.rows?.[0]?.TOTAL ?? 0);
  } finally {
    await conn.close();
  }
}

/**
 * Reversa una aplicación CONFIRMADA: bloquea aplicación + documento +
 * anticipo, le devuelve el saldo al documento e incrementa de vuelta
 * CXC_ANTICIPOS.MONTO_DISPONIBLE (columna física, no una suma como en
 * pagos/NC). Una transacción, con trazabilidad (quién, cuándo, por qué).
 */
export async function reversar(id: number, input: ReversarAplicacionAnticipoInput): Promise<void> {
  const conn = await getConnection();
  try {
    const aplicacionResult = await conn.execute<AplicacionLockRow>(
      `SELECT ID_APLICACION_ANTICIPO, ID_ANTICIPO, ID_DOCUMENTO, MONTO_APLICADO, ESTADO
         FROM CXC_APLICACION_ANTICIPO
        WHERE ID_APLICACION_ANTICIPO = :id
        FOR UPDATE`,
      { id },
    );
    const aplicacion = aplicacionResult.rows?.[0];
    if (!aplicacion) throw new NotFoundError(`Aplicación de anticipo ${id} no encontrada`);
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

    const anticipoResult = await conn.execute<AnticipoLockRow>(
      `SELECT ID_ANTICIPO, ID_CLIENTE, MONTO_ORIGINAL, MONTO_DISPONIBLE, ESTADO
         FROM CXC_ANTICIPOS
        WHERE ID_ANTICIPO = :idAnticipo
        FOR UPDATE`,
      { idAnticipo: aplicacion.ID_ANTICIPO },
    );
    const anticipo = anticipoResult.rows?.[0];
    if (!anticipo) throw new BadRequestError('El anticipo de la aplicación ya no existe');

    const montoAplicado = roundMoney(Number(aplicacion.MONTO_APLICADO));
    const nuevoSaldoDocumento = roundMoney(Number(documento.SALDO) + montoAplicado);
    const nuevoEstadoDocumento = deriveDocumentoEstado(Number(documento.TOTAL), nuevoSaldoDocumento, documento.ESTADO);
    await conn.execute(
      `UPDATE CXC_DOCUMENTOS SET SALDO = :saldo, ESTADO = :estado WHERE ID_DOCUMENTO = :idDocumento`,
      { saldo: nuevoSaldoDocumento, estado: nuevoEstadoDocumento, idDocumento: aplicacion.ID_DOCUMENTO },
    );

    const montoOriginal = roundMoney(Number(anticipo.MONTO_ORIGINAL));
    const nuevoDisponibleAnticipo = Math.min(montoOriginal, roundMoney(Number(anticipo.MONTO_DISPONIBLE) + montoAplicado));
    const anticipoEstadoActual = String(anticipo.ESTADO ?? '').trim().toUpperCase();
    const nuevoEstadoAnticipo = anticipoEstadoActual === 'CANCELADO'
      ? anticipoEstadoActual
      : nuevoDisponibleAnticipo >= montoOriginal - 0.005
        ? 'DISPONIBLE'
        : nuevoDisponibleAnticipo <= 0.005
          ? 'AGOTADO'
          : 'APLICADO';
    await conn.execute(
      `UPDATE CXC_ANTICIPOS SET MONTO_DISPONIBLE = :disponible, ESTADO = :estado WHERE ID_ANTICIPO = :idAnticipo`,
      { disponible: nuevoDisponibleAnticipo, estado: nuevoEstadoAnticipo, idAnticipo: aplicacion.ID_ANTICIPO },
    );

    await conn.execute(
      `UPDATE CXC_APLICACION_ANTICIPO
          SET ESTADO = 'REVERSADA',
              ID_EMPLEADO_REVERSA = :idEmpleadoReversa,
              FECHA_REVERSA = NVL(TO_DATE(:fechaReversa, 'YYYY-MM-DD'), SYSDATE),
              MOTIVO_REVERSA = :motivoReversa
        WHERE ID_APLICACION_ANTICIPO = :id`,
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
      tipoEvento: 'REVERSA_APLICACION_ANTICIPO',
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
