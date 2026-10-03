import { z } from 'zod';
<<<<<<< HEAD
import { isoDateSchema, moneySchema, optionalTrimmedText } from '../validation';
import { convenioDocumentoInputSchema } from './convenio-documento';

export const ESTADOS_CONVENIO_PAGO = ['ACTIVO', 'CUMPLIDO', 'INCUMPLIDO', 'CANCELADO'] as const;
=======
import { isoDateSchema, moneySchema } from '../validation';
import { convenioDocumentoInputSchema } from './convenio-documento';

export const ESTADOS_CONVENIO_PAGO = ['ACTIVO', 'CUMPLIDO', 'INCUMPLIDO', 'CANCELADO'] as const;
export const MAX_CUOTAS_CONVENIO = 18;

// Observaciones: solo texto (letras, espacios y . , ; : ' -). Sin números ni símbolos como $ % # " ( /
const observacionesConvenioSchema = z
  .string()
  .trim()
  .max(500, 'Las observaciones no pueden superar 500 caracteres')
  .regex(/^[\p{L}\s.,;:'’-]*$/u, 'Las observaciones solo admiten texto: letras, espacios y . , ; : - (sin números ni símbolos)')
  .nullable()
  .optional();
>>>>>>> origin/develop

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

<<<<<<< HEAD
export const createConvenioPagoSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  fechaConvenio: isoDateSchema('La fecha del convenio'),
  montoDeuda: moneySchema('El monto de la deuda', true),
  numeroCuotas: z.number().int('El número de cuotas debe ser entero').min(1, 'Debe tener al menos 1 cuota').max(60, 'No puede superar 60 cuotas'),
  estado: z.enum(ESTADOS_CONVENIO_PAGO).default('ACTIVO'),
  observaciones: optionalTrimmedText('Las observaciones', 500),
=======
const convenioPagoBaseSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  fechaConvenio: isoDateSchema('La fecha del convenio'),
  montoDeuda: moneySchema('El monto de la deuda', true),
  numeroCuotas: z.number().int('El número de cuotas debe ser entero').min(1, 'Debe tener al menos 1 cuota').max(MAX_CUOTAS_CONVENIO, `No puede superar ${MAX_CUOTAS_CONVENIO} cuotas`),
  estado: z.enum(ESTADOS_CONVENIO_PAGO),
  observaciones: observacionesConvenioSchema,
>>>>>>> origin/develop
  // Documentos reales que cubre el convenio: sin esto, pagar una cuota no
  // tendría a qué documento bajarle el saldo. La suma debe igualar montoDeuda
  // (se valida en el service, con datos frescos del saldo de cada documento).
  documentos: z.array(convenioDocumentoInputSchema).min(1, 'Selecciona al menos un documento que cubra el convenio'),
});
<<<<<<< HEAD
export type CreateConvenioPagoInput = z.infer<typeof createConvenioPagoSchema>;
export const updateConvenioPagoSchema = createConvenioPagoSchema.partial();
=======

// El default 'ACTIVO' vive SOLO en la creación. Con Zod 4, un .default() dentro de
// .partial() se aplica igual: un PATCH {observaciones} devolvía el convenio a ACTIVO
// aunque estuviera INCUMPLIDO o CANCELADO.
export const createConvenioPagoSchema = convenioPagoBaseSchema.extend({
  estado: z.enum(ESTADOS_CONVENIO_PAGO).default('ACTIVO'),
});
export type CreateConvenioPagoInput = z.infer<typeof createConvenioPagoSchema>;
export const updateConvenioPagoSchema = convenioPagoBaseSchema.partial();
>>>>>>> origin/develop
export type UpdateConvenioPagoInput = z.infer<typeof updateConvenioPagoSchema>;
