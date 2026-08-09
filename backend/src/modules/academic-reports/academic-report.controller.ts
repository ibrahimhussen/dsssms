import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { buildReportCardPdf } from '../../core/export/report-card-pdf.util';
import { buildTranscriptPdf } from '../../core/export/transcript-pdf.util';
import { academicReportService } from './academic-report.service';
import { GenerateClassroomReportsInput, ReportPeriodQuery, StudentIdParam } from './validation/academic-report.validation';
import { studentService } from '../students/student.service';
import { gradeService } from '../grades/grade.service';
import { systemSettingService } from '../system-settings/system-setting.service';

export class AcademicReportController {
  generateForClassroom = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as GenerateClassroomReportsInput;
    const result = await academicReportService.generateClassroomReports(input);
    ApiResponse.success(res, {
      statusCode: 201,
      message:
        result.skippedStudentIds.length > 0
          ? `Reports generated. ${result.skippedStudentIds.length} student(s) had no grades for this period and were skipped.`
          : 'Reports generated for the whole classroom',
      data: result,
    });
  });

  getStudentReport = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const { semester, academicYear } = req.query as unknown as ReportPeriodQuery;
    const report = await academicReportService.getStudentReport(req.user, studentId, semester, academicYear);
    ApiResponse.success(res, { message: 'Academic report retrieved', data: report });
  });

  getReportCardPdf = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const { semester, academicYear } = req.query as unknown as ReportPeriodQuery;

    const [report, student, subjects, settings] = await Promise.all([
      academicReportService.getStudentReport(req.user, studentId, semester, academicYear),
      studentService.getStudentById(studentId),
      gradeService.getStudentGrades(req.user, studentId, { semester, academicYear }),
      systemSettingService.get(),
    ]);

    const buffer = await buildReportCardPdf({
      schoolName: settings.schoolName,
      studentName: report.studentName,
      admissionNumber: student.admissionNumber,
      classroomLabel: `${student.classroom.className} ${student.classroom.section}`,
      semester: report.semester,
      academicYear: report.academicYear,
      averageMark: report.averageMark,
      rank: report.rank,
      subjects,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-card-${student.admissionNumber}.pdf"`);
    res.send(buffer);
  });

  listStudentReports = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const reports = await academicReportService.listStudentReports(req.user, studentId);
    ApiResponse.success(res, { message: 'Academic reports retrieved', data: reports });
  });

  getTranscript = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const transcript = await academicReportService.getStudentTranscript(req.user, studentId);
    ApiResponse.success(res, { message: 'Transcript retrieved', data: transcript });
  });

  getTranscriptPdf = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;

    const [transcript, settings] = await Promise.all([
      academicReportService.getStudentTranscript(req.user, studentId),
      systemSettingService.get(),
    ]);

    const buffer = await buildTranscriptPdf(settings.schoolName, transcript);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="transcript-${transcript.admissionNumber}.pdf"`);
    res.send(buffer);
  });

  /** Convenience endpoint: the logged-in student's own report history. */
  getMyReports = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const me = await studentService.getStudentByUserId(req.user.userId);
    const reports = await academicReportService.listStudentReports(req.user, me.studentId);
    ApiResponse.success(res, { message: 'Your academic reports', data: reports });
  });

  /** Convenience endpoint: the logged-in student's own transcript. */
  getMyTranscript = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const me = await studentService.getStudentByUserId(req.user.userId);
    const transcript = await academicReportService.getStudentTranscript(req.user, me.studentId);
    ApiResponse.success(res, { message: 'Your transcript', data: transcript });
  });
}

export const academicReportController = new AcademicReportController();
