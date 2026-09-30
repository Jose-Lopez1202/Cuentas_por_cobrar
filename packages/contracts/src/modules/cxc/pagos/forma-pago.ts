import { z } from 'zod';
export const REQUIERE_REFERENCIA_FORMA_PAGO = ['S', 'N'] as const;
export const ESTADOS_FORMA_PAGO = ['A', 'I'] as const;
export const formaPagoSchema = z.object({
  idFormaPago: z.number().int(), nombre: z.string(), requiereReferencia: z.enum(REQUIERE_REFERENCIA_FORMA_PAGO), estado: z.enum(ESTADOS_FORMA_PAGO),
});
export type FormaPago = z.infer<typeof formaPagoSchema>;
export const createFormaPagoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  requiereReferencia: z.enum(REQUIERE_REFERENCIA_FORMA_PAGO), estado: z.enum(ESTADOS_FORMA_PAGO),
});
export type CreateFormaPagoInput = z.infer<typeof createFormaPagoSchema>;
export const updateFormaPagoSchema = createFormaPagoSchema.partial();
export type UpdateFormaPagoInput = z.infer<typeof updateFormaPagoSchema>;
