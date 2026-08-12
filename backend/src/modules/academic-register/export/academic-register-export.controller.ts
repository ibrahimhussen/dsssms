import { Request, Response, NextFunction } from 'express';
import { academicRegisterExportService } from './academic-register-export.service';
import { academicRegisterService } from '../academic-register.service';
import { AuthenticatedUser } from '../../../middlewares/authenticate.middleware';
import { AcademicRegisterQuery } from '../dto/academic-register.dto';
import { UnauthorizedError } from '../../../core/errors/app-error';

export class AcademicRegisterExportController {
  /**
   * GET /academic-register/export/excel
   * Export academic register to Excel format
   */
  async exportToExcel(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query: AcademicRegisterQuery = {
        classroomId: req.query.classroomId ? Number(req.query.classroomId) : undefined,
        grade: typeof req.query.grade === 'string' ? req.query.grade : undefined,
        academicYear: typeof req.query.academicYear === 'string' ? req.query.academicYear : '',
        semester: req.query.semester as any,
        section: typeof req.query.section === 'string' ? req.query.section : undefined,
        gradeWide: req.query.gradeWide === 'true',
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const register = await academicRegisterService.generateClassroomRegister(req.user, query);
      const excelBuffer = await academicRegisterExportService.exportToExcel(register);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="academic-register-${register.metadata.classroomLabel}-${register.metadata.academicYear}-${register.metadata.semester}.xlsx"`
      );
      res.send(excelBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /academic-register/export/csv
   * Export academic register to CSV format
   */
  async exportToCSV(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query: AcademicRegisterQuery = {
        classroomId: req.query.classroomId ? Number(req.query.classroomId) : undefined,
        grade: typeof req.query.grade === 'string' ? req.query.grade : undefined,
        academicYear: typeof req.query.academicYear === 'string' ? req.query.academicYear : '',
        semester: req.query.semester as any,
        section: typeof req.query.section === 'string' ? req.query.section : undefined,
        gradeWide: req.query.gradeWide === 'true',
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const register = await academicRegisterService.generateClassroomRegister(req.user, query);
      const csvData = await academicRegisterExportService.exportToCSV(register);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="academic-register-${register.metadata.classroomLabel}-${register.metadata.academicYear}-${register.metadata.semester}.csv"`
      );
      res.send(csvData);
    } catch (error) {
      next(error);
    }
  }
}

export const academicRegisterExportController = new AcademicRegisterExportController();