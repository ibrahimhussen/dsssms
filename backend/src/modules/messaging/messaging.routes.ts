import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { messagingController } from './messaging.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  sendMessageSchema,
  replyMessageSchema,
  messageIdParamSchema,
  listThreadsQuerySchema,
  threadQuerySchema,
} from './validation/messaging.validation';

const router = Router();

router.use(authenticate);
router.use(authorize(RoleName.PARENT, RoleName.TEACHER));

// Unread count — quick badge query
router.get('/unread-count', messagingController.getUnreadCount);

// Full conversation thread (both parties)
router.get(
  '/thread',
  validate(threadQuerySchema, 'query'),
  messagingController.getThread
);

// Parent: list eligible teachers to contact for a child
router.get(
  '/eligible-teachers',
  authorize(RoleName.PARENT),
  messagingController.getEligibleTeachers
);

// List threads (both parent and teacher)
router.get(
  '/',
  validate(listThreadsQuerySchema, 'query'),
  messagingController.listThreads
);

// Parent sends a new message
router.post(
  '/',
  authorize(RoleName.PARENT),
  validate(sendMessageSchema),
  messagingController.sendMessage
);

// Reply to an existing message (both parent and teacher)
router.post(
  '/:id/reply',
  validate(messageIdParamSchema, 'params'),
  validate(replyMessageSchema),
  messagingController.replyToMessage
);

export const messagingRoutes = router;
