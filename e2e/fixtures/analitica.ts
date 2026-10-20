import type {
  Cliente360, ClienteRiesgo, ClientesRiesgoReporte, CobradorDetalle, CobradorRendimiento, CobradoresReporte, DiasCobroReporte,
  FactorRiesgo, NivelRiesgo, ResumenEjecutivo, RutaDetalleGrupo, RutasReporte,
} from '@erp/contracts';

/**
 * Datos de ejemplo con la misma forma que devuelve /api/cxc/analitica/*.
 * Sirven para probar las pantallas sin Oracle (pruebas e2e y capturas).
 */

const DESDE = '2026-07-20';
const HASTA = '2026-10-17';

const NOMBRES = ['Ana Morales', 'José Hernández', 'Sofía Castillo', 'Luis García', 'Andrea Pérez', 'Diego Ramírez', 'Gabriela Soto', 'Fernando López'];
const CLIENTES = [
  'Distribuidora Central, S.A.', 'Comercial Los Pinos, S.A.', 'Ferretería El Constructor', 'Farmacia San Rafael', 'Abarrotes La Esperanza',
  'Transportes Unidos, S.A.', 'Librería Universal', 'Panadería Santa Lucía', 'Servicios Médicos del Norte', 'Electrónica Zona 10',
];

function serie() {
  const out = [];
  for (let i = 0; i < 90; i += 1) {
    const d = new Date(Date.UTC(2026, 6, 20 + i));
    const dow = (d.getUTCDay() + 6) % 7;
    const base = dow === 4 ? 5200 : dow === 5 ? 3900 : dow < 5 ? 2100 : 600;
    const cobrado = Math.round(base * (0.7 + ((i * 37) % 60) / 100));
    const facturado = Math.round((dow < 5 ? 5200 : 900) * (0.6 + ((i * 53) % 70) / 100));
    out.push({ fecha: d.toISOString().slice(0, 10), cobrado, facturado });
  }
  return out;
}

function factores(score: number): FactorRiesgo[] {
  const k = score / 100;
  return [
    { id: 'antiguedad', etiqueta: 'Antigüedad de la deuda', maximo: 30, puntos: Math.round(30 * k * 10) / 10, detalle: 'Su documento más atrasado lleva 74 días vencido.' },
    { id: 'peso', etiqueta: 'Proporción vencida', maximo: 15, puntos: Math.round(15 * k * 10) / 10, detalle: '82 % de su saldo ya está vencido.' },
    { id: 'monto', etiqueta: 'Monto en juego', maximo: 15, puntos: Math.round(15 * k * 0.8 * 10) / 10, detalle: 'Q 8,420.00 vencidos, frente al mayor deudor de la cartera.' },
    { id: 'promesas', etiqueta: 'Promesas incumplidas', maximo: 15, puntos: 7.5, detalle: '1 promesa(s) de pago no se cumplieron.' },
    { id: 'historial', etiqueta: 'Historial de pago', maximo: 10, puntos: 6, detalle: 'Paga en promedio 18 días después del vencimiento.' },
    { id: 'contacto', etiqueta: 'Contacto fallido', maximo: 10, puntos: 5, detalle: '1 gestión(es) sin respuesta y 1 visita(s) fallida(s).' },
    { id: 'convenios', etiqueta: 'Convenios incumplidos', maximo: 5, puntos: 0, detalle: 'Sin convenios incumplidos.' },
  ];
}

const nivel = (s: number): NivelRiesgo => (s >= 70 ? 'CRITICO' : s >= 50 ? 'ALTO' : s >= 30 ? 'MEDIO' : 'BAJO');

