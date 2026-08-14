import { Request, Response, NextFunction } from 'express';
import { conductService } from './conduct.service';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { CreateConductInput, UpdateConductInput } from './dto/conduct.dto';
import { UnauthorizedError } from '../../core/errors/app-error';

export class ConductController {
  /**
   * POST /conduct
   * Create or update conduct rating for a student
   */
  async upsertConduct(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const input: CreateConductInput = req.body;
      const result = await conductService.upsertConduct(req.user, input, req.ip);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /conduct/:id
   * Update existing conduct rating
   */
  async updateConduct(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { id } = req.params;
      const input: UpdateConductInput = req.body;
      const result = await conductService.updateConduct(req.user, Number(id), input, req.ip);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /conduct/student/:studentId/:classroomId/:semester/:academicYear
   * Get conduct record for a specific student
   */
  async getStudentConduct(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { studentId, classroomId, semester } = req.params;
      const academicYear = req.query.academicYear as string;
      if (!academicYear) {
        return res.status(400).json({ success: false, message: 'academicYear query parameter is required' });
      }
      const result = await conductService.getStudentConduct(
        req.user,
        Number(studentId),
        Number(classroomId),
        semester as any,
        academicYear
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /conduct/classroom/:classroomId/:semester/:academicYear
   * Get all conduct records for a classroom
   */
  async getClassroomConducts(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { classroomId, semester } = req.params;
      const academicYear = req.query.academicYear as string;
      if (!academicYear) {
        return res.status(400).json({ success: false, message: 'academicYear query parameter is required' });
      }
      const result = await conductService.getClassroomConducts(
        req.user,
        Number(classroomId),
        semester as any,
        academicYear
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /conduct/classroom/:classroomId/:semester/:academicYear/summary
   * Get conduct summary for a classroom
   */
  async getClassroomConductSummary(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { classroomId, semester } = req.params;
      const academicYear = req.query.academicYear as string;
      if (!academicYear) {
        return res.status(400).json({ success: false, message: 'academicYear query parameter is required' });
      }
      const result = await conductService.getClassroomConductSummary(
        req.user,
        Number(classroomId),
        semester as any,
        academicYear
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /conduct/:id
   * Delete conduct record
   */
  async deleteConduct(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { id } = req.params;
      await conductService.deleteConduct(req.user, Number(id), req.ip);
      res.json({ success: true, message: 'Conduct record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const conductController = new ConductController();