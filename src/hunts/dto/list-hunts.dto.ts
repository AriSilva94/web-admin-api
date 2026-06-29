import { z } from 'zod';

const isoDateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const listHuntsSchema = z.object({
  type: z.enum(['SOLO', 'PARTY']).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  huntingSpot: z.string().optional(),
  characterName: z.string().optional(),
  tags: z.string().optional(),
  visibility: z.enum(['PRIVATE', 'FRIENDS']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type ListHuntsQuery = z.infer<typeof listHuntsSchema>;
