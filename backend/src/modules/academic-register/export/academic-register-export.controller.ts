import { Request, Response } from 'express';
import { asyncHandler } from '../../../core/http/async-handler';
import { UnauthorizedError } from '../../../core/errors/app-error';
import { academicRegisterService } from '../academic-register.service';
import { RegisterViewMode } from '../dto/academic-register.dto';
import { ExportRegisterQuery } from '../validation/academic-register.validation';

export class AcademicRegisterExportController {
  exportRegister = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as ExportRegisterQuery;

    const register = await academicRegisterService.getFullRegisterForExport(
      req.user,
      query.classroomId,
      query.academicYear,
      query.viewMode as RegisterViewMode
    );

    if (query.format === 'csv') {
      const csv = buildCsv(register);
      const filename = `register-${register.metadata.classroomLabel.replace(/\s/g, '_')}-${query.viewMode}-${query.academicYear}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    // Excel: return as CSV with .xlsx extension for now (can upgrade to exceljs later)
    const csv = buildCsv(register);
    const filename = `register-${register.metadata.classroomLabel.replace(/\s/g, '_')}-${query.viewMode}-${query.academicYear}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  });
}

export const academicRegisterExportController = new AcademicRegisterExportController();

// ── CSV builder ───────────────────────────────────────────────────────────────

function escape(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(register: Awaited<ReturnType<typeof academicRegisterService.getFullRegisterForExport>>): string {
  const subjectHeaders = register.subjects.map((s) => escape(s.subjectName));
  const headers = [
    '#', 'Admission No.', 'Full Name', 'Gender', 'Age',
    ...subjectHeaders,
    'Total Obtained', 'Total Possible', 'Average',
    'Section Rank', 'Grade Rank', 'Conduct', 'Status',
  ];

  const rows = register.students.map((s, idx) => [
    idx + 1,
    s.admissionNumber,
    s.studentName,
    s.gender === 'M' ? 'Male' : 'Female',
    s.age,
    ...register.subjects.map((sub) => {
      const r = s.subjectResults.find((sr) => sr.subjectId === sub.subjectId);
      return r?.finalResult !== null && r?.finalResult !== undefined ? r.finalResult : '';
    }),
    s.totalObtained ?? '',
    s.totalPossible ?? '',
    s.average ?? '',
    s.sectionRank ? `${s.sectionRank}/${s.totalStudentsInSection}` : '',
    s.gradeRank ? `${s.gradeRank}/${s.totalStudentsInGrade}` : '',
    s.conduct ?? '',
    s.academicStatus,
  ]);

  const allRows = [headers, ...rows];
  return allRows.map((row) => row.map(escape).join(',')).join('\r\n');
}
