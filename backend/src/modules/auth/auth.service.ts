import { RoleName, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { env } from '../../config/env';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../../core/errors/app-error';
import { hashPassword, verifyPassword } from '../../core/utils/password.util';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../core/utils/jwt.util';
import { durationToFutureDate, hashToken } from '../../core/utils/token.util';
import { recordAudit } from '../../core/audit/audit-recorder';
import { LoginResponseDto, RefreshResponseDto, AuthenticatedUserDto } from './dto/auth.dto';

function toAuthenticatedUserDto(user: {
  userId: number;
  username: string;
  email: string | null;
  status: UserStatus;
  isTemporaryPassword: boolean;
  role: { roleName: RoleName };
  permissions?: { permission: string; expiresAt: Date | null }[];
}): AuthenticatedUserDto {
  const activePermissions = (user.permissions || [])
    .filter(p => !p.expiresAt || p.expiresAt > new Date())
    .map(p => p.permission);

  return {
    userId: user.userId,
    username: user.username,
    email: user.email,
    role: user.role.roleName,
    status: user.status,
    permissions: activePermissions,
    isTemporaryPassword: user.isTemporaryPassword,
  };
}

export class AuthService {
  /**
   * Authenticates a user by username/password, enforcing the proposal's
   * account-lockout policy (3.6: "Account lockout after multiple failed
   * login attempts"), and issues a fresh access/refresh token pair.
   */
  async login(input: { username: string; password: string; ipAddress?: string }): Promise<LoginResponseDto> {
    const user = await prisma.user.findUnique({
      where: { username: input.username },
      include: { role: true, permissions: true },
    });

    // Deliberately identical error message whether the username doesn't
    // exist or the password is wrong — avoids leaking which usernames exist.
    const invalidCredentialsError = () => new UnauthorizedError('Invalid username or password');

    if (!user) {
      throw invalidCredentialsError();
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('This account is not active. Contact the system administrator.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenError(`Account is temporarily locked. Try again in ${minutesLeft} minute(s).`);
    }

    const passwordValid = await verifyPassword(input.password, user.passwordHash);

    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= env.LOGIN_MAX_ATTEMPTS;

      await prisma.user.update({
        where: { userId: user.userId },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });

      await recordAudit({
        userId: user.userId,
        action: shouldLock ? 'LOGIN_FAILED_ACCOUNT_LOCKED' : 'LOGIN_FAILED',
        ipAddress: input.ipAddress,
        metadata: { attempts },
      });

      if (shouldLock) {
        throw new ForbiddenError(
          `Too many failed login attempts. Account locked for ${env.LOGIN_LOCKOUT_MINUTES} minutes.`
        );
      }

      throw invalidCredentialsError();
    }

    // Successful login: reset the failure counter and issue tokens.
    await prisma.user.update({
      where: { userId: user.userId },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair({
      userId: user.userId,
      username: user.username,
      role: user.role.roleName,
    });

    await recordAudit({ userId: user.userId, action: 'LOGIN_SUCCESS', ipAddress: input.ipAddress });

    return { user: toAuthenticatedUserDto(user), ...tokens };
  }

  /**
   * Issues a new access token from a valid, non-revoked refresh token, and
   * rotates the refresh token itself (single-use refresh tokens limit the
   * blast radius of a leaked token).
   */
  async refresh(refreshToken: string): Promise<RefreshResponseDto> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token is no longer valid');
    }

    if (stored.tokenHash !== hashToken(refreshToken)) {
      // Token id matched but the token content didn't — treat as compromised.
      await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedError('Refresh token could not be verified');
    }

    const user = await prisma.user.findUnique({ where: { userId: stored.userId }, include: { role: true, permissions: true } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Account is no longer active');
    }

    // Revoke the used token and issue a new pair (rotation).
    const tokens = await this.issueTokenPair({
      userId: user.userId,
      username: user.username,
      role: user.role.roleName,
    });

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: tokens.refreshTokenId },
    });

    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  /** Revokes a single refresh token (used for logout from one device). */
  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // A logout call with an already-invalid token is a no-op, not an error.
    }
  }

  /** Revokes every active refresh token for a user (used for "log out everywhere"). */
  async logoutAllSessions(userId: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(params: {
    userId: number;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const user = await prisma.user.findUnique({ where: { userId: params.userId } });

    if (!user) {
      throw new UnauthorizedError();
    }

    const isCurrentValid = await verifyPassword(params.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestError('Current password is incorrect');
    }

    const newHash = await hashPassword(params.newPassword);

    await prisma.user.update({
      where: { userId: user.userId },
      data: {
        passwordHash: newHash,
        isTemporaryPassword: false, // password is now personal — no longer temporary
      },
    });

    // Force re-authentication on all devices after a password change.
    await this.logoutAllSessions(user.userId);

    await recordAudit({ userId: user.userId, action: 'PASSWORD_CHANGED' });
  }
  async getCurrentUser(userId: number): Promise<AuthenticatedUserDto> {
    const user = await prisma.user.findUnique({ where: { userId }, include: { role: true, permissions: true } });
    if (!user) {
      throw new UnauthorizedError();
    }
    return toAuthenticatedUserDto(user);
  }

  /** Signs a fresh access/refresh pair and persists the refresh token (hashed). */
  private async issueTokenPair(params: {
    userId: number;
    username: string;
    role: RoleName;
  }): Promise<{ accessToken: string; refreshToken: string; refreshTokenId: string }> {
    const accessToken = signAccessToken({ sub: params.userId, role: params.role, username: params.username });

    const tokenRecord = await prisma.refreshToken.create({
      data: {
        userId: params.userId,
        tokenHash: '', // filled in below once we know the signed value
        expiresAt: durationToFutureDate(env.JWT_REFRESH_EXPIRES_IN),
      },
    });

    const refreshToken = signRefreshToken({ sub: params.userId, jti: tokenRecord.id });

    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { tokenHash: hashToken(refreshToken) },
    });

    return { accessToken, refreshToken, refreshTokenId: tokenRecord.id };
  }
}

export const authService = new AuthService();
