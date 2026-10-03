import { z } from 'zod';
import { moneySchema, isoDateSchema } from '../validation';
const id = z.number().int().positive();
export const asignarDocumentoRutaSchema = z.object({
  idDocumento: id, idEmpleado: id, montoAsignado: moneySchema('Monto asignado', true),
  direccion: z.string().trim().min(1).max(250), ordenVisita: id,
  latitud: z.number().min(-90).max(90), longitud: z.number().min(-180).max(180),
});
export const registrarBitacoraRutaSchema = z.object({
  idAsignacion: id, tipo: z.enum(['VISITA', 'INCIDENCIA', 'REPROGRAMACION']),
  observaciones: z.string().trim().min(1).max(500),
});
export const cobrarRutaSchema = z.object({
  idAsignacion: id, idPago: id, idEmpleado: id,
  monto: moneySchema('Monto a aplicar', true), fecha: isoDateSchema('Fecha del cobro'),
  claveOperacion: z.string().uuid(),
});
export const perfilCobradorSchema = z.object({
  telefono: z.string().trim().max(30),
  fotoUrl: z.string().max(1000).refine(v => {if (!v) return true; try {return new URL(v).protocol === 'https:';} catch {return false;}}, 'La foto debe usar una URL HTTPS'),
});
export type AsignarDocumentoRuta = z.infer<typeof asignarDocumentoRutaSchema>;
export type RegistrarBitacoraRuta = z.infer<typeof registrarBitacoraRutaSchema>;
export type PerfilCobradorInput = z.infer<typeof perfilCobradorSchema>;
export interface CobradorPerfil { ID_EMPLEADO: number; NOMBRE: string; TELEFONO: string | null; PUESTO: string | null; EMAIL: string | null; FOTO_URL: string | null }
export interface RutaAsignacion { ID_ASIGNACION: number; ID_DOCUMENTO: number; ID_CLIENTE: number; DOCUMENTO: string; CLIENTE: string; ID_EMPLEADO: number; COBRADOR: string; MONTO_ASIGNADO: number; MONTO_REGISTRADO: number; SALDO_DOCUMENTO: number; DIRECCION: string; LATITUD: number; LONGITUD: number; ID_MONEDA: number; MONEDA: string; ORDEN_VISITA: number; ESTADO_VISITA: string }
export interface RutaBitacora { ID_BITACORA: number; ID_ASIGNACION: number; TIPO: string; MONTO: number | null; OBSERVACIONES: string; REFERENCIA: string | null; FECHA: string; COBRADOR: string; DOCUMENTO: string; ESTADO: string | null; MONEDA: string | null; REGISTRADO_POR: string | null }
export interface RutaOperacion { asignaciones: RutaAsignacion[]; bitacora: RutaBitacora[]; cobradores: CobradorPerfil[] }
export interface RutaDocumentoPendiente { ID_DOCUMENTO: number; DOCUMENTO: string; SALDO: number; DISPONIBLE: number; CLIENTE: string; ID_MONEDA: number; MONEDA: string }
export interface RutaPagoDisponible { ID_PAGO: number; ID_CLIENTE: number; ID_MONEDA: number; REFERENCIA: string; DISPONIBLE: number; CLIENTE: string; MONEDA: string }
