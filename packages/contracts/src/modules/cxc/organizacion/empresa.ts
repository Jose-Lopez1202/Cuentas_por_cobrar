import { z } from 'zod';
import { nitSchema, soloLetrasSchema } from '../validation';

export const ESTADOS_EMPRESA = ['A', 'I'] as const;

export const empresaSchema = z.object({
  idEmpresa: z.number().int(),
  nombre: z.string(),
  nit: z.string().nullable(),
  estado: z.string(),
});
export type Empresa = z.infer<typeof empresaSchema>;

export const createEmpresaSchema = z.object({
  nombre: soloLetrasSchema('El nombre', 150),
  nit: nitSchema.nullable().optional(),
  estado: z.enum(ESTADOS_EMPRESA).default('A'),
});
export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;

export const updateEmpresaSchema = createEmpresaSchema.partial();
export type UpdateEmpresaInput = z.infer<typeof updateEmpresaSchema>;