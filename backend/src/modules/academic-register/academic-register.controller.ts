import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { academicRegisterService } from './academic-register.service';
import { UnauthorizedError } from '../../core/errors/app-error';
import { RegisterViewMode } from './dto/academic-register.dto';

export class AcademicRegisterController {
  getRegister = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { classroomId, academicYear, viewMode } = req.query as Record<string, string>;
    const result = await academicRegisterService.generateClassroomRegister(req.user, {
      classroomId: Number(classroomId),
      academicYear,
      viewMode: viewMode as RegisterViewMode,
    });
    ApiResponse.success(res, { message: 'Academic register retrieved', data: result });
  });

  getGradeRegister = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { grade, academicYear, viewMode } = req.query as Record<string, string>;
    const result = await academicRegisterService.generateGradeRegister(
      req.user,
      grade,
      academicYear,
      viewMode as RegisterViewMode
    );
    ApiResponse.success(res, { message: 'Grade register summary retrieved', data: result });
  });
}

export const academicRegisterController = new AcademicRegisterController();
