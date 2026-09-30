import { z } from 'zod';
import { isoDateSchema, moneySchema, optionalIdentifierSchema } from '../validation';

export const ESTADOS_CUOTA = ['PENDIENTE', 'PAGADA', 'VENCIDA'] as const;

export const convenioCuotaSchema = z.object({
  idCuota: z.number().int(),
  idConvenio: z.number().int(),
  numeroCuota: z.number().int(),
  fechaVencimiento: z.string(),
  monto: z.number(),
  saldo: z.number(),
  estado: z.enum(ESTADOS_CUOTA),
  idFormaPago: z.number().int().nullable(),
  nombreFormaPago: z.string().nullable().optional(),
  referenciaPago: z.string().nullable(),
  // Calculado al leer, nunca persistido: PENDIENTE con fechaVencimiento ya
  // pasada. No sobreescribe `estado` (que sigue siendo autoridad del CRUD),
  // es una señal visual adicional. Mismo patrón que Documento.condicion.
  estaVencida: z.boolean(),
});
export type ConvenioCuota = z.infer<typeof convenioCuotaSchema>;

export const createConvenioCuotaSchema = z.object({
  idConvenio: z.number().int().positive(),
  numeroCuota: z.number().int().positive(),
  fechaVencimiento: isoDateSchema('La fecha de vencimiento'),
  monto: moneySchema('El monto', true),
  saldo: moneySchema('El saldo').optional(),
  estado: z.enum(ESTADOS_CUOTA).default('PENDIENTE'),
});
export type CreateConvenioCuotaInput = z.infer<typeof createConvenioCuotaSchema>;
export const updateConvenioCuotaSchema = createConvenioCuotaSchema.partial();
export type UpdateConvenioCuotaInput = z.infer<typeof updateConvenioCuotaSchema>;

export const registrarPagoCuotaSchema = z.object({
  montoPagado: moneySchema('El monto pagado', true),
  idFormaPago: z.number().int().positive('Selecciona una forma de pago'),
  referenciaPago: optionalIdentifierSchema('La referencia de pago', 50),
  idEmpleado: z.number().int().positive('Selecciona el empleado que registra el pago'),
});
export type RegistrarPagoCuotaInput = z.infer<typeof registrarPagoCuotaSchema>;
