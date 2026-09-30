import { z } from 'zod';
import { identifierSchema } from '../validation';

export const ESTADOS_TIPO_DOCUMENTO = ['A', 'I'] as const;
export const NATURALEZAS_DOCUMENTO = ['CARGO', 'CREDITO'] as const;

export const tipoDocumentoSchema = z.object({
  idTipoDocumento: z.number().int(),
  codigo: z.string(),
  nombre: z.string(),
  naturaleza: z.string().nullable(),
  estado: z.string(),
});
export type TipoDocumento = z.infer<typeof tipoDocumentoSchema>;

export const createTipoDocumentoSchema = z.object({
  codigo: identifierSchema('El código', 20).transform((value) => value.toUpperCase()),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  naturaleza: z.enum(NATURALEZAS_DOCUMENTO).nullable().optional(),
  estado: z.enum(ESTADOS_TIPO_DOCUMENTO).default('A'),
});
export type CreateTipoDocumentoInput = z.infer<typeof createTipoDocumentoSchema>;

export const updateTipoDocumentoSchema = createTipoDocumentoSchema.partial();
export type UpdateTipoDocumentoInput = z.infer<typeof updateTipoDocumentoSchema>;