function clientes(): ClienteRiesgo[] {
  const scores = [78, 64, 58, 51, 44, 41, 36, 29, 22, 15];
  return CLIENTES.map((nombre, i) => ({
    idCliente: i + 1, nombre, nit: `${1100001 + i * 7}-${i % 9}`,
    saldoTotal: 14000 - i * 900, saldoVencido: Math.max(0, 9800 - i * 1050), documentosVencidos: Math.max(0, 4 - Math.floor(i / 3)),
    diasMaxMora: 118 - i * 11, diasPromedioPago: i === 9 ? null : 24 - i * 3, promesasIncumplidas: i < 4 ? 2 : i < 7 ? 1 : 0,
    gestionesSinRespuesta: i < 5 ? 3 : 1, visitasFallidas: i < 3 ? 2 : 0, convenios: i === 0 ? 1 : 0,
    score: scores[i], nivel: nivel(scores[i]), factores: factores(scores[i]),
  }));
}

function cobradores(): CobradorRendimiento[] {
  const cobros = [18450, 14200, 11980, 9300, 6100, 3250, 1800, 0];
  const total = cobros.reduce((a, b) => a + b, 0);
  return NOMBRES.map((nombre, i) => ({
    idEmpleado: i + 3, nombre, codigo: `EMP${String(i + 3).padStart(3, '0')}`,
    cobrado: cobros[i], cobradoAnterior: Math.round(cobros[i] * (i % 3 === 0 ? 0.8 : i % 3 === 1 ? 1.25 : 0)),
    variacion: i % 3 === 2 || cobros[i] === 0 ? null : i % 3 === 0 ? 25 : -20, participacion: Math.round((cobros[i] / total) * 1000) / 10,
    pagos: Math.round(cobros[i] / 480), clientesCobrados: Math.max(0, Math.round(cobros[i] / 1300)), ticketPromedio: cobros[i] ? 480 : 0,
    gestiones: 40 - i * 4, gestionesEfectivas: Math.round((40 - i * 4) * (0.8 - i * 0.07)), efectividadGestion: Math.round((0.8 - i * 0.07) * 100),
    promesas: 12 - i, promesasCumplidas: Math.max(0, 8 - i), rutas: 6 - Math.floor(i / 2), paradas: 60 - i * 6, paradasVisitadas: Math.round((60 - i * 6) * (0.85 - i * 0.08)),
    efectividadRuta: Math.round((0.85 - i * 0.08) * 100), posicion: i + 1,
  }));
}

