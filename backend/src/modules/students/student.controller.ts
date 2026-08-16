import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { buildExcelWorkbook } from '../../core/export/excel-export.util';
import { studentService } from './student.service';
import { UnauthorizedError } from '../../core/errors/app-error';
import {
  CreateStudentInput,
  ListStudentsQuery,
  listStudentsQuerySchema,
  StudentIdParam,
  UpdateStudentInput,
  TransferClassroomInput,
  RemoveParentLinkParam,
  BulkImportInput,
  TransferOutInput,
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

  bulkImport = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as BulkImportInput;
    const result = await studentService.bulkImportStudents(input.students);
    ApiResponse.success(res, {
      statusCode: 201,
      message: `Bulk import completed. Successfully imported ${result.successCount} students.`,
      data: result,
    });
  });

  transferOut = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as StudentIdParam;
    const input = req.body as TransferOutInput;
    const result = await studentService.transferOutStudent(id, input);
    ApiResponse.success(res, {
      message: 'Student transferred out successfully',
      data: result,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query: ListStudentsQuery = listStudentsQuerySchema.parse(req.query);
    const { items, meta } = await studentService.listStudents(query);
    ApiResponse.success(res, { message: 'Students retrieved', data: items, pagination: meta });
  });

  export = asyncHandler(async (req: Request, res: Response) => {
    const query: ListStudentsQuery = listStudentsQuerySchema.parse(req.query);
    const students = await studentService.exportStudents(query);

    const buffer = await buildExcelWorkbook({
      sheetName: 'Students',
      columns: [
        { header: 'Admission #', key: 'admissionNumber', width: 16 },
        { header: 'First name', key: 'firstName' },
        { header: 'Last name', key: 'lastName' },
        { header: 'Gender', key: 'gender', width: 10 },
        { header: 'Classroom', key: 'classroom', width: 18 },
        { header: 'Academic year', key: 'academicYear', width: 14 },
        { header: 'Enrolled', key: 'enrolledAt', width: 14 },
      ],
      rows: students.map((s) => ({
        admissionNumber: s.admissionNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        classroom: `${s.classroom.className} ${s.classroom.section}`,
        academicYear: s.classroom.academicYear,
        enrolledAt: new Date(s.enrolledAt).toLocaleDateString(),
      })),
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="students.xlsx"');
    res.send(buffer);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as StudentIdParam;
    const student = await studentService.getStudentById(id);
    ApiResponse.success(res, { message: 'Student retrieved', data: student });
  });

  getEnrollmentHistory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as StudentIdParam;
    const history = await studentService.getEnrollmentHistory(id);
    ApiResponse.success(res, { message: 'Enrollment history retrieved', data: history });
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
    const result = await studentService.addParentLink(id, input);
    ApiResponse.success(res, {
      statusCode: 201,
      message:
        result.guardianCredentials.length > 0
          ? 'Parent linked. Share the temporary credentials securely — they will not be shown again.'
          : 'Parent linked to student',
      data: result,
    });
  });

  removeParent = asyncHandler(async (req: Request, res: Response) => {
    const { id, parentId } = req.params as unknown as RemoveParentLinkParam;
    await studentService.removeParentLink(id, parentId);
    ApiResponse.success(res, { message: 'Parent unlinked from student', data: null });
  });
}

export const studentController = new StudentController();