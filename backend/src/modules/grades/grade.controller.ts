import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { gradeService } from './grade.service';
import {
  CreateGradeComponentInput,
  GradeComponentIdParam,
  GradeComponentQuery,
  RecordComponentEntriesInput,
  StudentGradesQuery,
  StudentIdParam,
} from './validation/grade.validation';
import { studentService } from '../students/student.service';

export class GradeController {
  createComponent = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const input = req.body as CreateGradeComponentInput;
    const component = await gradeService.createComponent(req.user, input);
    ApiResponse.success(res, { statusCode: 201, message: 'Grade component created', data: component });
  });

  deleteComponent = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as GradeComponentIdParam;
    await gradeService.deleteComponent(req.user, id);
    ApiResponse.success(res, { message: 'Grade component removed', data: null });
  });

  listComponents = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as GradeComponentQuery;
    const scheme = await gradeService.listComponents(req.user, query);
    ApiResponse.success(res, { message: 'Grade scheme retrieved', data: scheme });
  });

  recordComponentEntries = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as GradeComponentIdParam;
    const input = req.body as RecordComponentEntriesInput;
    const result = await gradeService.recordComponentEntries(req.user, id, input);
    ApiResponse.success(res, { message: 'Scores recorded', data: result });
  });

  getComponentRoster = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as GradeComponentIdParam;
    const roster = await gradeService.getComponentRoster(req.user, id);
    ApiResponse.success(res, { message: 'Roster retrieved', data: roster });
  });

  getClassroomTotals = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as GradeComponentQuery;
    const totals = await gradeService.getClassroomTotals(req.user, query);
    ApiResponse.success(res, { message: 'Classroom totals retrieved', data: totals });
  });

  getStudentGrades = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const query = req.query as unknown as StudentGradesQuery;
    const breakdown = await gradeService.getStudentGrades(req.user, studentId, query);
    ApiResponse.success(res, { message: 'Student grades retrieved', data: breakdown });
  });

  /** Convenience endpoint: the logged-in student's own grades. */
  getMyGrades = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const me = await studentService.getStudentByUserId(req.user.userId);
    const query = req.query as unknown as StudentGradesQuery;
    const breakdown = await gradeService.getStudentGrades(req.user, me.studentId, query);
    ApiResponse.success(res, { message: 'Your grades', data: breakdown });
  });
}

export const gradeController = new GradeController();
