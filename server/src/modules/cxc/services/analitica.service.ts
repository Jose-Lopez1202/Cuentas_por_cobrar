import type {
  AlertaAnalitica, Cliente360, ClienteRiesgo, ClientesRiesgoReporte, CobradorDetalle, CobradorRendimiento, CobradoresReporte,
  DiaCobro, DiasCobroReporte, FactorRiesgo, NivelRiesgo, PagoAplicadoDetalle, ResumenEjecutivo, RutaDetalleGrupo, RutasReporte,
} from '@erp/contracts';
import { businessTodayIso } from '../../../shared/date';
import { BadRequestError, NotFoundError } from '../../../shared/errors/AppError';
import * as repo from '../repositories/analitica.repository';
import { num, round2, type Alcance } from '../repositories/analitica.repository';

// --- Filtros y períodos -----------------------------------------------------------------------

const MAX_DIAS = 400;
const DIA_MS = 86_400_000;

function esFecha(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}
const aIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const aMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

function entero(v: unknown, nombre: string): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestError(`El filtro "${nombre}" no es válido.`);
  return n;
}

export interface QueryFiltros {
  desde?: unknown; hasta?: unknown; idEmpleado?: unknown; idRuta?: unknown;
  idCliente?: unknown; idFormaPago?: unknown; diaSemana?: unknown; diaMes?: unknown; tramo?: unknown; baseRuta?: unknown;
}

function rango(v: unknown, nombre: string, max: number): number | undefined {
  const n = entero(v, nombre);
  if (n !== undefined && n > max) throw new BadRequestError(`El filtro "${nombre}" está fuera de rango.`);
  return n;
}

/** Valida los filtros y calcula el período anterior (misma duración, inmediatamente antes). */
export function resolverAlcance(q: QueryFiltros): Alcance {
  const hoy = businessTodayIso();
  const hasta = typeof q.hasta === 'string' && q.hasta ? q.hasta : hoy;
  const desde = typeof q.desde === 'string' && q.desde ? q.desde : aIso(aMs(hasta) - 89 * DIA_MS);
  if (!esFecha(desde)) throw new BadRequestError('La fecha "desde" no es válida (usa AAAA-MM-DD).');
  if (!esFecha(hasta)) throw new BadRequestError('La fecha "hasta" no es válida (usa AAAA-MM-DD).');
  if (desde > hasta) throw new BadRequestError('La fecha "desde" no puede ser posterior a "hasta".');
  const dias = Math.round((aMs(hasta) - aMs(desde)) / DIA_MS) + 1;
  if (dias > MAX_DIAS) throw new BadRequestError(`El período no puede superar ${MAX_DIAS} días. Elige un rango más corto.`);
  return {
    desde, hasta,
    desdeAnt: aIso(aMs(desde) - dias * DIA_MS),
    hastaAnt: aIso(aMs(desde) - DIA_MS),
    idEmpleado: entero(q.idEmpleado, 'cobrador'),
    idRuta: entero(q.idRuta, 'ruta'),
    idCliente: entero(q.idCliente, 'cliente'),
    idFormaPago: entero(q.idFormaPago, 'forma de pago'),
    diaSemana: rango(q.diaSemana, 'día de la semana', 7),
    diaMes: rango(q.diaMes, 'día del mes', 31),
    tramo: rango(q.tramo, 'tramo', 5),
    baseRuta: typeof q.baseRuta === 'string' && q.baseRuta.trim() ? q.baseRuta.trim().slice(0, 150) : undefined,
  };
}

const enPeriodo = (f: string, desde: string, hasta: string) => f >= desde && f <= hasta;
const porcentaje = (parte: number, total: number) => (total > 0 ? round2((parte / total) * 100) : 0);

// --- Panel ejecutivo ---------------------------------------------------------------------------------

