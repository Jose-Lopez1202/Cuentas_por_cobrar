import { z } from 'zod';
import { moneySchema } from '../validation';

/**
 * Documentos reales que un convenio de pago cubre. Un convenio negocia una
 * deuda global del cliente, pero esa deuda siempre proviene de documentos
 * concretos: sin este link, pagar una cuota del convenio no tenía forma de
 * saber a qué documento bajarle el saldo (quedaba completamente desconectado
 * del núcleo financiero).
 */
export const convenioDocumentoSchema = z.object({
  idConvenioDocumento: z.number().int(),
  idConvenio: z.number().int(),
  idDocumento: z.number().int(),
  referenciaDocumento: z.string().nullable().optional(),
  montoIncluido: z.number(),
  saldoActualDocumento: z.number().nullable().optional(),
});
export type ConvenioDocumento = z.infer<typeof convenioDocumentoSchema>;

export const convenioDocumentoInputSchema = z.object({
  idDocumento: z.number().int().positive('Selecciona un documento válido'),
  montoIncluido: moneySchema('El monto incluido', true),
});
export type ConvenioDocumentoInput = z.infer<typeof convenioDocumentoInputSchema>;
