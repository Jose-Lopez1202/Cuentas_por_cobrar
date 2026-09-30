import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type { RutaDetalle, CreateRutaDetalleInput, UpdateRutaDetalleInput } from '@erp/contracts';
import { NotFoundError } from '../../../../shared/errors/AppError';

interface RutaDetalleRow {
  ID_RUTA_DETALLE: number;
  ID_RUTA: number;
  ID_CLIENTE: number;
  NOMBRE_CLIENTE: string | null;
  ORDEN_VISITA: number | null;
  DIRECCION: string | null;
  MONTO_PENDIENTE: number | null;
  ESTADO_VISITA: string | null;
  HORA_VISITA: string | null;
  OBSERVACIONES: string | null;
}

function mapRow(row: RutaDetalleRow): RutaDetalle {
  return {
    idRutaDetalle: row.ID_RUTA_DETALLE,
    idRuta: row.ID_RUTA,
    idCliente: row.ID_CLIENTE,
    nombreCliente: row.NOMBRE_CLIENTE,
    ordenVisita: row.ORDEN_VISITA,
    direccion: row.DIRECCION,
    montoPendiente: row.MONTO_PENDIENTE,
    estadoVisita: row.ESTADO_VISITA,
    horaVisita: row.HORA_VISITA,
    observaciones: row.OBSERVACIONES,
  };
}

// OJO: la tabla de clientes en la base se llama CLIENTE (no CXC_CLIENTES).
// LEFT JOIN (no JOIN normal): un ID_CLIENTE huérfano no debe borrar la parada
// de la ruta del listado del cobrador ni causar un falso 404 en findById.
const SELECT_BASE = `
  SELECT d.ID_RUTA_DETALLE, d.ID_RUTA, d.ID_CLIENTE, c.NOMBRE AS NOMBRE_CLIENTE,
         d.ORDEN_VISITA, d.DIRECCION, d.MONTO_PENDIENTE,
         d.ESTADO_VISITA, d.HORA_VISITA, d.OBSERVACIONES
  FROM CXC_RUTA_DETALLE d
  LEFT JOIN CLIENTE c ON c.ID_CLIENTE = d.ID_CLIENTE
`;

/** Lista las paradas de UNA ruta específica, ordenadas por orden de visita. */
export async function findByRuta(idRuta: number): Promise<RutaDetalle[]> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<RutaDetalleRow>(
      `${SELECT_BASE} WHERE d.ID_RUTA = :idRuta ORDER BY d.ORDEN_VISITA ASC NULLS LAST, d.ID_RUTA_DETALLE ASC`,
      { idRuta },
    );
    return (result.rows ?? []).map(mapRow);
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<RutaDetalle | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<RutaDetalleRow>(`${SELECT_BASE} WHERE d.ID_RUTA_DETALLE = :id`, { id });
    const row = result.rows?.[0];
    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(idRuta: number, input: CreateRutaDetalleInput): Promise<number> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_RUTA_DETALLE
         (ID_RUTA, ID_CLIENTE, ORDEN_VISITA, DIRECCION, MONTO_PENDIENTE, ESTADO_VISITA, HORA_VISITA, OBSERVACIONES)
       VALUES
         (:idRuta, :idCliente, :ordenVisita, :direccion, :montoPendiente, :estadoVisita, :horaVisita, :observaciones)
       RETURNING ID_RUTA_DETALLE INTO :id`,
      {
        idRuta,
        idCliente: input.idCliente,
        ordenVisita: input.ordenVisita ?? null,
        direccion: input.direccion ?? null,
        montoPendiente: input.montoPendiente ?? null,
        estadoVisita: input.estadoVisita ?? 'PENDIENTE',
        horaVisita: input.horaVisita ?? null,
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

export async function update(id: number, input: UpdateRutaDetalleInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.idCliente !== undefined) { fields.push('ID_CLIENTE = :idCliente'); binds.idCliente = input.idCliente; }
  if (input.ordenVisita !== undefined) { fields.push('ORDEN_VISITA = :ordenVisita'); binds.ordenVisita = input.ordenVisita; }
  if (input.direccion !== undefined) { fields.push('DIRECCION = :direccion'); binds.direccion = input.direccion; }
  if (input.montoPendiente !== undefined) { fields.push('MONTO_PENDIENTE = :montoPendiente'); binds.montoPendiente = input.montoPendiente; }
  if (input.estadoVisita !== undefined) { fields.push('ESTADO_VISITA = :estadoVisita'); binds.estadoVisita = input.estadoVisita; }
  if (input.horaVisita !== undefined) { fields.push('HORA_VISITA = :horaVisita'); binds.horaVisita = input.horaVisita; }
  if (input.observaciones !== undefined) { fields.push('OBSERVACIONES = :observaciones'); binds.observaciones = input.observaciones; }

  if (fields.length === 0) {
    if (!(await findById(id))) throw new NotFoundError(`Parada de ruta ${id} no encontrada`);
    return;
  }

  const conn = await getConnection();
  try {
    const result = await conn.execute(`UPDATE CXC_RUTA_DETALLE SET ${fields.join(', ')} WHERE ID_RUTA_DETALLE = :id`, binds);
    if (!result.rowsAffected) throw new NotFoundError(`Parada de ruta ${id} no encontrada`);
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
    const result = await conn.execute(`DELETE FROM CXC_RUTA_DETALLE WHERE ID_RUTA_DETALLE = :id`, { id });
    if (!result.rowsAffected) throw new NotFoundError(`Parada de ruta ${id} no encontrada`);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}
