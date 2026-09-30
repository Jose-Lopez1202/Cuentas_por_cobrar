import oracledb from 'oracledb';
import { getConnection } from '../../../../config/database';
import type {
  Mora,
  CreateMoraInput,
  UpdateMoraInput,
} from '@erp/contracts';
import { roundMoney } from '../../shared/financialRules';

interface MoraRow {
  ID_MORA: number;
  ID_DOCUMENTO: number;
  DIAS_MORA: number | null;
  SALDO_VENCIDO: number | null;
  PORCENTAJE_MORA: number | null;
  MONTO_MORA: number | null;
  FECHA_CALCULO: Date | null;
  ESTADO: Mora['estado'];
}

function mapRow(row: MoraRow): Mora {
  return {
    idMora: row.ID_MORA,
    idDocumento: row.ID_DOCUMENTO,
    diasMora: row.DIAS_MORA,
    saldoVencido: row.SALDO_VENCIDO,
    porcentajeMora: row.PORCENTAJE_MORA,
    montoMora: row.MONTO_MORA,
    fechaCalculo: row.FECHA_CALCULO
      ? row.FECHA_CALCULO.toISOString()
      : null,
    estado: row.ESTADO,
  };
}

const SELECT_BASE = `
  SELECT
    ID_MORA,
    ID_DOCUMENTO,
    DIAS_MORA,
    SALDO_VENCIDO,
    PORCENTAJE_MORA,
    MONTO_MORA,
    FECHA_CALCULO,
    ESTADO
  FROM CXC_MORA
`;

