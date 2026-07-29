import { Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { assignmentService } from './assignment.service';
import {
  AssignmentIdParam,
  AssignmentStudentParam,
  CreateAssignmentInput,
  ListAssignmentsQuery,
  MarkMySubmissionInput,
  UpdateSubmissionStatusInput,
} from './validation/assignment.validation';

export class AssignmentController {
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const input = req.body as CreateAssignmentInput;
    const assignment = await assignmentService.createAssignment(req.user, input);
    ApiResponse.success(res, { statusCode: 201, message: 'Assignment created', data: assignment });
  });

  /** Convenience endpoint: a teacher's own assignments, or a student's own classroom assignments. */
  getMine = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    if (req.user.role === RoleName.TEACHER) {
      const query = req.query as unknown as ListAssignmentsQuery;
      const assignments = await assignmentService.listForTeacherUser(req.user.userId, query);
      ApiResponse.success(res, { message: 'Your assignments', data: assignments });
      return;
    }

    const assignments = await assignmentService.listForStudentUser(req.user.userId);
    ApiResponse.success(res, { message: 'Your assignments', data: assignments });
  });

  getSubmissions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as AssignmentIdParam;
    const submissions = await assignmentService.getSubmissions(req.user, id);
    ApiResponse.success(res, { message: 'Submissions retrieved', data: submissions });
  });

  updateSubmissionStatus = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id, studentId } = req.params as unknown as AssignmentStudentParam;
    const input = req.body as UpdateSubmissionStatusInput;
    const submission = await assignmentService.updateSubmissionStatus(req.user, id, studentId, input);
    ApiResponse.success(res, { message: 'Submission updated', data: submission });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as AssignmentIdParam;
    await assignmentService.deleteAssignment(req.user, id);
    ApiResponse.success(res, { message: 'Assignment removed', data: null });
  });

  /** Convenience endpoint: the logged-in student self-reporting completion. */
  markMySubmission = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as AssignmentIdParam;
    const input = req.body as MarkMySubmissionInput;
    const submission = await assignmentService.markMySubmission(req.user.userId, id, input);
    ApiResponse.success(res, { message: 'Submission updated', data: submission });
  });
}

export const assignmentController = new AssignmentController();
