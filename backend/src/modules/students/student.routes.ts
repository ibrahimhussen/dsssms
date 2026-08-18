import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { studentController } from './student.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize, authorizeWithPermissions } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createStudentSchema,
  listStudentsQuerySchema,
  studentIdParamSchema,
  updateStudentSchema,
  transferClassroomSchema,
  removeParentLinkParamSchema,
  bulkImportSchema,
  transferOutSchema,
} from './validation/student.validation';
import { linkParentToStudentSchema } from '../parents/validation/parent.validation';

const router = Router();

router.use(authenticate);

const MANAGE_ROLES   = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];
const READ_ROLES     = [...MANAGE_ROLES, RoleName.TEACHER];
// Credential management is Admin-only — Director/Vice Director manage students but not accounts
const CREDENTIAL_ROLES = [RoleName.ADMIN];

// Student's own profile — must be declared before the generic '/:id' route.
router.get('/me', authorize(RoleName.STUDENT), studentController.getMyProfile);

router.post('/', authorizeWithPermissions(MANAGE_ROLES, ['students:create']), validate(createStudentSchema), studentController.create);
router.post('/bulk', authorizeWithPermissions(MANAGE_ROLES, ['students:bulk_import']), validate(bulkImportSchema), studentController.bulkImport);
router.post('/:id/transfer-out', authorizeWithPermissions(MANAGE_ROLES, ['students:transfer']), validate(studentIdParamSchema, 'params'), validate(transferOutSchema), studentController.transferOut);

router.get('/', authorizeWithPermissions(READ_ROLES, ['students:view']), validate(listStudentsQuerySchema, 'query'), studentController.list);
router.get('/export', authorizeWithPermissions(READ_ROLES, ['students:view']), validate(listStudentsQuerySchema, 'query'), studentController.export);
router.get('/credentials/classroom/:id', authorizeWithPermissions(CREDENTIAL_ROLES, ['students:view']), validate(studentIdParamSchema, 'params'), studentController.exportClassroomCredentials);

// Preview: how many students need passwords generated (haven't set personal password)
router.get('/accounts/preview/:id', authorizeWithPermissions(CREDENTIAL_ROLES, ['students:view']), validate(studentIdParamSchema, 'params'), studentController.previewGeneratePasswords);

// Bulk generate passwords ONLY for students who haven't set a personal password yet
router.post('/accounts/generate-new/:id', authorizeWithPermissions(CREDENTIAL_ROLES, ['students:update']), validate(studentIdParamSchema, 'params'), studentController.bulkGenerateNewPasswords);

// Bulk reset ALL passwords for a classroom — Admin only
router.post('/accounts/generate/:id', authorizeWithPermissions(CREDENTIAL_ROLES, ['students:update']), validate(studentIdParamSchema, 'params'), studentController.bulkResetClassroomPasswords);

// Reset one student's password — Admin only
router.post('/:id/reset-password', authorizeWithPermissions(CREDENTIAL_ROLES, ['students:update']), validate(studentIdParamSchema, 'params'), studentController.resetStudentPassword);
router.get('/:id', authorizeWithPermissions(READ_ROLES, ['students:view']), validate(studentIdParamSchema, 'params'), studentController.getById);
router.get('/:id/enrollments', authorizeWithPermissions(READ_ROLES, ['students:view']), validate(studentIdParamSchema, 'params'), studentController.getEnrollmentHistory);

router.patch(
  '/:id',
  authorizeWithPermissions(MANAGE_ROLES, ['students:update']),
  validate(studentIdParamSchema, 'params'),
  validate(updateStudentSchema),
  studentController.update
);

router.patch(
  '/:id/classroom',
  authorizeWithPermissions(MANAGE_ROLES, ['students:update']),
  validate(studentIdParamSchema, 'params'),
  validate(transferClassroomSchema),
  studentController.transferClassroom
);

router.post(
  '/:id/parents',
  authorizeWithPermissions(MANAGE_ROLES, ['students:update']),
  validate(studentIdParamSchema, 'params'),
  validate(linkParentToStudentSchema),
  studentController.addParent
);

router.delete(
  '/:id/parents/:parentId',
  authorizeWithPermissions(MANAGE_ROLES, ['students:update']),
  validate(removeParentLinkParamSchema, 'params'),
  studentController.removeParent
);

export const studentRoutes = router;
