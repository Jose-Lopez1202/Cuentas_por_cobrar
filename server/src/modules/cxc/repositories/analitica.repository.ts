import type { Connection } from 'oracledb';
import { getConnection } from '../../../config/database';
import type {
  CobradorOpcion, DocumentoClienteDetalle, GestionDetalle, PagoAplicadoDetalle, PagoClienteDetalle, PromesaClienteDetalle,
  ConvenioClienteDetalle, VisitaClienteDetalle, RutaOpcion,
} from '@erp/contracts';

/**
 * Consultas de solo lectura del módulo de análisis. Todo se agrega en SQL y las
 * fechas salen ya como texto AAAA-MM-DD (TO_CHAR) para no depender del huso horario
 * del servidor. "Cobrado" = pagos aplicados confirmados (CXC_APLICACION_PAGOS) y se le
 * atribuye al empleado que registró la aplicación.
 */

export interface Alcance {
  desde: string;
  hasta: string;
  desdeAnt: string;
  hastaAnt: string;
  idEmpleado?: number;
  idRuta?: number;
}

export const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (n: number) => Math.round(n * 100) / 100;

const NO_ANULADO = `UPPER(d.ESTADO) NOT IN ('ANULADO', 'ANULADA')`;
const ABIERTO = `d.SALDO > 0 AND UPPER(d.ESTADO) NOT IN ('ANULADO', 'ANULADA', 'PAGADO', 'PAGADA')`;
const NOMBRE_EMP = `TRIM(e.NOMBRE || ' ' || e.APELLIDO)`;
const dia = (col: string) => `TO_CHAR(${col}, 'YYYY-MM-DD')`;
const entre = (col: string, a: string, b: string) => `${col} >= TO_DATE(:${a}, 'YYYY-MM-DD') AND ${col} < TO_DATE(:${b}, 'YYYY-MM-DD') + 1`;

/** Restringe documentos a los clientes de una ruta. */
export const porRutaDoc = (a: Alcance, alias = 'd') =>
  a.idRuta ? ` AND ${alias}.ID_CLIENTE IN (SELECT rd.ID_CLIENTE FROM CXC_RUTA_DETALLE rd WHERE rd.ID_RUTA = :idRuta)` : '';
const porEmpleado = (a: Alcance, col: string) => (a.idEmpleado ? ` AND ${col} = :idEmpleado` : '');

type Binds = Record<string, string | number | undefined>;

/** oracledb rechaza binds que no aparecen en el SQL: se envían solo los que se usan. */
async function ejecutar<T>(conn: Connection, sql: string, binds: Binds = {}): Promise<T[]> {
  const usados: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(binds)) {
    if (v !== undefined && new RegExp(`:${k}\\b`).test(sql)) usados[k] = v;
  }
  const r = await conn.execute<T>(sql, usados);
  return (r.rows ?? []) as T[];
}

const bindsDe = (a: Alcance): Binds => ({
  desde: a.desde, hasta: a.hasta, desdeAnt: a.desdeAnt, hastaAnt: a.hastaAnt, idEmpleado: a.idEmpleado, idRuta: a.idRuta,
});

async function conConexion<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
  const conn = await getConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

// --- Catálogo de filtros ---------------------------------------------------------------

export function catalogoFiltros(): Promise<{ cobradores: CobradorOpcion[]; rutas: RutaOpcion[] }> {
  return conConexion(async (conn) => {
    const cob = await ejecutar<{ ID: number; NOMBRE: string; CODIGO: string | null }>(
      conn,
      `SELECT e.ID_EMPLEADO AS ID, ${NOMBRE_EMP} AS NOMBRE, e.CODIGO_EMPLEADO AS CODIGO
         FROM EMPLEADO e
        WHERE e.ID_EMPLEADO IN (SELECT ID_EMPLEADO FROM CXC_APLICACION_PAGOS WHERE ID_EMPLEADO IS NOT NULL
                                UNION SELECT ID_EMPLEADO FROM CXC_GESTIONES_COBRO
                                UNION SELECT ID_EMPLEADO FROM CXC_RUTAS)
        ORDER BY 2`,
    );
    const rut = await ejecutar<{ ID: number; CODIGO: string | null; NOMBRE: string }>(
      conn,
      `SELECT ID_RUTA AS ID, CODIGO_RUTA AS CODIGO, NOMBRE FROM CXC_RUTAS ORDER BY FECHA DESC, ID_RUTA DESC FETCH FIRST 300 ROWS ONLY`,
    );
    return {
      cobradores: cob.map((r) => ({ idEmpleado: r.ID, nombre: r.NOMBRE || `Empleado ${r.ID}`, codigo: r.CODIGO })),
      rutas: rut.map((r) => ({ idRuta: r.ID, codigo: r.CODIGO, nombre: r.NOMBRE })),
    };
  });
}

// --- Panel ejecutivo ---------------------------------------------------------------------

export interface ResumenRaw {
  cobradoDia: Array<{ F: string; M: number; N: number }>;
  facturadoDia: Array<{ F: string; M: number }>;
  gestionesDia: Array<{ F: string; N: number }>;
  cartera: { TOTAL: number; VENCIDA: number; DOCS: number; CLIENTES: number; CLIENTES_VENC: number };
  antiguedad: Array<{ TRAMO: string; ORDEN: number; MONTO: number; DOCS: number }>;
  deudores: Array<{ ID_CLIENTE: number; NOMBRE: string; NIT: string | null; SALDO: number; VENCIDO: number; DIAS: number; DOCS_VENC: number }>;
  formas: Array<{ FORMA: string; PAGOS: number; MONTO: number }>;
  gestionesResultado: Array<{ RESULTADO: string; N: number }>;
  promesas: Array<{ ESTADO: string; N: number; MONTO: number }>;
  promesasVencidas: number;
  vencimientos: Array<{ SEMANA: number; DESDE: string; MONTO: number; DOCS: number }>;
  topCobradores: Array<{ ID: number; NOMBRE: string; MONTO: number }>;
  docsMasDe90: { N: number; MONTO: number; CLIENTES: number };
}

