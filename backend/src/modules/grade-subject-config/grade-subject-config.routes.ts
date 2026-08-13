import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { gradeSubjectConfigController } from './grade-subject-config.controller';

const router = Router();

router.use(authenticate);

const MANAGE_ROLES = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

// List all (className, academicYear) pairs that have been configured
router.get('/configured-grades', authorize(...MANAGE_ROLES), gradeSubjectConfigController.listConfiguredGrades);

// List subjects for a specific grade + year  (?className=Grade+11&academicYear=2026/27)
router.get('/', authorize(...MANAGE_ROLES, RoleName.TEACHER), gradeSubjectConfigController.listForGrade);

// Add / update a subject in a grade's config
router.post('/', authorize(...MANAGE_ROLES), gradeSubjectConfigController.upsert);

// Remove a subject from a grade's config
router.delete('/:id', authorize(...MANAGE_ROLES), gradeSubjectConfigController.remove);

// Copy an entire year's config to a new academic year
router.post('/copy', authorize(...MANAGE_ROLES), gradeSubjectConfigController.copyFromYear);

export const gradeSubjectConfigRoutes = router;
