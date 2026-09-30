import type { Connection } from 'oracledb';
import { getConnection } from '../../../config/database';
import type { ConteoPorEstado, ConteoPorTipo, MontoPorMes } from '@erp/contracts';

/**
 * Repositorio de solo lectura: agregaciones para el dashboard de CxC.
 * No administra CRUD de ninguna entidad, solo consulta y resume.
 *
 * Todo el resumen se arma en UNA sola conexión, con consultas secuenciales
 * (no Promise.all con getConnection() por consulta): el pool está
 * configurado con poolIncrement=1 hacia un Oracle remoto, así que pedir 10
 * conexiones simultáneas para una sola carga de página lo obligaba a crecer
 * de a una contra la latencia de red, y esa carga era la única en toda la
 * app que se comportaba así — por eso solo el dashboard se colgaba.
 */

export interface DashboardRaw {
  kpis: { carteraTotal: number; carteraVencida: number; documentosAbiertos: number };
  documentosPorEstado: ConteoPorEstado[];
  gestionesPorTipo: ConteoPorTipo[];
  promesasPorEstado: ConteoPorEstado[];
  conveniosPorEstado: ConteoPorEstado[];
  moraActiva: { cantidadDocumentos: number; montoTotal: number };
  notasCreditoPorEstado: ConteoPorEstado[];
  pagosPorEstado: ConteoPorEstado[];
  pagosAplicadosPorMes: MontoPorMes[];
  rutasPorEstado: ConteoPorTipo[];
}

interface KpisRow {
  CARTERA_TOTAL: number;
  CARTERA_VENCIDA: number;
  DOCUMENTOS_ABIERTOS: number;
}

async function fetchKpis(conn: Connection) {
  const result = await conn.execute<KpisRow>(
    `SELECT
       NVL(SUM(CASE WHEN UPPER(ESTADO) NOT IN ('ANULADO','ANULADA') THEN SALDO END), 0) AS CARTERA_TOTAL,
       NVL(SUM(CASE
                 WHEN UPPER(ESTADO) NOT IN ('ANULADO','ANULADA')
                  AND SALDO > 0.005
                  AND FECHA_VENCIMIENTO < TRUNC(SYSDATE)
                 THEN SALDO
               END), 0) AS CARTERA_VENCIDA,
       COUNT(CASE WHEN UPPER(ESTADO) NOT IN ('PAGADO','PAGADA','ANULADO','ANULADA') THEN 1 END) AS DOCUMENTOS_ABIERTOS
     FROM CXC_DOCUMENTOS`,
  );
  const row = result.rows?.[0];
  return {
    carteraTotal: Number(row?.CARTERA_TOTAL ?? 0),
    carteraVencida: Number(row?.CARTERA_VENCIDA ?? 0),
    documentosAbiertos: Number(row?.DOCUMENTOS_ABIERTOS ?? 0),
  };
}

async function fetchConteoPorEstado(conn: Connection, tabla: string, columnaMonto: string): Promise<ConteoPorEstado[]> {
  const result = await conn.execute<{ ESTADO: string | null; CANTIDAD: number; MONTO: number }>(
    `SELECT NVL(ESTADO, 'SIN_ESTADO') AS ESTADO, COUNT(*) AS CANTIDAD, NVL(SUM(${columnaMonto}), 0) AS MONTO
       FROM ${tabla}
      GROUP BY NVL(ESTADO, 'SIN_ESTADO')
      ORDER BY CANTIDAD DESC`,
  );
  return (result.rows ?? []).map((r) => ({
    estado: r.ESTADO ?? 'SIN_ESTADO',
    cantidad: Number(r.CANTIDAD ?? 0),
    monto: Number(r.MONTO ?? 0),
  }));
}

async function fetchGestionesPorTipo(conn: Connection): Promise<ConteoPorTipo[]> {
  const result = await conn.execute<{ TIPO: string | null; CANTIDAD: number }>(
    `SELECT NVL(TIPO_GESTION, 'SIN_TIPO') AS TIPO, COUNT(*) AS CANTIDAD
       FROM CXC_GESTIONES_COBRO
      GROUP BY NVL(TIPO_GESTION, 'SIN_TIPO')
      ORDER BY CANTIDAD DESC`,
  );
  return (result.rows ?? []).map((r) => ({ tipo: r.TIPO ?? 'SIN_TIPO', cantidad: Number(r.CANTIDAD ?? 0) }));
}

