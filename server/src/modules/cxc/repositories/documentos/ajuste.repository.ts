import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { Ajuste, CreateAjusteInput, UpdateAjusteInput, AprobarAjusteInput, RechazarAjusteInput } from '@erp/contracts';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';
import { isDocumentoBloqueadoParaAplicacion, deriveDocumentoEstado, roundMoney } from '../../shared/financialRules';
import { registrarEvento } from './documentoHistorial.repository';

interface AjusteRow {
  ID_AJUSTE: number;
  ID_CLIENTE: number;
  NOMBRE_CLIENTE: string | null;
  ID_DOCUMENTO: number | null;
  TIPO_AJUSTE: string;
  MONTO: number;
  MOTIVO: string | null;
  FECHA: Date;
  ID_EMPLEADO: number;
  NOMBRE_EMPLEADO: string | null;
  ESTADO: string;
  ID_EMPLEADO_APROBADOR: number | null;
  NOMBRE_EMPLEADO_APROBADOR: string | null;
  FECHA_APROBACION: Date | null;
  ID_EMPLEADO_APROBADOR_2: number | null;
  NOMBRE_EMPLEADO_APROBADOR_2: string | null;
  FECHA_APROBACION_2: Date | null;
  MOTIVO_RECHAZO: string | null;
}

interface DocumentoLockRow {
  ID_DOCUMENTO: number;
  ID_CLIENTE: number;
  TOTAL: number;
  SALDO: number;
  ESTADO: string;
}

function mapRow(row: AjusteRow): Ajuste {
  return {
    idAjuste: row.ID_AJUSTE,
    idCliente: row.ID_CLIENTE,
    nombreCliente: row.NOMBRE_CLIENTE,
    idDocumento: row.ID_DOCUMENTO,
    tipoAjuste: row.TIPO_AJUSTE,
    monto: row.MONTO,
    motivo: row.MOTIVO,
    fecha: row.FECHA?.toISOString() ?? '',
    idEmpleado: row.ID_EMPLEADO,
    nombreEmpleado: row.NOMBRE_EMPLEADO,
    estado: row.ESTADO as Ajuste['estado'],
    idEmpleadoAprobador: row.ID_EMPLEADO_APROBADOR,
    nombreEmpleadoAprobador: row.NOMBRE_EMPLEADO_APROBADOR,
    fechaAprobacion: row.FECHA_APROBACION?.toISOString() ?? null,
    idEmpleadoAprobador2: row.ID_EMPLEADO_APROBADOR_2,
    nombreEmpleadoAprobador2: row.NOMBRE_EMPLEADO_APROBADOR_2,
    fechaAprobacion2: row.FECHA_APROBACION_2?.toISOString() ?? null,
    motivoRechazo: row.MOTIVO_RECHAZO,
  };
}

