import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { teacherSubjectService } from './teacher-subject.service';
import { CreateAssignmentInput, ListAssignmentsQuery, AssignmentIdParam } from './validation/teacher-subject.validation';

export class TeacherSubjectController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateAssignmentInput;
    const assignment = await teacherSubjectService.createAssignment(input);
    ApiResponse.success(res, { statusCode: 201, message: 'Teaching assignment created', data: assignment });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListAssignmentsQuery;
    const { items, meta } = await teacherSubjectService.listAssignments(query);
    ApiResponse.success(res, { message: 'Teaching assignments retrieved', data: items, pagination: meta });
  });

  getMyAssignments = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const items = await teacherSubjectService.listAssignmentsForTeacherUser(req.user.userId);
    ApiResponse.success(res, { message: 'Your teaching assignments', data: items });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as AssignmentIdParam;
    await teacherSubjectService.deleteAssignment(id);
    ApiResponse.success(res, { message: 'Teaching assignment removed', data: null });
  });
}

export const teacherSubjectController = new TeacherSubjectController();
