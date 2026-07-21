import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { academicReportService } from './academic-report.service';
import { GenerateClassroomReportsInput, ReportPeriodQuery, StudentIdParam } from './validation/academic-report.validation';
import { studentService } from '../students/student.service';

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

  listStudentReports = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const reports = await academicReportService.listStudentReports(req.user, studentId);
    ApiResponse.success(res, { message: 'Academic reports retrieved', data: reports });
  });

  /** Convenience endpoint: the logged-in student's own report history. */
  getMyReports = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const me = await studentService.getStudentByUserId(req.user.userId);
    const reports = await academicReportService.listStudentReports(req.user, me.studentId);
    ApiResponse.success(res, { message: 'Your academic reports', data: reports });
  });
}

export const academicReportController = new AcademicReportController();
