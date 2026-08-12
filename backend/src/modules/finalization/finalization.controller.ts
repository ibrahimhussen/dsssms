import { Request, Response, NextFunction } from 'express';
import { finalizationService } from './finalization.service';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  CorrectFinalizationInput,
  FinalizeClassroomInput,
  FinalizeSubjectInput,
  ReviewSubjectInput,
  SubmitForReviewInput,
} from './dto/finalization.dto';
import { UnauthorizedError } from '../../core/errors/app-error';

export class FinalizationController {
  /**
   * POST /finalization/submit-for-review
   * Teacher submits subject results for Vice Director review
   */
  async submitForReview(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const input: SubmitForReviewInput = req.body;
      const result = await finalizationService.submitForReview(req.user, input, req.ip);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /finalization/review-subject
   * Vice Director reviews subject results (approve/reject)
   */
  async reviewSubject(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const input: ReviewSubjectInput = req.body;
      const result = await finalizationService.reviewSubject(req.user, input, req.ip);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /finalization/finalize-subject
   * Vice Director or Director finalizes subject results
   */
  async finalizeSubject(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const input: FinalizeSubjectInput = req.body;
      const result = await finalizationService.finalizeSubject(req.user, input, req.ip);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /finalization/finalize-classroom
   * Vice Director or Director finalizes entire classroom
   */
  async finalizeClassroom(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const input: FinalizeClassroomInput = req.body;
      const result = await finalizationService.finalizeClassroom(req.user, input, req.ip);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /finalization/subject/:teacherSubjectId/:semester/:academicYear
   * Get subject finalization details
   */
  async getSubjectFinalization(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { teacherSubjectId, semester, academicYear } = req.params;
      const result = await finalizationService.getSubjectFinalization(
        req.user,
        Number(typeof teacherSubjectId === 'string' ? teacherSubjectId : teacherSubjectId[0]),
        typeof semester === 'string' ? semester : semester[0] as any,
        typeof academicYear === 'string' ? academicYear : academicYear[0]
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /finalization/classroom/:classroomId/:semester/:academicYear
   * Get classroom finalization details
   */
  async getClassroomFinalization(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { classroomId, semester, academicYear } = req.params;
      const result = await finalizationService.getClassroomFinalization(
        req.user,
        Number(typeof classroomId === 'string' ? classroomId : classroomId[0]),
        typeof semester === 'string' ? semester : semester[0] as any,
        typeof academicYear === 'string' ? academicYear : academicYear[0]
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /finalization/classroom/:classroomId/:semester/:academicYear/subjects
   * Get all subject finalizations for a classroom
   */
  async getClassroomSubjectFinalizations(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { classroomId, semester, academicYear } = req.params;
      const result = await finalizationService.getClassroomSubjectFinalizations(
        req.user,
        Number(typeof classroomId === 'string' ? classroomId : classroomId[0]),
        typeof semester === 'string' ? semester : semester[0] as any,
        typeof academicYear === 'string' ? academicYear : academicYear[0]
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /finalization/subject/:id/correct
   * Post-finalization correction for subject
   */
  async correctSubjectFinalization(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { id } = req.params;
      const input: CorrectFinalizationInput = req.body;
      const result = await finalizationService.correctSubjectFinalization(req.user, Number(id), input, req.ip);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /finalization/classroom/:id/correct
   * Post-finalization correction for classroom
   */
  async correctClassroomFinalization(req: Request & { user?: AuthenticatedUser }, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { id } = req.params;
      const input: CorrectFinalizationInput = req.body;
      const result = await finalizationService.correctClassroomFinalization(req.user, Number(id), input, req.ip);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const finalizationController = new FinalizationController();