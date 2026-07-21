import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { gradeService } from './grade.service';
import {
  BulkRecordGradesInput,
  UpdateGradeInput,
  ClassroomGradesQuery,
  StudentGradesQuery,
  GradeIdParam,
  StudentIdParam,
} from './validation/grade.validation';
import { studentService } from '../students/student.service';

export class GradeController {
  recordBulk = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const input = req.body as BulkRecordGradesInput;
    const result = await gradeService.recordBulkGrades(req.user, input);
    ApiResponse.success(res, { statusCode: 201, message: 'Grades recorded', data: result });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as GradeIdParam;
    const input = req.body as UpdateGradeInput;
    const record = await gradeService.updateGrade(req.user, id, input);
    ApiResponse.success(res, { message: 'Grade updated', data: record });
  });

  getClassroomGrades = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as ClassroomGradesQuery;
    const records = await gradeService.getClassroomGrades(req.user, query);
    ApiResponse.success(res, { message: 'Classroom grades retrieved', data: records });
  });

  getStudentGrades = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const query = req.query as unknown as StudentGradesQuery;
    const { items, meta } = await gradeService.getStudentGrades(req.user, studentId, query);
    ApiResponse.success(res, { message: 'Student grades retrieved', data: items, pagination: meta });
  });

  /** Convenience endpoint: the logged-in student's own grades. */
  getMyGrades = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const me = await studentService.getStudentByUserId(req.user.userId);
    const query = req.query as unknown as StudentGradesQuery;
    const { items, meta } = await gradeService.getStudentGrades(req.user, me.studentId, query);
    ApiResponse.success(res, { message: 'Your grades', data: items, pagination: meta });
  });
}

export const gradeController = new GradeController();
