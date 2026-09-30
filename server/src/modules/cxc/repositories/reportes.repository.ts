import { getConnection } from '../../../config/database';
import type { AntiguedadSaldosReporte, EstadoCuenta } from '@erp/contracts';
import { deriveDocumentoCondicion } from '../shared/financialRules';

/**
 * Repositorio de solo lectura: reportes estándar de CxC (antigüedad de
 * saldos, estado de cuenta de cliente). No administra CRUD de ninguna
 * entidad, solo consulta y resume — mismo criterio que dashboard.repository.ts.
 */

interface AntiguedadRow {
  ID_CLIENTE: number;
  NOMBRE_CLIENTE: string;
  CORRIENTE: number;
  DIAS_1_30: number;
  DIAS_31_60: number;
  DIAS_61_90: number;
  MAS_90: number;
  TOTAL: number;
}

export async function getAntiguedadSaldos(): Promise<AntiguedadSaldosReporte> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<AntiguedadRow>(`
      SELECT d.ID_CLIENTE, c.NOMBRE AS NOMBRE_CLIENTE,
             NVL(SUM(CASE WHEN d.FECHA_VENCIMIENTO >= TRUNC(SYSDATE) THEN d.SALDO ELSE 0 END), 0) AS CORRIENTE,
             NVL(SUM(CASE WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO BETWEEN 1 AND 30 THEN d.SALDO ELSE 0 END), 0) AS DIAS_1_30,
             NVL(SUM(CASE WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO BETWEEN 31 AND 60 THEN d.SALDO ELSE 0 END), 0) AS DIAS_31_60,
             NVL(SUM(CASE WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO BETWEEN 61 AND 90 THEN d.SALDO ELSE 0 END), 0) AS DIAS_61_90,
             NVL(SUM(CASE WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO > 90 THEN d.SALDO ELSE 0 END), 0) AS MAS_90,
             NVL(SUM(d.SALDO), 0) AS TOTAL
        FROM CXC_DOCUMENTOS d
        JOIN CLIENTE c ON c.ID_CLIENTE = d.ID_CLIENTE
       WHERE d.SALDO > 0
         AND UPPER(NVL(d.ESTADO, 'PENDIENTE')) NOT IN ('ANULADO', 'ANULADA', 'PAGADO', 'PAGADA')
       GROUP BY d.ID_CLIENTE, c.NOMBRE
       ORDER BY TOTAL DESC
    `);

    const clientes = (result.rows ?? []).map((r) => ({
      idCliente: r.ID_CLIENTE,
      nombreCliente: r.NOMBRE_CLIENTE,
      corriente: Number(r.CORRIENTE),
      dias1a30: Number(r.DIAS_1_30),
      dias31a60: Number(r.DIAS_31_60),
      dias61a90: Number(r.DIAS_61_90),
      mas90: Number(r.MAS_90),
      total: Number(r.TOTAL),
    }));

    const totales = clientes.reduce(
      (acc, c) => ({
        corriente: acc.corriente + c.corriente,
        dias1a30: acc.dias1a30 + c.dias1a30,
        dias31a60: acc.dias31a60 + c.dias31a60,
        dias61a90: acc.dias61a90 + c.dias61a90,
        mas90: acc.mas90 + c.mas90,
        total: acc.total + c.total,
      }),
      { corriente: 0, dias1a30: 0, dias31a60: 0, dias61a90: 0, mas90: 0, total: 0 },
    );

    return { clientes, totales };
  } finally {
    await conn.close();
  }
}

interface ClienteRow {
  NOMBRE: string;
  NIT: string | null;
}

interface DocumentoRow {
  ID_DOCUMENTO: number;
  SERIE: string | null;
  NUMERO_DOCUMENTO: string | null;
  NOMBRE_TIPO_DOCUMENTO: string | null;
  FECHA_DOCUMENTO: Date;
  FECHA_VENCIMIENTO: Date;
  TOTAL: number;
  SALDO: number;
  ESTADO: string;
}

export async function getEstadoCuenta(idCliente: number): Promise<EstadoCuenta | null> {
  const conn = await getConnection();
  try {
    const clienteResult = await conn.execute<ClienteRow>(
      `SELECT NOMBRE, NIT FROM CLIENTE WHERE ID_CLIENTE = :idCliente`,
      { idCliente },
    );
    const cliente = clienteResult.rows?.[0];
    if (!cliente) return null;

    const docsResult = await conn.execute<DocumentoRow>(
      `SELECT d.ID_DOCUMENTO, d.SERIE, d.NUMERO_DOCUMENTO,
              td.NOMBRE AS NOMBRE_TIPO_DOCUMENTO,
              d.FECHA_DOCUMENTO, d.FECHA_VENCIMIENTO, d.TOTAL, d.SALDO, d.ESTADO
         FROM CXC_DOCUMENTOS d
         LEFT JOIN CXC_TIPOS_DOCUMENTO td ON td.ID_TIPO_DOCUMENTO = d.ID_TIPO_DOCUMENTO
        WHERE d.ID_CLIENTE = :idCliente
        ORDER BY d.FECHA_DOCUMENTO DESC, d.ID_DOCUMENTO DESC`,
      { idCliente },
    );

    const documentos = (docsResult.rows ?? []).map((r) => {
      const estado = r.ESTADO?.trim() ?? '';
      return {
        idDocumento: r.ID_DOCUMENTO,
        referenciaDocumento: [r.SERIE, r.NUMERO_DOCUMENTO].filter(Boolean).join('-') || `Documento #${r.ID_DOCUMENTO}`,
        nombreTipoDocumento: r.NOMBRE_TIPO_DOCUMENTO,
        fechaDocumento: r.FECHA_DOCUMENTO?.toISOString() ?? '',
        fechaVencimiento: r.FECHA_VENCIMIENTO?.toISOString() ?? '',
        total: r.TOTAL,
        saldo: r.SALDO,
        estado,
        condicion: deriveDocumentoCondicion(r.FECHA_VENCIMIENTO, r.SALDO, estado),
      };
    });

    const totalFacturado = documentos.reduce((acc, d) => acc + Number(d.total), 0);
    const totalSaldoPendiente = documentos.reduce((acc, d) => acc + Number(d.saldo), 0);
    const totalVencido = documentos
      .filter((d) => d.condicion === 'VENCIDA')
      .reduce((acc, d) => acc + Number(d.saldo), 0);

    return {
      idCliente,
      nombreCliente: cliente.NOMBRE,
      nitCliente: cliente.NIT,
      documentos,
      totalFacturado,
      totalSaldoPendiente,
      totalVencido,
    };
  } finally {
    await conn.close();
  }
}
