import { z } from 'zod';
import { isoDateSchema, moneySchema, optionalTrimmedText } from '../validation';
import { convenioDocumentoInputSchema } from './convenio-documento';

export const ESTADOS_CONVENIO_PAGO = ['ACTIVO', 'CUMPLIDO', 'INCUMPLIDO', 'CANCELADO'] as const;

export const convenioPagoSchema = z.object({
  idConvenio: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  fechaConvenio: z.string(),
  montoDeuda: z.number(),
  numeroCuotas: z.number().int(),
  estado: z.enum(ESTADOS_CONVENIO_PAGO),
  observaciones: z.string().nullable(),
});
export type ConvenioPago = z.infer<typeof convenioPagoSchema>;

export const createConvenioPagoSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  fechaConvenio: isoDateSchema('La fecha del convenio'),
  montoDeuda: moneySchema('El monto de la deuda', true),
  numeroCuotas: z.number().int('El número de cuotas debe ser entero').min(1, 'Debe tener al menos 1 cuota').max(60, 'No puede superar 60 cuotas'),
  estado: z.enum(ESTADOS_CONVENIO_PAGO).default('ACTIVO'),
  observaciones: optionalTrimmedText('Las observaciones', 500),
  // Documentos reales que cubre el convenio: sin esto, pagar una cuota no
  // tendría a qué documento bajarle el saldo. La suma debe igualar montoDeuda
  // (se valida en el service, con datos frescos del saldo de cada documento).
  documentos: z.array(convenioDocumentoInputSchema).min(1, 'Selecciona al menos un documento que cubra el convenio'),
});
export type CreateConvenioPagoInput = z.infer<typeof createConvenioPagoSchema>;
export const updateConvenioPagoSchema = createConvenioPagoSchema.partial();
export type UpdateConvenioPagoInput = z.infer<typeof updateConvenioPagoSchema>;
