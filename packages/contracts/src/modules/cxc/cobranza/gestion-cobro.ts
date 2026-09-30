import { z } from 'zod';
import { optionalIsoDateSchema, optionalMoneySchema, optionalTrimmedText } from '../validation';

export const TIPOS_GESTION_COBRO = ['LLAMADA', 'VISITA', 'EMAIL', 'WHATSAPP', 'CARTA', 'OTRO'] as const;

export const gestionCobroSchema = z.object({
  idGestion: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  idDocumento: z.number().int().nullable(),
  idEmpleado: z.number().int(),
  nombreEmpleado: z.string().nullable().optional(),
  fechaGestion: z.string(),
  tipoGestion: z.enum(TIPOS_GESTION_COBRO).nullable(),
  resultado: z.string().nullable(),
  observacion: z.string().nullable(),
  fechaCompromiso: z.string().nullable(),
  montoCompromiso: z.number().nullable(),
});
export type GestionCobro = z.infer<typeof gestionCobroSchema>;

export const createGestionCobroSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  idDocumento: z.number().int().positive('Selecciona un documento válido').nullable().optional(),
  idEmpleado: z.number().int().positive('Selecciona un empleado responsable'),
  fechaGestion: optionalIsoDateSchema('La fecha de gestión'),
  tipoGestion: z.enum(TIPOS_GESTION_COBRO).nullable().optional(),
  resultado: optionalTrimmedText('El resultado', 80),
  observacion: optionalTrimmedText('La observación', 500),
  fechaCompromiso: optionalIsoDateSchema('La fecha de compromiso'),
  montoCompromiso: optionalMoneySchema('El monto comprometido', true),
});
export type CreateGestionCobroInput = z.infer<typeof createGestionCobroSchema>;

export const updateGestionCobroSchema = createGestionCobroSchema.partial();
export type UpdateGestionCobroInput = z.infer<typeof updateGestionCobroSchema>;
