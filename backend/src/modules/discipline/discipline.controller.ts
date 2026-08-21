import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { disciplineService } from './discipline.service';
import type { DisciplineSeverity, DisciplineStatus } from './discipline.dto';
import type { CreateDisciplineRecordInput, UpdateDisciplineRecordInput } from './discipline.dto';
import { UnauthorizedError } from '../../core/errors/app-error';

export class DisciplineController {
  listRecords = asyncHandler(async (req: Request, res: Response) => {
    const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
    const severity  = (req.query.severity  as DisciplineSeverity)  || undefined;
    const status    = (req.query.status    as DisciplineStatus)    || undefined;
    const search    = (req.query.search    as string)              || undefined;

    const records = await disciplineService.listRecords({ studentId, severity, status, search });
    ApiResponse.success(res, { message: 'Records retrieved', data: records });
  });

  createRecord = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const input = req.body as CreateDisciplineRecordInput;
    const record = await disciplineService.createRecord(req.user, input);
    ApiResponse.success(res, { statusCode: 201, message: 'Discipline record created', data: record });
  });

  updateRecord = asyncHandler(async (req: Request, res: Response) => {
    const id    = Number(req.params.id);
    const input = req.body as UpdateDisciplineRecordInput;
    const updated = await disciplineService.updateRecord(id, input);
    ApiResponse.success(res, { message: 'Discipline record updated', data: updated });
  });
}

export const disciplineController = new DisciplineController();