export async function findAll(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{
  data: Mora[];
  total: number;
}> {
  const conn = await getConnection();

  try {
    const offset = (params.page - 1) * params.limit;

    const whereClause = params.search
      ? `
        WHERE TO_CHAR(ID_MORA) LIKE :search
           OR TO_CHAR(ID_DOCUMENTO) LIKE :search
           OR TO_CHAR(DIAS_MORA) LIKE :search
           OR TO_CHAR(SALDO_VENCIDO) LIKE :search
           OR TO_CHAR(PORCENTAJE_MORA) LIKE :search
           OR TO_CHAR(MONTO_MORA) LIKE :search
           OR UPPER(ESTADO) LIKE UPPER(:search)
      `
      : '';

    const searchBind = params.search
      ? { search: `%${params.search}%` }
      : {};

    const dataResult = await conn.execute<MoraRow>(
      `${SELECT_BASE}
       ${whereClause}
       ORDER BY ID_MORA DESC
       OFFSET :offset ROWS
       FETCH NEXT :limit ROWS ONLY`,
      {
        ...searchBind,
        offset,
        limit: params.limit,
      },
    );

    const countResult = await conn.execute<{
      TOTAL: number;
    }>(
      `SELECT COUNT(*) AS TOTAL
       FROM CXC_MORA
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

export async function findById(
  id: number,
): Promise<Mora | null> {
  const conn = await getConnection();

  try {
    const result = await conn.execute<MoraRow>(
      `${SELECT_BASE}
       WHERE ID_MORA = :id`,
      { id },
    );

    const row = result.rows?.[0];

    return row ? mapRow(row) : null;
  } finally {
    await conn.close();
  }
}

export async function create(
  input: CreateMoraInput,
): Promise<number> {
  const conn = await getConnection();

  try {
    const result = await conn.execute<{
      id: number[];
    }>(
      `INSERT INTO CXC_MORA
        (
          ID_DOCUMENTO,
          DIAS_MORA,
          SALDO_VENCIDO,
          PORCENTAJE_MORA,
          MONTO_MORA,
          FECHA_CALCULO,
          ESTADO
        )
       VALUES
        (
          :idDocumento,
          :diasMora,
          :saldoVencido,
          :porcentajeMora,
          :montoMora,
          CASE
            WHEN :fechaCalculo IS NULL THEN NULL
            ELSE TO_DATE(:fechaCalculo, 'YYYY-MM-DD')
          END,
          :estado
        )
       RETURNING ID_MORA INTO :id`,
      {
        idDocumento: input.idDocumento,
        diasMora: input.diasMora ?? null,
        saldoVencido: input.saldoVencido ?? null,
        porcentajeMora: input.porcentajeMora ?? null,
        montoMora: input.montoMora ?? null,
        fechaCalculo: input.fechaCalculo ?? null,
        estado: input.estado,
        id: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER,
        },
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

export async function update(
  id: number,
  input: UpdateMoraInput,
): Promise<void> {
  const fields: string[] = [];
  const binds: Record<string, any> = { id };

  if (input.idDocumento !== undefined) {
    fields.push('ID_DOCUMENTO = :idDocumento');
    binds.idDocumento = input.idDocumento;
  }

  if (input.diasMora !== undefined) {
    fields.push('DIAS_MORA = :diasMora');
    binds.diasMora = input.diasMora ?? null;
  }

  if (input.saldoVencido !== undefined) {
    fields.push('SALDO_VENCIDO = :saldoVencido');
    binds.saldoVencido = input.saldoVencido ?? null;
  }

  if (input.porcentajeMora !== undefined) {
    fields.push('PORCENTAJE_MORA = :porcentajeMora');
    binds.porcentajeMora = input.porcentajeMora ?? null;
  }

  if (input.montoMora !== undefined) {
    fields.push('MONTO_MORA = :montoMora');
    binds.montoMora = input.montoMora ?? null;
  }

  if (input.fechaCalculo !== undefined) {
    fields.push(`
      FECHA_CALCULO =
        CASE
          WHEN :fechaCalculo IS NULL THEN NULL
          ELSE TO_DATE(:fechaCalculo, 'YYYY-MM-DD')
        END
    `);

    binds.fechaCalculo = input.fechaCalculo ?? null;
  }

  if (input.estado !== undefined) {
    fields.push('ESTADO = :estado');
    binds.estado = input.estado;
  }

  if (fields.length === 0) return;

  const conn = await getConnection();

  try {
    await conn.execute(
      `UPDATE CXC_MORA
       SET ${fields.join(', ')}
       WHERE ID_MORA = :id`,
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

export async function remove(
  id: number,
): Promise<void> {
  const conn = await getConnection();

  try {
    await conn.execute(
      `DELETE FROM CXC_MORA
       WHERE ID_MORA = :id`,
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

export interface ResultadoRecalculoMora {
  activas: number;
  cerradas: number;
}

/**
 * Recalcula la mora de todos los documentos con una CXC_CONDICIONES_CREDITO
 * asignada. Es una acción manual (botón "Recalcular mora"), no un job
 * programado: este proyecto no usa PL/SQL ni tiene infraestructura de cron,
 * así que el disparo es explícito por diseño, no una limitación olvidada.
 *
 * Reglas:
 * - Un documento sin ID_CONDICION_CREDITO nunca genera mora automática
 *   (puede seguir registrándose a mano como antes).
 * - Días de mora = (hoy - fechaVencimiento) - diasGracia de su condición.
 *   Si el resultado es <= 0, todavía está dentro del período de gracia: no
 *   se genera/actualiza mora para ese documento en esta pasada.
 * - Monto de mora = saldo actual del documento * porcentajeMora / 100 (plano,
 *   no prorrateado por día — igual de simple que el resto de porcentajes del
 *   sistema, ej. condición de crédito o ajustes).
 * - Si el documento ya tiene una mora ACTIVA, se actualiza in-place; si no,
 *   se crea una nueva.
 * - Una mora ACTIVA cuyo documento ya no tiene saldo pendiente se cierra
 *   como PAGADA.
 */
export async function recalcularPendientes(): Promise<ResultadoRecalculoMora> {
  const conn = await getConnection();
  try {
    const cerradasResult = await conn.execute(
      `UPDATE CXC_MORA m
          SET ESTADO = 'PAGADA'
        WHERE UPPER(m.ESTADO) = 'ACTIVA'
          AND EXISTS (
            SELECT 1 FROM CXC_DOCUMENTOS d
             WHERE d.ID_DOCUMENTO = m.ID_DOCUMENTO
               AND d.SALDO <= 0.005
          )`,
    );

    const candidatos = await conn.execute<{
      ID_DOCUMENTO: number;
      SALDO: number;
      FECHA_VENCIMIENTO: Date;
      DIAS_GRACIA: number;
      PORCENTAJE_MORA: number;
    }>(
      `SELECT d.ID_DOCUMENTO, d.SALDO, d.FECHA_VENCIMIENTO, cc.DIAS_GRACIA, cc.PORCENTAJE_MORA
         FROM CXC_DOCUMENTOS d
         JOIN CXC_CONDICIONES_CREDITO cc ON cc.ID_CONDICION = d.ID_CONDICION_CREDITO
        WHERE UPPER(cc.ESTADO) = 'A'
          AND d.SALDO > 0.005
          AND UPPER(d.ESTADO) NOT IN ('PAGADO', 'PAGADA', 'ANULADO', 'ANULADA')`,
    );

    const hoy = Date.now();
    let activas = 0;

    for (const row of candidatos.rows ?? []) {
      const diasVencido = Math.floor((hoy - row.FECHA_VENCIMIENTO.getTime()) / 86_400_000);
      const diasMora = diasVencido - Number(row.DIAS_GRACIA);
      if (diasMora <= 0) continue; // todavía dentro del período de gracia

      const saldo = roundMoney(Number(row.SALDO));
      const montoMora = roundMoney((saldo * Number(row.PORCENTAJE_MORA)) / 100);

      const existente = await conn.execute<{ ID_MORA: number }>(
        `SELECT ID_MORA FROM CXC_MORA
          WHERE ID_DOCUMENTO = :idDocumento AND UPPER(ESTADO) = 'ACTIVA'
          FOR UPDATE`,
        { idDocumento: row.ID_DOCUMENTO },
      );
      const moraExistente = existente.rows?.[0];

      if (moraExistente) {
        await conn.execute(
          `UPDATE CXC_MORA
              SET DIAS_MORA = :diasMora, SALDO_VENCIDO = :saldo,
                  PORCENTAJE_MORA = :porcentaje, MONTO_MORA = :montoMora,
                  FECHA_CALCULO = TRUNC(SYSDATE)
            WHERE ID_MORA = :idMora`,
          { diasMora, saldo, porcentaje: row.PORCENTAJE_MORA, montoMora, idMora: moraExistente.ID_MORA },
        );
      } else {
        await conn.execute(
          `INSERT INTO CXC_MORA
             (ID_DOCUMENTO, DIAS_MORA, SALDO_VENCIDO, PORCENTAJE_MORA, MONTO_MORA, FECHA_CALCULO, ESTADO)
           VALUES
             (:idDocumento, :diasMora, :saldo, :porcentaje, :montoMora, TRUNC(SYSDATE), 'ACTIVA')`,
          { idDocumento: row.ID_DOCUMENTO, diasMora, saldo, porcentaje: row.PORCENTAJE_MORA, montoMora },
        );
      }
      activas += 1;
    }

    await conn.commit();
    return { activas, cerradas: cerradasResult.rowsAffected ?? 0 };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.close();
  }
}