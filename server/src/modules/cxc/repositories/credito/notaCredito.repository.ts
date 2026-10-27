
import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import { businessTodayIso } from '../../../../shared/date';

import type {
  NotaCredito,
  CreateNotaCreditoInput,
  UpdateNotaCreditoInput,
  AnularNotaCreditoInput,
} from '@erp/contracts';

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/AppError';

// =====================================================
// ESTADOS EN LOS QUE UNA NOTA PUEDE MODIFICARSE
// =====================================================

export function isNotaCreditoAplicable(
  estado: string | null | undefined,
): boolean {
  return ['PENDIENTE', 'ACTIVA'].includes(
    String(estado ?? '').trim().toUpperCase(),
  );
}

// =====================================================
// INTERFAZ DE RESULTADOS DE ORACLE
// =====================================================

interface NotaCreditoRow {
  ID_NOTA_CREDITO: number;
  ID_CLIENTE: number;
  NOMBRE_CLIENTE: string | null;
  ID_DOCUMENTO_REFERENCIA: number | null;
  DESCRIPCION: string | null;
  SERIE: string | null;
  NUMERO: string | null;

  FECHA_ISO: string;

  MONTO: number;
  MONTO_APLICADO: number;
  MONTO_DISPONIBLE: number;
  ESTADO: string;

  ID_EMPLEADO_ANULACION: number | null;
  NOMBRE_EMPLEADO_ANULACION: string | null;
  FECHA_ANULACION_ISO: string | null;
  MOTIVO_ANULACION: string | null;
}

// =====================================================
// MAPEO DE RESULTADOS
// =====================================================

function mapRow(row: NotaCreditoRow): NotaCredito {
  return {
    idNotaCredito: row.ID_NOTA_CREDITO,
    idCliente: row.ID_CLIENTE,
    nombreCliente: row.NOMBRE_CLIENTE,
    idDocumentoReferencia: row.ID_DOCUMENTO_REFERENCIA,
    descripcion: row.DESCRIPCION,
    serie: row.SERIE,
    numero: row.NUMERO,

    // TO_CHAR devuelve exactamente la fecha
    // registrada en Oracle, sin conversión UTC.
    fecha: row.FECHA_ISO,

    monto: row.MONTO,
    montoAplicado: Number(row.MONTO_APLICADO ?? 0),
    montoDisponible: Number(
      row.MONTO_DISPONIBLE ?? row.MONTO,
    ),

    estado: row.ESTADO as NotaCredito['estado'],

    idEmpleadoAnulacion: row.ID_EMPLEADO_ANULACION,
    nombreEmpleadoAnulacion: row.NOMBRE_EMPLEADO_ANULACION,
    fechaAnulacion: row.FECHA_ANULACION_ISO,
    motivoAnulacion: row.MOTIVO_ANULACION,
  };
}

// =====================================================
// CONSULTA BASE
// =====================================================

const SELECT_BASE = `
  SELECT
    n.ID_NOTA_CREDITO,
    n.ID_CLIENTE,
    c.NOMBRE AS NOMBRE_CLIENTE,
    n.ID_DOCUMENTO_REFERENCIA,
    n.DESCRIPCION,
    n.SERIE,
    n.NUMERO,

    TO_CHAR(n.FECHA, 'YYYY-MM-DD') AS FECHA_ISO,

    n.MONTO,

    NVL(
      (
        SELECT SUM(a.MONTO_APLICADO)
        FROM CXC_APLICACION_NOTA_CREDITO a
        WHERE a.ID_NOTA_CREDITO = n.ID_NOTA_CREDITO
          AND a.ESTADO = 'CONFIRMADA'
      ),
      0
    ) AS MONTO_APLICADO,

    GREATEST(
      n.MONTO -
      NVL(
        (
          SELECT SUM(a.MONTO_APLICADO)
          FROM CXC_APLICACION_NOTA_CREDITO a
          WHERE a.ID_NOTA_CREDITO = n.ID_NOTA_CREDITO
            AND a.ESTADO = 'CONFIRMADA'
        ),
        0
      ),
      0
    ) AS MONTO_DISPONIBLE,

    n.ESTADO,
    n.ID_EMPLEADO_ANULACION,

    CASE
      WHEN ea.ID_EMPLEADO IS NULL THEN NULL
      ELSE TRIM(
        ea.NOMBRE || ' ' || NVL(ea.APELLIDO, '')
      )
    END AS NOMBRE_EMPLEADO_ANULACION,

    TO_CHAR(
      n.FECHA_ANULACION,
      'YYYY-MM-DD'
    ) AS FECHA_ANULACION_ISO,

    n.MOTIVO_ANULACION

  FROM CXC_NOTAS_CREDITO n

  LEFT JOIN CLIENTE c
    ON c.ID_CLIENTE = n.ID_CLIENTE

  LEFT JOIN EMPLEADO ea
    ON ea.ID_EMPLEADO = n.ID_EMPLEADO_ANULACION
`;

