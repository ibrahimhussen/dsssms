import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { gradeSubjectConfigService } from './grade-subject-config.service';
import { UnauthorizedError } from '../../core/errors/app-error';
import {
  CopyFromYearInput,
  ListGradeSubjectConfigQuery,
  UpsertGradeSubjectConfigInput,
} from './dto/grade-subject-config.dto';

export class GradeSubjectConfigController {
  listConfiguredGrades = asyncHandler(async (_req: Request, res: Response) => {
    const result = await gradeSubjectConfigService.listConfiguredGrades();
    ApiResponse.success(res, { message: 'Configured grades retrieved', data: result });
  });

  listForGrade = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListGradeSubjectConfigQuery;
    const result = await gradeSubjectConfigService.listForGrade(query);
    ApiResponse.success(res, { message: 'Grade subject configuration retrieved', data: result });
  });

  upsert = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const input = req.body as UpsertGradeSubjectConfigInput;
    const result = await gradeSubjectConfigService.upsert(req.user, input, req.ip);
    ApiResponse.success(res, { statusCode: 201, message: 'Grade subject configuration updated', data: result });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const id = Number(req.params.id);
    await gradeSubjectConfigService.remove(req.user, id, req.ip);
    ApiResponse.success(res, { message: 'Grade subject configuration entry removed', data: null });
  });

  copyFromYear = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const input = req.body as CopyFromYearInput;
    const result = await gradeSubjectConfigService.copyFromYear(req.user, input, req.ip);
    ApiResponse.success(res, { message: `Copied ${result.created} subject(s) to target year`, data: result });
  });
}

export const gradeSubjectConfigController = new GradeSubjectConfigController();