export function resumenRaw(a: Alcance): Promise<ResumenRaw> {
  return conConexion(async (conn) => {
    const b = bindsDe(a);
    const rangoTotal = { ...b, desde: a.desdeAnt };
    const doc = porRutaDoc(a);
    const apEmp = porEmpleado(a, 'ap.ID_EMPLEADO');

    const cobradoDia = await ejecutar<ResumenRaw['cobradoDia'][number]>(conn,
      `SELECT ${dia('ap.FECHA_APLICACION')} AS F, SUM(ap.MONTO_APLICADO) AS M, COUNT(*) AS N
         FROM CXC_APLICACION_PAGOS ap JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = ap.ID_DOCUMENTO
        WHERE ap.ESTADO = 'CONFIRMADA' AND ${entre('ap.FECHA_APLICACION', 'desde', 'hasta')}${apEmp}${doc}
        GROUP BY ${dia('ap.FECHA_APLICACION')}`, rangoTotal);

    const facturadoDia = await ejecutar<ResumenRaw['facturadoDia'][number]>(conn,
      `SELECT ${dia('d.FECHA_DOCUMENTO')} AS F, SUM(d.TOTAL) AS M
         FROM CXC_DOCUMENTOS d
        WHERE ${NO_ANULADO} AND ${entre('d.FECHA_DOCUMENTO', 'desde', 'hasta')}${doc}
        GROUP BY ${dia('d.FECHA_DOCUMENTO')}`, rangoTotal);

    const gestRuta = a.idRuta ? ` AND g.ID_CLIENTE IN (SELECT rd.ID_CLIENTE FROM CXC_RUTA_DETALLE rd WHERE rd.ID_RUTA = :idRuta)` : '';
    const gestionesDia = await ejecutar<ResumenRaw['gestionesDia'][number]>(conn,
      `SELECT ${dia('g.FECHA_GESTION')} AS F, COUNT(*) AS N
         FROM CXC_GESTIONES_COBRO g
        WHERE ${entre('g.FECHA_GESTION', 'desde', 'hasta')}${porEmpleado(a, 'g.ID_EMPLEADO')}${gestRuta}
        GROUP BY ${dia('g.FECHA_GESTION')}`, rangoTotal);

    const cartera = (await ejecutar<ResumenRaw['cartera']>(conn,
      `SELECT NVL(SUM(d.SALDO), 0) AS TOTAL,
              NVL(SUM(CASE WHEN d.FECHA_VENCIMIENTO < TRUNC(SYSDATE) THEN d.SALDO ELSE 0 END), 0) AS VENCIDA,
              COUNT(*) AS DOCS,
              COUNT(DISTINCT d.ID_CLIENTE) AS CLIENTES,
              COUNT(DISTINCT CASE WHEN d.FECHA_VENCIMIENTO < TRUNC(SYSDATE) THEN d.ID_CLIENTE END) AS CLIENTES_VENC
         FROM CXC_DOCUMENTOS d WHERE ${ABIERTO}${doc}`, b))[0];

    const antiguedad = await ejecutar<ResumenRaw['antiguedad'][number]>(conn,
      `SELECT TRAMO, ORDEN, SUM(SALDO) AS MONTO, COUNT(*) AS DOCS FROM (
         SELECT d.SALDO,
                CASE WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO <= 0 THEN 'Al corriente'
                     WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO <= 30 THEN '1 a 30 días'
                     WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO <= 60 THEN '31 a 60 días'
                     WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO <= 90 THEN '61 a 90 días'
                     ELSE 'Más de 90 días' END AS TRAMO,
                CASE WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO <= 0 THEN 1
                     WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO <= 30 THEN 2
                     WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO <= 60 THEN 3
                     WHEN TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO <= 90 THEN 4 ELSE 5 END AS ORDEN
           FROM CXC_DOCUMENTOS d WHERE ${ABIERTO}${doc})
        GROUP BY TRAMO, ORDEN ORDER BY ORDEN`, b);

    const deudores = await ejecutar<ResumenRaw['deudores'][number]>(conn,
      `SELECT c.ID_CLIENTE, c.NOMBRE, c.NIT, SUM(d.SALDO) AS SALDO,
              SUM(CASE WHEN d.FECHA_VENCIMIENTO < TRUNC(SYSDATE) THEN d.SALDO ELSE 0 END) AS VENCIDO,
              MAX(GREATEST(0, TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO)) AS DIAS,
              COUNT(CASE WHEN d.FECHA_VENCIMIENTO < TRUNC(SYSDATE) THEN 1 END) AS DOCS_VENC
         FROM CXC_DOCUMENTOS d JOIN CLIENTE c ON c.ID_CLIENTE = d.ID_CLIENTE
        WHERE ${ABIERTO}${doc}
        GROUP BY c.ID_CLIENTE, c.NOMBRE, c.NIT
       HAVING SUM(CASE WHEN d.FECHA_VENCIMIENTO < TRUNC(SYSDATE) THEN d.SALDO ELSE 0 END) > 0
        ORDER BY VENCIDO DESC FETCH FIRST 10 ROWS ONLY`, b);

    const formas = await ejecutar<ResumenRaw['formas'][number]>(conn,
      `SELECT fp.NOMBRE AS FORMA, COUNT(DISTINCT ap.ID_PAGO) AS PAGOS, SUM(ap.MONTO_APLICADO) AS MONTO
         FROM CXC_APLICACION_PAGOS ap
         JOIN CXC_PAGOS p ON p.ID_PAGO = ap.ID_PAGO
         JOIN CXC_FORMAS_PAGO fp ON fp.ID_FORMA_PAGO = p.ID_FORMA_PAGO
         JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = ap.ID_DOCUMENTO
        WHERE ap.ESTADO = 'CONFIRMADA' AND ${entre('ap.FECHA_APLICACION', 'desde', 'hasta')}${apEmp}${doc}
        GROUP BY fp.NOMBRE ORDER BY MONTO DESC`, b);

    const gestionesResultado = await ejecutar<ResumenRaw['gestionesResultado'][number]>(conn,
      `SELECT NVL(g.RESULTADO, 'Sin resultado') AS RESULTADO, COUNT(*) AS N
         FROM CXC_GESTIONES_COBRO g
        WHERE ${entre('g.FECHA_GESTION', 'desde', 'hasta')}${porEmpleado(a, 'g.ID_EMPLEADO')}${gestRuta}
        GROUP BY NVL(g.RESULTADO, 'Sin resultado') ORDER BY N DESC FETCH FIRST 8 ROWS ONLY`, b);

    const promEmp = a.idEmpleado ? ` AND pp.ID_GESTION IN (SELECT ID_GESTION FROM CXC_GESTIONES_COBRO WHERE ID_EMPLEADO = :idEmpleado)` : '';
    const promRuta = a.idRuta ? ` AND pp.ID_CLIENTE IN (SELECT rd.ID_CLIENTE FROM CXC_RUTA_DETALLE rd WHERE rd.ID_RUTA = :idRuta)` : '';
    const promesas = await ejecutar<ResumenRaw['promesas'][number]>(conn,
      `SELECT pp.ESTADO, COUNT(*) AS N, SUM(pp.MONTO_COMPROMETIDO) AS MONTO
         FROM CXC_PROMESAS_PAGO pp
        WHERE ${entre('pp.FECHA_PROMESA', 'desde', 'hasta')}${promEmp}${promRuta}
        GROUP BY pp.ESTADO ORDER BY pp.ESTADO`, b);

    const promesasVencidas = num((await ejecutar<{ N: number }>(conn,
      `SELECT COUNT(*) AS N FROM CXC_PROMESAS_PAGO pp
        WHERE pp.ESTADO = 'PENDIENTE' AND pp.FECHA_COMPROMISO < TRUNC(SYSDATE)${promEmp}${promRuta}`, b))[0]?.N);

    const vencimientos = await ejecutar<ResumenRaw['vencimientos'][number]>(conn,
      `SELECT TRUNC((d.FECHA_VENCIMIENTO - TRUNC(SYSDATE)) / 7) AS SEMANA,
              TO_CHAR(TRUNC(SYSDATE) + 7 * TRUNC((d.FECHA_VENCIMIENTO - TRUNC(SYSDATE)) / 7), 'YYYY-MM-DD') AS DESDE,
              SUM(d.SALDO) AS MONTO, COUNT(*) AS DOCS
         FROM CXC_DOCUMENTOS d
        WHERE ${ABIERTO} AND d.FECHA_VENCIMIENTO >= TRUNC(SYSDATE) AND d.FECHA_VENCIMIENTO < TRUNC(SYSDATE) + 28${doc}
        GROUP BY TRUNC((d.FECHA_VENCIMIENTO - TRUNC(SYSDATE)) / 7),
                 TO_CHAR(TRUNC(SYSDATE) + 7 * TRUNC((d.FECHA_VENCIMIENTO - TRUNC(SYSDATE)) / 7), 'YYYY-MM-DD')
        ORDER BY 1`, b);

    const topCobradores = await ejecutar<ResumenRaw['topCobradores'][number]>(conn,
      `SELECT * FROM (
         SELECT e.ID_EMPLEADO AS ID, ${NOMBRE_EMP} AS NOMBRE, SUM(ap.MONTO_APLICADO) AS MONTO
           FROM CXC_APLICACION_PAGOS ap
           JOIN EMPLEADO e ON e.ID_EMPLEADO = ap.ID_EMPLEADO
           JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = ap.ID_DOCUMENTO
          WHERE ap.ESTADO = 'CONFIRMADA' AND ${entre('ap.FECHA_APLICACION', 'desde', 'hasta')}${apEmp}${doc}
          GROUP BY e.ID_EMPLEADO, ${NOMBRE_EMP} ORDER BY MONTO DESC) WHERE ROWNUM <= 5`, b);

    const docsMasDe90 = (await ejecutar<ResumenRaw['docsMasDe90']>(conn,
      `SELECT COUNT(*) AS N, NVL(SUM(d.SALDO), 0) AS MONTO, COUNT(DISTINCT d.ID_CLIENTE) AS CLIENTES
         FROM CXC_DOCUMENTOS d WHERE ${ABIERTO} AND TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO > 90${doc}`, b))[0];

    return { cobradoDia, facturadoDia, gestionesDia, cartera, antiguedad, deudores, formas, gestionesResultado, promesas, promesasVencidas, vencimientos, topCobradores, docsMasDe90 };
  });
}

