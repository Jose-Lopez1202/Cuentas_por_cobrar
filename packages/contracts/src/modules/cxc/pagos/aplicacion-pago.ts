import { z } from 'zod';
import { isoDateSchema, moneySchema } from '../validation';

export const ESTADOS_APLICACION_PAGO = ['CONFIRMADA', 'REVERSADA'] as const;

export const aplicacionPagoSchema = z.object({
  idAplicacion: z.number().int(),
  idRutaDetalle: z.number().int().nullable().optional(),
  idPago: z.number().int(),
  referenciaPago: z.string().nullable().optional(),
  idDocumento: z.number().int(),
  referenciaDocumento: z.string().nullable().optional(),
  fechaAplicacion: z.string(),
  montoAplicado: z.number(),
  idEmpleado: z.number().int().nullable(),
  nombreEmpleado: z.string().nullable().optional(),
  estado: z.enum(ESTADOS_APLICACION_PAGO),
  idEmpleadoReversa: z.number().int().nullable(),
  nombreEmpleadoReversa: z.string().nullable().optional(),
  fechaReversa: z.string().nullable(),
  motivoReversa: z.string().nullable(),
});
export type AplicacionPago = z.infer<typeof aplicacionPagoSchema>;

export const createAplicacionPagoSchema = z.object({
  idRutaDetalle: z.number().int().positive().optional(),
  claveRuta: z.string().uuid().optional(),
  idPago: z.number().int().positive('El pago es obligatorio'),
  idDocumento: z.number().int().positive('El documento es obligatorio'),
  fechaAplicacion: isoDateSchema('La fecha de aplicación'),
  montoAplicado: moneySchema('El monto aplicado', true),
  idEmpleado: z.number().int().positive('Selecciona el empleado que aplica el pago'),
});
export type CreateAplicacionPagoInput = z.infer<typeof createAplicacionPagoSchema>;

export const updateAplicacionPagoSchema = createAplicacionPagoSchema.partial();
export type UpdateAplicacionPagoInput = z.infer<typeof updateAplicacionPagoSchema>;

export const reversarAplicacionPagoSchema = z.object({
  idEmpleadoReversa: z.number().int().positive('Selecciona el empleado que reversa'),
  motivoReversa: z.string().trim().min(10, 'Describe el motivo de la reversa (mínimo 10 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
  fechaReversa: isoDateSchema('La fecha de reversa').optional(),
});
export type ReversarAplicacionPagoInput = z.infer<typeof reversarAplicacionPagoSchema>;
