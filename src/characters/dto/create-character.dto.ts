import { z } from 'zod';

export const createCharacterSchema = z.object({
  name: z.string().min(1).max(60),
});

export type CreateCharacterDto = z.infer<typeof createCharacterSchema>;
