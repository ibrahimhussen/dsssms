import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { classroomService } from './classroom.service';
import {
  CreateClassroomInput,
  ListClassroomsQuery,
  listClassroomsQuerySchema,
  ClassroomIdParam,
  UpdateClassroomInput,
} from './validation/classroom.validation';

export class ClassroomController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateClassroomInput;
    const classroom = await classroomService.createClassroom(input);
    ApiResponse.success(res, { statusCode: 201, message: 'Classroom created', data: classroom });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query: ListClassroomsQuery = listClassroomsQuerySchema.parse(req.query);
    const { items, meta } = await classroomService.listClassrooms(query);
    ApiResponse.success(res, { message: 'Classrooms retrieved', data: items, pagination: meta });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as ClassroomIdParam;
    const classroom = await classroomService.getClassroomById(id);
    ApiResponse.success(res, { message: 'Classroom retrieved', data: classroom });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as ClassroomIdParam;
    const input = req.body as UpdateClassroomInput;
    const classroom = await classroomService.updateClassroom(id, input);
    ApiResponse.success(res, { message: 'Classroom updated', data: classroom });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as ClassroomIdParam;
    await classroomService.deleteClassroom(id);
    ApiResponse.success(res, { message: 'Classroom deleted', data: null });
  });
}

export const classroomController = new ClassroomController();