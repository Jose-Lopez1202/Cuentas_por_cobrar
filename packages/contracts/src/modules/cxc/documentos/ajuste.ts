import { z } from 'zod';
import { isoDateSchema, moneySchema } from '../validation';

export const TIPOS_AJUSTE = ['DEBITO', 'CREDITO'] as const;
// EN_2DA_APROBACION: la primera aprobación ya ocurrió (no mueve saldo);
// se necesita un SEGUNDO empleado, distinto del primero, para llegar a
// APROBADO y recién ahí afectar el saldo del documento (doble aprobación).
export const ESTADOS_AJUSTE = ['PENDIENTE', 'EN_2DA_APROBACION', 'APROBADO', 'RECHAZADO', 'ANULADO'] as const;

export const ajusteSchema = z.object({
  idAjuste: z.number().int(),
  idCliente: z.number().int(),
  nombreCliente: z.string().nullable().optional(),
  idDocumento: z.number().int().nullable(),
  tipoAjuste: z.string(),
  monto: z.number(),
  motivo: z.string().nullable(),
  fecha: z.string(),
  idEmpleado: z.number().int(),
  nombreEmpleado: z.string().nullable().optional(),
  // Flujo de doble aprobación: el ajuste NO mueve saldo hasta la SEGUNDA aprobación.
  estado: z.enum(ESTADOS_AJUSTE),
  idEmpleadoAprobador: z.number().int().nullable(),
  nombreEmpleadoAprobador: z.string().nullable().optional(),
  fechaAprobacion: z.string().nullable(),
  idEmpleadoAprobador2: z.number().int().nullable(),
  nombreEmpleadoAprobador2: z.string().nullable().optional(),
  fechaAprobacion2: z.string().nullable(),
  motivoRechazo: z.string().nullable(),
});
export type Ajuste = z.infer<typeof ajusteSchema>;

export const createAjusteSchema = z.object({
  idCliente: z.number().int().positive('Selecciona un cliente'),
  idDocumento: z.number().int().positive().nullable().optional(),
  tipoAjuste: z.enum(TIPOS_AJUSTE, { message: 'Selecciona Débito o Crédito' }),
  monto: moneySchema('El monto', true),
  motivo: z.string().trim().min(10, 'Describe el motivo del ajuste (mínimo 10 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
  fecha: isoDateSchema('La fecha').optional(),
  idEmpleado: z.number().int().positive('Selecciona un empleado'),
});
export type CreateAjusteInput = z.infer<typeof createAjusteSchema>;

export const updateAjusteSchema = createAjusteSchema.partial();
export type UpdateAjusteInput = z.infer<typeof updateAjusteSchema>;

export const aprobarAjusteSchema = z.object({
  idEmpleadoAprobador: z.number().int().positive('Selecciona el empleado que aprueba'),
  fechaAprobacion: isoDateSchema('La fecha de aprobación').optional(),
});
export type AprobarAjusteInput = z.infer<typeof aprobarAjusteSchema>;

export const rechazarAjusteSchema = z.object({
  idEmpleadoAprobador: z.number().int().positive('Selecciona el empleado que rechaza'),
  motivoRechazo: z.string().trim().min(5, 'Describe el motivo del rechazo (mínimo 5 caracteres)').max(250, 'El motivo no puede superar 250 caracteres'),
  fechaAprobacion: isoDateSchema('La fecha de rechazo').optional(),
});
export type RechazarAjusteInput = z.infer<typeof rechazarAjusteSchema>;
