import { z } from 'zod';
import { NotificationStatus } from '@prisma/client';
import { paginationQuerySchema } from '../../../core/http/pagination';

export const createNotificationSchema = z.object({
  recipientUserId: z.coerce.number().int().positive(),
  studentId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1, 'Title is required').max(150),
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

export const sendToParentsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

const BROADCAST_AUDIENCES = [
  'ALL_STAFF',
  'ALL_TEACHERS',
  'ALL_PARENTS',
  'ALL_STUDENTS',
  'CLASSROOM_STUDENTS',
  'CLASSROOM_PARENTS',
] as const;

export const broadcastNotificationSchema = z
  .object({
    audience: z.enum(BROADCAST_AUDIENCES),
    classroomId: z.coerce.number().int().positive().optional(),
    title: z.string().trim().min(1, 'Title is required').max(150),
    message: z.string().trim().min(1, 'Message is required').max(2000),
  })
  .refine(
    (data) => !(data.audience === 'CLASSROOM_STUDENTS' || data.audience === 'CLASSROOM_PARENTS') || data.classroomId !== undefined,
    { message: 'classroomId is required for this audience', path: ['classroomId'] }
  );

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(NotificationStatus).optional(),
});

export const listAllNotificationsQuerySchema = listNotificationsQuerySchema.extend({
  recipientUserId: z.coerce.number().int().positive().optional(),
  studentId: z.coerce.number().int().positive().optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const studentIdParamSchema = z.object({
  studentId: z.coerce.number().int().positive(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type SendToParentsInput = z.infer<typeof sendToParentsSchema>;
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type ListAllNotificationsQuery = z.infer<typeof listAllNotificationsQuerySchema>;
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