export function datosAnalitica() {
  const s = serie();
  const lista = cobradores();
  const cli = clientes();
  const totalCobrado = s.reduce((a, p) => a + p.cobrado, 0);
  const totalFacturado = s.reduce((a, p) => a + p.facturado, 0);

  const resumen: ResumenEjecutivo = {
    desde: DESDE, hasta: HASTA, desdeAnterior: '2026-04-21', hastaAnterior: '2026-07-19',
    kpis: {
      cobrado: { actual: totalCobrado, anterior: Math.round(totalCobrado * 0.88) },
      facturado: { actual: totalFacturado, anterior: Math.round(totalFacturado * 0.97) },
      indiceCobranza: { actual: Math.round((totalCobrado / totalFacturado) * 1000) / 10, anterior: 61.4 },
      pagosAplicados: { actual: 214, anterior: 190 },
      gestiones: { actual: 312, anterior: 280 },
    },
    cartera: { total: 189234.5, vencida: 140909.2, porcentajeVencida: 74.5, diasCartera: 96, documentosAbiertos: 52, clientesConSaldo: 49, clientesVencidos: 43 },
    serie: s,
    antiguedad: [
      { tramo: 'Al corriente', monto: 48325, documentos: 14 }, { tramo: '1 a 30 días', monto: 61200, documentos: 17 },
      { tramo: '31 a 60 días', monto: 42800, documentos: 12 }, { tramo: '61 a 90 días', monto: 24100, documentos: 6 }, { tramo: 'Más de 90 días', monto: 12809, documentos: 3 },
    ],
    topDeudores: cli.slice(0, 8).map((c) => ({ idCliente: c.idCliente, nombre: c.nombre, nit: c.nit, saldoTotal: c.saldoTotal, saldoVencido: c.saldoVencido, diasMaxMora: c.diasMaxMora, documentosVencidos: c.documentosVencidos })),
    formasPago: [{ formaPago: 'Transferencia', pagos: 96, monto: 61200 }, { formaPago: 'Efectivo', pagos: 78, monto: 38400 }, { formaPago: 'Cheque', pagos: 40, monto: 22950 }],
    gestionesPorResultado: [{ resultado: 'CONTACTADO', cantidad: 120 }, { resultado: 'COMPROMISO_PAGO', cantidad: 98 }, { resultado: 'SIN_RESPUESTA', cantidad: 94 }],
    promesas: [{ estado: 'PENDIENTE', cantidad: 34, monto: 28100 }, { estado: 'CUMPLIDA', cantidad: 21, monto: 17650 }, { estado: 'INCUMPLIDA', cantidad: 9, monto: 7400 }],
    vencimientosProximos: [
      { semana: 'Esta semana', desde: '2026-10-17', monto: 18400, documentos: 6 }, { semana: 'Próxima semana', desde: '2026-10-24', monto: 12900, documentos: 4 },
      { semana: 'En 2 semanas', desde: '2026-10-31', monto: 22100, documentos: 7 }, { semana: 'En 3 semanas', desde: '2026-11-07', monto: 9600, documentos: 3 },
    ],
    topCobradores: lista.slice(0, 5).map((c) => ({ idEmpleado: c.idEmpleado, nombre: c.nombre, cobrado: c.cobrado })),
    alertas: [
      { id: 'mas-90', severidad: 'critica', titulo: 'Cartera con más de 90 días de atraso', detalle: '3 documento(s) de 3 cliente(s) suman Q 12,809.00. Cuanto más antigua, menor la probabilidad de recuperarla.', destino: '/cxc/analisis/clientes-riesgo' },
      { id: 'promesas-vencidas', severidad: 'alta', titulo: 'Promesas de pago vencidas sin cumplir', detalle: '12 promesa(s) pasaron su fecha de compromiso y siguen pendientes. Conviene dar seguimiento hoy.', destino: '/cxc/cobranza/promesas-pago' },
      { id: 'vence-semana', severidad: 'media', titulo: 'Vencimientos en los próximos 7 días', detalle: '6 documento(s) por Q 18,400.00 vencen esta semana: es el momento de recordar el pago.', destino: '/cxc/documentos/documentos' },
    ],
  };

  const cobradoresRep: CobradoresReporte = {
    desde: DESDE, hasta: HASTA,
    totales: { cobrado: lista.reduce((a, c) => a + c.cobrado, 0), pagos: lista.reduce((a, c) => a + c.pagos, 0), gestiones: lista.reduce((a, c) => a + c.gestiones, 0), cobradoresActivos: 7 },
    cobradores: lista,
  };

  const cobradorDetalle: CobradorDetalle = {
    cobrador: lista[0],
    serie: s.map((p) => ({ fecha: p.fecha, cobrado: Math.round(p.cobrado * 0.35) })),
    pagos: CLIENTES.slice(0, 6).map((c, i) => ({ idAplicacion: i + 1, fecha: `2026-10-${String(14 - i).padStart(2, '0')}`, idCliente: i + 1, cliente: c, idDocumento: 100 + i, documento: `A-${1200 + i}`, monto: 1800 - i * 150, formaPago: i % 2 ? 'Efectivo' : 'Transferencia', referencia: i % 2 ? null : `TR-${5520 + i}` })),
    gestiones: CLIENTES.slice(0, 5).map((c, i) => ({ idGestion: i + 1, fecha: `2026-10-${String(15 - i).padStart(2, '0')}`, idCliente: i + 1, cliente: c, tipo: i % 2 ? 'LLAMADA' : 'VISITA', resultado: i % 3 ? 'CONTACTADO' : 'SIN_RESPUESTA', observacion: null, fechaCompromiso: null, montoCompromiso: i % 2 ? 1500 : null })),
    clientes: CLIENTES.slice(0, 6).map((c, i) => ({ idCliente: i + 1, nombre: c, cobrado: 4200 - i * 600, pagos: 5 - Math.floor(i / 2) })),
    rutas: [{ idRuta: 1, codigo: 'R-0001', nombre: 'Ruta Zona 1 #1', fecha: '2026-10-13', estado: 'COMPLETADA', paradas: 8, visitadas: 7 }, { idRuta: 31, codigo: 'R-0031', nombre: 'Ruta Zona 1 #31', fecha: '2026-10-06', estado: 'EN_PROCESO', paradas: 9, visitadas: 5 }],
  };

  const celdas = [];
  for (let d = 1; d <= 7; d += 1) for (let sm = 1; sm <= 5; sm += 1) {
    const peso = d === 5 ? 3 : d === 4 ? 2.4 : d <= 5 ? 1.2 : 0.3;
    celdas.push({ diaSemana: d, semanaMes: sm, cobrado: Math.round(peso * (900 + sm * 380 + ((d * sm * 71) % 500))), pagos: Math.round(peso * 3) });
  }
  const nombresDia = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const totalDia = (d: number) => celdas.filter((c) => c.diaSemana === d).reduce((a, c) => a + c.cobrado, 0);
  const total = celdas.reduce((a, c) => a + c.cobrado, 0);
  const porDiaSemana = nombresDia.map((etiqueta, i) => ({ valor: i + 1, etiqueta, cobrado: totalDia(i + 1), pagos: Math.round(totalDia(i + 1) / 480), diasConCobro: 12, promedio: Math.round(totalDia(i + 1) / 13), participacion: Math.round((totalDia(i + 1) / total) * 1000) / 10 }));
  const porDiaMes = Array.from({ length: 31 }, (_, i) => {
    const v = i + 1; const c = v === 15 || v === 30 ? 9200 : v === 1 || v === 16 ? 5400 : 1200 + ((v * 331) % 2600);
    return { valor: v, etiqueta: String(v), cobrado: c, pagos: Math.round(c / 480), diasConCobro: 3, promedio: Math.round(c / 3), participacion: Math.round((c / 80000) * 1000) / 10 };
  });
  const diasCobro: DiasCobroReporte = {
    desde: DESDE, hasta: HASTA, totalCobrado: total, porDiaSemana, porDiaMes, calor: celdas,
    mejorDiaSemana: [...porDiaSemana].sort((a, b) => b.promedio - a.promedio)[0], peorDiaSemana: [...porDiaSemana].sort((a, b) => a.promedio - b.promedio)[0],
    mejorDiaMes: porDiaMes[14],
    mejoresFechas: [{ fecha: '2026-09-30', cobrado: 12400, pagos: 19 }, { fecha: '2026-10-15', cobrado: 11800, pagos: 17 }, { fecha: '2026-09-15', cobrado: 10250, pagos: 14 }, { fecha: '2026-08-31', cobrado: 9100, pagos: 12 }, { fecha: '2026-10-01', cobrado: 7600, pagos: 10 }],
  };

  const zonas = ['Ruta Zona 1', 'Ruta Zona 11', 'Ruta Mixco', 'Ruta Villa Nueva', 'Ruta Petapa', 'Ruta Centro Histórico'];
  const rutas: RutasReporte = {
    desde: DESDE, hasta: HASTA,
    totales: { rutas: 35, recurrentes: 5, paradas: 210, visitadas: 138, efectividad: 65.7 },
    rutas: zonas.map((base, i) => ({
      base, veces: 6 - i, cobradores: 3 - Math.floor(i / 3), primeraFecha: '2026-08-04', ultimaFecha: '2026-10-13', frecuenciaDias: i === 5 ? null : 9 + i * 3,
      paradas: 48 - i * 6, visitadas: Math.round((48 - i * 6) * (0.8 - i * 0.1)), noEncontrados: 3 + i, reprogramadas: 2, efectividad: Math.round((0.8 - i * 0.1) * 1000) / 10,
      montoPendiente: 26050 - i * 3800, completadas: 4 - Math.floor(i / 2), canceladas: i % 2,
    })),
    clientesRecurrentes: CLIENTES.slice(0, 6).map((nombre, i) => ({ idCliente: i + 1, nombre, veces: 5 - Math.floor(i / 2), visitadas: 2, noEncontrado: 3 - Math.floor(i / 2), saldoVencido: 9800 - i * 1050 })),
    porEstado: [{ estado: 'COMPLETADA', cantidad: 18 }, { estado: 'PLANIFICADA', cantidad: 9 }, { estado: 'EN_PROCESO', cantidad: 5 }, { estado: 'CANCELADA', cantidad: 3 }],
  };
  const rutaDetalle: RutaDetalleGrupo = {
    base: 'Ruta Zona 1',
    salidas: [1, 2, 3].map((n) => ({ idRuta: n, codigo: `R-00${n}1`, nombre: `Ruta Zona 1 #${n}1`, fecha: `2026-10-${String(13 - n * 3).padStart(2, '0')}`, estado: n === 1 ? 'COMPLETADA' : 'PLANIFICADA', idEmpleado: n + 2, cobrador: NOMBRES[n - 1], paradas: 8, visitadas: 8 - n * 2, montoPendiente: 6400 - n * 900 })),
    paradas: CLIENTES.slice(0, 6).map((c, i) => ({ idRuta: 1, codigoRuta: 'R-0001', fecha: '2026-10-13', idCliente: i + 1, cliente: c, estadoVisita: i % 3 ? 'VISITADO' : 'NO_ENCONTRADO', montoPendiente: 2100 - i * 200, observaciones: null })),
  };

  const riesgo: ClientesRiesgoReporte = {
    totales: { clientes: cli.length, criticos: cli.filter((c) => c.nivel === 'CRITICO').length, altos: cli.filter((c) => c.nivel === 'ALTO').length, medios: cli.filter((c) => c.nivel === 'MEDIO').length, bajos: cli.filter((c) => c.nivel === 'BAJO').length, saldoVencido: cli.reduce((a, c) => a + c.saldoVencido, 0), saldoEnRiesgo: cli.filter((c) => c.nivel === 'CRITICO' || c.nivel === 'ALTO').reduce((a, c) => a + c.saldoVencido, 0) },
    clientes: cli,
  };

  const cliente: Cliente360 = {
    riesgo: cli[0],
    documentos: [1, 2, 3, 4].map((n) => ({ idDocumento: n, referencia: `A-${1200 + n}`, fecha: `2026-0${6 + n}-05`, vencimiento: `2026-0${6 + n}-20`, total: 3200, saldo: n === 4 ? 0 : 3200 - n * 300, estado: n === 4 ? 'PAGADO' : 'PENDIENTE', diasMora: n === 4 ? 0 : 118 - n * 25 })),
    pagos: [{ idPago: 1, fecha: '2026-09-12', monto: 1500, formaPago: 'Transferencia', referencia: 'TR-4431', estado: 'APLICADO' }],
    promesas: [{ idPromesa: 1, fecha: '2026-09-01', fechaCompromiso: '2026-09-15', monto: 2500, estado: 'PENDIENTE', vencida: true }, { idPromesa: 2, fecha: '2026-08-02', fechaCompromiso: '2026-08-10', monto: 1800, estado: 'INCUMPLIDA', vencida: false }],
    convenios: [{ idConvenio: 1, fecha: '2026-08-20', deuda: 6400, estado: 'INCUMPLIDO' }],
    gestiones: [{ idGestion: 1, fecha: '2026-10-08', idCliente: 1, cliente: CLIENTES[0], tipo: 'LLAMADA', resultado: 'SIN_RESPUESTA', observacion: 'No contestó, se dejó mensaje.', fechaCompromiso: null, montoCompromiso: null }],
    visitas: [{ idRuta: 1, codigoRuta: 'R-0001', fecha: '2026-10-13', estado: 'NO_ENCONTRADO', cobrador: NOMBRES[0] }],
  };

  return { filtros: { cobradores: lista.map((c) => ({ idEmpleado: c.idEmpleado, nombre: c.nombre, codigo: c.codigo })), rutas: zonas.map((n, i) => ({ idRuta: i + 1, codigo: `R-000${i + 1}`, nombre: `${n} #${i + 1}` })) }, resumen, cobradores: cobradoresRep, cobradorDetalle, diasCobro, diasDetalle: cobradorDetalle.pagos, rutas, rutaDetalle, riesgo, cliente };
}