// --- Cobradores ----------------------------------------------------------------------------

export interface CobradorRaw {
  cobros: Array<{ ID: number; NOMBRE: string; CODIGO: string | null; COBRADO: number; COBRADO_ANT: number; PAGOS: number; CLIENTES: number }>;
  gestiones: Array<{ ID: number; TOTAL: number; EFECTIVAS: number }>;
  promesas: Array<{ ID: number; TOTAL: number; CUMPLIDAS: number }>;
  rutas: Array<{ ID: number; RUTAS: number; PARADAS: number; VISITADAS: number }>;
  nombres: Array<{ ID: number; NOMBRE: string; CODIGO: string | null }>;
}

const EFECTIVA = `NOT REGEXP_LIKE(UPPER(NVL(g.RESULTADO, 'SIN_RESULTADO')), 'SIN_RESP|SIN_RESULT|NO_CONTEST|NO_LOCALIZ|NO_ENCONTR|BUZON|EQUIVOC')`;

export function cobradoresRaw(a: Alcance, soloEmpleado?: number): Promise<CobradorRaw> {
  return conConexion(async (conn) => {
    const al = { ...a, idEmpleado: soloEmpleado ?? a.idEmpleado };
    const b = bindsDe(al);
    const rangoTotal = { ...b, desde: a.desdeAnt };
    const doc = porRutaDoc(al);
    const apEmp = al.idEmpleado ? ' AND ap.ID_EMPLEADO = :idEmpleado' : '';
    const gEmp = al.idEmpleado ? ' AND g.ID_EMPLEADO = :idEmpleado' : '';

    const cobros = await ejecutar<CobradorRaw['cobros'][number]>(conn,
      `SELECT e.ID_EMPLEADO AS ID, ${NOMBRE_EMP} AS NOMBRE, e.CODIGO_EMPLEADO AS CODIGO,
              NVL(SUM(CASE WHEN ${entre('ap.FECHA_APLICACION', 'desde2', 'hasta')} THEN ap.MONTO_APLICADO END), 0) AS COBRADO,
              NVL(SUM(CASE WHEN ${entre('ap.FECHA_APLICACION', 'desdeAnt', 'hastaAnt')} THEN ap.MONTO_APLICADO END), 0) AS COBRADO_ANT,
              COUNT(CASE WHEN ${entre('ap.FECHA_APLICACION', 'desde2', 'hasta')} THEN 1 END) AS PAGOS,
              COUNT(DISTINCT CASE WHEN ${entre('ap.FECHA_APLICACION', 'desde2', 'hasta')} THEN d.ID_CLIENTE END) AS CLIENTES
         FROM CXC_APLICACION_PAGOS ap
         JOIN EMPLEADO e ON e.ID_EMPLEADO = ap.ID_EMPLEADO
         JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = ap.ID_DOCUMENTO
        WHERE ap.ESTADO = 'CONFIRMADA' AND ${entre('ap.FECHA_APLICACION', 'desdeAnt', 'hasta')}${apEmp}${doc}
        GROUP BY e.ID_EMPLEADO, ${NOMBRE_EMP}, e.CODIGO_EMPLEADO`, { ...rangoTotal, desde2: a.desde, desdeAnt: a.desdeAnt });

    const gestRuta = al.idRuta ? ` AND g.ID_CLIENTE IN (SELECT rd.ID_CLIENTE FROM CXC_RUTA_DETALLE rd WHERE rd.ID_RUTA = :idRuta)` : '';
    const gestiones = await ejecutar<CobradorRaw['gestiones'][number]>(conn,
      `SELECT g.ID_EMPLEADO AS ID, COUNT(*) AS TOTAL, COUNT(CASE WHEN ${EFECTIVA} THEN 1 END) AS EFECTIVAS
         FROM CXC_GESTIONES_COBRO g
        WHERE ${entre('g.FECHA_GESTION', 'desde', 'hasta')}${gEmp}${gestRuta}
        GROUP BY g.ID_EMPLEADO`, b);

    const promesas = await ejecutar<CobradorRaw['promesas'][number]>(conn,
      `SELECT g.ID_EMPLEADO AS ID, COUNT(*) AS TOTAL, COUNT(CASE WHEN pp.ESTADO = 'CUMPLIDA' THEN 1 END) AS CUMPLIDAS
         FROM CXC_PROMESAS_PAGO pp JOIN CXC_GESTIONES_COBRO g ON g.ID_GESTION = pp.ID_GESTION
        WHERE ${entre('g.FECHA_GESTION', 'desde', 'hasta')}${gEmp}${gestRuta}
        GROUP BY g.ID_EMPLEADO`, b);

    const rEmp = al.idEmpleado ? ' AND r.ID_EMPLEADO = :idEmpleado' : '';
    const rRuta = al.idRuta ? ' AND r.ID_RUTA = :idRuta' : '';
    const rutas = await ejecutar<CobradorRaw['rutas'][number]>(conn,
      `SELECT r.ID_EMPLEADO AS ID, COUNT(DISTINCT r.ID_RUTA) AS RUTAS, COUNT(rd.ID_RUTA_DETALLE) AS PARADAS,
              COUNT(CASE WHEN rd.ESTADO_VISITA = 'VISITADO' THEN 1 END) AS VISITADAS
         FROM CXC_RUTAS r LEFT JOIN CXC_RUTA_DETALLE rd ON rd.ID_RUTA = r.ID_RUTA
        WHERE ${entre('r.FECHA', 'desde', 'hasta')}${rEmp}${rRuta}
        GROUP BY r.ID_EMPLEADO`, b);

    // Nombres de todos los que aparecen en alguna de las listas (incluye quien solo gestionó o salió a ruta).
    const ids = [...new Set([...gestiones.map((x) => x.ID), ...rutas.map((x) => x.ID), ...promesas.map((x) => x.ID)])].filter((x) => x != null);
    let nombres: CobradorRaw['nombres'] = [];
    if (ids.length) {
      const binds: Binds = {};
      const marcas = ids.map((id, i) => { binds[`i${i}`] = id; return `:i${i}`; });
      nombres = await ejecutar<CobradorRaw['nombres'][number]>(conn,
        `SELECT e.ID_EMPLEADO AS ID, ${NOMBRE_EMP} AS NOMBRE, e.CODIGO_EMPLEADO AS CODIGO FROM EMPLEADO e WHERE e.ID_EMPLEADO IN (${marcas.join(',')})`, binds);
    }
    return { cobros, gestiones, promesas, rutas, nombres };
  });
}

