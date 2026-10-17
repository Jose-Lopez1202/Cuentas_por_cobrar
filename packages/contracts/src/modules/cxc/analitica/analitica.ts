// Contratos del módulo de análisis de cobranza (tableros, rankings y detalle por fila).
// Solo lectura: todo se calcula en el servidor sobre las tablas de CxC.

/** Filtros comunes de todos los tableros. Las fechas son AAAA-MM-DD. */
export interface FiltrosAnalitica {
  desde: string;
  hasta: string;
  /** Limita los cobros y la gestión a un cobrador. */
  idEmpleado?: number;
  /** Limita a los clientes que pertenecen a una ruta. */
  idRuta?: number;
}

export interface Comparativo {
  actual: number;
  anterior: number;
}

export interface CobradorOpcion {
  idEmpleado: number;
  nombre: string;
  codigo: string | null;
}

export interface RutaOpcion {
  idRuta: number;
  codigo: string | null;
  nombre: string;
}

export interface CatalogoFiltrosAnalitica {
  cobradores: CobradorOpcion[];
  rutas: RutaOpcion[];
}

// --- Panel ejecutivo ---------------------------------------------------------------

export type SeveridadAlerta = 'critica' | 'alta' | 'media' | 'info';

export interface AlertaAnalitica {
  id: string;
  severidad: SeveridadAlerta;
  titulo: string;
  detalle: string;
  /** Pantalla a la que lleva la alerta. */
  destino?: string;
}

export interface PuntoSerie {
  fecha: string;
  cobrado: number;
  facturado: number;
}

export interface TramoAntiguedad {
  tramo: string;
  monto: number;
  documentos: number;
}

export interface DeudorResumen {
  idCliente: number;
  nombre: string;
  nit: string | null;
  saldoTotal: number;
  saldoVencido: number;
  diasMaxMora: number;
  documentosVencidos: number;
}

export interface ResumenEjecutivo {
  desde: string;
  hasta: string;
  desdeAnterior: string;
  hastaAnterior: string;
  kpis: {
    cobrado: Comparativo;
    facturado: Comparativo;
    /** null cuando hay un cobrador seleccionado (la facturación no es por cobrador). */
    indiceCobranza: Comparativo | null;
    pagosAplicados: Comparativo;
    gestiones: Comparativo;
  };
  cartera: {
    total: number;
    vencida: number;
    porcentajeVencida: number;
    diasCartera: number;
    documentosAbiertos: number;
    clientesConSaldo: number;
    clientesVencidos: number;
  };
  serie: PuntoSerie[];
  antiguedad: TramoAntiguedad[];
  topDeudores: DeudorResumen[];
  formasPago: Array<{ formaPago: string; pagos: number; monto: number }>;
  gestionesPorResultado: Array<{ resultado: string; cantidad: number }>;
  promesas: Array<{ estado: string; cantidad: number; monto: number }>;
  vencimientosProximos: Array<{ semana: string; desde: string; monto: number; documentos: number }>;
  topCobradores: Array<{ idEmpleado: number; nombre: string; cobrado: number }>;
  alertas: AlertaAnalitica[];
}

// --- Cobradores ---------------------------------------------------------------------

export interface CobradorRendimiento {
  idEmpleado: number;
  nombre: string;
  codigo: string | null;
  cobrado: number;
  cobradoAnterior: number;
  /** Variación % contra el período anterior (null si antes no cobró nada). */
  variacion: number | null;
  participacion: number;
  pagos: number;
  clientesCobrados: number;
  ticketPromedio: number;
  gestiones: number;
  gestionesEfectivas: number;
  efectividadGestion: number;
  promesas: number;
  promesasCumplidas: number;
  rutas: number;
  paradas: number;
  paradasVisitadas: number;
  efectividadRuta: number;
  /** 1 = el que más cobra. */
  posicion: number;
}

export interface CobradoresReporte {
  desde: string;
  hasta: string;
  totales: { cobrado: number; pagos: number; gestiones: number; cobradoresActivos: number };
  cobradores: CobradorRendimiento[];
}

export interface PagoAplicadoDetalle {
  idAplicacion: number;
  fecha: string;
  idCliente: number;
  cliente: string;
  idDocumento: number;
  documento: string;
  monto: number;
  formaPago: string | null;
  referencia: string | null;
}

export interface GestionDetalle {
  idGestion: number;
  fecha: string;
  idCliente: number;
  cliente: string;
  tipo: string | null;
  resultado: string | null;
  observacion: string | null;
  fechaCompromiso: string | null;
  montoCompromiso: number | null;
}

export interface CobradorDetalle {
  cobrador: CobradorRendimiento;
  serie: Array<{ fecha: string; cobrado: number }>;
  pagos: PagoAplicadoDetalle[];
  gestiones: GestionDetalle[];
  clientes: Array<{ idCliente: number; nombre: string; cobrado: number; pagos: number }>;
  rutas: Array<{ idRuta: number; codigo: string | null; nombre: string; fecha: string; estado: string; paradas: number; visitadas: number }>;
}

// --- Días de cobro ------------------------------------------------------------------

