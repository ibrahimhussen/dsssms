import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';

const router = Router();

router.use(authenticate);

// Each dashboard is visible to the role it's built for, plus every more
// senior oversight role above it (an Admin can see the Director's view, a
// Director can see the Vice Director's, etc).
router.get('/admin', authorize(RoleName.ADMIN), dashboardController.getAdminDashboard);

router.get(
  '/director',
  authorize(RoleName.ADMIN, RoleName.DIRECTOR),
  dashboardController.getDirectorDashboard
);

router.get(
  '/vice-director',
  authorize(RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR),
  dashboardController.getViceDirectorDashboard
);

export const dashboardRoutes = router;
