import { z } from 'zod';

export const consultaSchema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
  tipo: z.enum(['energia', 'agua']),
});