// --- Listados de detalle (reutilizados por varios tableros) ----------------------------------

export function pagosAplicados(a: Alcance, extra: { cond?: string; binds?: Binds; idEmpleado?: number; idCliente?: number }, limite = 200): Promise<PagoAplicadoDetalle[]> {
  return conConexion(async (conn) => {
    const emp = extra.idEmpleado ?? a.idEmpleado;
    const rows = await ejecutar<{
      ID: number; F: string; ID_CLIENTE: number; CLIENTE: string; ID_DOCUMENTO: number; SERIE: string | null; NUMERO: string | null;
      MONTO: number; FORMA: string | null; REF: string | null;
    }>(conn,
      `SELECT ap.ID_APLICACION AS ID, ${dia('ap.FECHA_APLICACION')} AS F, c.ID_CLIENTE, c.NOMBRE AS CLIENTE, d.ID_DOCUMENTO,
              d.SERIE, d.NUMERO_DOCUMENTO AS NUMERO, ap.MONTO_APLICADO AS MONTO, fp.NOMBRE AS FORMA, p.NUMERO_REFERENCIA AS REF
         FROM CXC_APLICACION_PAGOS ap
         JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = ap.ID_DOCUMENTO
         JOIN CLIENTE c ON c.ID_CLIENTE = d.ID_CLIENTE
         LEFT JOIN CXC_PAGOS p ON p.ID_PAGO = ap.ID_PAGO
         LEFT JOIN CXC_FORMAS_PAGO fp ON fp.ID_FORMA_PAGO = p.ID_FORMA_PAGO
        WHERE ap.ESTADO = 'CONFIRMADA' AND ${entre('ap.FECHA_APLICACION', 'desde', 'hasta')}
              ${emp ? 'AND ap.ID_EMPLEADO = :idEmpleado' : ''}
              ${extra.idCliente ? 'AND d.ID_CLIENTE = :idCliente' : ''}
              ${porRutaDoc(a)} ${extra.cond ?? ''}
        ORDER BY ap.FECHA_APLICACION DESC, ap.ID_APLICACION DESC FETCH FIRST ${limite} ROWS ONLY`,
      { ...bindsDe(a), idEmpleado: emp, idCliente: extra.idCliente, ...(extra.binds ?? {}) });
    return rows.map((r) => ({
      idAplicacion: r.ID, fecha: r.F, idCliente: r.ID_CLIENTE, cliente: r.CLIENTE, idDocumento: r.ID_DOCUMENTO,
      documento: [r.SERIE, r.NUMERO].filter(Boolean).join('-') || `#${r.ID_DOCUMENTO}`,
      monto: num(r.MONTO), formaPago: r.FORMA, referencia: r.REF,
    }));
  });
}

