import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type {
  DocumentoDetalle,
  CreateDocumentoDetalleInput,
  UpdateDocumentoDetalleInput,
} from '@erp/contracts';

interface DocumentoDetalleRow {
  ID_DETALLE: number;
  ID_DOCUMENTO: number;
  CODIGO_PRODUCTO: string | null;
  DESCRIPCION: string;
  CANTIDAD: number;
  PRECIO_UNITARIO: number;
  TOTAL: number;
}

function mapRow(row: DocumentoDetalleRow): DocumentoDetalle {
  return {
    idDetalle: row.ID_DETALLE,
    idDocumento: row.ID_DOCUMENTO,
    codigoProducto: row.CODIGO_PRODUCTO,
    descripcion: row.DESCRIPCION,
    cantidad: row.CANTIDAD,
    precioUnitario: row.PRECIO_UNITARIO,
    total: row.TOTAL,
  };
}

export async function findByDocumento(idDocumento: number): Promise<DocumentoDetalle[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<DocumentoDetalleRow>(
      `SELECT ID_DETALLE, ID_DOCUMENTO, CODIGO_PRODUCTO, DESCRIPCION,
              CANTIDAD, PRECIO_UNITARIO, TOTAL
         FROM CXC_DOCUMENTO_DETALLE
        WHERE ID_DOCUMENTO = :idDocumento
        ORDER BY ID_DETALLE ASC`,
      { idDocumento },
    );
    return (result.rows ?? []).map(mapRow);
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<DocumentoDetalle | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<DocumentoDetalleRow>(
      `SELECT ID_DETALLE, ID_DOCUMENTO, CODIGO_PRODUCTO, DESCRIPCION,
              CANTIDAD, PRECIO_UNITARIO, TOTAL
         FROM CXC_DOCUMENTO_DETALLE
        WHERE ID_DETALLE = :id`,
      { id },
    );
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(input: CreateDocumentoDetalleInput): Promise<number> {
  const conn = await getConnection();
  try {
    const total = input.total ?? Number((input.cantidad * input.precioUnitario).toFixed(2));
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_DOCUMENTO_DETALLE
         (ID_DOCUMENTO, CODIGO_PRODUCTO, DESCRIPCION, CANTIDAD, PRECIO_UNITARIO, TOTAL)
       VALUES
         (:idDocumento, :codigoProducto, :descripcion, :cantidad, :precioUnitario, :total)
       RETURNING ID_DETALLE INTO :id`,
      {
        idDocumento: input.idDocumento,
        codigoProducto: input.codigoProducto ?? null,
        descripcion: input.descripcion,
        cantidad: input.cantidad,
        precioUnitario: input.precioUnitario,
        total,
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

export async function update(id: number, input: UpdateDocumentoDetalleInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.codigoProducto !== undefined) { fields.push('CODIGO_PRODUCTO = :codigoProducto'); binds.codigoProducto = input.codigoProducto; }
  if (input.descripcion !== undefined) { fields.push('DESCRIPCION = :descripcion'); binds.descripcion = input.descripcion; }
  if (input.cantidad !== undefined) { fields.push('CANTIDAD = :cantidad'); binds.cantidad = input.cantidad; }
  if (input.precioUnitario !== undefined) { fields.push('PRECIO_UNITARIO = :precioUnitario'); binds.precioUnitario = input.precioUnitario; }
  if (input.total !== undefined) { fields.push('TOTAL = :total'); binds.total = input.total; }

  if (fields.length === 0) return;

  const conn = await getConnection();
  try {
    await conn.execute(
      `UPDATE CXC_DOCUMENTO_DETALLE SET ${fields.join(', ')} WHERE ID_DETALLE = :id`,
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
    await conn.execute(
      `DELETE FROM CXC_DOCUMENTO_DETALLE WHERE ID_DETALLE = :id`,
      { id },
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}
