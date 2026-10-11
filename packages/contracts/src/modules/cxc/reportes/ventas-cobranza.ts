/** Contratos de los reportes fiscales y estadísticos de CxC (solo lectura). */

export interface LibroVentasFila {
  fecha: string;
  serie: string;
  numero: number;
  uuid: string;
  nitReceptor: string;
  nombreReceptor: string;
  estado: 'CERTIFICADA' | 'ANULADA';
  /** Base imponible (sin IVA). En facturas anuladas es 0. */
  baseGravada: number;
  iva: number;
  total: number;
}

export interface LibroVentasReporte {
  anio: number;
  mes: number;
  filas: LibroVentasFila[];
  totales: { facturas: number; anuladas: number; baseGravada: number; iva: number; total: number };
}

export interface EstadisticaVentas {
  desde: string;
  hasta: string;
  totales: { facturas: number; anuladas: number; ventaNeta: number; iva: number; ventaTotal: number; ticketPromedio: number };
  porMes: Array<{ periodo: string; facturas: number; ventaTotal: number }>;
  topClientes: Array<{ idCliente: number; nombreCliente: string; facturas: number; ventaTotal: number }>;
  porCondicion: Array<{ condicion: string; facturas: number; ventaTotal: number }>;
}

export interface EstadisticaCobranza {
  desde: string;
  hasta: string;
  totales: {
    facturado: number;
    cobrado: number;
    /** cobrado / facturado en el período, 0-100. */
    indiceCobranza: number;
    carteraTotal: number;
    carteraVencida: number;
    /** carteraVencida / carteraTotal, 0-100. */
    porcentajeVencida: number;
    /** Días promedio de venta pendiente de cobro (cartera / venta diaria). */
    diasCartera: number;
  };
  porMes: Array<{ periodo: string; facturado: number; cobrado: number }>;
  porFormaPago: Array<{ formaPago: string; pagos: number; monto: number }>;
  promesas: Array<{ estado: string; cantidad: number; monto: number }>;
  gestiones: Array<{ resultado: string; cantidad: number }>;
  convenios: Array<{ estado: string; cantidad: number; monto: number }>;
}
