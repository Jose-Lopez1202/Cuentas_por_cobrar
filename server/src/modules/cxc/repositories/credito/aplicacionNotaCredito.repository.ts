
import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import { businessTodayIso } from '../../../../shared/date';

import type {
  AplicacionNotaCredito,
  CreateAplicacionNotaCreditoInput,
  UpdateAplicacionNotaCreditoInput,
  ReversarAplicacionNotaCreditoInput,
} from '@erp/contracts';

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/AppError';

import {
  deriveDocumentoEstado,
  isDocumentoBloqueadoParaAplicacion,
  roundMoney,
} from '../../shared/financialRules';

import { isNotaCreditoAplicable } from './notaCredito.repository';
import { registrarEvento } from '../documentos/documentoHistorial.repository';

// =====================================================
// INTERFACES DE ORACLE
// =====================================================

interface AplicacionNotaCreditoRow {
  ID_APLICACION_NC: number;
  ID_NOTA_CREDITO: number;
  ID_DOCUMENTO: number;
  MONTO_APLICADO: number;

  FECHA_APLICACION_ISO: string;

  ID_EMPLEADO: number | null;
  NOMBRE_EMPLEADO: string | null;

  ESTADO: AplicacionNotaCredito['estado'];

  ID_EMPLEADO_REVERSA: number | null;
  NOMBRE_EMPLEADO_REVERSA: string | null;

  FECHA_REVERSA_ISO: string | null;

  MOTIVO_REVERSA: string | null;
}

interface NotaLockRow {
  ID_NOTA_CREDITO: number;
  ID_CLIENTE: number;
  MONTO: number;
  ESTADO: string;
  FECHA_ISO: string;
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
  FECHA_APLICACION_ISO: string;
}

// =====================================================
// MAPEO DE RESULTADOS
// =====================================================

const mapRow = (
  row: AplicacionNotaCreditoRow,
): AplicacionNotaCredito => ({
  idAplicacionNc: row.ID_APLICACION_NC,
  idNotaCredito: row.ID_NOTA_CREDITO,
  idDocumento: row.ID_DOCUMENTO,
  montoAplicado: row.MONTO_APLICADO,

  // Se conserva la fecha exacta de Oracle.
  fechaAplicacion: row.FECHA_APLICACION_ISO,

  idEmpleado: row.ID_EMPLEADO,
  nombreEmpleado: row.NOMBRE_EMPLEADO,
  estado: row.ESTADO,

  idEmpleadoReversa: row.ID_EMPLEADO_REVERSA,
  nombreEmpleadoReversa: row.NOMBRE_EMPLEADO_REVERSA,

  fechaReversa: row.FECHA_REVERSA_ISO,
  motivoReversa: row.MOTIVO_REVERSA,
});

// =====================================================
// CONSULTA BASE
// =====================================================

const SELECT_BASE = `
  SELECT
    a.ID_APLICACION_NC,
    a.ID_NOTA_CREDITO,
    a.ID_DOCUMENTO,
    a.MONTO_APLICADO,

    TO_CHAR(
      a.FECHA_APLICACION,
      'YYYY-MM-DD'
    ) AS FECHA_APLICACION_ISO,

    a.ID_EMPLEADO,

    CASE
      WHEN e.ID_EMPLEADO IS NULL THEN NULL
      ELSE TRIM(
        e.NOMBRE || ' ' || NVL(e.APELLIDO, '')
      )
    END AS NOMBRE_EMPLEADO,

    a.ESTADO,
    a.ID_EMPLEADO_REVERSA,

    CASE
      WHEN er.ID_EMPLEADO IS NULL THEN NULL
      ELSE TRIM(
        er.NOMBRE || ' ' || NVL(er.APELLIDO, '')
      )
    END AS NOMBRE_EMPLEADO_REVERSA,

    TO_CHAR(
      a.FECHA_REVERSA,
      'YYYY-MM-DD'
    ) AS FECHA_REVERSA_ISO,

    a.MOTIVO_REVERSA

  FROM CXC_APLICACION_NOTA_CREDITO a

  LEFT JOIN EMPLEADO e
    ON e.ID_EMPLEADO = a.ID_EMPLEADO

  LEFT JOIN EMPLEADO er
    ON er.ID_EMPLEADO = a.ID_EMPLEADO_REVERSA
`;

