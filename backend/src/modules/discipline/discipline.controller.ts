import { Request, Response } from 'express';
import { ApiResponse } from '../../core/http/api-response';
import { disciplineService } from './discipline.service';
import { DisciplineSeverity, DisciplineStatus } from './discipline.dto';

export class DisciplineController {
  async listRecords(req: Request, res: Response) {
    const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
    const severity = req.query.severity as DisciplineSeverity | undefined;
    const status = req.query.status as DisciplineStatus | undefined;
    const search = req.query.search as string | undefined;

    const records = await disciplineService.listRecords({ studentId, severity, status, search });
    ApiResponse.success(res, { message: 'Records retrieved', data: records });
  }

  async createRecord(req: Request, res: Response) {
    const actor = req.user!;
    const record = await disciplineService.createRecord(actor, req.body);
    ApiResponse.success(res, { statusCode: 201, message: 'Discipline record created successfully', data: record });
  }

  async updateRecord(req: Request, res: Response) {
    const id = Number(req.params.id);
    const updated = await disciplineService.updateRecord(id, req.body);
    ApiResponse.success(res, { data: updated, message: 'Discipline record updated successfully' });
  }
}

export const disciplineController = new DisciplineController();
