import { z } from 'zod';
import { DayOfWeek, Semester } from '@prisma/client';

const timeField = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in 24-hour HH:MM format, e.g. "08:30"');

/** Break slots that cannot receive a timetable entry */
const BREAK_SLOTS = [
  { startTime: '10:00', endTime: '10:15' }, // Morning break  04:00–04:15 local
  { startTime: '14:30', endTime: '14:45' }, // Afternoon break 08:30–08:45 local
];

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
  })
  .refine(
    (data) => !BREAK_SLOTS.some((b) => b.startTime === data.startTime && b.endTime === data.endTime),
    {
      message: 'This time slot is a break period and cannot be assigned a class',
      path: ['startTime'],
    }
  );

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
