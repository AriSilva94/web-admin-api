import { z } from 'zod';

export const createHuntSchema = z.object({
  raw: z.string().min(1),
  characterId: z.string().min(1),
  title: z.string().min(1).max(120).optional(),
  huntingSpot: z.string().max(120).optional(),
  tags: z.array(z.string().min(1)).max(30).optional(),
  notes: z.string().max(2000).optional(),
  wheelCode: z.string().max(64).optional(),
  visibility: z.enum(['PRIVATE', 'FRIENDS']).default('PRIVATE'),
});

export type CreateHuntDto = z.infer<typeof createHuntSchema>;
