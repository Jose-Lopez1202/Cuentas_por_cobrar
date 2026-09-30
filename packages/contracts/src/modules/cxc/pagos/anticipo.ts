import { z } from 'zod';
import { isoDateSchema, moneySchema } from '../validation';

export const ESTADOS_ANTICIPO = ['DISPONIBLE', 'APLICADO', 'AGOTADO', 'CANCELADO'] as const;

export const anticipoSchema = z.object({
  idAnticipo: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  idPago: z.number().int().nullable(),
  referenciaPago: z.string().nullable().optional(),
  montoOriginal: z.number(),
  montoDisponible: z.number(),
  fecha: z.string(),
  estado: z.enum(ESTADOS_ANTICIPO),
  idEmpleadoAnulacion: z.number().int().nullable(),
  nombreEmpleadoAnulacion: z.string().nullable().optional(),
  fechaAnulacion: z.string().nullable(),
  motivoAnulacion: z.string().nullable(),
});
export type Anticipo = z.infer<typeof anticipoSchema>;

const anticipoBaseSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  idPago: z.number().int().positive().nullable().optional(),
  montoOriginal: moneySchema('El monto original', true),
  montoDisponible: moneySchema('El monto disponible'),
  fecha: isoDateSchema('La fecha'),
});

export const createAnticipoSchema = anticipoBaseSchema.superRefine((value, ctx) => {
  if (value.montoDisponible > value.montoOriginal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['montoDisponible'],
      message: 'El monto disponible no puede superar el monto original',
    });
  }
});
export type CreateAnticipoInput = z.infer<typeof createAnticipoSchema>;

// ESTADO ya no se edita libremente vía update(): nace DISPONIBLE y solo el
// motor financiero (aplicar/reversar) o anular() lo cambian después.
export const updateAnticipoSchema = anticipoBaseSchema.partial();
export type UpdateAnticipoInput = z.infer<typeof updateAnticipoSchema>;

export const anularAnticipoSchema = z.object({
  idEmpleadoAnulacion: z.number().int().positive('Selecciona el empleado que anula'),
  motivoAnulacion: z.string().trim().min(10, 'Describe el motivo de la anulación (mínimo 10 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
  fechaAnulacion: isoDateSchema('La fecha de anulación').optional(),
});
export type AnularAnticipoInput = z.infer<typeof anularAnticipoSchema>;