// =====================================================
// LISTAR NOTAS DE CRÉDITO
// =====================================================

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: NotaCredito[]; total: number }> {
  const conn = await getConnection();

  try {
    const offset = (params.page - 1) * params.limit;

    const whereClause = params.search
      ? `
        WHERE TO_CHAR(n.ID_CLIENTE) LIKE :search
           OR TO_CHAR(n.ID_NOTA_CREDITO) LIKE :search
           OR UPPER(NVL(c.NOMBRE, '')) LIKE UPPER(:search)
           OR UPPER(NVL(n.DESCRIPCION, '')) LIKE UPPER(:search)
           OR UPPER(NVL(n.SERIE, '')) LIKE UPPER(:search)
           OR UPPER(NVL(n.NUMERO, '')) LIKE UPPER(:search)
           OR UPPER(n.ESTADO) LIKE UPPER(:search)
      `
      : '';

    const searchBind = params.search
      ? { search: `%${params.search}%` }
      : {};

    const dataResult = await conn.execute<NotaCreditoRow>(
      `
        ${SELECT_BASE}
        ${whereClause}

        ORDER BY n.ID_NOTA_CREDITO DESC

        OFFSET :offset ROWS
        FETCH NEXT :limit ROWS ONLY
      `,
      {
        ...searchBind,
        offset,
        limit: params.limit,
      },
    );

    const countResult = await conn.execute<{
      TOTAL: number;
    }>(
      `
        SELECT COUNT(*) AS TOTAL
        FROM CXC_NOTAS_CREDITO n
        LEFT JOIN CLIENTE c
          ON c.ID_CLIENTE = n.ID_CLIENTE
        ${whereClause}
      `,
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

// =====================================================
// CONSULTAR NOTA POR ID
// =====================================================

export async function findById(
  id: number,
): Promise<NotaCredito | null> {
  const conn = await getConnection();

  try {
    const result = await conn.execute<NotaCreditoRow>(
      `
        ${SELECT_BASE}
        WHERE n.ID_NOTA_CREDITO = :id
      `,
      { id },
    );

    const row = result.rows?.[0];

    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

// =====================================================
// CREAR NOTA DE CRÉDITO
// =====================================================

export async function create(
  input: CreateNotaCreditoInput,
): Promise<number> {
  const conn = await getConnection();

  try {
    const result = await conn.execute<{
      id: number[];
    }>(
      `
        INSERT INTO CXC_NOTAS_CREDITO (
          ID_CLIENTE,
          ID_DOCUMENTO_REFERENCIA,
          DESCRIPCION,
          SERIE,
          NUMERO,
          FECHA,
          MONTO,
          ESTADO
        )
        VALUES (
          :idCliente,
          :idDocumentoReferencia,
          :descripcion,
          :serie,
          :numero,
          TO_DATE(:fecha, 'YYYY-MM-DD'),
          :monto,
          'PENDIENTE'
        )
        RETURNING ID_NOTA_CREDITO INTO :id
      `,
      {
        idCliente: input.idCliente,
        idDocumentoReferencia:
          input.idDocumentoReferencia ?? null,
        descripcion: input.descripcion ?? null,
        serie: input.serie ?? null,
        numero: input.numero ?? null,
        fecha: input.fecha,
        monto: input.monto,
        id: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER,
        },
      },
    );

    const idNotaCredito = result.outBinds!.id[0];

    await conn.commit();

    return idNotaCredito;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

// =====================================================
// BLOQUEO Y VALIDACIÓN DE NOTA
// =====================================================

interface NotaCreditoLockRow {
  ESTADO: string;
  FECHA_ISO: string;
}

async function lockYValidarSinAplicaciones(
  conn: oracledb.Connection,
  id: number,
  mensajeSiAplicada: string,
): Promise<NotaCreditoLockRow> {
  // Bloquear la nota para evitar modificaciones
  // concurrentes mientras se valida su estado.

  const lockResult =
    await conn.execute<NotaCreditoLockRow>(
      `
        SELECT
          ESTADO,
          TO_CHAR(FECHA, 'YYYY-MM-DD') AS FECHA_ISO
        FROM CXC_NOTAS_CREDITO
        WHERE ID_NOTA_CREDITO = :id
        FOR UPDATE
      `,
      { id },
    );

  const row = lockResult.rows?.[0];

  if (!row) {
    throw new NotFoundError(
      `Nota de crédito ${id} no encontrada`,
    );
  }

  // Verificar aplicaciones confirmadas
  // dentro de la misma transacción.

  const sumResult = await conn.execute<{
    TOTAL: number;
  }>(
    `
      SELECT
        NVL(SUM(MONTO_APLICADO), 0) AS TOTAL
      FROM CXC_APLICACION_NOTA_CREDITO
      WHERE ID_NOTA_CREDITO = :id
        AND ESTADO = 'CONFIRMADA'
    `,
    { id },
  );

  if (
    Number(sumResult.rows?.[0]?.TOTAL ?? 0) > 0.005
  ) {
    throw new ConflictError(mensajeSiAplicada);
  }

  return row;
}

// =====================================================
// ACTUALIZAR NOTA DE CRÉDITO
// =====================================================

export async function update(
  id: number,
  input: UpdateNotaCreditoInput,
): Promise<void> {
  const fields: string[] = [];

  const binds: Record<
    string,
    string | number | null
  > = { id };

  if (input.idCliente !== undefined) {
    fields.push('ID_CLIENTE = :idCliente');
    binds.idCliente = input.idCliente;
  }

  if (input.idDocumentoReferencia !== undefined) {
    fields.push(
      'ID_DOCUMENTO_REFERENCIA = :idDocumentoReferencia',
    );
    binds.idDocumentoReferencia =
      input.idDocumentoReferencia ?? null;
  }

  if (input.descripcion !== undefined) {
    fields.push('DESCRIPCION = :descripcion');
    binds.descripcion = input.descripcion ?? null;
  }

  if (input.serie !== undefined) {
    fields.push('SERIE = :serie');
    binds.serie = input.serie ?? null;
  }

  if (input.numero !== undefined) {
    fields.push('NUMERO = :numero');
    binds.numero = input.numero ?? null;
  }

  if (input.fecha !== undefined) {
    fields.push(
      "FECHA = TO_DATE(:fecha, 'YYYY-MM-DD')",
    );
    binds.fecha = input.fecha;
  }

  if (input.monto !== undefined) {
    fields.push('MONTO = :monto');
    binds.monto = input.monto;
  }

  if (fields.length === 0) {
    return;
  }

  const conn = await getConnection();

  try {
    const row = await lockYValidarSinAplicaciones(
      conn,
      id,
      'La nota de crédito ya tiene aplicaciones y no puede editarse directamente. Primero debe reversarse la aplicación.',
    );

    // CORRECCIÓN:
    // No permitir modificaciones sobre notas
    // anuladas ni sobre otros estados cerrados.

    if (!isNotaCreditoAplicable(row.ESTADO)) {
      throw new ConflictError(
        'Solo las notas de crédito pendientes o activas y sin aplicaciones pueden modificarse.',
      );
    }

    await conn.execute(
      `
        UPDATE CXC_NOTAS_CREDITO
        SET ${fields.join(', ')}
        WHERE ID_NOTA_CREDITO = :id
      `,
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

// =====================================================
// ELIMINAR NOTA DE CRÉDITO
// =====================================================

export async function remove(
  id: number,
): Promise<void> {
  const conn = await getConnection();

  try {
    const row = await lockYValidarSinAplicaciones(
      conn,
      id,
      'Una nota de crédito aplicada no se elimina. Debe reversarse/anularse para conservar trazabilidad.',
    );

    if (!isNotaCreditoAplicable(row.ESTADO)) {
      throw new ConflictError(
        'Solo una nota pendiente o activa y sin aplicaciones puede eliminarse físicamente.',
      );
    }

    await conn.execute(
      `
        DELETE FROM CXC_NOTAS_CREDITO
        WHERE ID_NOTA_CREDITO = :id
      `,
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

// =====================================================
// ANULACIÓN FORMAL DE NOTA DE CRÉDITO
// =====================================================

export async function anular(
  id: number,
  input: AnularNotaCreditoInput,
): Promise<void> {
  const conn = await getConnection();

  try {
    const row = await lockYValidarSinAplicaciones(
      conn,
      id,
      'Esta nota de crédito tiene aplicaciones vigentes. Reversa cada aplicación antes de anularla.',
    );

    const estadoActual = String(
      row.ESTADO ?? '',
    ).trim().toUpperCase();

    if (estadoActual === 'ANULADA') {
      throw new ConflictError(
        'Esta nota de crédito ya está anulada.',
      );
    }

    // Impedir anular notas en otros estados cerrados.
    if (!isNotaCreditoAplicable(estadoActual)) {
      throw new ConflictError(
        'La nota de crédito no está en un estado que permita su anulación.',
      );
    }

    // Utilizar fecha de Guatemala cuando el usuario
    // no proporcione una fecha de anulación.

    const fechaAnulacion =
      input.fechaAnulacion ?? businessTodayIso();

    const hoy = businessTodayIso();

    // CORRECCIÓN:
    // La anulación no puede ser anterior
    // a la emisión de la nota.

    if (fechaAnulacion < row.FECHA_ISO) {
      throw new BadRequestError(
        'La fecha de anulación no puede ser anterior a la fecha de emisión de la nota de crédito.',
      );
    }

    // Tampoco puede ser posterior al día actual.
    if (fechaAnulacion > hoy) {
      throw new BadRequestError(
        'La fecha de anulación no puede ser futura.',
      );
    }

    await conn.execute(
      `
        UPDATE CXC_NOTAS_CREDITO
        SET
          ESTADO = 'ANULADA',
          ID_EMPLEADO_ANULACION = :idEmpleadoAnulacion,
          FECHA_ANULACION =
            TO_DATE(:fechaAnulacion, 'YYYY-MM-DD'),
          MOTIVO_ANULACION = :motivoAnulacion
        WHERE ID_NOTA_CREDITO = :id
      `,
      {
        idEmpleadoAnulacion:
          input.idEmpleadoAnulacion,
        fechaAnulacion,
        motivoAnulacion:
          input.motivoAnulacion,
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
