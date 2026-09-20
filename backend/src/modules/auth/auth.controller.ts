import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { authService } from './auth.service';
import { LoginInput, ChangePasswordInput } from './validation/auth.validation';
import { UnauthorizedError } from '../../core/errors/app-error';
import { isProduction } from '../../config/env';
import { getFullProfile } from './profile.service';

// ── Cookie helpers ────────────────────────────────────────────────────────────

const REFRESH_COOKIE = 'dsssms_rt';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure:   isProduction,          // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge:   REFRESH_COOKIE_MAX_AGE_MS,
    path:     '/api/v1/auth',        // only sent to auth endpoints
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure:   isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path:     '/api/v1/auth',
  });
}

function getRefreshToken(req: Request): string | undefined {
  // Prefer httpOnly cookie; fall back to body for backwards-compatibility
  // during the transition (clients that haven't been updated yet).
  return (req.cookies?.[REFRESH_COOKIE] as string | undefined)
      ?? (req.body as { refreshToken?: string })?.refreshToken;
}

// ── Controller ────────────────────────────────────────────────────────────────

export class AuthController {
  login = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as LoginInput;

    const result = await authService.login({
      username:  input.username,
      password:  input.password,
      ipAddress: req.ip,
    });

    // Refresh token lives in an httpOnly cookie — never exposed to JS.
    setRefreshCookie(res, result.refreshToken);

    // Only return accessToken + user in the body (refresh token omitted).
    ApiResponse.success(res, {
      message: 'Login successful',
      data:    { accessToken: result.accessToken, user: result.user },
    });
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) throw new UnauthorizedError('No refresh token provided');

    const result = await authService.refresh(refreshToken);

    // Rotate the cookie with the new refresh token.
    setRefreshCookie(res, result.refreshToken);

    ApiResponse.success(res, {
      message: 'Token refreshed',
      data:    { accessToken: result.accessToken },
    });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = getRefreshToken(req);

    clearRefreshCookie(res);

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    ApiResponse.success(res, { message: 'Logged out successfully', data: null });
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();

    const input = req.body as ChangePasswordInput;
    await authService.changePassword({
      userId:          req.user.userId,
      currentPassword: input.currentPassword,
      newPassword:     input.newPassword,
    });

    // Invalidate the refresh cookie — user must re-login on all devices.
    clearRefreshCookie(res);

    ApiResponse.success(res, {
      message: 'Password changed successfully. Please log in again.',
      data:    null,
    });
  });

  getProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const profile = await getFullProfile(req.user.userId);
    ApiResponse.success(res, { message: 'Profile retrieved', data: profile });
  });

  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { email, profilePicture } = req.body as { email?: string; profilePicture?: string | null };
    const updated = await authService.updateProfile(req.user.userId, { email, profilePicture });
    ApiResponse.success(res, { message: 'Profile updated', data: updated });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const user = await authService.getCurrentUser(req.user.userId);
    ApiResponse.success(res, { message: 'Current user retrieved', data: user });
  });
}

export const authController = new AuthController();
