import { z } from 'zod';

export const conteoPorEstadoSchema = z.object({
  estado: z.string(),
  cantidad: z.number().int(),
  monto: z.number(),
});
export type ConteoPorEstado = z.infer<typeof conteoPorEstadoSchema>;

export const conteoPorTipoSchema = z.object({
  tipo: z.string(),
  cantidad: z.number().int(),
});
export type ConteoPorTipo = z.infer<typeof conteoPorTipoSchema>;

export const montoPorMesSchema = z.object({
  mes: z.string(), // 'YYYY-MM'
  monto: z.number(),
});
export type MontoPorMes = z.infer<typeof montoPorMesSchema>;

export const dashboardResumenSchema = z.object({
  kpis: z.object({
    carteraTotal: z.number(),
    carteraVencida: z.number(),
    porcentajeVencida: z.number(),
    documentosAbiertos: z.number().int(),
  }),
  documentos: z.object({
    porEstado: z.array(conteoPorEstadoSchema),
  }),
  cobranza: z.object({
    gestionesPorTipo: z.array(conteoPorTipoSchema),
    promesasPorEstado: z.array(conteoPorEstadoSchema),
    conveniosPorEstado: z.array(conteoPorEstadoSchema),
  }),
  credito: z.object({
    moraActiva: z.object({
      cantidadDocumentos: z.number().int(),
      montoTotal: z.number(),
    }),
    notasCreditoPorEstado: z.array(conteoPorEstadoSchema),
  }),
  pagos: z.object({
    porEstado: z.array(conteoPorEstadoSchema),
    aplicadoPorMes: z.array(montoPorMesSchema),
  }),
  organizacion: z.object({
    rutasPorEstado: z.array(conteoPorTipoSchema),
  }),
});
export type DashboardResumen = z.infer<typeof dashboardResumenSchema>;
