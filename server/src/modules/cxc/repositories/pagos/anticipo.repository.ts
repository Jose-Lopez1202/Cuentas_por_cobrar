import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import { businessTodayIso } from '../../../../shared/date';
import type {
  Anticipo,
  CreateAnticipoInput,
  UpdateAnticipoInput,
  AnularAnticipoInput,
} from '@erp/contracts';
import { BadRequestError, ConflictError, NotFoundError } from '../../../../shared/errors/AppError';

interface Row {
  ID_ANTICIPO: number;
  ID_CLIENTE: number;
  NOMBRE_CLIENTE: string | null;
  ID_PAGO: number | null;
  REFERENCIA_PAGO: string | null;
  MONTO_ORIGINAL: number;
  MONTO_DISPONIBLE: number;
  FECHA: Date;
  ESTADO: string;
  ID_EMPLEADO_ANULACION: number | null;
  NOMBRE_EMPLEADO_ANULACION: string | null;
  FECHA_ANULACION: Date | null;
  MOTIVO_ANULACION: string | null;
}

interface AnticipoBloqueado {
  ESTADO: string;
  MONTO_ORIGINAL: number;
  MONTO_DISPONIBLE: number;
  FECHA_ISO: string;
}

const map = (r: Row): Anticipo => ({
  idAnticipo: r.ID_ANTICIPO,
  idCliente: r.ID_CLIENTE,
  nombreCliente: r.NOMBRE_CLIENTE,
  idPago: r.ID_PAGO,
  referenciaPago: r.REFERENCIA_PAGO,
  montoOriginal: r.MONTO_ORIGINAL,
  montoDisponible: r.MONTO_DISPONIBLE,
  fecha: r.FECHA?.toISOString() ?? '',
  estado: r.ESTADO as Anticipo['estado'],
  idEmpleadoAnulacion: r.ID_EMPLEADO_ANULACION,
  nombreEmpleadoAnulacion: r.NOMBRE_EMPLEADO_ANULACION,
  fechaAnulacion: r.FECHA_ANULACION?.toISOString() ?? null,
  motivoAnulacion: r.MOTIVO_ANULACION,
});

const SELECT_BASE = `
  SELECT a.ID_ANTICIPO, a.ID_CLIENTE, c.NOMBRE AS NOMBRE_CLIENTE,
         a.ID_PAGO, p.NUMERO_REFERENCIA AS REFERENCIA_PAGO,
         a.MONTO_ORIGINAL, a.MONTO_DISPONIBLE, a.FECHA, a.ESTADO,
         a.ID_EMPLEADO_ANULACION,
         CASE WHEN ea.ID_EMPLEADO IS NULL THEN NULL
              ELSE TRIM(ea.NOMBRE || ' ' || NVL(ea.APELLIDO, ''))
         END AS NOMBRE_EMPLEADO_ANULACION,
         a.FECHA_ANULACION, a.MOTIVO_ANULACION
    FROM CXC_ANTICIPOS a
    JOIN CLIENTE c ON c.ID_CLIENTE = a.ID_CLIENTE
    LEFT JOIN CXC_PAGOS p ON p.ID_PAGO = a.ID_PAGO
    LEFT JOIN EMPLEADO ea ON ea.ID_EMPLEADO = a.ID_EMPLEADO_ANULACION
`;

