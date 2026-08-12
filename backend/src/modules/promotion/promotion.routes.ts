import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { promotionController } from './promotion.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize, authorizeWithPermissions } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  batchIdParamSchema,
  entryIdParamSchema,
  createBatchSchema,
  updateEntrySchema,
  bulkAssignClassroomSchema,
  rejectBatchSchema,
  correctEntrySchema,
  listBatchesQuerySchema,
} from './validation/promotion.validation';

const router = Router();

router.use(authenticate);

const MANAGE_ROLES = [RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

// ── Batch CRUD ────────────────────────────────────────────────────────────────

// Vice Director (or Director) prepares a batch
router.post(
  '/',
  authorizeWithPermissions(MANAGE_ROLES, ['students:promotion:prepare']),
  validate(createBatchSchema),
  promotionController.createBatch
);

router.get(
  '/',
  authorizeWithPermissions(MANAGE_ROLES, ['students:promotion:view']),
  validate(listBatchesQuerySchema, 'query'),
  promotionController.listBatches
);

router.get(
  '/:id',
  authorizeWithPermissions(MANAGE_ROLES, ['students:promotion:view']),
  validate(batchIdParamSchema, 'params'),
  promotionController.getBatch
);

// ── Entry editing (Vice Director) ─────────────────────────────────────────────

router.patch(
  '/:id/entries/:entryId',
  authorizeWithPermissions(MANAGE_ROLES, ['students:promotion:prepare']),
  validate(entryIdParamSchema, 'params'),
  validate(updateEntrySchema),
  promotionController.updateEntry
);

router.post(
  '/:id/bulk-assign',
  authorizeWithPermissions(MANAGE_ROLES, ['students:promotion:prepare']),
  validate(batchIdParamSchema, 'params'),
  validate(bulkAssignClassroomSchema),
  promotionController.bulkAssignClassroom
);

// ── State transitions ──────────────────────────────────────────────────────────

// Vice Director submits for approval
router.post(
  '/:id/submit',
  authorizeWithPermissions(MANAGE_ROLES, ['students:promotion:prepare']),
  validate(batchIdParamSchema, 'params'),
  promotionController.submitBatch
);

// Director approves
router.post(
  '/:id/approve',
  authorizeWithPermissions([RoleName.DIRECTOR], ['students:promotion:approve']),
  validate(batchIdParamSchema, 'params'),
  promotionController.approveBatch
);

// Director rejects
router.post(
  '/:id/reject',
  authorizeWithPermissions([RoleName.DIRECTOR], ['students:promotion:approve']),
  validate(batchIdParamSchema, 'params'),
  validate(rejectBatchSchema),
  promotionController.rejectBatch
);

// ── Corrections (Director / Admin) ────────────────────────────────────────────

router.post(
  '/:id/entries/:entryId/correct',
  authorizeWithPermissions([RoleName.DIRECTOR, RoleName.ADMIN], ['students:promotion:correct']),
  validate(entryIdParamSchema, 'params'),
  validate(correctEntrySchema),
  promotionController.correctEntry
);

// ── Student enrollment history ────────────────────────────────────────────────

router.get(
  '/students/:studentId/history',
  authorizeWithPermissions(MANAGE_ROLES, ['students:promotion:view']),
  promotionController.getStudentEnrollmentHistory
);

export const promotionRoutes = router;
