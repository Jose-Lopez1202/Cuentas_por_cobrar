import { z } from 'zod';

export const documentoCatalogoOptionSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  nit: z.string().nullable().optional(),
  saldo: z.number().optional(),
});

export type DocumentoCatalogoOption = z.infer<typeof documentoCatalogoOptionSchema>;
