import { z } from 'zod';
import { isoDateSchema, moneySchema, optionalIdentifierSchema } from '../validation';

export const ESTADOS_PAGO = [
  'NO_IDENTIFICADO',
  'NO_APLICADO',
  'APLICADO',
  'EN_CUENTA',
  'REVERSADO',
  'ANULADO',
] as const;

export const ESTADOS_PAGO_REGISTRO = [
  'NO_IDENTIFICADO',
  'NO_APLICADO',
  'EN_CUENTA',
] as const;

export const pagoSchema = z.object({
  idPago: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  idFormaPago: z.number().int(),
  idMoneda: z.number().int(),
  idBanco: z.number().int().nullable(),
  nombreBanco: z.string().nullable().optional(),
  fechaPago: z.string(),
  monto: z.number(),
  montoAplicado: z.number().optional(),
  montoDisponible: z.number().optional(),
  numeroReferencia: z.string().nullable(),
  estado: z.string(),
  idEmpleadoAnulacion: z.number().int().nullable(),
  nombreEmpleadoAnulacion: z.string().nullable().optional(),
  fechaAnulacion: z.string().nullable(),
  motivoAnulacion: z.string().nullable(),
});
export type Pago = z.infer<typeof pagoSchema>;

const pagoBaseSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  idFormaPago: z.number().int().positive('Selecciona una forma de pago'),
  idMoneda: z.number().int().positive('Selecciona una moneda'),
  idBanco: z.number().int().positive('El banco debe ser un ID válido').nullable().optional(),
  fechaPago: isoDateSchema('La fecha de pago'),
  monto: moneySchema('El monto', true),
  numeroReferencia: optionalIdentifierSchema('La referencia', 80),
});

export const createPagoSchema = pagoBaseSchema.extend({
  estado: z.enum(ESTADOS_PAGO_REGISTRO).default('NO_APLICADO'),
});
export type CreatePagoInput = z.infer<typeof createPagoSchema>;

export const updatePagoSchema = pagoBaseSchema.partial().extend({
  estado: z.enum(ESTADOS_PAGO_REGISTRO).optional(),
});
export type UpdatePagoInput = z.infer<typeof updatePagoSchema>;

export const anularPagoSchema = z.object({
  idEmpleadoAnulacion: z.number().int().positive('Selecciona el empleado que anula'),
  motivoAnulacion: z.string().trim().min(10, 'Describe el motivo de la anulación (mínimo 10 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
  fechaAnulacion: isoDateSchema('La fecha de anulación').optional(),
});
export type AnularPagoInput = z.infer<typeof anularPagoSchema>;