export function gestiones(a: Alcance, f: { idEmpleado?: number; idCliente?: number }, limite = 100): Promise<GestionDetalle[]> {
  return conConexion(async (conn) => {
    const rows = await ejecutar<{
      ID: number; F: string; ID_CLIENTE: number; CLIENTE: string; TIPO: string | null; RESULTADO: string | null;
      OBS: string | null; FC: string | null; MC: number | null;
    }>(conn,
      `SELECT g.ID_GESTION AS ID, ${dia('g.FECHA_GESTION')} AS F, c.ID_CLIENTE, c.NOMBRE AS CLIENTE, g.TIPO_GESTION AS TIPO,
              g.RESULTADO, g.OBSERVACION AS OBS, ${dia('g.FECHA_COMPROMISO')} AS FC, g.MONTO_COMPROMISO AS MC
         FROM CXC_GESTIONES_COBRO g JOIN CLIENTE c ON c.ID_CLIENTE = g.ID_CLIENTE
        WHERE ${f.idCliente ? 'g.ID_CLIENTE = :idCliente' : `${entre('g.FECHA_GESTION', 'desde', 'hasta')}`}
              ${f.idEmpleado ? 'AND g.ID_EMPLEADO = :idEmpleado' : ''}
        ORDER BY g.FECHA_GESTION DESC, g.ID_GESTION DESC FETCH FIRST ${limite} ROWS ONLY`,
      { ...bindsDe(a), idEmpleado: f.idEmpleado, idCliente: f.idCliente });
    return rows.map((r) => ({
      idGestion: r.ID, fecha: r.F, idCliente: r.ID_CLIENTE, cliente: r.CLIENTE, tipo: r.TIPO, resultado: r.RESULTADO,
      observacion: r.OBS, fechaCompromiso: r.FC, montoCompromiso: r.MC == null ? null : num(r.MC),
    }));
  });
}

export function detalleCobrador(a: Alcance, idEmpleado: number) {
  return conConexion(async (conn) => {
    const b = { ...bindsDe(a), idEmpleado };
    const doc = porRutaDoc(a);
    const serie = await ejecutar<{ F: string; M: number }>(conn,
      `SELECT ${dia('ap.FECHA_APLICACION')} AS F, SUM(ap.MONTO_APLICADO) AS M
         FROM CXC_APLICACION_PAGOS ap JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = ap.ID_DOCUMENTO
        WHERE ap.ESTADO = 'CONFIRMADA' AND ap.ID_EMPLEADO = :idEmpleado AND ${entre('ap.FECHA_APLICACION', 'desde', 'hasta')}${doc}
        GROUP BY ${dia('ap.FECHA_APLICACION')}`, b);
    const clientes = await ejecutar<{ ID: number; NOMBRE: string; M: number; N: number }>(conn,
      `SELECT * FROM (
         SELECT c.ID_CLIENTE AS ID, c.NOMBRE, SUM(ap.MONTO_APLICADO) AS M, COUNT(*) AS N
           FROM CXC_APLICACION_PAGOS ap JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = ap.ID_DOCUMENTO JOIN CLIENTE c ON c.ID_CLIENTE = d.ID_CLIENTE
          WHERE ap.ESTADO = 'CONFIRMADA' AND ap.ID_EMPLEADO = :idEmpleado AND ${entre('ap.FECHA_APLICACION', 'desde', 'hasta')}${doc}
          GROUP BY c.ID_CLIENTE, c.NOMBRE ORDER BY M DESC) WHERE ROWNUM <= 15`, b);
    const rutas = await ejecutar<{ ID: number; CODIGO: string | null; NOMBRE: string; F: string; ESTADO: string; PARADAS: number; VISITADAS: number }>(conn,
      `SELECT r.ID_RUTA AS ID, r.CODIGO_RUTA AS CODIGO, r.NOMBRE, ${dia('r.FECHA')} AS F, r.ESTADO,
              COUNT(rd.ID_RUTA_DETALLE) AS PARADAS, COUNT(CASE WHEN rd.ESTADO_VISITA = 'VISITADO' THEN 1 END) AS VISITADAS
         FROM CXC_RUTAS r LEFT JOIN CXC_RUTA_DETALLE rd ON rd.ID_RUTA = r.ID_RUTA
        WHERE r.ID_EMPLEADO = :idEmpleado AND ${entre('r.FECHA', 'desde', 'hasta')}
        GROUP BY r.ID_RUTA, r.CODIGO_RUTA, r.NOMBRE, r.FECHA, r.ESTADO ORDER BY r.FECHA DESC FETCH FIRST 30 ROWS ONLY`, b);
    return {
      serie: serie.map((r) => ({ fecha: r.F, cobrado: num(r.M) })),
      clientes: clientes.map((r) => ({ idCliente: r.ID, nombre: r.NOMBRE, cobrado: num(r.M), pagos: num(r.N) })),
      rutas: rutas.map((r) => ({ idRuta: r.ID, codigo: r.CODIGO, nombre: r.NOMBRE, fecha: r.F, estado: r.ESTADO, paradas: num(r.PARADAS), visitadas: num(r.VISITADAS) })),
    };
  });
}

