import { z } from 'zod';

export const shareSchema = z.object({ userId: z.string().min(1) });

export type ShareDto = z.infer<typeof shareSchema>;
