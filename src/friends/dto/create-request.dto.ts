import { z } from 'zod';

export const createRequestSchema = z.object({
  email: z.string().email(),
});

export type CreateRequestDto = z.infer<typeof createRequestSchema>;