const SELECT_BASE = `
  SELECT a.ID_AJUSTE,
         a.ID_CLIENTE,
         c.NOMBRE AS NOMBRE_CLIENTE,
         a.ID_DOCUMENTO,
         a.TIPO_AJUSTE,
         a.MONTO,
         a.MOTIVO,
         a.FECHA,
         a.ID_EMPLEADO,
         (e.NOMBRE || ' ' || e.APELLIDO) AS NOMBRE_EMPLEADO,
         a.ESTADO,
         a.ID_EMPLEADO_APROBADOR,
         (ap.NOMBRE || ' ' || ap.APELLIDO) AS NOMBRE_EMPLEADO_APROBADOR,
         a.FECHA_APROBACION,
         a.ID_EMPLEADO_APROBADOR_2,
         (ap2.NOMBRE || ' ' || ap2.APELLIDO) AS NOMBRE_EMPLEADO_APROBADOR_2,
         a.FECHA_APROBACION_2,
         a.MOTIVO_RECHAZO
    FROM CXC_AJUSTES a
    LEFT JOIN CLIENTE c ON c.ID_CLIENTE = a.ID_CLIENTE
    LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = a.ID_EMPLEADO
    LEFT JOIN EMPLEADO ap ON ap.ID_EMPLEADO = a.ID_EMPLEADO_APROBADOR
    LEFT JOIN EMPLEADO ap2 ON ap2.ID_EMPLEADO = a.ID_EMPLEADO_APROBADOR_2
`;

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: Ajuste[]; total: number }> {
  const conn = await getConnection();
  try {
    const offset = (params.page - 1) * params.limit;
    const whereClause = params.search
      ? `WHERE UPPER(c.NOMBRE) LIKE UPPER(:search)
          OR UPPER(a.TIPO_AJUSTE) LIKE UPPER(:search)
          OR UPPER(a.MOTIVO) LIKE UPPER(:search)
          OR UPPER(a.ESTADO) LIKE UPPER(:search)
          OR TO_CHAR(a.ID_DOCUMENTO) LIKE :search`
      : '';
    const searchBind = params.search ? { search: `%${params.search}%` } : {};

    const dataResult = await conn.execute<AjusteRow>(
      `${SELECT_BASE}
       ${whereClause}
       ORDER BY a.FECHA DESC, a.ID_AJUSTE DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBind, offset, limit: params.limit },
    );

    const countResult = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) AS TOTAL
         FROM CXC_AJUSTES a
         LEFT JOIN CLIENTE c ON c.ID_CLIENTE = a.ID_CLIENTE
        ${whereClause}`,
      searchBind,
    );

    return {
      data: (dataResult.rows ?? []).map(mapRow),
      total: countResult.rows?.[0]?.TOTAL ?? 0,
    };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<Ajuste | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<AjusteRow>(
      `${SELECT_BASE} WHERE a.ID_AJUSTE = :id`,
      { id },
    );
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(input: CreateAjusteInput): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_AJUSTES
         (ID_CLIENTE, ID_DOCUMENTO, TIPO_AJUSTE, MONTO, MOTIVO, FECHA, ID_EMPLEADO, ESTADO)
       VALUES
         (:idCliente, :idDocumento, :tipoAjuste, :monto, :motivo,
          NVL(TO_DATE(:fecha, 'YYYY-MM-DD'), SYSDATE), :idEmpleado, 'PENDIENTE')
       RETURNING ID_AJUSTE INTO :id`,
      {
        idCliente: input.idCliente,
        idDocumento: input.idDocumento ?? null,
        tipoAjuste: input.tipoAjuste,
        monto: input.monto,
        motivo: input.motivo ?? null,
        fecha: input.fecha ?? null,
        idEmpleado: input.idEmpleado,
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

export async function update(id: number, input: UpdateAjusteInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.idCliente !== undefined) { fields.push('ID_CLIENTE = :idCliente'); binds.idCliente = input.idCliente; }
  if (input.idDocumento !== undefined) { fields.push('ID_DOCUMENTO = :idDocumento'); binds.idDocumento = input.idDocumento; }
  if (input.tipoAjuste !== undefined) { fields.push('TIPO_AJUSTE = :tipoAjuste'); binds.tipoAjuste = input.tipoAjuste; }
  if (input.monto !== undefined) { fields.push('MONTO = :monto'); binds.monto = input.monto; }
  if (input.motivo !== undefined) { fields.push('MOTIVO = :motivo'); binds.motivo = input.motivo; }
  if (input.fecha !== undefined) {
    fields.push(`FECHA = TO_DATE(:fecha, 'YYYY-MM-DD')`);
    binds.fecha = input.fecha;
  }
  if (input.idEmpleado !== undefined) { fields.push('ID_EMPLEADO = :idEmpleado'); binds.idEmpleado = input.idEmpleado; }

  if (fields.length === 0) return;

  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE CXC_AJUSTES SET ${fields.join(', ')} WHERE ID_AJUSTE = :id`,
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
    await conn.execute(`DELETE FROM CXC_AJUSTES WHERE ID_AJUSTE = :id`, { id });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

const ESTADOS_APROBABLES = ['PENDIENTE', 'EN_2DA_APROBACION'];

/**
 * Aprobación DOBLE de un ajuste: la primera llamada (ESTADO PENDIENTE) solo
 * dispara el ajuste hacia EN_2DA_APROBACION y NO mueve saldo. La segunda
 * llamada (ESTADO EN_2DA_APROBACION) exige un empleado DISTINTO al primer
 * aprobador; recién ahí, con datos frescos bajo FOR UPDATE, aplica CREDITO
 * como reducción de saldo y DEBITO como incremento, deja el ajuste APROBADO
 * y registra el evento en el historial del documento. Una sola conexión por
 * llamada, un solo commit.
 */
export async function aprobar(id: number, input: AprobarAjusteInput): Promise<void> {
  const conn = await getConnection();
  try {
    const ajusteResult = await conn.execute<{
      ID_AJUSTE: number;
      ID_CLIENTE: number;
      ID_DOCUMENTO: number | null;
      TIPO_AJUSTE: string;
      MONTO: number;
      ESTADO: string;
      ID_EMPLEADO_APROBADOR: number | null;
    }>(
      `SELECT ID_AJUSTE, ID_CLIENTE, ID_DOCUMENTO, TIPO_AJUSTE, MONTO, ESTADO, ID_EMPLEADO_APROBADOR
         FROM CXC_AJUSTES
        WHERE ID_AJUSTE = :id
        FOR UPDATE`,
      { id },
    );
    const ajuste = ajusteResult.rows?.[0];
    if (!ajuste) throw new NotFoundError(`Ajuste ${id} no encontrado`);
    const estadoActual = String(ajuste.ESTADO).toUpperCase();
    if (!ESTADOS_APROBABLES.includes(estadoActual)) {
      throw new ConflictError('Solo un ajuste pendiente o en segunda aprobación puede aprobarse.');
    }

    // Primera aprobación: solo registra al primer aprobador. Sin efecto
    // financiero todavía — eso ocurre únicamente en la segunda aprobación.
    if (estadoActual === 'PENDIENTE') {
      await conn.execute(
        `UPDATE CXC_AJUSTES
            SET ESTADO = 'EN_2DA_APROBACION',
                ID_EMPLEADO_APROBADOR = :idEmpleadoAprobador,
                FECHA_APROBACION = NVL(TO_DATE(:fechaAprobacion, 'YYYY-MM-DD'), SYSDATE)
          WHERE ID_AJUSTE = :id`,
        { idEmpleadoAprobador: input.idEmpleadoAprobador, fechaAprobacion: input.fechaAprobacion ?? null, id },
      );
      await conn.commit();
      return;
    }

    // Segunda aprobación: debe ser un empleado distinto al primer aprobador.
    if (ajuste.ID_EMPLEADO_APROBADOR === input.idEmpleadoAprobador) {
      throw new ConflictError('El segundo aprobador debe ser un empleado distinto al que dio la primera aprobación.');
    }

    if (!ajuste.ID_DOCUMENTO) {
      throw new BadRequestError('El ajuste no tiene un documento asociado; no hay saldo que afectar.');
    }

    const documentoResult = await conn.execute<DocumentoLockRow>(
      `SELECT ID_DOCUMENTO, ID_CLIENTE, TOTAL, SALDO, ESTADO
         FROM CXC_DOCUMENTOS
        WHERE ID_DOCUMENTO = :idDocumento
        FOR UPDATE`,
      { idDocumento: ajuste.ID_DOCUMENTO },
    );
    const documento = documentoResult.rows?.[0];
    if (!documento) throw new BadRequestError('El documento del ajuste ya no existe');

    if (isDocumentoBloqueadoParaAplicacion(documento.ESTADO)) {
      throw new ConflictError('El documento ya está pagado o anulado; no se puede aprobar un ajuste sobre él.');
    }

    const saldoActual = roundMoney(Number(documento.SALDO));
    const monto = roundMoney(Number(ajuste.MONTO));
    const tipoAjuste = String(ajuste.TIPO_AJUSTE).toUpperCase();

    if (tipoAjuste === 'CREDITO' && monto > saldoActual + 0.005) {
      throw new BadRequestError('Un ajuste crédito no puede superar el saldo pendiente vigente del documento.');
    }

    const nuevoSaldo = tipoAjuste === 'CREDITO'
      ? Math.max(0, roundMoney(saldoActual - monto))
      : roundMoney(saldoActual + monto);
    const nuevoEstadoDocumento = deriveDocumentoEstado(Number(documento.TOTAL), nuevoSaldo, documento.ESTADO);

    await conn.execute(
      `UPDATE CXC_DOCUMENTOS SET SALDO = :saldo, ESTADO = :estado WHERE ID_DOCUMENTO = :idDocumento`,
      { saldo: nuevoSaldo, estado: nuevoEstadoDocumento, idDocumento: ajuste.ID_DOCUMENTO },
    );

    await conn.execute(
      `UPDATE CXC_AJUSTES
          SET ESTADO = 'APROBADO',
              ID_EMPLEADO_APROBADOR_2 = :idEmpleadoAprobador2,
              FECHA_APROBACION_2 = NVL(TO_DATE(:fechaAprobacion, 'YYYY-MM-DD'), SYSDATE)
        WHERE ID_AJUSTE = :id`,
      { idEmpleadoAprobador2: input.idEmpleadoAprobador, fechaAprobacion: input.fechaAprobacion ?? null, id },
    );

    await registrarEvento(conn, {
      idDocumento: ajuste.ID_DOCUMENTO,
      estadoAnterior: documento.ESTADO,
      estadoNuevo: nuevoEstadoDocumento,
      idEmpleado: input.idEmpleadoAprobador,
      tipoEvento: 'AJUSTE_APROBADO',
      monto,
      naturaleza: tipoAjuste === 'CREDITO' ? 'ABONO' : 'CARGO',
      descripcion: `Ajuste #${id} (${tipoAjuste}) aprobado en segunda instancia`,
      fecha: input.fechaAprobacion,
    });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

/** Rechaza un ajuste PENDIENTE o EN_2DA_APROBACION: nunca toca el saldo del documento. */
export async function rechazar(id: number, input: RechazarAjusteInput): Promise<void> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ ESTADO: string }>(
      `SELECT ESTADO FROM CXC_AJUSTES WHERE ID_AJUSTE = :id FOR UPDATE`,
      { id },
    );
    const row = result.rows?.[0];
    if (!row) throw new NotFoundError(`Ajuste ${id} no encontrado`);
    if (!ESTADOS_APROBABLES.includes(String(row.ESTADO).toUpperCase())) {
      throw new ConflictError('Solo un ajuste pendiente o en segunda aprobación puede rechazarse.');
    }

    await conn.execute(
      `UPDATE CXC_AJUSTES
          SET ESTADO = 'RECHAZADO',
              ID_EMPLEADO_APROBADOR = :idEmpleadoAprobador,
              FECHA_APROBACION = NVL(TO_DATE(:fechaAprobacion, 'YYYY-MM-DD'), SYSDATE),
              MOTIVO_RECHAZO = :motivoRechazo
        WHERE ID_AJUSTE = :id`,
      {
        idEmpleadoAprobador: input.idEmpleadoAprobador,
        fechaAprobacion: input.fechaAprobacion ?? null,
        motivoRechazo: input.motivoRechazo,
        id,
      },
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}
