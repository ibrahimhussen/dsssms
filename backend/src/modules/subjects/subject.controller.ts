import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { subjectService } from './subject.service';
import {
  CreateSubjectInput,
  ListSubjectsQuery,
  listSubjectsQuerySchema,
  SubjectIdParam,
  UpdateSubjectInput,
} from './validation/subject.validation';

export class SubjectController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateSubjectInput;
    const subject = await subjectService.createSubject(input);
    ApiResponse.success(res, { statusCode: 201, message: 'Subject created', data: subject });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query: ListSubjectsQuery = listSubjectsQuerySchema.parse(req.query);
    const { items, meta } = await subjectService.listSubjects(query);
    ApiResponse.success(res, { message: 'Subjects retrieved', data: items, pagination: meta });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as SubjectIdParam;
    const subject = await subjectService.getSubjectById(id);
    ApiResponse.success(res, { message: 'Subject retrieved', data: subject });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as SubjectIdParam;
    const input = req.body as UpdateSubjectInput;
    const subject = await subjectService.updateSubject(id, input);
    ApiResponse.success(res, { message: 'Subject updated', data: subject });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as SubjectIdParam;
    await subjectService.deleteSubject(id);
    ApiResponse.success(res, { message: 'Subject deleted', data: null });
  });
}

export const subjectController = new SubjectController();