export async function resumenEjecutivo(q: QueryFiltros): Promise<ResumenEjecutivo> {
  const a = resolverAlcance(q);
  const raw = await repo.resumenRaw(a);

  let cobrado = 0, cobradoAnt = 0, pagos = 0, pagosAnt = 0, facturado = 0, facturadoAnt = 0, gestiones = 0, gestionesAnt = 0;
  const porDia = new Map<string, { cobrado: number; facturado: number }>();
  const dia = (f: string) => { const v = porDia.get(f) ?? { cobrado: 0, facturado: 0 }; porDia.set(f, v); return v; };

  for (const r of raw.cobradoDia) {
    if (enPeriodo(r.F, a.desde, a.hasta)) { cobrado += num(r.M); pagos += num(r.N); dia(r.F).cobrado += num(r.M); }
    else if (enPeriodo(r.F, a.desdeAnt, a.hastaAnt)) { cobradoAnt += num(r.M); pagosAnt += num(r.N); }
  }
  for (const r of raw.facturadoDia) {
    if (enPeriodo(r.F, a.desde, a.hasta)) { facturado += num(r.M); dia(r.F).facturado += num(r.M); }
    else if (enPeriodo(r.F, a.desdeAnt, a.hastaAnt)) facturadoAnt += num(r.M);
  }
  for (const r of raw.gestionesDia) {
    if (enPeriodo(r.F, a.desde, a.hasta)) gestiones += num(r.N);
    else if (enPeriodo(r.F, a.desdeAnt, a.hastaAnt)) gestionesAnt += num(r.N);
  }

  // Serie continua: un punto por día del período (los días sin movimiento valen 0).
  const serie = [];
  for (let t = aMs(a.desde); t <= aMs(a.hasta); t += DIA_MS) {
    const f = aIso(t);
    const v = porDia.get(f);
    serie.push({ fecha: f, cobrado: round2(v?.cobrado ?? 0), facturado: round2(v?.facturado ?? 0) });
  }

  const c = raw.cartera;
  const carteraTotal = num(c?.TOTAL);
  const carteraVencida = num(c?.VENCIDA);
  const dias = Math.round((aMs(a.hasta) - aMs(a.desde)) / DIA_MS) + 1;
  // Con una selección sobre el cobro (cobrador, forma de pago, día) la facturación ya no es comparable.
  const filtraCobrador = Boolean(a.idEmpleado || a.idFormaPago || a.diaSemana || a.diaMes);

  const cartera = {
    total: round2(carteraTotal),
    vencida: round2(carteraVencida),
    porcentajeVencida: porcentaje(carteraVencida, carteraTotal),
    diasCartera: facturado > 0 ? Math.round(carteraTotal / (facturado / dias)) : 0,
    documentosAbiertos: num(c?.DOCS),
    clientesConSaldo: num(c?.CLIENTES),
    clientesVencidos: num(c?.CLIENTES_VENC),
  };

  const alertas: AlertaAnalitica[] = [];
  const m90 = raw.docsMasDe90;
  if (num(m90?.N) > 0) {
    alertas.push({
      id: 'mas-90', severidad: 'critica', titulo: 'Cartera con más de 90 días de atraso',
      detalle: `${num(m90.N)} documento(s) de ${num(m90.CLIENTES)} cliente(s) suman ${fmtQ(num(m90.MONTO))}. Cuanto más antigua, menor la probabilidad de recuperarla.`,
      destino: '/cxc/analisis/clientes-riesgo',
    });
  }
  if (raw.promesasVencidas > 0) {
    alertas.push({
      id: 'promesas-vencidas', severidad: 'alta', titulo: 'Promesas de pago vencidas sin cumplir',
      detalle: `${raw.promesasVencidas} promesa(s) pasaron su fecha de compromiso y siguen pendientes. Conviene dar seguimiento hoy.`,
      destino: '/cxc/cobranza/promesas-pago',
    });
  }
  const proxima = raw.vencimientos.find((v) => num(v.SEMANA) === 0);
  if (proxima && num(proxima.MONTO) > 0) {
    alertas.push({
      id: 'vence-semana', severidad: 'media', titulo: 'Vencimientos en los próximos 7 días',
      detalle: `${num(proxima.DOCS)} documento(s) por ${fmtQ(num(proxima.MONTO))} vencen esta semana: es el momento de recordar el pago.`,
      destino: '/cxc/documentos/documentos',
    });
  }
  if (!filtraCobrador && facturadoAnt > 0 && facturado > 0) {
    const idx = cobrado / facturado, idxAnt = cobradoAnt / facturadoAnt;
    if (idxAnt > 0 && idx < idxAnt * 0.9) {
      alertas.push({
        id: 'indice-baja', severidad: 'alta', titulo: 'El índice de cobranza está bajando',
        detalle: `Pasó de ${round2(idxAnt * 100)} % a ${round2(idx * 100)} % contra el período anterior: se está cobrando menos de lo que se factura.`,
        destino: '/cxc/analisis/cobradores',
      });
    }
  }
  if (cartera.porcentajeVencida >= 40) {
    alertas.push({
      id: 'vencida-alta', severidad: 'alta', titulo: 'Alta proporción de cartera vencida',
      detalle: `${cartera.porcentajeVencida} % de la cartera (${fmtQ(cartera.vencida)}) ya está vencida.`,
      destino: '/cxc/reportes/antiguedad-saldos',
    });
  }
  const orden = { critica: 0, alta: 1, media: 2, info: 3 } as const;
  alertas.sort((x, y) => orden[x.severidad] - orden[y.severidad]);

  return {
    desde: a.desde, hasta: a.hasta, desdeAnterior: a.desdeAnt, hastaAnterior: a.hastaAnt,
    kpis: {
      cobrado: { actual: round2(cobrado), anterior: round2(cobradoAnt) },
      facturado: { actual: round2(facturado), anterior: round2(facturadoAnt) },
      indiceCobranza: filtraCobrador ? null : { actual: porcentaje(cobrado, facturado), anterior: porcentaje(cobradoAnt, facturadoAnt) },
      pagosAplicados: { actual: pagos, anterior: pagosAnt },
      gestiones: { actual: gestiones, anterior: gestionesAnt },
    },
    cartera,
    serie,
    antiguedad: TRAMOS.map((nombre, i) => {
      const f = raw.antiguedad.find((r) => num(r.ORDEN) === i + 1);
      return { orden: i + 1, tramo: nombre, monto: round2(num(f?.MONTO)), documentos: num(f?.DOCS) };
    }),
    topDeudores: raw.deudores.map((r) => ({
      idCliente: r.ID_CLIENTE, nombre: r.NOMBRE, nit: r.NIT, saldoTotal: round2(num(r.SALDO)), saldoVencido: round2(num(r.VENCIDO)),
      diasMaxMora: num(r.DIAS), documentosVencidos: num(r.DOCS_VENC),
    })),
    formasPago: raw.formas.map((r) => ({ idFormaPago: r.ID, formaPago: r.FORMA, pagos: num(r.PAGOS), monto: round2(num(r.MONTO)) })),
    gestionesPorResultado: raw.gestionesResultado.map((r) => ({ resultado: r.RESULTADO, cantidad: num(r.N) })),
    promesas: raw.promesas.map((r) => ({ estado: r.ESTADO, cantidad: num(r.N), monto: round2(num(r.MONTO)) })),
    vencimientosProximos: raw.vencimientos.map((r) => ({ semana: semanaEtiqueta(num(r.SEMANA)), desde: r.DESDE, monto: round2(num(r.MONTO)), documentos: num(r.DOCS) })),
    topCobradores: raw.topCobradores.map((r) => ({ idEmpleado: r.ID, nombre: r.NOMBRE, cobrado: round2(num(r.MONTO)) })),
    alertas,
  };
}