// --- Días de cobro -------------------------------------------------------------------------------

export function cobradoPorFecha(a: Alcance): Promise<Array<{ fecha: string; cobrado: number; pagos: number }>> {
  return conConexion(async (conn) => {
    const rows = await ejecutar<{ F: string; M: number; N: number }>(conn,
      `SELECT ${dia('ap.FECHA_APLICACION')} AS F, SUM(ap.MONTO_APLICADO) AS M, COUNT(*) AS N
         FROM CXC_APLICACION_PAGOS ap JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = ap.ID_DOCUMENTO
        WHERE ap.ESTADO = 'CONFIRMADA' AND ${entre('ap.FECHA_APLICACION', 'desde', 'hasta')}${porEmpleado(a, 'ap.ID_EMPLEADO')}${porRutaDoc(a)}
        GROUP BY ${dia('ap.FECHA_APLICACION')} ORDER BY 1`, bindsDe(a));
    return rows.map((r) => ({ fecha: r.F, cobrado: num(r.M), pagos: num(r.N) }));
  });
}

// --- Rutas ---------------------------------------------------------------------------------------------

const BASE_RUTA = `REGEXP_REPLACE(TRIM(r.NOMBRE), '\\s*#\\s*[0-9]+$', '')`;

export interface RutaFila {
  ID: number; CODIGO: string | null; NOMBRE: string; BASE: string; F: string; ESTADO: string; ID_EMPLEADO: number;
  PARADAS: number; VISITADAS: number; NO_ENC: number; REPROG: number; MONTO: number;
}

export function rutasRaw(a: Alcance) {
  return conConexion(async (conn) => {
    const b = bindsDe(a);
    const rEmp = a.idEmpleado ? ' AND r.ID_EMPLEADO = :idEmpleado' : '';
    const rRuta = a.idRuta ? ' AND r.ID_RUTA = :idRuta' : '';
    const filas = await ejecutar<RutaFila>(conn,
      `SELECT r.ID_RUTA AS ID, r.CODIGO_RUTA AS CODIGO, r.NOMBRE, ${BASE_RUTA} AS BASE, ${dia('r.FECHA')} AS F, r.ESTADO, r.ID_EMPLEADO,
              COUNT(rd.ID_RUTA_DETALLE) AS PARADAS,
              COUNT(CASE WHEN rd.ESTADO_VISITA = 'VISITADO' THEN 1 END) AS VISITADAS,
              COUNT(CASE WHEN rd.ESTADO_VISITA = 'NO_ENCONTRADO' THEN 1 END) AS NO_ENC,
              COUNT(CASE WHEN rd.ESTADO_VISITA = 'REPROGRAMADO' THEN 1 END) AS REPROG,
              NVL(SUM(rd.MONTO_PENDIENTE), 0) AS MONTO
         FROM CXC_RUTAS r LEFT JOIN CXC_RUTA_DETALLE rd ON rd.ID_RUTA = r.ID_RUTA
        WHERE ${entre('r.FECHA', 'desde', 'hasta')}${rEmp}${rRuta}
        GROUP BY r.ID_RUTA, r.CODIGO_RUTA, r.NOMBRE, r.FECHA, r.ESTADO, r.ID_EMPLEADO ORDER BY r.FECHA`, b);

    const clientes = await ejecutar<{ ID: number; NOMBRE: string; VECES: number; VISITADAS: number; NO_ENC: number; VENCIDO: number }>(conn,
      `SELECT * FROM (
         SELECT c.ID_CLIENTE AS ID, c.NOMBRE, COUNT(*) AS VECES,
                COUNT(CASE WHEN rd.ESTADO_VISITA = 'VISITADO' THEN 1 END) AS VISITADAS,
                COUNT(CASE WHEN rd.ESTADO_VISITA = 'NO_ENCONTRADO' THEN 1 END) AS NO_ENC,
                NVL((SELECT SUM(d.SALDO) FROM CXC_DOCUMENTOS d
                      WHERE d.ID_CLIENTE = c.ID_CLIENTE AND ${ABIERTO} AND d.FECHA_VENCIMIENTO < TRUNC(SYSDATE)), 0) AS VENCIDO
           FROM CXC_RUTA_DETALLE rd JOIN CXC_RUTAS r ON r.ID_RUTA = rd.ID_RUTA JOIN CLIENTE c ON c.ID_CLIENTE = rd.ID_CLIENTE
          WHERE ${entre('r.FECHA', 'desde', 'hasta')}${rEmp}${rRuta}
          GROUP BY c.ID_CLIENTE, c.NOMBRE HAVING COUNT(*) >= 2 ORDER BY VECES DESC, VENCIDO DESC) WHERE ROWNUM <= 15`, b);
    return { filas, clientes };
  });
}