// =====================================================
// LISTAR APLICACIONES
// =====================================================

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{
  data: AplicacionNotaCredito[];
  total: number;
}> {
  const conn = await getConnection();

  try {
    const offset = (params.page - 1) * params.limit;

    const whereClause = params.search
      ? `
        WHERE TO_CHAR(a.ID_APLICACION_NC) LIKE :search
           OR TO_CHAR(a.ID_NOTA_CREDITO) LIKE :search
           OR TO_CHAR(a.ID_DOCUMENTO) LIKE :search

           OR a.ID_DOCUMENTO IN (
             SELECT dx.ID_DOCUMENTO
             FROM CXC_DOCUMENTOS dx
             LEFT JOIN CLIENTE cx
               ON cx.ID_CLIENTE = dx.ID_CLIENTE
             WHERE UPPER(NVL(cx.NOMBRE, ''))
                   LIKE UPPER(:search)
                OR UPPER(
                     NVL(dx.SERIE, '') || '-' ||
                     NVL(TO_CHAR(dx.NUMERO_DOCUMENTO), '')
                   ) LIKE UPPER(:search)
           )

           OR a.ID_NOTA_CREDITO IN (
             SELECT nx.ID_NOTA_CREDITO
             FROM CXC_NOTAS_CREDITO nx
             WHERE UPPER(
               NVL(nx.SERIE, '') || '-' ||
               NVL(TO_CHAR(nx.NUMERO), '')
             ) LIKE UPPER(:search)
           )
      `
      : '';

    const searchBind = params.search
      ? { search: `%${params.search}%` }
      : {};

    const dataResult =
      await conn.execute<AplicacionNotaCreditoRow>(
        `
          ${SELECT_BASE}
          ${whereClause}

          ORDER BY
            a.FECHA_APLICACION DESC,
            a.ID_APLICACION_NC DESC

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
        FROM CXC_APLICACION_NOTA_CREDITO a
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
// OBTENER APLICACIÓN POR ID
// =====================================================

export async function findById(
  id: number,
): Promise<AplicacionNotaCredito | null> {
  const conn = await getConnection();

  try {
    const result =
      await conn.execute<AplicacionNotaCreditoRow>(
        `
          ${SELECT_BASE}
          WHERE a.ID_APLICACION_NC = :id
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
// CREAR APLICACIÓN DE NOTA DE CRÉDITO
// =====================================================

export async function create(
  input: CreateAplicacionNotaCreditoInput,
): Promise<number> {
  const conn = await getConnection();

  try {
    // -------------------------------------------------
    // 1. BLOQUEAR NOTA DE CRÉDITO
    // -------------------------------------------------

    const notaResult = await conn.execute<NotaLockRow>(
      `
        SELECT
          ID_NOTA_CREDITO,
          ID_CLIENTE,
          MONTO,
          ESTADO,
          TO_CHAR(FECHA, 'YYYY-MM-DD') AS FECHA_ISO

        FROM CXC_NOTAS_CREDITO

        WHERE ID_NOTA_CREDITO = :idNotaCredito

        FOR UPDATE
      `,
      {
        idNotaCredito: input.idNotaCredito,
      },
    );

    const nota = notaResult.rows?.[0];

    if (!nota) {
      throw new BadRequestError(
        'La nota de crédito seleccionada no existe',
      );
    }

    // -------------------------------------------------
    // 2. VALIDAR ESTADO DE NOTA
    // -------------------------------------------------

    const notaEstado = String(
      nota.ESTADO ?? '',
    ).trim().toUpperCase();

    if (notaEstado === 'ANULADA') {
      throw new ConflictError(
        'Una nota de crédito anulada no puede aplicarse.',
      );
    }

    if (notaEstado === 'APLICADA') {
      throw new ConflictError(
        'La nota de crédito ya está totalmente aplicada.',
      );
    }

    if (!isNotaCreditoAplicable(notaEstado)) {
      throw new ConflictError(
        `La nota de crédito está en un estado no aplicable: ${
          notaEstado || 'SIN ESTADO'
        }.`,
      );
    }

    // -------------------------------------------------
    // 3. VALIDAR FECHA DE APLICACIÓN
    // -------------------------------------------------

    const hoy = businessTodayIso();

    if (input.fechaAplicacion < nota.FECHA_ISO) {
      throw new BadRequestError(
        'La fecha de aplicación no puede ser anterior a la fecha de emisión de la nota de crédito.',
      );
    }

    if (input.fechaAplicacion > hoy) {
      throw new BadRequestError(
        'La fecha de aplicación no puede ser futura.',
      );
    }

    // -------------------------------------------------
    // 4. BLOQUEAR DOCUMENTO
    // -------------------------------------------------

    const documentoResult =
      await conn.execute<DocumentoLockRow>(
        `
          SELECT
            ID_DOCUMENTO,
            ID_CLIENTE,
            TOTAL,
            SALDO,
            ESTADO

          FROM CXC_DOCUMENTOS

          WHERE ID_DOCUMENTO = :idDocumento

          FOR UPDATE
        `,
        {
          idDocumento: input.idDocumento,
        },
      );

    const documento = documentoResult.rows?.[0];

    if (!documento) {
      throw new BadRequestError(
        'El documento seleccionado no existe',
      );
    }

    // -------------------------------------------------
    // 5. VALIDAR ESTADO DEL DOCUMENTO
    // -------------------------------------------------

    if (
      isDocumentoBloqueadoParaAplicacion(
        documento.ESTADO,
      ) ||
      Number(documento.SALDO) <= 0
    ) {
      throw new ConflictError(
        'El documento ya está pagado/anulado o no tiene saldo pendiente.',
      );
    }

    // -------------------------------------------------
    // 6. VALIDAR CLIENTE
    // -------------------------------------------------

    if (nota.ID_CLIENTE !== documento.ID_CLIENTE) {
      throw new BadRequestError(
        'La nota de crédito y el documento deben pertenecer al mismo cliente',
      );
    }

    // -------------------------------------------------
    // 7. CONSULTAR MONTO YA APLICADO
    // -------------------------------------------------

    const sumResult = await conn.execute<{
      TOTAL: number;
    }>(
      `
        SELECT
          NVL(SUM(MONTO_APLICADO), 0) AS TOTAL

        FROM CXC_APLICACION_NOTA_CREDITO

        WHERE ID_NOTA_CREDITO = :idNotaCredito
          AND ESTADO = 'CONFIRMADA'
      `,
      {
        idNotaCredito: input.idNotaCredito,
      },
    );

    const yaAplicado = Number(
      sumResult.rows?.[0]?.TOTAL ?? 0,
    );

    const disponibleNota = roundMoney(
      Number(nota.MONTO) - yaAplicado,
    );

    const saldoDocumento = roundMoney(
      Number(documento.SALDO),
    );

    const montoAplicado = roundMoney(
      Number(input.montoAplicado),
    );

    // -------------------------------------------------
    // 8. VALIDAR MONTO
    // -------------------------------------------------

    if (!Number.isFinite(montoAplicado) || montoAplicado <= 0) {
      throw new BadRequestError(
        'El monto aplicado debe ser mayor a cero',
      );
    }

    if (montoAplicado > saldoDocumento + 0.005) {
      throw new BadRequestError(
        'El monto aplicado no puede superar el saldo del documento',
      );
    }

    if (montoAplicado > disponibleNota + 0.005) {
      throw new BadRequestError(
        'El monto aplicado no puede superar el monto disponible de la nota de crédito',
      );
    }

    // -------------------------------------------------
    // 9. INSERTAR APLICACIÓN
    // -------------------------------------------------

    const insert = await conn.execute<{
      id: number[];
    }>(
      `
        INSERT INTO CXC_APLICACION_NOTA_CREDITO (
          ID_NOTA_CREDITO,
          ID_DOCUMENTO,
          MONTO_APLICADO,
          FECHA_APLICACION,
          ID_EMPLEADO
        )
        VALUES (
          :idNotaCredito,
          :idDocumento,
          :montoAplicado,
          TO_DATE(:fechaAplicacion, 'YYYY-MM-DD'),
          :idEmpleado
        )

        RETURNING ID_APLICACION_NC INTO :id
      `,
      {
        idNotaCredito: input.idNotaCredito,
        idDocumento: input.idDocumento,
        montoAplicado,
        fechaAplicacion: input.fechaAplicacion,
        idEmpleado: input.idEmpleado,

        id: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER,
        },
      },
    );

    // -------------------------------------------------
    // 10. ACTUALIZAR SALDO DEL DOCUMENTO
    // -------------------------------------------------

    const nuevoSaldo = Math.max(
      0,
      roundMoney(saldoDocumento - montoAplicado),
    );

    const nuevoEstadoDocumento = deriveDocumentoEstado(
      Number(documento.TOTAL),
      nuevoSaldo,
      documento.ESTADO,
    );

    await conn.execute(
      `
        UPDATE CXC_DOCUMENTOS

        SET
          SALDO = :saldo,
          ESTADO = :estado

        WHERE ID_DOCUMENTO = :idDocumento
      `,
      {
        saldo: nuevoSaldo,
        estado: nuevoEstadoDocumento,
        idDocumento: input.idDocumento,
      },
    );

    // -------------------------------------------------
    // 11. ACTUALIZAR ESTADO DE NOTA
    // -------------------------------------------------

    const totalAplicado = roundMoney(
      yaAplicado + montoAplicado,
    );

    const nuevoEstadoNota =
      totalAplicado >= Number(nota.MONTO) - 0.005
        ? 'APLICADA'
        : 'PENDIENTE';

    await conn.execute(
      `
        UPDATE CXC_NOTAS_CREDITO

        SET ESTADO = :estado

        WHERE ID_NOTA_CREDITO = :idNotaCredito
      `,
      {
        estado: nuevoEstadoNota,
        idNotaCredito: input.idNotaCredito,
      },
    );

    // -------------------------------------------------
    // 12. REGISTRAR HISTORIAL FINANCIERO
    // -------------------------------------------------

    await registrarEvento(conn, {
      idDocumento: input.idDocumento,
      estadoAnterior: documento.ESTADO,
      estadoNuevo: nuevoEstadoDocumento,
      idEmpleado: input.idEmpleado,
      tipoEvento: 'APLICACION_NOTA_CREDITO',
      monto: montoAplicado,
      naturaleza: 'ABONO',
      descripcion:
        `Nota de crédito #${input.idNotaCredito} aplicada al documento`,
      fecha: input.fechaAplicacion,
    });

    // -------------------------------------------------
    // 13. CONFIRMAR TRANSACCIÓN
    // -------------------------------------------------

    await conn.commit();

    return insert.outBinds!.id[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}

// =====================================================
// EDICIÓN DIRECTA BLOQUEADA
// =====================================================

// Se conserva la firma por compatibilidad.
//
// Las aplicaciones confirmadas son movimientos
// financieros. Cambiar directamente su monto,
// documento o nota rompería la consistencia
// de los saldos.
//
// La corrección debe hacerse mediante reversa
// y creación de una nueva aplicación.

export async function update(
  _id: number,
  _input: UpdateAplicacionNotaCreditoInput,
): Promise<void> {
  throw new ConflictError(
    'Una aplicación de nota de crédito no se edita directamente. Para corregirla, reversa la aplicación y regístrala de nuevo.',
  );
}

// =====================================================
// ELIMINACIÓN DIRECTA BLOQUEADA
// =====================================================

// Se conserva la función exportada para que
// otros archivos que la importen sigan compilando,
// pero se impide borrar movimientos financieros
// sin restaurar sus saldos.

export async function remove(
  _id: number,
): Promise<void> {
  throw new ConflictError(
    'Una aplicación de nota de crédito no se elimina físicamente. Debe reversarse para conservar trazabilidad.',
  );
}

// =====================================================
// REVERSAR APLICACIÓN DE NOTA DE CRÉDITO
// =====================================================

export async function reversar(
  id: number,
  input: ReversarAplicacionNotaCreditoInput,
): Promise<void> {
  const conn = await getConnection();

  try {
    // -------------------------------------------------
    // 1. BLOQUEAR APLICACIÓN
    // -------------------------------------------------

    const aplicacionResult =
      await conn.execute<AplicacionLockRow>(
        `
          SELECT
            ID_APLICACION_NC,
            ID_NOTA_CREDITO,
            ID_DOCUMENTO,
            MONTO_APLICADO,
            ESTADO,

            TO_CHAR(
              FECHA_APLICACION,
              'YYYY-MM-DD'
            ) AS FECHA_APLICACION_ISO

          FROM CXC_APLICACION_NOTA_CREDITO

          WHERE ID_APLICACION_NC = :id

          FOR UPDATE
        `,
        { id },
      );

    const aplicacion = aplicacionResult.rows?.[0];

    if (!aplicacion) {
      throw new NotFoundError(
        `Aplicación de nota de crédito ${id} no encontrada`,
      );
    }

    if (
      String(aplicacion.ESTADO)
        .trim()
        .toUpperCase() !== 'CONFIRMADA'
    ) {
      throw new ConflictError(
        'Esta aplicación ya fue reversada.',
      );
    }

    // -------------------------------------------------
    // 2. VALIDAR FECHA DE REVERSA
    // -------------------------------------------------

    const hoy = businessTodayIso();

    const fechaReversa =
      input.fechaReversa ?? hoy;

    if (
      fechaReversa <
      aplicacion.FECHA_APLICACION_ISO
    ) {
      throw new BadRequestError(
        'La fecha de reversa no puede ser anterior a la fecha de aplicación de la nota de crédito.',
      );
    }

    if (fechaReversa > hoy) {
      throw new BadRequestError(
        'La fecha de reversa no puede ser futura.',
      );
    }

    // -------------------------------------------------
    // 3. BLOQUEAR NOTA DE CRÉDITO
    // -------------------------------------------------

    // Se bloquea primero la nota y después
    // el documento, igual que en create().
    // Esto evita invertir el orden de ambos
    // recursos entre creación y reversa.

    const notaResult = await conn.execute<NotaLockRow>(
      `
        SELECT
          ID_NOTA_CREDITO,
          ID_CLIENTE,
          MONTO,
          ESTADO,

          TO_CHAR(
            FECHA,
            'YYYY-MM-DD'
          ) AS FECHA_ISO

        FROM CXC_NOTAS_CREDITO

        WHERE ID_NOTA_CREDITO = :idNotaCredito

        FOR UPDATE
      `,
      {
        idNotaCredito:
          aplicacion.ID_NOTA_CREDITO,
      },
    );

    const nota = notaResult.rows?.[0];

    if (!nota) {
      throw new BadRequestError(
        'La nota de crédito de la aplicación ya no existe',
      );
    }

    // -------------------------------------------------
    // 4. BLOQUEAR DOCUMENTO
    // -------------------------------------------------

    const documentoResult =
      await conn.execute<DocumentoLockRow>(
        `
          SELECT
            ID_DOCUMENTO,
            ID_CLIENTE,
            TOTAL,
            SALDO,
            ESTADO

          FROM CXC_DOCUMENTOS

          WHERE ID_DOCUMENTO = :idDocumento

          FOR UPDATE
        `,
        {
          idDocumento:
            aplicacion.ID_DOCUMENTO,
        },
      );

    const documento = documentoResult.rows?.[0];

    if (!documento) {
      throw new BadRequestError(
        'El documento de la aplicación ya no existe',
      );
    }

    // -------------------------------------------------
    // 5. VALIDAR DOCUMENTO
    // -------------------------------------------------

    const docEstado = String(
      documento.ESTADO ?? '',
    ).trim().toUpperCase();

    if (
      docEstado === 'ANULADO' ||
      docEstado === 'ANULADA'
    ) {
      throw new ConflictError(
        'No se puede reversar una aplicación sobre un documento anulado.',
      );
    }

    // -------------------------------------------------
    // 6. RESTAURAR SALDO DEL DOCUMENTO
    // -------------------------------------------------

    const montoAplicado = roundMoney(
      Number(aplicacion.MONTO_APLICADO),
    );

    const nuevoSaldo = roundMoney(
      Number(documento.SALDO) + montoAplicado,
    );

    const nuevoEstadoDocumento = deriveDocumentoEstado(
      Number(documento.TOTAL),
      nuevoSaldo,
      documento.ESTADO,
    );

    await conn.execute(
      `
        UPDATE CXC_DOCUMENTOS

        SET
          SALDO = :saldo,
          ESTADO = :estado

        WHERE ID_DOCUMENTO = :idDocumento
      `,
      {
        saldo: nuevoSaldo,
        estado: nuevoEstadoDocumento,
        idDocumento:
          aplicacion.ID_DOCUMENTO,
      },
    );

    // -------------------------------------------------
    // 7. CONSULTAR APLICACIONES CONFIRMADAS
    //    RESTANTES
    // -------------------------------------------------

    const sumResult = await conn.execute<{
      TOTAL: number;
    }>(
      `
        SELECT
          NVL(SUM(MONTO_APLICADO), 0) AS TOTAL

        FROM CXC_APLICACION_NOTA_CREDITO

        WHERE ID_NOTA_CREDITO = :idNotaCredito
          AND ESTADO = 'CONFIRMADA'
          AND ID_APLICACION_NC <> :id
      `,
      {
        idNotaCredito:
          aplicacion.ID_NOTA_CREDITO,
        id,
      },
    );

    const totalConfirmadoRestante = roundMoney(
      Number(
        sumResult.rows?.[0]?.TOTAL ?? 0,
      ),
    );

    // -------------------------------------------------
    // 8. RECALCULAR ESTADO DE NOTA
    // -------------------------------------------------

    const notaEstadoActual = String(
      nota.ESTADO ?? '',
    ).trim().toUpperCase();

    const nuevoEstadoNota =
      notaEstadoActual === 'ANULADA'
        ? notaEstadoActual
        : totalConfirmadoRestante >=
            Number(nota.MONTO) - 0.005
          ? 'APLICADA'
          : 'PENDIENTE';

    await conn.execute(
      `
        UPDATE CXC_NOTAS_CREDITO

        SET ESTADO = :estado

        WHERE ID_NOTA_CREDITO = :idNotaCredito
      `,
      {
        estado: nuevoEstadoNota,
        idNotaCredito:
          aplicacion.ID_NOTA_CREDITO,
      },
    );

    // -------------------------------------------------
    // 9. MARCAR APLICACIÓN COMO REVERSADA
    // -------------------------------------------------

    await conn.execute(
      `
        UPDATE CXC_APLICACION_NOTA_CREDITO

        SET
          ESTADO = 'REVERSADA',
          ID_EMPLEADO_REVERSA =
            :idEmpleadoReversa,

          FECHA_REVERSA =
            TO_DATE(
              :fechaReversa,
              'YYYY-MM-DD'
            ),

          MOTIVO_REVERSA =
            :motivoReversa

        WHERE ID_APLICACION_NC = :id
      `,
      {
        idEmpleadoReversa:
          input.idEmpleadoReversa,

        fechaReversa,

        motivoReversa:
          input.motivoReversa,

        id,
      },
    );

    // -------------------------------------------------
    // 10. REGISTRAR HISTORIAL FINANCIERO
    // -------------------------------------------------

    await registrarEvento(conn, {
      idDocumento:
        aplicacion.ID_DOCUMENTO,

      estadoAnterior:
        documento.ESTADO,

      estadoNuevo:
        nuevoEstadoDocumento,

      idEmpleado:
        input.idEmpleadoReversa,

      tipoEvento:
        'REVERSA_APLICACION_NOTA_CREDITO',

      monto:
        montoAplicado,

      naturaleza:
        'CARGO',

      descripcion:
        input.motivoReversa,

      // Misma fecha que se almacena en Oracle.
      fecha: fechaReversa,
    });

    // -------------------------------------------------
    // 11. CONFIRMAR TRANSACCIÓN
    // -------------------------------------------------

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}