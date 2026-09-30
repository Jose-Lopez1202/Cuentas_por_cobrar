import { z } from 'zod';
import {
  nullableIsoDateSchema,
  optionalMoneySchema,
  percentageSchema,
} from '../validation';

export const ESTADOS_MORA = ['ACTIVA', 'PAGADA', 'ANULADA'] as const;

export const moraSchema = z.object({
  idMora: z.number().int(),
  idDocumento: z.number().int(),
  diasMora: z.number().int().nullable(),
  saldoVencido: z.number().nullable(),
  porcentajeMora: z.number().nullable(),
  montoMora: z.number().nullable(),
  fechaCalculo: z.string().nullable(),
  estado: z.enum(ESTADOS_MORA),
});

export type Mora = z.infer<typeof moraSchema>;

const nullablePercentageSchema = percentageSchema('El porcentaje de mora').nullable().optional();

export const createMoraSchema = z.object({
  idDocumento: z.number().int().positive('El documento es obligatorio'),
  diasMora: z.number().int().nonnegative('Los días de mora no pueden ser negativos').max(36500, 'Los días de mora exceden el rango permitido').nullable().optional(),
  saldoVencido: optionalMoneySchema('El saldo vencido'),
  porcentajeMora: nullablePercentageSchema,
  montoMora: optionalMoneySchema('El monto de mora'),
  fechaCalculo: nullableIsoDateSchema('La fecha de cálculo'),
  estado: z.enum(ESTADOS_MORA).default('ACTIVA'),
});

export type CreateMoraInput = z.infer<typeof createMoraSchema>;
export const updateMoraSchema = createMoraSchema.partial();
export type UpdateMoraInput = z.infer<typeof updateMoraSchema>;
