import { z } from 'zod';
import { isoDateSchema, optionalIsoDateSchema, moneySchema, optionalTrimmedText } from '../validation';

export const ESTADOS_PROMESA_PAGO = ['PENDIENTE', 'CUMPLIDA', 'INCUMPLIDA'] as const;

export const promesaPagoSchema = z.object({
  idPromesa: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  idDocumento: z.number().int().nullable(),
  idGestion: z.number().int().nullable(),
  fechaPromesa: z.string(),
  fechaCompromiso: z.string().nullable(),
  montoComprometido: z.number(),
  estado: z.enum(ESTADOS_PROMESA_PAGO),
  observaciones: z.string().nullable(),
  // Calculado al leer, nunca persistido: PENDIENTE cuya fechaCompromiso ya
  // pasó. No sobreescribe `estado` (que sigue siendo autoridad del CRUD),
  // es una señal visual adicional. Mismo patrón que Documento.condicion.
  estaVencida: z.boolean(),
});
export type PromesaPago = z.infer<typeof promesaPagoSchema>;

const promesaInputBase = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  idDocumento: z.number().int().positive('Selecciona un documento válido').nullable().optional(),
  idGestion: z.number().int().positive('Selecciona una gestión válida').nullable().optional(),
  fechaPromesa: isoDateSchema('La fecha de la promesa'),
  fechaCompromiso: optionalIsoDateSchema('La fecha comprometida de pago'),
  montoComprometido: moneySchema('El monto comprometido', true),
  estado: z.enum(ESTADOS_PROMESA_PAGO).default('PENDIENTE'),
  observaciones: optionalTrimmedText('Las observaciones', 500),
});

export const createPromesaPagoSchema = promesaInputBase.superRefine((data, ctx) => {
  if (data.fechaCompromiso && data.fechaCompromiso < data.fechaPromesa) {
    ctx.addIssue({ code: 'custom', path: ['fechaCompromiso'], message: 'La fecha comprometida de pago no puede ser anterior a la fecha de la promesa' });
  }
});
export type CreatePromesaPagoInput = z.infer<typeof createPromesaPagoSchema>;
export const updatePromesaPagoSchema = promesaInputBase.partial();
export type UpdatePromesaPagoInput = z.infer<typeof updatePromesaPagoSchema>;
