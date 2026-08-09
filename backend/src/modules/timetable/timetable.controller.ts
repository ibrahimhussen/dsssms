import { Request, Response } from 'express';
import { RoleName, Semester } from '@prisma/client';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { timetableService } from './timetable.service';
import { CreateTimetableEntryInput, ListTimetableQuery, TimetableEntryIdParam } from './validation/timetable.validation';

export class TimetableController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateTimetableEntryInput;
    const entry = await timetableService.createEntry(input);
    ApiResponse.success(res, { statusCode: 201, message: 'Timetable entry created', data: entry });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as TimetableEntryIdParam;
    await timetableService.deleteEntry(id);
    ApiResponse.success(res, { message: 'Timetable entry removed', data: null });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListTimetableQuery;
    const entries = await timetableService.listEntries(query);
    ApiResponse.success(res, { message: 'Timetable entries retrieved', data: entries });
  });

  /** Convenience endpoint: the logged-in teacher's or student's own schedule. */
  getMyTimetable = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const semester = req.query.semester ? (req.query.semester as Semester) : undefined;
    const entries =
      req.user.role === RoleName.TEACHER
        ? await timetableService.listForTeacherUser(req.user.userId, semester)
        : await timetableService.listForStudentUser(req.user.userId, semester);
    ApiResponse.success(res, { message: 'Your timetable', data: entries });
  });
}

export const timetableController = new TimetableController();
