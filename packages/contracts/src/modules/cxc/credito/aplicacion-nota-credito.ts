import { z } from 'zod';
import { isoDateSchema, moneySchema } from '../validation';

export const ESTADOS_APLICACION_NOTA_CREDITO = ['CONFIRMADA', 'REVERSADA'] as const;

export const aplicacionNotaCreditoSchema = z.object({
  idAplicacionNc: z.number().int(),
  idNotaCredito: z.number().int(),
  idDocumento: z.number().int(),
  montoAplicado: z.number(),
  fechaAplicacion: z.string(),
  idEmpleado: z.number().int().nullable(),
  nombreEmpleado: z.string().nullable().optional(),
  estado: z.enum(ESTADOS_APLICACION_NOTA_CREDITO),
  idEmpleadoReversa: z.number().int().nullable(),
  nombreEmpleadoReversa: z.string().nullable().optional(),
  fechaReversa: z.string().nullable(),
  motivoReversa: z.string().nullable(),
});

export type AplicacionNotaCredito = z.infer<typeof aplicacionNotaCreditoSchema>;

export const createAplicacionNotaCreditoSchema = z.object({
  idNotaCredito: z.number().int().positive('La nota de crédito es obligatoria'),
  idDocumento: z.number().int().positive('El documento es obligatorio'),
  montoAplicado: moneySchema('El monto aplicado', true),
  fechaAplicacion: isoDateSchema('La fecha de aplicación'),
  idEmpleado: z.number().int().positive('Selecciona el empleado que aplica la nota de crédito'),
});

export type CreateAplicacionNotaCreditoInput = z.infer<typeof createAplicacionNotaCreditoSchema>;

export const updateAplicacionNotaCreditoSchema = createAplicacionNotaCreditoSchema.partial();
export type UpdateAplicacionNotaCreditoInput = z.infer<typeof updateAplicacionNotaCreditoSchema>;

export const reversarAplicacionNotaCreditoSchema = z.object({
  idEmpleadoReversa: z.number().int().positive('Selecciona el empleado que reversa'),
  motivoReversa: z.string().trim().min(10, 'Describe el motivo de la reversa (mínimo 10 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
  fechaReversa: isoDateSchema('La fecha de reversa').optional(),
});
export type ReversarAplicacionNotaCreditoInput = z.infer<typeof reversarAplicacionNotaCreditoSchema>;
