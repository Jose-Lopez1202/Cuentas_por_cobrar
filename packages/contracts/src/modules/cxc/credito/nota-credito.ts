import { z } from 'zod';
import {
  isoDateSchema,
  moneySchema,
  optionalIdentifierSchema,
  optionalTrimmedText,
} from '../validation';

export const ESTADOS_NOTA_CREDITO = [
  'PENDIENTE',
  'APLICADA',
  'ANULADA',
] as const;

export const notaCreditoSchema = z.object({
  idNotaCredito: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  idDocumentoReferencia: z.number().int().nullable(),
  descripcion: z.string().nullable(),
  serie: z.string().nullable(),
  numero: z.string().nullable(),
  fecha: z.string(),
  monto: z.number(),
  montoAplicado: z.number().optional(),
  montoDisponible: z.number().optional(),
  // string para tolerar ACTIVA en datos heredados mientras se normaliza BD.
  estado: z.string(),
  idEmpleadoAnulacion: z.number().int().nullable(),
  nombreEmpleadoAnulacion: z.string().nullable().optional(),
  fechaAnulacion: z.string().nullable(),
  motivoAnulacion: z.string().nullable(),
});

export type NotaCredito = z.infer<typeof notaCreditoSchema>;

const notaCreditoBaseSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  idDocumentoReferencia: z.number().int().positive('Selecciona un documento válido').nullable().optional(),
  descripcion: optionalTrimmedText('La descripción', 250),
  serie: optionalIdentifierSchema('La serie', 30),
  numero: optionalIdentifierSchema('El número', 30),
  fecha: isoDateSchema('La fecha'),
  monto: moneySchema('El monto', true),
});

export const createNotaCreditoSchema = notaCreditoBaseSchema.extend({
  estado: z.literal('PENDIENTE').default('PENDIENTE'),
});

export type CreateNotaCreditoInput = z.infer<typeof createNotaCreditoSchema>;

/** El estado se deriva de las aplicaciones; no se edita desde el CRUD. */
export const updateNotaCreditoSchema = notaCreditoBaseSchema.partial();
export type UpdateNotaCreditoInput = z.infer<typeof updateNotaCreditoSchema>;

export const anularNotaCreditoSchema = z.object({
  idEmpleadoAnulacion: z.number().int().positive('Selecciona el empleado que anula'),
  motivoAnulacion: z.string().trim().min(10, 'Describe el motivo de la anulación (mínimo 10 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
  fechaAnulacion: isoDateSchema('La fecha de anulación').optional(),
});
export type AnularNotaCreditoInput = z.infer<typeof anularNotaCreditoSchema>;
