import { z } from 'zod';
import { moneySchema, optionalTrimmedText, timeSchema } from '../validation';

// Hora de visita permitida: de 08:00 a 19:00.
const HORA_VISITA_MIN = '08:00';
const HORA_VISITA_MAX = '19:00';

export const ESTADOS_VISITA = ['PENDIENTE', 'VISITADO', 'NO_ENCONTRADO', 'REPROGRAMADO'] as const;

export const rutaDetalleSchema = z.object({
  idRutaDetalle: z.number().int(),
  idDocumento: z.number().int().nullable().optional(),
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
  ordenVisita: z.number().int().positive('El orden debe ser un entero positivo').nullable().optional(),
  direccion: optionalTrimmedText('La dirección', 200).refine(
    (v) => !v || /^[\p{L}\p{N}\s-]+$/u.test(v),
    'La dirección solo admite letras, números, espacios y guion (-)',
  ),
  montoPendiente: moneySchema('El monto pendiente', true).nullable().optional(),
  estadoVisita: z.enum(ESTADOS_VISITA).optional(),
  horaVisita: timeSchema('La hora de visita').nullable().refine(
    (v) => !v || (v >= HORA_VISITA_MIN && v <= HORA_VISITA_MAX),
    `La hora de visita debe estar entre ${HORA_VISITA_MIN} y ${HORA_VISITA_MAX}`,
  ),
  observaciones: optionalTrimmedText('Las observaciones', 500).refine(
    (v) => !v || /^[\p{L}\s]+$/u.test(v),
    'Las observaciones solo admiten letras y espacios',
  ),
});
export type CreateRutaDetalleInput = z.infer<typeof createRutaDetalleSchema>;

export const updateRutaDetalleSchema = createRutaDetalleSchema.partial();
export type UpdateRutaDetalleInput = z.infer<typeof updateRutaDetalleSchema>;