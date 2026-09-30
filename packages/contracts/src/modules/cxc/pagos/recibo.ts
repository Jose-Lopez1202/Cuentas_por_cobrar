import { z } from 'zod';
import { isoDateSchema, moneySchema, optionalIdentifierSchema } from '../validation';

export const ESTADOS_RECIBO = ['EMITIDO', 'CANCELADO'] as const;

export const reciboSchema = z.object({
  idRecibo: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  idPago: z.number().int(),
  referenciaPago: z.string().nullable().optional(),
  numeroRecibo: z.string().nullable(),
  fecha: z.string(),
  monto: z.number(),
  estado: z.enum(ESTADOS_RECIBO),
});
export type Recibo = z.infer<typeof reciboSchema>;

export const createReciboSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  idPago: z.number().int().positive('El pago es obligatorio'),
  numeroRecibo: optionalIdentifierSchema('El número de recibo', 30),
  fecha: isoDateSchema('La fecha'),
  monto: moneySchema('El monto', true),
  estado: z.enum(ESTADOS_RECIBO).default('EMITIDO'),
});
export type CreateReciboInput = z.infer<typeof createReciboSchema>;

export const updateReciboSchema = createReciboSchema.partial();
export type UpdateReciboInput = z.infer<typeof updateReciboSchema>;
