import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { authService } from './auth.service';
import { LoginInput, RefreshTokenInput, ChangePasswordInput } from './validation/auth.validation';
import { UnauthorizedError } from '../../core/errors/app-error';

export class AuthController {
  login = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as LoginInput;

    const result = await authService.login({
      username: input.username,
      password: input.password,
      ipAddress: req.ip,
    });

    ApiResponse.success(res, { message: 'Login successful', data: result });
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as RefreshTokenInput;
    const result = await authService.refresh(refreshToken);
    ApiResponse.success(res, { message: 'Token refreshed', data: result });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as RefreshTokenInput;
    await authService.logout(refreshToken);
    ApiResponse.success(res, { message: 'Logged out successfully', data: null });
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const input = req.body as ChangePasswordInput;
    await authService.changePassword({
      userId: req.user.userId,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });

    ApiResponse.success(res, { message: 'Password changed successfully. Please log in again.', data: null });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const user = await authService.getCurrentUser(req.user.userId);
    ApiResponse.success(res, { message: 'Current user retrieved', data: user });
  });
}

export const authController = new AuthController();
