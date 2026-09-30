import oracledb, { Connection } from 'oracledb';
import { getConnection } from '../../../../config/database';
import type {
  DocumentoHistorial,
  CreateDocumentoHistorialInput,
  UpdateDocumentoHistorialInput,
  RegistrarEventoHistorialInput,
} from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';

interface DocumentoHistorialRow {
  ID_HISTORIAL: number;
  ID_DOCUMENTO: number;
  ESTADO_ANTERIOR: string | null;
  ESTADO_NUEVO: string;
  FECHA: Date;
  ID_EMPLEADO: number;
  NOMBRE_EMPLEADO: string | null;
  TIPO_EVENTO: DocumentoHistorial['tipoEvento'];
  MONTO: number | null;
  NATURALEZA: DocumentoHistorial['naturaleza'];
  DESCRIPCION: string | null;
}

function mapRow(row: DocumentoHistorialRow): DocumentoHistorial {
  return {
    idHistorial: row.ID_HISTORIAL,
    idDocumento: row.ID_DOCUMENTO,
    estadoAnterior: row.ESTADO_ANTERIOR,
    estadoNuevo: row.ESTADO_NUEVO,
    fecha: row.FECHA?.toISOString() ?? '',
    idEmpleado: row.ID_EMPLEADO,
    nombreEmpleado: row.NOMBRE_EMPLEADO,
    tipoEvento: row.TIPO_EVENTO,
    monto: row.MONTO,
    naturaleza: row.NATURALEZA,
    descripcion: row.DESCRIPCION,
  };
}

const SELECT_BASE = `
  SELECT h.ID_HISTORIAL,
         h.ID_DOCUMENTO,
         h.ESTADO_ANTERIOR,
         h.ESTADO_NUEVO,
         h.FECHA,
         h.ID_EMPLEADO,
         (e.NOMBRE || ' ' || e.APELLIDO) AS NOMBRE_EMPLEADO,
         h.TIPO_EVENTO,
         h.MONTO,
         h.NATURALEZA,
         h.DESCRIPCION
    FROM CXC_DOCUMENTO_HISTORIAL h
    LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = h.ID_EMPLEADO
`;

export async function findByDocumento(idDocumento: number): Promise<DocumentoHistorial[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<DocumentoHistorialRow>(
      `${SELECT_BASE}
       WHERE h.ID_DOCUMENTO = :idDocumento
       ORDER BY h.FECHA DESC, h.ID_HISTORIAL DESC`,
      { idDocumento },
    );
    return (result.rows ?? []).map(mapRow);
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<DocumentoHistorial | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<DocumentoHistorialRow>(
      `${SELECT_BASE} WHERE h.ID_HISTORIAL = :id`,
      { id },
    );
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(input: CreateDocumentoHistorialInput): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_DOCUMENTO_HISTORIAL
         (ID_DOCUMENTO, ESTADO_ANTERIOR, ESTADO_NUEVO, FECHA, ID_EMPLEADO)
       VALUES
         (:idDocumento, :estadoAnterior, :estadoNuevo,
          NVL(TO_DATE(:fecha, 'YYYY-MM-DD'), SYSDATE), :idEmpleado)
       RETURNING ID_HISTORIAL INTO :id`,
      {
        idDocumento: input.idDocumento,
        estadoAnterior: input.estadoAnterior ?? null,
        estadoNuevo: input.estadoNuevo,
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

export async function update(id: number, input: UpdateDocumentoHistorialInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.estadoAnterior !== undefined) { fields.push('ESTADO_ANTERIOR = :estadoAnterior'); binds.estadoAnterior = input.estadoAnterior; }
  if (input.estadoNuevo !== undefined) { fields.push('ESTADO_NUEVO = :estadoNuevo'); binds.estadoNuevo = input.estadoNuevo; }
  if (input.fecha !== undefined) {
    fields.push(`FECHA = TO_DATE(:fecha, 'YYYY-MM-DD')`);
    binds.fecha = input.fecha;
  }
  if (input.idEmpleado !== undefined) { fields.push('ID_EMPLEADO = :idEmpleado'); binds.idEmpleado = input.idEmpleado; }

  if (fields.length === 0) {
    if (!(await findById(id))) throw new NotFoundError(`Historial de documento ${id} no encontrado`);
    return;
  }

  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `UPDATE CXC_DOCUMENTO_HISTORIAL SET ${fields.join(', ')} WHERE ID_HISTORIAL = :id`,
      binds,
    );
    if (!result.rowsAffected) throw new NotFoundError(`Historial de documento ${id} no encontrado`);
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
    const result = await conn.execute(
      `DELETE FROM CXC_DOCUMENTO_HISTORIAL WHERE ID_HISTORIAL = :id`,
      { id },
    );
    if (!result.rowsAffected) throw new NotFoundError(`Historial de documento ${id} no encontrado`);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

/**
 * Deja un registro automático de historial DENTRO de la transacción del
 * llamador: recibe la conexión ya abierta de quien está aplicando un
 * pago/NC/anticipo, reversando una aplicación, aprobando un ajuste o
 * anulando un documento, y no hace su propio commit/close ni abre conexión
 * propia. El caller decide cuándo confirmar todo junto.
 */
export async function registrarEvento(conn: Connection, input: RegistrarEventoHistorialInput): Promise<void> {
  await conn.execute(
    `INSERT INTO CXC_DOCUMENTO_HISTORIAL
       (ID_DOCUMENTO, ESTADO_ANTERIOR, ESTADO_NUEVO, FECHA, ID_EMPLEADO, TIPO_EVENTO, MONTO, NATURALEZA, DESCRIPCION)
     VALUES
       (:idDocumento, :estadoAnterior, :estadoNuevo,
        NVL(TO_DATE(:fecha, 'YYYY-MM-DD'), SYSDATE), :idEmpleado, :tipoEvento, :monto, :naturaleza, :descripcion)`,
    {
      idDocumento: input.idDocumento,
      estadoAnterior: input.estadoAnterior,
      estadoNuevo: input.estadoNuevo,
      fecha: input.fecha ?? null,
      idEmpleado: input.idEmpleado,
      tipoEvento: input.tipoEvento,
      monto: input.monto ?? null,
      naturaleza: input.naturaleza ?? null,
      descripcion: input.descripcion ?? null,
    },
  );
}
