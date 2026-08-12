import { Request, Response, NextFunction } from 'express';
import { academicRegisterService } from './academic-register.service';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { AcademicRegisterQuery } from './dto/academic-register.dto';
import { UnauthorizedError } from '../../core/errors/app-error';

export class AcademicRegisterController {
  /**
   * GET /academic-register
   * Generate and return academic register (classroom or grade-wide)
   */
  async getRegister(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
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

      const result = await academicRegisterService.generateClassroomRegister(req.user, query);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /academic-register/grade/:grade/:academicYear/:semester
   * Generate grade-wide summary
   */
  async getGradeSummary(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { grade, academicYear, semester } = req.params;
      const result = await academicRegisterService.generateGradeSummary(
        req.user,
        typeof grade === 'string' ? grade : grade[0],
        typeof academicYear === 'string' ? academicYear : academicYear[0],
        typeof semester === 'string' ? semester : semester[0] as any
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /academic-register/historical/:studentId/:academicYear/:semester
   * Generate historical academic register for a student
   */
  async getHistoricalRegister(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { studentId, academicYear, semester } = req.params;
      const result = await academicRegisterService.generateHistoricalRegister(
        req.user,
        Number(typeof studentId === 'string' ? studentId : studentId[0]),
        typeof academicYear === 'string' ? academicYear : academicYear[0],
        typeof semester === 'string' ? semester : semester[0] as any
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const academicRegisterController = new AcademicRegisterController();