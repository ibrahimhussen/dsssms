import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { auditLogController } from './audit-log.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { listAuditLogsQuerySchema } from './validation/audit-log.validation';

const router = Router();

router.use(authenticate);

router.get('/', authorize(RoleName.ADMIN), validate(listAuditLogsQuerySchema, 'query'), auditLogController.list);

export const auditLogRoutes = router;
