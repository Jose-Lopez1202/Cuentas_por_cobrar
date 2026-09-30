import { z } from 'zod';
import { identifierSchema, optionalIsoDateSchema, optionalTrimmedText } from '../validation';

export const ESTADOS_RUTA = ['PLANIFICADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'] as const;

export const rutaSchema = z.object({
  idRuta: z.number().int(),
  codigoRuta: z.string().nullable(),
  nombre: z.string(),
  idEmpleado: z.number().int(),
  nombreEmpleado: z.string().nullable().optional(),
  fecha: z.string().nullable(),
  estado: z.string(),
  observaciones: z.string(),
});
export type Ruta = z.infer<typeof rutaSchema>;

export const createRutaSchema = z.object({
  codigoRuta: identifierSchema('El código de ruta', 20).optional(),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  idEmpleado: z.number().int().positive('Selecciona un empleado responsable'),
  fecha: optionalIsoDateSchema('La fecha'),
  estado: z.enum(ESTADOS_RUTA).default('PLANIFICADA'),
  observaciones: optionalTrimmedText('Las observaciones', 500),
});
export type CreateRutaInput = z.infer<typeof createRutaSchema>;

export const updateRutaSchema = createRutaSchema.partial();
export type UpdateRutaInput = z.infer<typeof updateRutaSchema>;
