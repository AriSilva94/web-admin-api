import { z } from 'zod';

export const updateHuntSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    huntingSpot: z.string().max(120).nullable().optional(),
    characterName: z.string().max(60).nullable().optional(),
    vocation: z.string().max(40).nullable().optional(),
    level: z.number().int().positive().nullable().optional(),
    tags: z.array(z.string().min(1)).max(30).optional(),
    notes: z.string().max(2000).nullable().optional(),
    wheelCode: z.string().max(64).nullable().optional(),
    visibility: z.enum(['PRIVATE', 'FRIENDS']).optional(),
  })
  .strict();

export type UpdateHuntDto = z.infer<typeof updateHuntSchema>;
