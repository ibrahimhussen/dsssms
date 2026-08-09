import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { buildExcelWorkbook } from '../../core/export/excel-export.util';
import { attendanceService } from './attendance.service';
import {
  BulkMarkAttendanceInput,
  UpdateAttendanceInput,
  ClassroomAttendanceQuery,
  ClassroomAttendanceRangeQuery,
  StudentAttendanceQuery,
  AttendanceSummaryQuery,
  AttendanceIdParam,
  StudentIdParam,
} from './validation/attendance.validation';
import { studentService } from '../students/student.service';

export class AttendanceController {
  markBulk = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const input = req.body as BulkMarkAttendanceInput;
    const result = await attendanceService.markBulkAttendance(req.user, input);
    ApiResponse.success(res, { statusCode: 201, message: 'Attendance recorded', data: result });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as AttendanceIdParam;
    const input = req.body as UpdateAttendanceInput;
    const record = await attendanceService.updateAttendance(req.user, id, input);
    ApiResponse.success(res, { message: 'Attendance record updated', data: record });
  });

  getClassroomAttendance = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as ClassroomAttendanceQuery;
    const records = await attendanceService.getClassroomAttendance(req.user, query);
    ApiResponse.success(res, { message: 'Classroom attendance retrieved', data: records });
  });

  export = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as ClassroomAttendanceRangeQuery;
    const records = await attendanceService.exportClassroomAttendance(req.user, query);

    const buffer = await buildExcelWorkbook({
      sheetName: 'Attendance',
      columns: [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Student', key: 'student', width: 24 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Remarks', key: 'remarks', width: 30 },
        { header: 'Recorded by', key: 'recordedBy', width: 24 },
      ],
      rows: records.map((r) => ({
        date: new Date(r.attendanceDate).toLocaleDateString(),
        student: r.studentName,
        status: r.status,
        remarks: r.remarks ?? '',
        recordedBy: `${r.recordedBy.firstName} ${r.recordedBy.lastName}`,
      })),
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.xlsx"');
    res.send(buffer);
  });

  getStudentHistory = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const query = req.query as unknown as StudentAttendanceQuery;
    const { items, meta } = await attendanceService.getStudentAttendanceHistory(req.user, studentId, query);
    ApiResponse.success(res, { message: 'Attendance history retrieved', data: items, pagination: meta });
  });

  getStudentSummary = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const query = req.query as unknown as AttendanceSummaryQuery;
    const summary = await attendanceService.getStudentAttendanceSummary(req.user, studentId, query);
    ApiResponse.success(res, { message: 'Attendance summary retrieved', data: summary });
  });

  /** Convenience endpoint: the logged-in student's own attendance history. */
  getMyHistory = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const me = await studentService.getStudentByUserId(req.user.userId);
    const query = req.query as unknown as StudentAttendanceQuery;
    const { items, meta } = await attendanceService.getStudentAttendanceHistory(req.user, me.studentId, query);
    ApiResponse.success(res, { message: 'Your attendance history', data: items, pagination: meta });
  });

  /** Convenience endpoint: the logged-in student's own attendance summary. */
  getMySummary = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const me = await studentService.getStudentByUserId(req.user.userId);
    const query = req.query as unknown as AttendanceSummaryQuery;
    const summary = await attendanceService.getStudentAttendanceSummary(req.user, me.studentId, query);
    ApiResponse.success(res, { message: 'Your attendance summary', data: summary });
  });
}

export const attendanceController = new AttendanceController();