export function detalleGrupoRuta(a: Alcance, base: string) {
  return conConexion(async (conn) => {
    const b = { ...bindsDe(a), base };
    const rEmp = a.idEmpleado ? ' AND r.ID_EMPLEADO = :idEmpleado' : '';
    const salidas = await ejecutar<RutaFila & { COBRADOR: string }>(conn,
      `SELECT r.ID_RUTA AS ID, r.CODIGO_RUTA AS CODIGO, r.NOMBRE, ${BASE_RUTA} AS BASE, ${dia('r.FECHA')} AS F, r.ESTADO, r.ID_EMPLEADO,
              ${NOMBRE_EMP} AS COBRADOR,
              COUNT(rd.ID_RUTA_DETALLE) AS PARADAS, COUNT(CASE WHEN rd.ESTADO_VISITA = 'VISITADO' THEN 1 END) AS VISITADAS,
              0 AS NO_ENC, 0 AS REPROG, NVL(SUM(rd.MONTO_PENDIENTE), 0) AS MONTO
         FROM CXC_RUTAS r LEFT JOIN CXC_RUTA_DETALLE rd ON rd.ID_RUTA = r.ID_RUTA LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = r.ID_EMPLEADO
        WHERE ${entre('r.FECHA', 'desde', 'hasta')} AND ${BASE_RUTA} = :base${rEmp}
        GROUP BY r.ID_RUTA, r.CODIGO_RUTA, r.NOMBRE, r.FECHA, r.ESTADO, r.ID_EMPLEADO, ${NOMBRE_EMP} ORDER BY r.FECHA DESC`, b);
    const paradas = await ejecutar<{ ID_RUTA: number; CODIGO: string | null; F: string; ID_CLIENTE: number; CLIENTE: string; EST: string | null; MONTO: number | null; OBS: string | null }>(conn,
      `SELECT r.ID_RUTA, r.CODIGO_RUTA AS CODIGO, ${dia('r.FECHA')} AS F, c.ID_CLIENTE, c.NOMBRE AS CLIENTE,
              rd.ESTADO_VISITA AS EST, rd.MONTO_PENDIENTE AS MONTO, rd.OBSERVACIONES AS OBS
         FROM CXC_RUTA_DETALLE rd JOIN CXC_RUTAS r ON r.ID_RUTA = rd.ID_RUTA JOIN CLIENTE c ON c.ID_CLIENTE = rd.ID_CLIENTE
        WHERE ${entre('r.FECHA', 'desde', 'hasta')} AND ${BASE_RUTA} = :base${rEmp}
        ORDER BY r.FECHA DESC, rd.ORDEN_VISITA FETCH FIRST 300 ROWS ONLY`, b);
    return { salidas, paradas };
  });
}

// --- Clientes en riesgo -------------------------------------------------------------------------------

export interface RiesgoRaw {
  ID_CLIENTE: number; NOMBRE: string; NIT: string | null; SALDO_TOTAL: number; SALDO_VENCIDO: number; DOCS_VENC: number; DIAS_MAX: number;
  DIAS_PROM: number | null; INCUMPLIDAS: number; SIN_RESP: number; FALLIDAS: number; CONVENIOS: number;
}

export function riesgoRaw(a: Alcance, idCliente?: number): Promise<RiesgoRaw[]> {
  return conConexion(async (conn) => {
    const doc = porRutaDoc(a);
    return ejecutar<RiesgoRaw>(conn,
      `SELECT c.ID_CLIENTE, c.NOMBRE, c.NIT, doc.SALDO_TOTAL, doc.SALDO_VENCIDO, doc.DOCS_VENC, doc.DIAS_MAX,
              pay.DIAS_PROM, NVL(prom.INCUMPLIDAS, 0) AS INCUMPLIDAS, NVL(ges.SIN_RESP, 0) AS SIN_RESP,
              NVL(vis.FALLIDAS, 0) AS FALLIDAS, NVL(conv.N, 0) AS CONVENIOS
         FROM CLIENTE c
         JOIN (SELECT d.ID_CLIENTE, SUM(d.SALDO) AS SALDO_TOTAL,
                      SUM(CASE WHEN d.FECHA_VENCIMIENTO < TRUNC(SYSDATE) THEN d.SALDO ELSE 0 END) AS SALDO_VENCIDO,
                      COUNT(CASE WHEN d.FECHA_VENCIMIENTO < TRUNC(SYSDATE) THEN 1 END) AS DOCS_VENC,
                      MAX(GREATEST(0, TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO)) AS DIAS_MAX
                 FROM CXC_DOCUMENTOS d WHERE ${ABIERTO}${doc} GROUP BY d.ID_CLIENTE) doc ON doc.ID_CLIENTE = c.ID_CLIENTE
         LEFT JOIN (SELECT d.ID_CLIENTE, ROUND(AVG(ap.FECHA_APLICACION - d.FECHA_VENCIMIENTO), 1) AS DIAS_PROM
                      FROM CXC_APLICACION_PAGOS ap JOIN CXC_DOCUMENTOS d ON d.ID_DOCUMENTO = ap.ID_DOCUMENTO
                     WHERE ap.ESTADO = 'CONFIRMADA' GROUP BY d.ID_CLIENTE) pay ON pay.ID_CLIENTE = c.ID_CLIENTE
         LEFT JOIN (SELECT pp.ID_CLIENTE, COUNT(*) AS INCUMPLIDAS FROM CXC_PROMESAS_PAGO pp
                     WHERE pp.ESTADO = 'INCUMPLIDA' OR (pp.ESTADO = 'PENDIENTE' AND pp.FECHA_COMPROMISO < TRUNC(SYSDATE))
                     GROUP BY pp.ID_CLIENTE) prom ON prom.ID_CLIENTE = c.ID_CLIENTE
         LEFT JOIN (SELECT g.ID_CLIENTE, COUNT(*) AS SIN_RESP FROM CXC_GESTIONES_COBRO g
                     WHERE REGEXP_LIKE(UPPER(NVL(g.RESULTADO, 'SIN_RESULTADO')), 'SIN_RESP|SIN_RESULT|NO_CONTEST|NO_LOCALIZ|BUZON|EQUIVOC')
                     GROUP BY g.ID_CLIENTE) ges ON ges.ID_CLIENTE = c.ID_CLIENTE
         LEFT JOIN (SELECT rd.ID_CLIENTE, COUNT(*) AS FALLIDAS FROM CXC_RUTA_DETALLE rd
                     WHERE rd.ESTADO_VISITA IN ('NO_ENCONTRADO', 'REPROGRAMADO') GROUP BY rd.ID_CLIENTE) vis ON vis.ID_CLIENTE = c.ID_CLIENTE
         LEFT JOIN (SELECT cv.ID_CLIENTE, COUNT(*) AS N FROM CXC_CONVENIOS_PAGO cv
                     WHERE cv.ESTADO = 'INCUMPLIDO' GROUP BY cv.ID_CLIENTE) conv ON conv.ID_CLIENTE = c.ID_CLIENTE
        WHERE doc.SALDO_TOTAL > 0 ${idCliente ? 'AND c.ID_CLIENTE = :idCliente' : ''}`,
      { ...bindsDe(a), idCliente });
  });
}

