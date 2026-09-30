import { z } from 'zod';
import { isoDateSchema } from '../validation';
import { ESTADOS_DOCUMENTO } from './documento';

// Eventos que el propio servidor registra automáticamente (append-only) cada
// vez que una operación real mueve el saldo o el estado de un documento.
// El registro manual (formulario "Agregar historial") deja esto en null.
export const TIPOS_EVENTO_HISTORIAL = [
  'APLICACION_PAGO',
  'APLICACION_NOTA_CREDITO',
  'APLICACION_ANTICIPO',
  'REVERSA_APLICACION_PAGO',
  'REVERSA_APLICACION_NOTA_CREDITO',
  'REVERSA_APLICACION_ANTICIPO',
  'AJUSTE_APROBADO',
  'ANULACION_DOCUMENTO',
] as const;
export type TipoEventoHistorial = (typeof TIPOS_EVENTO_HISTORIAL)[number];

// CARGO = el movimiento aumentó el saldo pendiente (reversa, ajuste débito).
// ABONO = el movimiento redujo el saldo pendiente (aplicar pago/NC/anticipo, ajuste crédito).
export const NATURALEZAS_MOVIMIENTO = ['CARGO', 'ABONO'] as const;
export type NaturalezaMovimiento = (typeof NATURALEZAS_MOVIMIENTO)[number];

export const documentoHistorialSchema = z.object({
  idHistorial: z.number().int(),
  idDocumento: z.number().int(),
  estadoAnterior: z.string().nullable(),
  estadoNuevo: z.string(),
  fecha: z.string(),
  idEmpleado: z.number().int(),
  nombreEmpleado: z.string().nullable().optional(),
  tipoEvento: z.enum(TIPOS_EVENTO_HISTORIAL).nullable().optional(),
  monto: z.number().nullable().optional(),
  naturaleza: z.enum(NATURALEZAS_MOVIMIENTO).nullable().optional(),
  descripcion: z.string().nullable().optional(),
});
export type DocumentoHistorial = z.infer<typeof documentoHistorialSchema>;

export const createDocumentoHistorialSchema = z.object({
  idDocumento: z.number().int().positive(),
  estadoAnterior: z.enum(ESTADOS_DOCUMENTO).nullable().optional(),
  estadoNuevo: z.enum(ESTADOS_DOCUMENTO, { message: 'Selecciona un estado válido' }),
  fecha: isoDateSchema('La fecha').optional(),
  idEmpleado: z.number().int().positive('Selecciona un empleado'),
});
export type CreateDocumentoHistorialInput = z.infer<typeof createDocumentoHistorialSchema>;

export const updateDocumentoHistorialSchema = createDocumentoHistorialSchema
  .omit({ idDocumento: true })
  .partial();
export type UpdateDocumentoHistorialInput = z.infer<typeof updateDocumentoHistorialSchema>;

// Input interno (no expuesto por HTTP): lo usan los repositorios de
// aplicaciones/ajustes/documento para dejar un registro automático dentro de
// su propia transacción, reusando la conexión y sin pedir estos datos a un
// endpoint separado.
export interface RegistrarEventoHistorialInput {
  idDocumento: number;
  estadoAnterior: string | null;
  estadoNuevo: string;
  idEmpleado: number;
  tipoEvento: TipoEventoHistorial;
  monto?: number | null;
  naturaleza?: NaturalezaMovimiento | null;
  descripcion?: string | null;
  fecha?: string | null;
}