const TRAMOS = ['Al corriente', '1 a 30 días', '31 a 60 días', '61 a 90 días', 'Más de 90 días'];
const fmtQ = (n: number) => `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const semanaEtiqueta = (n: number) => (n === 0 ? 'Esta semana' : n === 1 ? 'Próxima semana' : `En ${n} semanas`);

// --- Cobradores -----------------------------------------------------------------------------------------

function armarCobradores(raw: Awaited<ReturnType<typeof repo.cobradoresRaw>>): CobradorRendimiento[] {
  const mapa = new Map<number, CobradorRendimiento>();
  const nombre = new Map(raw.nombres.map((n) => [n.ID, n]));
  const obtener = (id: number, nom?: string, cod?: string | null): CobradorRendimiento => {
    let c = mapa.get(id);
    if (!c) {
      const n = nombre.get(id);
      c = {
        idEmpleado: id, nombre: nom || n?.NOMBRE || `Empleado ${id}`, codigo: cod ?? n?.CODIGO ?? null,
        cobrado: 0, cobradoAnterior: 0, variacion: null, participacion: 0, pagos: 0, clientesCobrados: 0, ticketPromedio: 0,
        gestiones: 0, gestionesEfectivas: 0, efectividadGestion: 0, promesas: 0, promesasCumplidas: 0,
        rutas: 0, paradas: 0, paradasVisitadas: 0, efectividadRuta: 0, posicion: 0,
      };
      mapa.set(id, c);
    }
    return c;
  };
  raw.cobros.forEach((r) => {
    const c = obtener(r.ID, r.NOMBRE, r.CODIGO);
    c.cobrado = round2(num(r.COBRADO)); c.cobradoAnterior = round2(num(r.COBRADO_ANT)); c.pagos = num(r.PAGOS); c.clientesCobrados = num(r.CLIENTES);
  });
  raw.gestiones.forEach((r) => { const c = obtener(r.ID); c.gestiones = num(r.TOTAL); c.gestionesEfectivas = num(r.EFECTIVAS); });
  raw.promesas.forEach((r) => { const c = obtener(r.ID); c.promesas = num(r.TOTAL); c.promesasCumplidas = num(r.CUMPLIDAS); });
  raw.rutas.forEach((r) => { const c = obtener(r.ID); c.rutas = num(r.RUTAS); c.paradas = num(r.PARADAS); c.paradasVisitadas = num(r.VISITADAS); });

  const lista = [...mapa.values()];
  const total = lista.reduce((acc, c) => acc + c.cobrado, 0);
  lista.forEach((c) => {
    c.ticketPromedio = c.pagos > 0 ? round2(c.cobrado / c.pagos) : 0;
    c.efectividadGestion = porcentaje(c.gestionesEfectivas, c.gestiones);
    c.efectividadRuta = porcentaje(c.paradasVisitadas, c.paradas);
    c.participacion = porcentaje(c.cobrado, total);
    c.variacion = c.cobradoAnterior > 0 ? round2(((c.cobrado - c.cobradoAnterior) / c.cobradoAnterior) * 100) : null;
  });
  lista.sort((x, y) => y.cobrado - x.cobrado || y.gestiones - x.gestiones || x.nombre.localeCompare(y.nombre));
  lista.forEach((c, i) => { c.posicion = i + 1; });
  return lista;
}

export async function cobradores(q: QueryFiltros): Promise<CobradoresReporte> {
  const a = resolverAlcance({ ...q, idEmpleado: undefined });
  const lista = armarCobradores(await repo.cobradoresRaw(a));
  return {
    desde: a.desde, hasta: a.hasta,
    totales: {
      cobrado: round2(lista.reduce((s, c) => s + c.cobrado, 0)),
      pagos: lista.reduce((s, c) => s + c.pagos, 0),
      gestiones: lista.reduce((s, c) => s + c.gestiones, 0),
      cobradoresActivos: lista.filter((c) => c.cobrado > 0 || c.gestiones > 0 || c.rutas > 0).length,
    },
    cobradores: lista,
  };
}

export async function cobradorDetalle(idEmpleado: number, q: QueryFiltros): Promise<CobradorDetalle> {
  const a = resolverAlcance({ ...q, idEmpleado: undefined });
  const [raw, extra, pagos, gestiones] = await Promise.all([
    repo.cobradoresRaw(a, idEmpleado),
    repo.detalleCobrador(a, idEmpleado),
    repo.pagosAplicados(a, { idEmpleado }, 150),
    repo.gestiones(a, { idEmpleado }, 100),
  ]);
  const cobrador = armarCobradores(raw).find((c) => c.idEmpleado === idEmpleado);
  if (!cobrador) throw new NotFoundError('Este cobrador no tiene actividad en el período seleccionado.');

  const porDia = new Map(extra.serie.map((s) => [s.fecha, s.cobrado]));
  const serie = [];
  for (let t = aMs(a.desde); t <= aMs(a.hasta); t += DIA_MS) serie.push({ fecha: aIso(t), cobrado: round2(porDia.get(aIso(t)) ?? 0) });
  return { cobrador, serie, pagos, gestiones, clientes: extra.clientes, rutas: extra.rutas };
}

// --- Días de cobro ---------------------------------------------------------------------------------------

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export async function diasCobro(q: QueryFiltros): Promise<DiasCobroReporte> {
  const a = resolverAlcance(q);
  // El gráfico por día de la semana no se filtra por el día elegido (sigue mostrando todos); igual el del mes.
  const [filas, filasSemana, filasMes] = await Promise.all([
    repo.cobradoPorFecha(a),
    a.diaSemana ? repo.cobradoPorFecha({ ...a, diaSemana: undefined }) : null,
    a.diaMes ? repo.cobradoPorFecha({ ...a, diaMes: undefined }) : null,
  ]);
  const paraSemana = filasSemana ?? filas;
  const paraMes = filasMes ?? filas;
  const suma = (f: typeof filas) => round2(f.reduce((s, x) => s + x.cobrado, 0));
  const total = suma(filas);

  // Cuántas veces ocurre cada día de la semana / del mes dentro del período (para promediar bien).
  const ocurrenciaSemana = new Array(8).fill(0);
  const ocurrenciaMes = new Array(32).fill(0);
  for (let t = aMs(a.desde); t <= aMs(a.hasta); t += DIA_MS) {
    const d = new Date(t);
    ocurrenciaSemana[((d.getUTCDay() + 6) % 7) + 1] += 1;
    ocurrenciaMes[d.getUTCDate()] += 1;
  }

  const semana = Array.from({ length: 7 }, () => ({ cobrado: 0, pagos: 0, dias: 0 }));
  const mes = Array.from({ length: 31 }, () => ({ cobrado: 0, pagos: 0, dias: 0 }));
  const calor = new Map<string, { cobrado: number; pagos: number }>();
  for (const f of paraSemana) {
    const d = new Date(`${f.fecha}T00:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
    semana[dow].cobrado += f.cobrado; semana[dow].pagos += f.pagos; semana[dow].dias += 1;
    const k = `${dow + 1}-${Math.ceil(d.getUTCDate() / 7)}`;
    const c = calor.get(k) ?? { cobrado: 0, pagos: 0 };
    c.cobrado += f.cobrado; c.pagos += f.pagos; calor.set(k, c);
  }
  for (const f of paraMes) {
    const dm = new Date(`${f.fecha}T00:00:00Z`).getUTCDate();
    mes[dm - 1].cobrado += f.cobrado; mes[dm - 1].pagos += f.pagos; mes[dm - 1].dias += 1;
  }

  const aDia = (valor: number, etiqueta: string, v: { cobrado: number; pagos: number; dias: number }, ocurrencias: number, base: number): DiaCobro => ({
    valor, etiqueta, cobrado: round2(v.cobrado), pagos: v.pagos, diasConCobro: v.dias,
    promedio: ocurrencias > 0 ? round2(v.cobrado / ocurrencias) : 0, participacion: porcentaje(v.cobrado, base),
  });
  const totalSemana = suma(paraSemana), totalMes = suma(paraMes);
  const porDiaSemana = semana.map((v, i) => aDia(i + 1, DIAS_SEMANA[i], v, ocurrenciaSemana[i + 1], totalSemana));
  const porDiaMes = mes.map((v, i) => aDia(i + 1, String(i + 1), v, ocurrenciaMes[i + 1], totalMes));

  const mejor = (arr: DiaCobro[]) => arr.filter((d) => d.promedio > 0).sort((x, y) => y.promedio - x.promedio)[0] ?? null;
  const peor = (arr: DiaCobro[]) => arr.filter((d) => d.promedio >= 0).sort((x, y) => x.promedio - y.promedio)[0] ?? null;

  const celdas = [];
  for (let d = 1; d <= 7; d += 1) for (let s = 1; s <= 5; s += 1) {
    const c = calor.get(`${d}-${s}`);
    celdas.push({ diaSemana: d, semanaMes: s, cobrado: round2(c?.cobrado ?? 0), pagos: c?.pagos ?? 0 });
  }

  return {
    desde: a.desde, hasta: a.hasta, totalCobrado: total, porDiaSemana, porDiaMes, calor: celdas,
    mejorDiaSemana: mejor(porDiaSemana), peorDiaSemana: ocurrenciaSemana.slice(1).every((n) => n > 0) ? peor(porDiaSemana) : null,
    mejorDiaMes: mejor(porDiaMes),
    mejoresFechas: [...filas].sort((x, y) => y.cobrado - x.cobrado).slice(0, 5).map((f) => ({ fecha: f.fecha, cobrado: round2(f.cobrado), pagos: f.pagos })),
  };
}

