import { z } from 'zod';

/**
 * Reporte de antigüedad de saldos (aging report): estándar en cualquier CxC
 * real para saber cuánto debe cada cliente y qué tan viejo es ese saldo.
 * Los buckets son de solo lectura, calculados al vuelo contra FECHA_VENCIMIENTO
 * vs. la fecha de hoy — no hay ninguna tabla ni job detrás.
 */
export const antiguedadSaldoSchema = z.object({
  idCliente: z.number().int(),
  nombreCliente: z.string(),
  corriente: z.number(),
  dias1a30: z.number(),
  dias31a60: z.number(),
  dias61a90: z.number(),
  mas90: z.number(),
  total: z.number(),
});
export type AntiguedadSaldo = z.infer<typeof antiguedadSaldoSchema>;

export const antiguedadSaldosReporteSchema = z.object({
  clientes: z.array(antiguedadSaldoSchema),
  totales: antiguedadSaldoSchema.omit({ idCliente: true, nombreCliente: true }),
});
export type AntiguedadSaldosReporte = z.infer<typeof antiguedadSaldosReporteSchema>;

export const estadoCuentaDocumentoSchema = z.object({
  idDocumento: z.number().int(),
  referenciaDocumento: z.string(),
  nombreTipoDocumento: z.string().nullable(),
  fechaDocumento: z.string(),
  fechaVencimiento: z.string(),
  total: z.number(),
  saldo: z.number(),
  estado: z.string(),
  condicion: z.enum(['VIGENTE', 'VENCIDA']),
});
export type EstadoCuentaDocumento = z.infer<typeof estadoCuentaDocumentoSchema>;

export const estadoCuentaSchema = z.object({
  idCliente: z.number().int(),
  nombreCliente: z.string(),
  nitCliente: z.string().nullable(),
  documentos: z.array(estadoCuentaDocumentoSchema),
  totalFacturado: z.number(),
  totalSaldoPendiente: z.number(),
  totalVencido: z.number(),
});
export type EstadoCuenta = z.infer<typeof estadoCuentaSchema>;
