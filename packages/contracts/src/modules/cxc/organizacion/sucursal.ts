import { z } from 'zod';

export const ESTADOS_SUCURSAL = ['A', 'I'] as const;

export const sucursalSchema = z.object({
  idSucursal: z.number().int(),
  idEmpresa: z.number().int(),
  nombreEmpresa: z.string().nullable().optional(),
  nombre: z.string(),
  direccion: z.string().nullable(),
  estado: z.string(),
});
export type Sucursal = z.infer<typeof sucursalSchema>;

export const createSucursalSchema = z.object({
  idEmpresa: z.number().int().positive('Selecciona una empresa'),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  direccion: z.string().max(200).optional(),
  estado: z.enum(ESTADOS_SUCURSAL).default('A'),
});
export type CreateSucursalInput = z.infer<typeof createSucursalSchema>;

export const updateSucursalSchema = createSucursalSchema.partial();
export type UpdateSucursalInput = z.infer<typeof updateSucursalSchema>;
