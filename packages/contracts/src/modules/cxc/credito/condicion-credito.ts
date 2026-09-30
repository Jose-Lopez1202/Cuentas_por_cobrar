import { z } from 'zod';
import { percentageSchema } from '../validation';

export const ESTADOS_CONDICION_CREDITO = ['A', 'I'] as const;

export const condicionCreditoSchema = z.object({
  idCondicion: z.number().int(),
  diasCredito: z.number().int(),
  porcentajeMora: z.number(),
  diasGracia: z.number().int(),
  estado: z.enum(ESTADOS_CONDICION_CREDITO),
});

export type CondicionCredito = z.infer<typeof condicionCreditoSchema>;

export const createCondicionCreditoSchema = z.object({
  diasCredito: z.number().int().min(0, 'Los días de crédito no pueden ser negativos').max(3650, 'Los días de crédito exceden el rango permitido'),
  porcentajeMora: percentageSchema('El porcentaje de mora'),
  diasGracia: z.number().int().min(0, 'Los días de gracia no pueden ser negativos').max(365, 'Los días de gracia exceden el rango permitido'),
  estado: z.enum(ESTADOS_CONDICION_CREDITO).default('A'),
});

export type CreateCondicionCreditoInput = z.infer<typeof createCondicionCreditoSchema>;

export const updateCondicionCreditoSchema = createCondicionCreditoSchema.partial();
export type UpdateCondicionCreditoInput = z.infer<typeof updateCondicionCreditoSchema>;
