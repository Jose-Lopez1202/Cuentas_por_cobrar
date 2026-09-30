import { z } from 'zod';
import {
  isoDateSchema,
  moneySchema,
  optionalIdentifierSchema,
  identifierSchema,
} from '../validation';

/**
 * Estados persistidos actuales. VENCIDO se conserva por compatibilidad con
 * datos históricos, pero la nueva lógica trata el vencimiento como una
 * condición calculada independiente para poder representar PARCIAL + VENCIDA.
 */
export const ESTADOS_DOCUMENTO = [
  'PENDIENTE',
  'PARCIAL',
  'PAGADO',
  'VENCIDO',
  'ANULADO',
] as const;

export const CONDICIONES_DOCUMENTO = ['VIGENTE', 'VENCIDA'] as const;

export const documentoSchema = z.object({
  idDocumento: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  nitCliente: z.string().nullable(),
  idTipoDocumento: z.number().int(),
  nombreTipoDocumento: z.string().nullable().optional(),
  idMoneda: z.number().int(),
  // Opcional: solo los documentos con condición asignada participan en el
  // recálculo automático de mora (ver server mora.repository.ts).
  idCondicionCredito: z.number().int().nullable(),
  estado: z.string(),
  condicion: z.enum(CONDICIONES_DOCUMENTO).optional(),
  serie: z.string().nullable(),
  numeroDocumento: z.string(),
  fechaDocumento: z.string(),
  fechaVencimiento: z.string(),
  total: z.number(),
  saldo: z.number(),
  idEmpleadoAnulacion: z.number().int().nullable(),
  nombreEmpleadoAnulacion: z.string().nullable().optional(),
  fechaAnulacion: z.string().nullable(),
  motivoAnulacion: z.string().nullable(),
});

export type Documento = z.infer<typeof documentoSchema>;

const documentoEditableBaseSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  // El NIT es una fotografía del dato maestro. El backend lo deriva del
  // cliente seleccionado; se conserva opcional para compatibilidad.
  nitCliente: z.string().trim().max(20).nullable().optional(),
  idTipoDocumento: z.number().int().positive('Selecciona un tipo de documento'),
  idMoneda: z.number().int().positive('Selecciona una moneda'),
  idCondicionCredito: z.number().int().positive().nullable().optional(),
  serie: optionalIdentifierSchema('La serie', 30),
  numeroDocumento: identifierSchema('El número de documento', 50),
  fechaDocumento: isoDateSchema('La fecha del documento'),
  fechaVencimiento: isoDateSchema('La fecha de vencimiento'),
  total: moneySchema('El total', true),
});

export const createDocumentoSchema = documentoEditableBaseSchema.superRefine((data, ctx) => {
  if (data.fechaVencimiento < data.fechaDocumento) {
    ctx.addIssue({
      code: 'custom',
      path: ['fechaVencimiento'],
      message: 'La fecha de vencimiento no puede ser anterior a la fecha del documento',
    });
  }
});

export type CreateDocumentoInput = z.infer<typeof createDocumentoSchema>;

/**
 * Estado y saldo NO se aceptan desde el CRUD. Son valores derivados del motor
 * financiero y únicamente se actualizan mediante aplicaciones/reversiones.
 */
export const updateDocumentoSchema = documentoEditableBaseSchema.partial();
export type UpdateDocumentoInput = z.infer<typeof updateDocumentoSchema>;

export const anularDocumentoSchema = z.object({
  idEmpleadoAnulacion: z.number().int().positive('Selecciona el empleado que anula'),
  motivoAnulacion: z.string().trim().min(10, 'Describe el motivo de la anulación (mínimo 10 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
  fechaAnulacion: isoDateSchema('La fecha de anulación').optional(),
});
export type AnularDocumentoInput = z.infer<typeof anularDocumentoSchema>;
