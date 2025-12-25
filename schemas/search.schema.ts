import { z } from 'zod';

export const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .max(80, 'La recherche est trop longue (80 caracteres max).'),
});

export type SearchFormValues = z.infer<typeof searchSchema>;