async function fetchRutasPorEstado(conn: Connection): Promise<ConteoPorTipo[]> {
  const result = await conn.execute<{ ESTADO: string | null; CANTIDAD: number }>(
    `SELECT NVL(ESTADO, 'SIN_ESTADO') AS ESTADO, COUNT(*) AS CANTIDAD
       FROM CXC_RUTAS
      GROUP BY NVL(ESTADO, 'SIN_ESTADO')
      ORDER BY CANTIDAD DESC`,
  );
  return (result.rows ?? []).map((r) => ({ tipo: r.ESTADO ?? 'SIN_ESTADO', cantidad: Number(r.CANTIDAD ?? 0) }));
}

async function fetchMoraActiva(conn: Connection) {
  const result = await conn.execute<{ CANTIDAD: number; MONTO: number }>(
    `SELECT COUNT(*) AS CANTIDAD, NVL(SUM(SALDO_VENCIDO), 0) AS MONTO
       FROM CXC_MORA
      WHERE UPPER(NVL(ESTADO, 'ACTIVA')) = 'ACTIVA'`,
  );
  const row = result.rows?.[0];
  return { cantidadDocumentos: Number(row?.CANTIDAD ?? 0), montoTotal: Number(row?.MONTO ?? 0) };
}

/**
 * Monto de aplicaciones de pago de los últimos `meses` meses (incluye el mes
 * actual). Rellena con 0 los meses sin aplicaciones para que la tendencia no
 * tenga huecos: Oracle solo devuelve filas para los meses con datos.
 */
async function fetchPagosAplicadosPorMes(conn: Connection, meses: number): Promise<MontoPorMes[]> {
  const result = await conn.execute<{ MES: string; MONTO: number }>(
    `SELECT TO_CHAR(FECHA_APLICACION, 'YYYY-MM') AS MES, NVL(SUM(MONTO_APLICADO), 0) AS MONTO
       FROM CXC_APLICACION_PAGOS
      WHERE FECHA_APLICACION >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), :desde)
      GROUP BY TO_CHAR(FECHA_APLICACION, 'YYYY-MM')`,
    { desde: -(meses - 1) },
  );
  const porMes = new Map((result.rows ?? []).map((r) => [r.MES, Number(r.MONTO ?? 0)]));

  const hoy = new Date();
  const serie: MontoPorMes[] = [];
  for (let i = meses - 1; i >= 0; i -= 1) {
    const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    const mes = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
    serie.push({ mes, monto: porMes.get(mes) ?? 0 });
  }
  return serie;
}

export async function obtenerDatosResumen(): Promise<DashboardRaw> {
  const conn = await getConnection();
  try {
    const kpis = await fetchKpis(conn);
    const documentosPorEstado = await fetchConteoPorEstado(conn, 'CXC_DOCUMENTOS', 'SALDO');
    const gestionesPorTipo = await fetchGestionesPorTipo(conn);
    const promesasPorEstado = await fetchConteoPorEstado(conn, 'CXC_PROMESAS_PAGO', 'MONTO_COMPROMETIDO');
    const conveniosPorEstado = await fetchConteoPorEstado(conn, 'CXC_CONVENIOS_PAGO', 'MONTO_DEUDA');
    const moraActiva = await fetchMoraActiva(conn);
    const notasCreditoPorEstado = await fetchConteoPorEstado(conn, 'CXC_NOTAS_CREDITO', 'MONTO');
    const pagosPorEstado = await fetchConteoPorEstado(conn, 'CXC_PAGOS', 'MONTO');
    const pagosAplicadosPorMes = await fetchPagosAplicadosPorMes(conn, 6);
    const rutasPorEstado = await fetchRutasPorEstado(conn);

    return {
      kpis,
      documentosPorEstado,
      gestionesPorTipo,
      promesasPorEstado,
      conveniosPorEstado,
      moraActiva,
      notasCreditoPorEstado,
      pagosPorEstado,
      pagosAplicadosPorMes,
      rutasPorEstado,
    };
  } finally {
    await conn.close();
  }
}
