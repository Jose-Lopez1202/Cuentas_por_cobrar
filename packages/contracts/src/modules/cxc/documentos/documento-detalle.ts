import { z } from 'zod';
import { hasAtMostDecimals, moneySchema, optionalIdentifierSchema } from '../validation';

export const documentoDetalleSchema = z.object({
  idDetalle: z.number().int(),
  idDocumento: z.number().int(),
  codigoProducto: z.string().nullable(),
  descripcion: z.string(),
  cantidad: z.number(),
  precioUnitario: z.number(),
  total: z.number(),
});
export type DocumentoDetalle = z.infer<typeof documentoDetalleSchema>;

export const createDocumentoDetalleSchema = z.object({
  idDocumento: z.number().int().positive(),
  codigoProducto: optionalIdentifierSchema('El código de producto', 30),
  descripcion: z.string().trim().min(1, 'La descripción es obligatoria').max(200),
  cantidad: z
    .number()
    .positive('La cantidad debe ser mayor que cero')
    .refine((value) => hasAtMostDecimals(value, 4), 'La cantidad admite como máximo 4 decimales'),
  precioUnitario: moneySchema('El precio unitario'),
  // TOTAL se calcula en el servidor; se mantiene opcional por compatibilidad.
  total: moneySchema('El total').optional(),
});
export type CreateDocumentoDetalleInput = z.infer<typeof createDocumentoDetalleSchema>;

export const updateDocumentoDetalleSchema = createDocumentoDetalleSchema
  .omit({ idDocumento: true })
  .partial();
export type UpdateDocumentoDetalleInput = z.infer<typeof updateDocumentoDetalleSchema>;
