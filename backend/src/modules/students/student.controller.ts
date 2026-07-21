import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { studentService } from './student.service';
import { UnauthorizedError } from '../../core/errors/app-error';
import {
  CreateStudentInput,
  ListStudentsQuery,
  StudentIdParam,
  UpdateStudentInput,
  TransferClassroomInput,
  RemoveParentLinkParam,
} from './validation/student.validation';
import { LinkParentToStudentInput } from '../parents/validation/parent.validation';

export class StudentController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateStudentInput;
    const result = await studentService.createStudent(input);
    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Student registered. Share the temporary credentials securely — they will not be shown again.',
      data: result,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListStudentsQuery;
    const { items, meta } = await studentService.listStudents(query);
    ApiResponse.success(res, { message: 'Students retrieved', data: items, pagination: meta });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as StudentIdParam;
    const student = await studentService.getStudentById(id);
    ApiResponse.success(res, { message: 'Student retrieved', data: student });
  });

  getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const student = await studentService.getStudentByUserId(req.user.userId);
    ApiResponse.success(res, { message: 'Your profile', data: student });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as StudentIdParam;
    const input = req.body as UpdateStudentInput;
    const student = await studentService.updateStudent(id, input);
    ApiResponse.success(res, { message: 'Student updated', data: student });
  });

  transferClassroom = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as StudentIdParam;
    const { classroomId } = req.body as TransferClassroomInput;
    const student = await studentService.transferClassroom(id, classroomId);
    ApiResponse.success(res, { message: 'Student transferred to new classroom', data: student });
  });

  addParent = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as StudentIdParam;
    const input = req.body as LinkParentToStudentInput;
    const student = await studentService.addParentLink(id, input);
    ApiResponse.success(res, { statusCode: 201, message: 'Parent linked to student', data: student });
  });

  removeParent = asyncHandler(async (req: Request, res: Response) => {
    const { id, parentId } = req.params as unknown as RemoveParentLinkParam;
    await studentService.removeParentLink(id, parentId);
    ApiResponse.success(res, { message: 'Parent unlinked from student', data: null });
  });
}

export const studentController = new StudentController();