export function detalleCliente(idCliente: number) {
  return conConexion(async (conn) => {
    const b = { idCliente };
    const documentos = await ejecutar<{
      ID: number; SERIE: string | null; NUMERO: string | null; F: string; V: string; TOTAL: number; SALDO: number; ESTADO: string; DIAS: number;
    }>(conn,
      `SELECT d.ID_DOCUMENTO AS ID, d.SERIE, d.NUMERO_DOCUMENTO AS NUMERO, ${dia('d.FECHA_DOCUMENTO')} AS F, ${dia('d.FECHA_VENCIMIENTO')} AS V,
              d.TOTAL, d.SALDO, d.ESTADO, GREATEST(0, TRUNC(SYSDATE) - d.FECHA_VENCIMIENTO) AS DIAS
         FROM CXC_DOCUMENTOS d WHERE d.ID_CLIENTE = :idCliente
        ORDER BY CASE WHEN d.SALDO > 0 THEN 0 ELSE 1 END, d.FECHA_VENCIMIENTO FETCH FIRST 40 ROWS ONLY`, b);
    const pagos = await ejecutar<{ ID: number; F: string; MONTO: number; FORMA: string | null; REF: string | null; ESTADO: string }>(conn,
      `SELECT p.ID_PAGO AS ID, ${dia('p.FECHA_PAGO')} AS F, p.MONTO, fp.NOMBRE AS FORMA, p.NUMERO_REFERENCIA AS REF, p.ESTADO
         FROM CXC_PAGOS p LEFT JOIN CXC_FORMAS_PAGO fp ON fp.ID_FORMA_PAGO = p.ID_FORMA_PAGO
        WHERE p.ID_CLIENTE = :idCliente ORDER BY p.FECHA_PAGO DESC FETCH FIRST 20 ROWS ONLY`, b);
    const promesas = await ejecutar<{ ID: number; F: string; FC: string | null; MONTO: number; ESTADO: string; VENCIDA: number }>(conn,
      `SELECT pp.ID_PROMESA AS ID, ${dia('pp.FECHA_PROMESA')} AS F, ${dia('pp.FECHA_COMPROMISO')} AS FC, pp.MONTO_COMPROMETIDO AS MONTO, pp.ESTADO,
              CASE WHEN pp.ESTADO = 'PENDIENTE' AND pp.FECHA_COMPROMISO < TRUNC(SYSDATE) THEN 1 ELSE 0 END AS VENCIDA
         FROM CXC_PROMESAS_PAGO pp WHERE pp.ID_CLIENTE = :idCliente ORDER BY pp.FECHA_PROMESA DESC FETCH FIRST 20 ROWS ONLY`, b);
    const convenios = await ejecutar<{ ID: number; F: string | null; DEUDA: number; ESTADO: string }>(conn,
      `SELECT cv.ID_CONVENIO AS ID, ${dia('cv.FECHA_CONVENIO')} AS F, cv.MONTO_DEUDA AS DEUDA, cv.ESTADO
         FROM CXC_CONVENIOS_PAGO cv WHERE cv.ID_CLIENTE = :idCliente ORDER BY cv.FECHA_CONVENIO DESC FETCH FIRST 10 ROWS ONLY`, b);
    const visitas = await ejecutar<{ ID: number; CODIGO: string | null; F: string; EST: string | null; COBRADOR: string }>(conn,
      `SELECT r.ID_RUTA AS ID, r.CODIGO_RUTA AS CODIGO, ${dia('r.FECHA')} AS F, rd.ESTADO_VISITA AS EST, ${NOMBRE_EMP} AS COBRADOR
         FROM CXC_RUTA_DETALLE rd JOIN CXC_RUTAS r ON r.ID_RUTA = rd.ID_RUTA LEFT JOIN EMPLEADO e ON e.ID_EMPLEADO = r.ID_EMPLEADO
        WHERE rd.ID_CLIENTE = :idCliente ORDER BY r.FECHA DESC FETCH FIRST 15 ROWS ONLY`, b);
    const mapDoc = (r: (typeof documentos)[number]): DocumentoClienteDetalle => ({
      idDocumento: r.ID, referencia: [r.SERIE, r.NUMERO].filter(Boolean).join('-') || `#${r.ID}`, fecha: r.F, vencimiento: r.V,
      total: num(r.TOTAL), saldo: num(r.SALDO), estado: r.ESTADO, diasMora: r.SALDO > 0 ? num(r.DIAS) : 0,
    });
    return {
      documentos: documentos.map(mapDoc),
      pagos: pagos.map((r): PagoClienteDetalle => ({ idPago: r.ID, fecha: r.F, monto: num(r.MONTO), formaPago: r.FORMA, referencia: r.REF, estado: r.ESTADO })),
      promesas: promesas.map((r): PromesaClienteDetalle => ({ idPromesa: r.ID, fecha: r.F, fechaCompromiso: r.FC, monto: num(r.MONTO), estado: r.ESTADO, vencida: r.VENCIDA === 1 })),
      convenios: convenios.map((r): ConvenioClienteDetalle => ({ idConvenio: r.ID, fecha: r.F, deuda: num(r.DEUDA), estado: r.ESTADO })),
      visitas: visitas.map((r): VisitaClienteDetalle => ({ idRuta: r.ID, codigoRuta: r.CODIGO, fecha: r.F, estado: r.EST, cobrador: r.COBRADOR || '—' })),
    };
  });
}

/** Datos básicos de un cliente, para mostrar su ficha aunque hoy no tenga saldo pendiente. */
export function clienteBasico(idCliente: number): Promise<{ ID_CLIENTE: number; NOMBRE: string; NIT: string | null } | null> {
  return conConexion(async (conn) => {
    const r = await ejecutar<{ ID_CLIENTE: number; NOMBRE: string; NIT: string | null }>(conn,
      `SELECT ID_CLIENTE, NOMBRE, NIT FROM CLIENTE WHERE ID_CLIENTE = :idCliente`, { idCliente });
    return r[0] ?? null;
  });
}
