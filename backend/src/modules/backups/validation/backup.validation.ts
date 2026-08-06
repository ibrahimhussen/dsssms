import { z } from 'zod';

export const restoreBackupSchema = z.object({
  confirm: z.literal(true, 'You must set confirm: true to restore a backup'),
});

export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;