export async function diasCobroDetalle(q: QueryFiltros & { tipo?: unknown; valor?: unknown }): Promise<PagoAplicadoDetalle[]> {
  const a = resolverAlcance(q);
  const tipo = String(q.tipo ?? '');
  if (tipo === 'semana') {
    const v = entero(q.valor, 'día');
    if (!v || v > 7) throw new BadRequestError('El día de la semana debe estar entre 1 y 7.');
    return repo.pagosAplicados(a, { cond: `AND TRUNC(ap.FECHA_APLICACION) - TRUNC(ap.FECHA_APLICACION, 'IW') + 1 = :valor`, binds: { valor: v } }, 300);
  }
  if (tipo === 'mes') {
    const v = entero(q.valor, 'día');
    if (!v || v > 31) throw new BadRequestError('El día del mes debe estar entre 1 y 31.');
    return repo.pagosAplicados(a, { cond: `AND TO_NUMBER(TO_CHAR(ap.FECHA_APLICACION, 'DD')) = :valor`, binds: { valor: v } }, 300);
  }
  if (tipo === 'fecha') {
    const f = String(q.valor ?? '');
    if (!esFecha(f)) throw new BadRequestError('La fecha no es válida.');
    return repo.pagosAplicados(a, { cond: `AND TO_CHAR(ap.FECHA_APLICACION, 'YYYY-MM-DD') = :fechaExacta`, binds: { fechaExacta: f } }, 300);
  }
  if (tipo === 'periodo') {
    const p = String(q.valor ?? '');
    if (!/^\d{4}-\d{2}$/.test(p)) throw new BadRequestError('El período debe tener el formato AAAA-MM.');
    return repo.pagosAplicados(a, { cond: `AND TO_CHAR(ap.FECHA_APLICACION, 'YYYY-MM') = :periodoExacto`, binds: { periodoExacto: p } }, 300);
  }
  throw new BadRequestError('Indica el tipo de detalle: semana, mes, fecha o periodo.');
}

