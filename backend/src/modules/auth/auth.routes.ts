import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { loginRateLimiter } from '../../middlewares/rate-limiter.middleware';
import { loginSchema, refreshTokenSchema, changePasswordSchema } from './validation/auth.validation';

const router = Router();

// Common use cases available to every actor (proposal 4.3): Login, Logout, Change Password.
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', validate(refreshTokenSchema), authController.logout);

router.get('/me', authenticate, authController.me);
router.get('/profile', authenticate, authController.getProfile);
router.patch('/profile', authenticate, authController.updateProfile);
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

export const authRoutes = router;
