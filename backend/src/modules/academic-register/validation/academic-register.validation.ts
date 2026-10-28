import { z } from 'zod';

// Matches both plain year ("2026") and slash-separated ("2026/27") —
// the same pattern used by the classroom creation schema.
// DB classrooms may use either format depending on when they were created.
const academicYearField = z
  .string()
  .trim()
  .regex(
    /^\d{4}(\/\d{2,4})?$/,
    'Academic year must be in format YYYY (e.g. 2026) or YYYY/YY (e.g. 2026/27)',
  );

const viewModeField = z.enum(['SEMESTER_1', 'SEMESTER_2', 'FULL_YEAR']);

// GET /academic-register?classroomId=1&academicYear=2026/27&viewMode=SEMESTER_1
export const classroomRegisterSchema = z.object({
  classroomId:  z.coerce.number().int().positive(),
  academicYear: academicYearField,
  viewMode:     viewModeField,
});

// GET /academic-register/grade  ?grade=Grade+11&academicYear=2026/27&viewMode=FULL_YEAR
export const gradeRegisterSchema = z.object({
  grade:        z.string().trim().min(1),
  academicYear: academicYearField,
  viewMode:     viewModeField,
});

// GET /academic-register/export?classroomId=1&academicYear=2026/27&viewMode=SEMESTER_1&format=excel|csv
export const exportRegisterSchema = z.object({
  classroomId:  z.coerce.number().int().positive(),
  academicYear: academicYearField,
  viewMode:     viewModeField,
  format:       z.enum(['excel', 'csv']).default('csv'),
});

export type ClassroomRegisterQuery = z.infer<typeof classroomRegisterSchema>;
export type GradeRegisterQuery     = z.infer<typeof gradeRegisterSchema>;
export type ExportRegisterQuery    = z.infer<typeof exportRegisterSchema>;