// --- Rutas -----------------------------------------------------------------------------------------------------

function agruparRutas(filas: Awaited<ReturnType<typeof repo.rutasRaw>>['filas']) {
  const grupos = new Map<string, typeof filas>();
  filas.forEach((f) => { const l = grupos.get(f.BASE) ?? []; l.push(f); grupos.set(f.BASE, l); });
  return [...grupos.entries()].map(([base, items]) => {
    const fechas = items.map((i) => i.F).sort();
    let frecuencia: number | null = null;
    if (fechas.length > 1) {
      const dif = fechas.slice(1).map((f, i) => (aMs(f) - aMs(fechas[i])) / DIA_MS);
      frecuencia = round2(dif.reduce((s, x) => s + x, 0) / dif.length);
    }
    const paradas = items.reduce((s, i) => s + num(i.PARADAS), 0);
    const visitadas = items.reduce((s, i) => s + num(i.VISITADAS), 0);
    return {
      base, veces: items.length, cobradores: new Set(items.map((i) => i.ID_EMPLEADO)).size,
      primeraFecha: fechas[0], ultimaFecha: fechas[fechas.length - 1], frecuenciaDias: frecuencia,
      paradas, visitadas,
      noEncontrados: items.reduce((s, i) => s + num(i.NO_ENC), 0),
      reprogramadas: items.reduce((s, i) => s + num(i.REPROG), 0),
      efectividad: porcentaje(visitadas, paradas),
      montoPendiente: round2(items.reduce((s, i) => s + num(i.MONTO), 0)),
      completadas: items.filter((i) => i.ESTADO === 'COMPLETADA').length,
      canceladas: items.filter((i) => i.ESTADO === 'CANCELADA').length,
    };
  }).sort((x, y) => y.veces - x.veces || y.montoPendiente - x.montoPendiente);
}