export interface DiaCobro {
  /** Día de la semana (1 = lunes ... 7 = domingo) o día del mes (1..31). */
  valor: number;
  etiqueta: string;
  cobrado: number;
  pagos: number;
  /** Días del calendario del período que caen en este valor y tuvieron cobros. */
  diasConCobro: number;
  /** Promedio cobrado por cada ocurrencia del día en el período. */
  promedio: number;
  participacion: number;
}

export interface CeldaCalor {
  /** 1..7 (lunes a domingo). */
  diaSemana: number;
  /** Semana del mes: 1..5. */
  semanaMes: number;
  cobrado: number;
  pagos: number;
}

export interface DiasCobroReporte {
  desde: string;
  hasta: string;
  totalCobrado: number;
  porDiaSemana: DiaCobro[];
  porDiaMes: DiaCobro[];
  calor: CeldaCalor[];
  mejorDiaSemana: DiaCobro | null;
  peorDiaSemana: DiaCobro | null;
  mejorDiaMes: DiaCobro | null;
  /** Fechas concretas con más cobro. */
  mejoresFechas: Array<{ fecha: string; cobrado: number; pagos: number }>;
}

// --- Rutas recurrentes --------------------------------------------------------------

export interface RutaRecurrente {
  /** Nombre base de la ruta, sin el número correlativo (“Ruta Zona 1”). */
  base: string;
  veces: number;
  cobradores: number;
  primeraFecha: string;
  ultimaFecha: string;
  /** Promedio de días entre una salida y la siguiente (null si salió una sola vez). */
  frecuenciaDias: number | null;
  paradas: number;
  visitadas: number;
  noEncontrados: number;
  reprogramadas: number;
  efectividad: number;
  montoPendiente: number;
  completadas: number;
  canceladas: number;
}

export interface ClienteRecurrenteRuta {
  idCliente: number;
  nombre: string;
  veces: number;
  visitadas: number;
  noEncontrado: number;
  saldoVencido: number;
}

export interface RutasReporte {
  desde: string;
  hasta: string;
  totales: { rutas: number; recurrentes: number; paradas: number; visitadas: number; efectividad: number };
  rutas: RutaRecurrente[];
  clientesRecurrentes: ClienteRecurrenteRuta[];
  porEstado: Array<{ estado: string; cantidad: number }>;
}

export interface RutaDetalleGrupo {
  base: string;
  salidas: Array<{
    idRuta: number;
    codigo: string | null;
    nombre: string;
    fecha: string;
    estado: string;
    idEmpleado: number;
    cobrador: string;
    paradas: number;
    visitadas: number;
    montoPendiente: number;
  }>;
  paradas: Array<{
    idRuta: number;
    codigoRuta: string | null;
    fecha: string;
    idCliente: number;
    cliente: string;
    estadoVisita: string | null;
    montoPendiente: number | null;
    observaciones: string | null;
  }>;
}

// --- Clientes problemáticos ---------------------------------------------------------

export type NivelRiesgo = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO';

export interface FactorRiesgo {
  id: string;
  etiqueta: string;
  puntos: number;
  maximo: number;
  detalle: string;
}

export interface ClienteRiesgo {
  idCliente: number;
  nombre: string;
  nit: string | null;
  saldoTotal: number;
  saldoVencido: number;
  documentosVencidos: number;
  diasMaxMora: number;
  /** Promedio de días de atraso con los que ha pagado (null si nunca ha pagado). */
  diasPromedioPago: number | null;
  promesasIncumplidas: number;
  gestionesSinRespuesta: number;
  visitasFallidas: number;
  convenios: number;
  score: number;
  nivel: NivelRiesgo;
  factores: FactorRiesgo[];
}

export interface ClientesRiesgoReporte {
  totales: {
    clientes: number;
    criticos: number;
    altos: number;
    medios: number;
    bajos: number;
    saldoVencido: number;
    saldoEnRiesgo: number;
  };
  clientes: ClienteRiesgo[];
}

export interface DocumentoClienteDetalle {
  idDocumento: number;
  referencia: string;
  fecha: string;
  vencimiento: string;
  total: number;
  saldo: number;
  estado: string;
  diasMora: number;
}

export interface PagoClienteDetalle {
  idPago: number;
  fecha: string;
  monto: number;
  formaPago: string | null;
  referencia: string | null;
  estado: string;
}

export interface PromesaClienteDetalle {
  idPromesa: number;
  fecha: string;
  fechaCompromiso: string | null;
  monto: number;
  estado: string;
  vencida: boolean;
}

export interface ConvenioClienteDetalle {
  idConvenio: number;
  fecha: string | null;
  deuda: number;
  estado: string;
}

export interface VisitaClienteDetalle {
  idRuta: number;
  codigoRuta: string | null;
  fecha: string;
  estado: string | null;
  cobrador: string;
}

/** Vista 360° de un cliente: todo lo que hay que saber antes de llamarle o visitarlo. */
export interface Cliente360 {
  riesgo: ClienteRiesgo;
  documentos: DocumentoClienteDetalle[];
  pagos: PagoClienteDetalle[];
  promesas: PromesaClienteDetalle[];
  convenios: ConvenioClienteDetalle[];
  gestiones: GestionDetalle[];
  visitas: VisitaClienteDetalle[];
}
