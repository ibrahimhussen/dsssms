import { z } from 'zod';
import { paginationQuerySchema } from '../../../core/http/pagination';

export const sendMessageSchema = z.object({
  studentId:       z.coerce.number().int().positive(),
  recipientUserId: z.coerce.number().int().positive(),
  body:            z.string().trim().min(1, 'Message body is required').max(2000),
});

export const replyMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message body is required').max(2000),
});

export const messageIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listThreadsQuerySchema = paginationQuerySchema.extend({
  studentId: z.coerce.number().int().positive().optional(),
});

export const threadQuerySchema = z.object({
  studentId:   z.coerce.number().int().positive(),
  otherUserId: z.coerce.number().int().positive(),
});

export type SendMessageInput   = z.infer<typeof sendMessageSchema>;
export type ReplyMessageInput  = z.infer<typeof replyMessageSchema>;
export type MessageIdParam     = z.infer<typeof messageIdParamSchema>;
export type ListThreadsQuery   = z.infer<typeof listThreadsQuerySchema>;
export type ThreadQuery        = z.infer<typeof threadQuerySchema>;