export async function rutas(q: QueryFiltros): Promise<RutasReporte> {
  const a = resolverAlcance(q);
  const [{ filas, clientes }, todas] = await Promise.all([
    repo.rutasRaw(a),
    a.baseRuta ? repo.rutasRaw({ ...a, baseRuta: undefined }) : null,
  ]);
  const lista = agruparRutas(filas);
  const zonas = todas ? agruparRutas(todas.filas) : lista;

  const estados = new Map<string, number>();
  filas.forEach((f) => estados.set(f.ESTADO, (estados.get(f.ESTADO) ?? 0) + 1));
  const paradas = filas.reduce((s, f) => s + num(f.PARADAS), 0);
  const visitadas = filas.reduce((s, f) => s + num(f.VISITADAS), 0);

  return {
    desde: a.desde, hasta: a.hasta,
    totales: { rutas: filas.length, recurrentes: lista.filter((r) => r.veces > 1).length, paradas, visitadas, efectividad: porcentaje(visitadas, paradas) },
    rutas: lista,
    zonas,
    clientesRecurrentes: clientes.map((c) => ({
      idCliente: c.ID, nombre: c.NOMBRE, veces: num(c.VECES), visitadas: num(c.VISITADAS), noEncontrado: num(c.NO_ENC), saldoVencido: round2(num(c.VENCIDO)),
    })),
    porEstado: [...estados.entries()].map(([estado, cantidad]) => ({ estado, cantidad })).sort((x, y) => y.cantidad - x.cantidad),
  };
}

