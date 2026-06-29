import { z } from 'zod';

export const previewSchema = z.object({
  raw: z.string().min(1),
});

export type PreviewDto = z.infer<typeof previewSchema>;