/** Registra las rutas de la API de análisis en una página de Playwright. */
export async function simularAnalitica(page: import('@playwright/test').Page) {
  const d = datosAnalitica();
  const json = (body: unknown) => (route: import('@playwright/test').Route) => route.fulfill({ json: body });
  await page.route('**/localhost:3000/api/cxc/analitica/filtros', json(d.filtros));
  await page.route('**/localhost:3000/api/cxc/analitica/resumen*', json(d.resumen));
  await page.route('**/localhost:3000/api/cxc/analitica/cobradores', json(d.cobradores));
  await page.route('**/localhost:3000/api/cxc/analitica/cobradores?*', json(d.cobradores));
  await page.route('**/localhost:3000/api/cxc/analitica/cobradores/*', json(d.cobradorDetalle));
  await page.route('**/localhost:3000/api/cxc/analitica/dias-cobro?*', json(d.diasCobro));
  await page.route('**/localhost:3000/api/cxc/analitica/dias-cobro/detalle*', json(d.diasDetalle));
  await page.route('**/localhost:3000/api/cxc/analitica/rutas?*', json(d.rutas));
  await page.route('**/localhost:3000/api/cxc/analitica/rutas/detalle*', json(d.rutaDetalle));
  await page.route('**/localhost:3000/api/cxc/analitica/clientes-riesgo*', json(d.riesgo));
  await page.route('**/localhost:3000/api/cxc/analitica/clientes/*', json(d.cliente));
}