export async function rutaGrupoDetalle(base: string, q: QueryFiltros): Promise<RutaDetalleGrupo> {
  if (!base.trim()) throw new BadRequestError('Indica la ruta a consultar.');
  const a = resolverAlcance(q);
  const { salidas, paradas } = await repo.detalleGrupoRuta(a, base.trim());
  return {
    base: base.trim(),
    salidas: salidas.map((s) => ({
      idRuta: s.ID, codigo: s.CODIGO, nombre: s.NOMBRE, fecha: s.F, estado: s.ESTADO, idEmpleado: s.ID_EMPLEADO,
      cobrador: s.COBRADOR || '—', paradas: num(s.PARADAS), visitadas: num(s.VISITADAS), montoPendiente: round2(num(s.MONTO)),
    })),
    paradas: paradas.map((p) => ({
      idRuta: p.ID_RUTA, codigoRuta: p.CODIGO, fecha: p.F, idCliente: p.ID_CLIENTE, cliente: p.CLIENTE, estadoVisita: p.EST,
      montoPendiente: p.MONTO == null ? null : round2(num(p.MONTO)), observaciones: p.OBS,
    })),
  };
}

// --- Clientes en riesgo -----------------------------------------------------------------------------------------

const nivelDe = (score: number): NivelRiesgo => (score >= 70 ? 'CRITICO' : score >= 50 ? 'ALTO' : score >= 30 ? 'MEDIO' : 'BAJO');

/**
 * Puntaje 0-100, transparente y explicable (cada punto viene de un factor visible):
 *  antigüedad 30 · peso del vencido 15 · monto relativo 15 · promesas rotas 15 ·
 *  historial de pago 10 · contacto fallido 10 · convenios incumplidos 5.
 */
