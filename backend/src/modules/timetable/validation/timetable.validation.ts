import { z } from 'zod';
import { DayOfWeek, Semester } from '@prisma/client';

const timeField = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in 24-hour HH:MM format, e.g. "08:30"');

export const createTimetableEntrySchema = z
  .object({
    teacherSubjectId: z.coerce.number().int().positive(),
    semester: z.nativeEnum(Semester).default(Semester.SEMESTER_1),
    dayOfWeek: z.nativeEnum(DayOfWeek),
    period: z.coerce.number().int().positive(),
    startTime: timeField,
    endTime: timeField,
    roomNumber: z.string().trim().max(50).optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export const listTimetableQuerySchema = z.object({
  classroomId: z.coerce.number().int().positive().optional(),
  teacherSubjectId: z.coerce.number().int().positive().optional(),
  semester: z.nativeEnum(Semester).optional(),
});

export const timetableEntryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateTimetableEntryInput = z.infer<typeof createTimetableEntrySchema>;
export type ListTimetableQuery = z.infer<typeof listTimetableQuerySchema>;
export type TimetableEntryIdParam = z.infer<typeof timetableEntryIdParamSchema>;