/** Respuestas vacías pero con la forma correcta de los reportes clásicos (para auditar sin Oracle). */
export async function simularReportesVacios(page: import('@playwright/test').Page) {
  const json = (body: unknown) => (route: import('@playwright/test').Route) => route.fulfill({ json: body });
  const cero = { corriente: 0, dias1a30: 0, dias31a60: 0, dias61a90: 0, mas90: 0, total: 0 };
  await page.route('**/localhost:3000/api/cxc/reportes/antiguedad-saldos', json({ clientes: [], totales: cero }));
  await page.route('**/localhost:3000/api/cxc/reportes/libro-ventas*', json({ anio: 2026, mes: 10, filas: [], totales: { facturas: 0, anuladas: 0, baseGravada: 0, iva: 0, total: 0 } }));
  await page.route('**/localhost:3000/api/cxc/reportes/estadistica-ventas*', json({
    desde: '2026-07-01', hasta: '2026-10-17', totales: { facturas: 0, anuladas: 0, ventaNeta: 0, iva: 0, ventaTotal: 0, ticketPromedio: 0 }, porMes: [], topClientes: [], porCondicion: [],
  }));
  await page.route('**/localhost:3000/api/cxc/reportes/estadistica-cobranza*', json({
    desde: '2026-07-01', hasta: '2026-10-17', totales: { facturado: 0, cobrado: 0, indiceCobranza: 0, carteraTotal: 0, carteraVencida: 0, porcentajeVencida: 0, diasCartera: 0 },
    porMes: [], porFormaPago: [], promesas: [], gestiones: [], convenios: [],
  }));
  await page.route(/localhost:3000\/api\/cxc\/rutas\/\d+$/, json({ idRuta: 1, codigoRuta: 'R-0001', nombre: 'Ruta de prueba', idEmpleado: 3, nombreEmpleado: 'Ana Morales', fecha: '2026-10-10', estado: 'PLANIFICADA', observaciones: '' }));
  // Catálogos y sublistas de las pantallas de detalle devuelven arreglos, no páginas.
  await page.route('**/localhost:3000/api/cxc/catalogos/**', json([]));
  await page.route(/localhost:3000\/api\/cxc\/[a-z-]+\/\d+\/[a-z-]+/, json([]));
  await page.route(/localhost:3000\/api\/cxc\/rutas-(documentos-pendientes|pagos-disponibles)/, json([]));
  await page.route(/localhost:3000\/api\/cxc\/rutas\/\d+\/operacion/, json({ asignaciones: [], bitacora: [], cobradores: [] }));
}