function puntuar(r: repo.RiesgoRaw, maxVencido: number): ClienteRiesgo {
  const saldoTotal = num(r.SALDO_TOTAL), saldoVencido = num(r.SALDO_VENCIDO), diasMax = num(r.DIAS_MAX);
  const incumplidas = num(r.INCUMPLIDAS), sinResp = num(r.SIN_RESP), fallidas = num(r.FALLIDAS), convenios = num(r.CONVENIOS);
  const diasProm = r.DIAS_PROM == null ? null : num(r.DIAS_PROM);

  const f = (id: string, etiqueta: string, max: number, valor: number, detalle: string): FactorRiesgo =>
    ({ id, etiqueta, maximo: max, puntos: Math.round(Math.max(0, Math.min(max, valor)) * 10) / 10, detalle });

  const factores: FactorRiesgo[] = [
    f('antiguedad', 'Antigüedad de la deuda', 30, (diasMax / 120) * 30, diasMax > 0 ? `Su documento más atrasado lleva ${diasMax} días vencido.` : 'Sin documentos vencidos.'),
    f('peso', 'Proporción vencida', 15, saldoTotal > 0 ? (saldoVencido / saldoTotal) * 15 : 0, `${porcentaje(saldoVencido, saldoTotal)} % de su saldo ya está vencido.`),
    f('monto', 'Monto en juego', 15, maxVencido > 0 ? (saldoVencido / maxVencido) * 15 : 0, `${fmtQ(saldoVencido)} vencidos, frente al mayor deudor de la cartera.`),
    f('promesas', 'Promesas incumplidas', 15, incumplidas * 7.5, incumplidas ? `${incumplidas} promesa(s) de pago no se cumplieron.` : 'No tiene promesas incumplidas.'),
    f('historial', 'Historial de pago', 10, diasProm == null ? 4 : diasProm <= 0 ? 0 : (diasProm / 30) * 10,
      diasProm == null ? 'Nunca ha pagado: no hay historial.' : diasProm <= 0 ? 'Históricamente paga a tiempo.' : `Paga en promedio ${diasProm} días después del vencimiento.`),
    f('contacto', 'Contacto fallido', 10, (sinResp + fallidas) * 2.5, sinResp + fallidas ? `${sinResp} gestión(es) sin respuesta y ${fallidas} visita(s) fallida(s).` : 'Se le ha podido contactar.'),
    f('convenios', 'Convenios incumplidos', 5, convenios * 5, convenios ? `${convenios} convenio(s) de pago incumplido(s).` : 'Sin convenios incumplidos.'),
  ];
  const score = Math.round(Math.min(100, factores.reduce((s, x) => s + x.puntos, 0)));

  return {
    idCliente: r.ID_CLIENTE, nombre: r.NOMBRE, nit: r.NIT, saldoTotal: round2(saldoTotal), saldoVencido: round2(saldoVencido),
    documentosVencidos: num(r.DOCS_VENC), diasMaxMora: diasMax, diasPromedioPago: diasProm,
    promesasIncumplidas: incumplidas, gestionesSinRespuesta: sinResp, visitasFallidas: fallidas, convenios,
    score, nivel: nivelDe(score), factores,
  };
}

export async function clientesRiesgo(q: QueryFiltros): Promise<ClientesRiesgoReporte> {
  const a = resolverAlcance(q);
  const raw = await repo.riesgoRaw(a);
  const maxVencido = raw.reduce((m, r) => Math.max(m, num(r.SALDO_VENCIDO)), 0);
  const clientes = raw.map((r) => puntuar(r, maxVencido)).sort((x, y) => y.score - x.score || y.saldoVencido - x.saldoVencido);
  const cuenta = (n: NivelRiesgo) => clientes.filter((c) => c.nivel === n).length;
  return {
    totales: {
      clientes: clientes.length, criticos: cuenta('CRITICO'), altos: cuenta('ALTO'), medios: cuenta('MEDIO'), bajos: cuenta('BAJO'),
      saldoVencido: round2(clientes.reduce((s, c) => s + c.saldoVencido, 0)),
      saldoEnRiesgo: round2(clientes.filter((c) => c.nivel === 'CRITICO' || c.nivel === 'ALTO').reduce((s, c) => s + c.saldoVencido, 0)),
    },
    clientes,
  };
}

export async function cliente360(idCliente: number, q: QueryFiltros): Promise<Cliente360> {
  const a = resolverAlcance({ ...q, idRuta: undefined, idEmpleado: undefined });
  const [todos, detalle, gestiones] = await Promise.all([
    repo.riesgoRaw(a), repo.detalleCliente(idCliente), repo.gestiones(a, { idCliente }, 30),
  ]);
  let raw = todos.find((r) => r.ID_CLIENTE === idCliente);
  if (!raw) {
    // Cliente sin saldo hoy: se muestra su historial igual, con riesgo en cero.
    const c = await repo.clienteBasico(idCliente);
    if (!c) throw new NotFoundError('El cliente no existe.');
    raw = { ...c, SALDO_TOTAL: 0, SALDO_VENCIDO: 0, DOCS_VENC: 0, DIAS_MAX: 0, DIAS_PROM: null, INCUMPLIDAS: 0, SIN_RESP: 0, FALLIDAS: 0, CONVENIOS: 0 };
  }
  // El monto relativo se mide contra el mayor deudor de TODA la cartera, no solo contra este cliente.
  const maxVencido = todos.reduce((m, r) => Math.max(m, num(r.SALDO_VENCIDO)), 0);
  return { riesgo: puntuar(raw, maxVencido), ...detalle, gestiones };
}
