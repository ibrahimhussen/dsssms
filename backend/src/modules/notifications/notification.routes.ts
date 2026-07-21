import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { notificationController } from './notification.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createNotificationSchema,
  sendToParentsSchema,
  listNotificationsQuerySchema,
  listAllNotificationsQuerySchema,
  notificationIdParamSchema,
  studentIdParamSchema,
} from './validation/notification.validation';

const router = Router();

router.use(authenticate);

const OVERSIGHT_ROLES = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];
const OVERSIGHT_AND_TEACHER = [...OVERSIGHT_ROLES, RoleName.TEACHER];

// Inbox routes — declared before '/:id' so they aren't swallowed by the param route.
router.get('/me', validate(listNotificationsQuerySchema, 'query'), notificationController.getMyNotifications);
router.patch('/read-all', notificationController.markAllAsRead);

router.post('/', authorize(...OVERSIGHT_ROLES), validate(createNotificationSchema), notificationController.send);

router.post(
  '/student/:studentId/parents',
  authorize(...OVERSIGHT_AND_TEACHER),
  validate(studentIdParamSchema, 'params'),
  validate(sendToParentsSchema),
  notificationController.sendToParents
);

router.get(
  '/',
  authorize(...OVERSIGHT_ROLES),
  validate(listAllNotificationsQuerySchema, 'query'),
  notificationController.listAll
);

router.patch('/:id/read', validate(notificationIdParamSchema, 'params'), notificationController.markAsRead);
router.delete('/:id', validate(notificationIdParamSchema, 'params'), notificationController.delete);

export const notificationRoutes = router;
