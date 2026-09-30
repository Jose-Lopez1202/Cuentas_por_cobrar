import { z } from 'zod';
import { isoDateSchema, moneySchema } from '../validation';

export const ESTADOS_APLICACION_ANTICIPO = ['CONFIRMADA', 'REVERSADA'] as const;

export const aplicacionAnticipoSchema = z.object({
  idAplicacionAnticipo: z.number().int(),
  idAnticipo: z.number().int(),
  idDocumento: z.number().int(),
  montoAplicado: z.number(),
  fechaAplicacion: z.string(),
  idEmpleado: z.number().int().nullable(),
  nombreEmpleado: z.string().nullable().optional(),
  estado: z.enum(ESTADOS_APLICACION_ANTICIPO),
  idEmpleadoReversa: z.number().int().nullable(),
  nombreEmpleadoReversa: z.string().nullable().optional(),
  fechaReversa: z.string().nullable(),
  motivoReversa: z.string().nullable(),
});

export type AplicacionAnticipo = z.infer<typeof aplicacionAnticipoSchema>;

export const createAplicacionAnticipoSchema = z.object({
  idAnticipo: z.number().int().positive('El anticipo es obligatorio'),
  idDocumento: z.number().int().positive('El documento es obligatorio'),
  montoAplicado: moneySchema('El monto aplicado', true),
  fechaAplicacion: isoDateSchema('La fecha de aplicación'),
  idEmpleado: z.number().int().positive('Selecciona el empleado que aplica el anticipo'),
});

export type CreateAplicacionAnticipoInput = z.infer<typeof createAplicacionAnticipoSchema>;

export const updateAplicacionAnticipoSchema = createAplicacionAnticipoSchema.partial();
export type UpdateAplicacionAnticipoInput = z.infer<typeof updateAplicacionAnticipoSchema>;

export const reversarAplicacionAnticipoSchema = z.object({
  idEmpleadoReversa: z.number().int().positive('Selecciona el empleado que reversa'),
  motivoReversa: z.string().trim().min(10, 'Describe el motivo de la reversa (mínimo 10 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
  fechaReversa: isoDateSchema('La fecha de reversa').optional(),
});
export type ReversarAplicacionAnticipoInput = z.infer<typeof reversarAplicacionAnticipoSchema>;
