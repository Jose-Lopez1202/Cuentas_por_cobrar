import { z } from 'zod';
import { moneySchema, optionalTrimmedText, timeSchema } from '../validation';

export const ESTADOS_VISITA = ['PENDIENTE', 'VISITADO', 'NO_ENCONTRADO', 'REPROGRAMADO'] as const;

export const rutaDetalleSchema = z.object({
  idRutaDetalle: z.number().int(),
  idRuta: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  ordenVisita: z.number().int().nullable(),
  direccion: z.string().nullable(),
  montoPendiente: z.number().nullable(),
  estadoVisita: z.string().nullable(),
  horaVisita: z.string().nullable(),
  observaciones: z.string().nullable(),
});
export type RutaDetalle = z.infer<typeof rutaDetalleSchema>;

export const createRutaDetalleSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  ordenVisita: z.number().int().positive('El orden debe ser un entero positivo').optional(),
  direccion: optionalTrimmedText('La dirección', 200),
  montoPendiente: moneySchema('El monto pendiente').optional(),
  estadoVisita: z.enum(ESTADOS_VISITA).optional(),
  horaVisita: timeSchema('La hora de visita'),
  observaciones: optionalTrimmedText('Las observaciones', 500),
});
export type CreateRutaDetalleInput = z.infer<typeof createRutaDetalleSchema>;

export const updateRutaDetalleSchema = createRutaDetalleSchema.partial();
export type UpdateRutaDetalleInput = z.infer<typeof updateRutaDetalleSchema>;