export async function findAll({ page, limit, search }: {
  page: number;
  limit: number;
  search?: string;
}) {
  const conn = await getConnection();
  try {
    const where = search
      ? `WHERE UPPER(c.NOMBRE) LIKE UPPER(:search)
          OR UPPER(a.ESTADO) LIKE UPPER(:search)
          OR UPPER(p.NUMERO_REFERENCIA) LIKE UPPER(:search)
          OR TO_CHAR(a.ID_ANTICIPO) LIKE :search`
      : '';
    const searchBinds = search ? { search: `%${search}%` } : {};
    const data = await conn.execute<Row>(
      `${SELECT_BASE} ${where}
       ORDER BY a.FECHA DESC, a.ID_ANTICIPO DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...searchBinds, offset: (page - 1) * limit, limit },
    );
    const count = await conn.execute<{ TOTAL: number }>(
      `SELECT COUNT(*) TOTAL
         FROM CXC_ANTICIPOS a
         JOIN CLIENTE c ON c.ID_CLIENTE = a.ID_CLIENTE
         LEFT JOIN CXC_PAGOS p ON p.ID_PAGO = a.ID_PAGO
        ${where}`,
      searchBinds,
    );
    return {
      data: (data.rows ?? []).map(map),
      total: count.rows?.[0]?.TOTAL ?? 0,
    };
  } finally {
    await conn.close();
  }
}

export async function findById(id: number): Promise<Anticipo | null> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<Row>(
      `${SELECT_BASE} WHERE a.ID_ANTICIPO = :id`,
      { id },
    );
    return result.rows?.[0] ? map(result.rows[0]) : null;
  } finally {
    await conn.close();
  }
}

// Las aplicaciones y reversas modifican MONTO_DISPONIBLE mediante su propio
// repositorio. La creación de la cabecera inicia siempre con saldo íntegro.
export async function create(input: CreateAnticipoInput): Promise<number> {
  const original = Number(input.montoOriginal);
  const disponible = Number(input.montoDisponible);
  if (!Number.isFinite(original) || original <= 0 ||
      !Number.isFinite(disponible) || Math.abs(original - disponible) > 0.005) {
    throw new BadRequestError('El anticipo debe iniciar con un monto positivo y disponible igual al original.');
  }
  if (input.fecha > businessTodayIso()) {
    throw new BadRequestError('La fecha del anticipo no puede ser futura.');
  }

  const conn = await getConnection();
  try {
    const result = await conn.execute<{ id: number[] }>(
      `INSERT INTO CXC_ANTICIPOS
         (ID_CLIENTE, ID_PAGO, MONTO_ORIGINAL, MONTO_DISPONIBLE, FECHA, ESTADO)
       VALUES
         (:idCliente, :idPago, :montoOriginal, :montoDisponible,
          TO_DATE(:fecha, 'YYYY-MM-DD'), 'DISPONIBLE')
       RETURNING ID_ANTICIPO INTO :id`,
      {
        idCliente: input.idCliente,
        idPago: input.idPago ?? null,
        montoOriginal: original,
        montoDisponible: original,
        fecha: input.fecha,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    await conn.commit();
    return result.outBinds!.id[0];
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.close();
  }
}

async function bloquearAnticipo(conn: oracledb.Connection, id: number): Promise<AnticipoBloqueado> {
  const result = await conn.execute<AnticipoBloqueado>(
    `SELECT ESTADO, MONTO_ORIGINAL, MONTO_DISPONIBLE,
            TO_CHAR(FECHA, 'YYYY-MM-DD') AS FECHA_ISO
       FROM CXC_ANTICIPOS
      WHERE ID_ANTICIPO = :id
      FOR UPDATE`,
    { id },
  );
  const item = result.rows?.[0];
  if (!item) throw new NotFoundError(`Anticipo ${id} no encontrado`);
  return item;
}

async function tieneHistorialAplicaciones(conn: oracledb.Connection, id: number): Promise<boolean> {
  const result = await conn.execute<{ TOTAL: number }>(
    `SELECT COUNT(*) AS TOTAL
       FROM CXC_APLICACION_ANTICIPO
      WHERE ID_ANTICIPO = :id`,
    { id },
  );
  return Number(result.rows?.[0]?.TOTAL ?? 0) > 0;
}

export async function update(id: number, input: UpdateAnticipoInput): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, string | number | null> = { id };

  const conn = await getConnection();
  try {
    const current = await bloquearAnticipo(conn, id);
    if (String(current.ESTADO ?? '').trim().toUpperCase() !== 'DISPONIBLE') {
      throw new ConflictError('Solo los anticipos disponibles pueden modificarse.');
    }
    // Se rechazan también aplicaciones reversadas: la cabecera conserva
    // su historia, y cambiarla podría descontextualizar movimientos previos.
    if (await tieneHistorialAplicaciones(conn, id)) {
      throw new ConflictError('Este anticipo ya tiene historial de aplicaciones; no puede editarse directamente.');
    }

    const original = input.montoOriginal ?? Number(current.MONTO_ORIGINAL);
    const disponible = input.montoDisponible ?? Number(current.MONTO_DISPONIBLE);
    if (!Number.isFinite(original) || original <= 0 ||
        !Number.isFinite(disponible) || Math.abs(original - disponible) > 0.005) {
      throw new BadRequestError('En un anticipo sin aplicaciones, el disponible debe ser igual al monto original y positivo.');
    }
    if (input.fecha !== undefined && input.fecha > businessTodayIso()) {
      throw new BadRequestError('La fecha del anticipo no puede ser futura.');
    }

    const columnas = [
      ['idCliente', 'ID_CLIENTE'],
      ['idPago', 'ID_PAGO'],
      ['montoOriginal', 'MONTO_ORIGINAL'],
      ['montoDisponible', 'MONTO_DISPONIBLE'],
    ] as const;
    for (const [key, column] of columnas) {
      const value = input[key];
      if (value !== undefined) {
        fields.push(`${column} = :${key}`);
        binds[key] = value;
      }
    }
    if (input.fecha !== undefined) {
      fields.push("FECHA = TO_DATE(:fecha, 'YYYY-MM-DD')");
      binds.fecha = input.fecha;
    }
    if (fields.length > 0) {
      await conn.execute(
        `UPDATE CXC_ANTICIPOS SET ${fields.join(', ')} WHERE ID_ANTICIPO = :id`,
        binds,
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.close();
  }
}

export async function remove(id: number): Promise<void> {
  const conn = await getConnection();
  try {
    const current = await bloquearAnticipo(conn, id);
    if (String(current.ESTADO ?? '').trim().toUpperCase() !== 'DISPONIBLE') {
      throw new ConflictError('Solo se puede eliminar un anticipo disponible.');
    }
    if (await tieneHistorialAplicaciones(conn, id)) {
      throw new ConflictError('No se puede eliminar un anticipo con historial de aplicaciones, incluso si fueron reversadas.');
    }
    await conn.execute(`DELETE FROM CXC_ANTICIPOS WHERE ID_ANTICIPO = :id`, { id });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.close();
  }
}

/**
 * Anulación formal: conserva el anticipo, la persona responsable, fecha y
 * motivo. Rechaza aplicaciones confirmadas y fechas anteriores al anticipo.
 */
export async function anular(id: number, input: AnularAnticipoInput): Promise<void> {
  const conn = await getConnection();
  try {
    const current = await bloquearAnticipo(conn, id);
    if (String(current.ESTADO ?? '').trim().toUpperCase() === 'CANCELADO') {
      throw new ConflictError('Este anticipo ya está anulado.');
    }

    const aplicadoResult = await conn.execute<{ TOTAL: number }>(
      `SELECT NVL(SUM(MONTO_APLICADO), 0) AS TOTAL
         FROM CXC_APLICACION_ANTICIPO
        WHERE ID_ANTICIPO = :id AND ESTADO = 'CONFIRMADA'`,
      { id },
    );
    if (Number(aplicadoResult.rows?.[0]?.TOTAL ?? 0) > 0.005) {
      throw new ConflictError('Este anticipo tiene aplicaciones vigentes; debe reversarlas antes de anularlo.');
    }

    const fechaAnulacion = input.fechaAnulacion ?? businessTodayIso();
    if (fechaAnulacion > businessTodayIso()) {
      throw new BadRequestError('La fecha de anulación no puede ser futura.');
    }
    if (fechaAnulacion < current.FECHA_ISO) {
      throw new BadRequestError('La fecha de anulación no puede ser anterior a la fecha del anticipo.');
    }

    await conn.execute(
      `UPDATE CXC_ANTICIPOS
          SET MONTO_DISPONIBLE = 0,
              ESTADO = 'CANCELADO',
              ID_EMPLEADO_ANULACION = :idEmpleadoAnulacion,
              FECHA_ANULACION = TO_DATE(:fechaAnulacion, 'YYYY-MM-DD'),
              MOTIVO_ANULACION = :motivoAnulacion
        WHERE ID_ANTICIPO = :id`,
      {
        idEmpleadoAnulacion: input.idEmpleadoAnulacion,
        fechaAnulacion,
        motivoAnulacion: input.motivoAnulacion,
        id,
      },
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.close();
  }
}
