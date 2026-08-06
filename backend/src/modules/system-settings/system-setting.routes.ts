import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { systemSettingController } from './system-setting.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { updateSystemSettingSchema } from './validation/system-setting.validation';

const router = Router();

router.use(authenticate);

// Readable by any authenticated role — it's just school display info.
router.get('/', systemSettingController.get);

router.patch('/', authorize(RoleName.ADMIN), validate(updateSystemSettingSchema), systemSettingController.update);

export const systemSettingRoutes = router;
