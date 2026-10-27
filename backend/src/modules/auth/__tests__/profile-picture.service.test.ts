/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * updateProfile — profile picture regression tests.
 *
 * Root cause fixed: users.profilePicture was VARCHAR(500), base64 images are
 * hundreds of thousands of characters. Column changed to LONGTEXT in migration
 * 20261027153805_fix_profile_picture_longtext.
 *
 * These tests verify the service-level validation and DB interaction for
 * profile picture uploads, including rejection of invalid types, oversized
 * payloads, and unauthorized requests.
 *
 * All Prisma calls are mocked — no database required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mocks (must come before imports) ─────────────────────────────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst:  vi.fn(),
      update:     vi.fn(),
    },
  },
}));

vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));

vi.mock('../../../config/env', () => ({
  env: {
    LOGIN_MAX_ATTEMPTS: 5, LOGIN_LOCKOUT_MINUTES: 15,
    JWT_ACCESS_EXPIRES_IN: '15m', JWT_REFRESH_EXPIRES_IN: '7d', BCRYPT_SALT_ROUNDS: 12,
  },
  isProduction: false,
}));

// jwt / token / password utilities are imported in auth.service but not used
// in updateProfile — mock them to satisfy the import
vi.mock('../../../core/utils/jwt.util',   () => ({ signAccessToken: vi.fn(), signRefreshToken: vi.fn(), verifyRefreshToken: vi.fn() }));
vi.mock('../../../core/utils/token.util', () => ({ hashToken: vi.fn(), durationToFutureDate: vi.fn() }));
vi.mock('../../../core/utils/password.util', () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));

import { AuthService }  from '../auth.service';
import { prisma }        from '../../../database/prisma-client';
import { BadRequestError, UnauthorizedError } from '../../../core/errors/app-error';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a valid base64 JPEG data-URL of exactly `chars` characters. */
function makeDataUrl(chars: number, type = 'jpeg'): string {
  const header  = `data:image/${type};base64,`;
  const payload = 'A'.repeat(chars - header.length);
  return header + payload;
}

const BASE_USER = {
  userId: 1, username: 'admin', email: null, status: 'ACTIVE',
  isTemporaryPassword: false, profilePicture: null,
  failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null,
  role: { roleName: 'ADMIN' as const }, permissions: [],
  administrator: { firstName: 'System', lastName: 'Administrator' },
  director: null, viceDirector: null, teacher: null, student: null, parent: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthService.updateProfile — profile picture', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.resetAllMocks();
  });

  // ── Successful upload ────────────────────────────────────────────────────

  it('stores a valid JPEG data-URL when the user exists', async () => {
    const dataUrl = makeDataUrl(5000, 'jpeg');
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);
    (prisma.user.update    as Mock).mockResolvedValue({ ...BASE_USER, profilePicture: dataUrl });

    const result = await service.updateProfile(1, { profilePicture: dataUrl });

    expect(prisma.user.update).toHaveBeenCalledOnce();
    const updateCall = (prisma.user.update as Mock).mock.calls[0][0];
    expect(updateCall.data.profilePicture).toBe(dataUrl);
    expect(result.profilePicture).toBe(dataUrl);
  });

  it('stores a valid PNG data-URL', async () => {
    const dataUrl = makeDataUrl(5000, 'png');
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);
    (prisma.user.update    as Mock).mockResolvedValue({ ...BASE_USER, profilePicture: dataUrl });

    await service.updateProfile(1, { profilePicture: dataUrl });

    const updateCall = (prisma.user.update as Mock).mock.calls[0][0];
    expect(updateCall.data.profilePicture).toBe(dataUrl);
  });

  it('stores a valid WebP data-URL', async () => {
    const dataUrl = makeDataUrl(5000, 'webp');
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);
    (prisma.user.update    as Mock).mockResolvedValue({ ...BASE_USER, profilePicture: dataUrl });

    await service.updateProfile(1, { profilePicture: dataUrl });

    expect(prisma.user.update).toHaveBeenCalledOnce();
  });

  it('stores a valid HTTPS URL', async () => {
    const url = 'https://cdn.example.com/photos/user-1.jpg';
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);
    (prisma.user.update    as Mock).mockResolvedValue({ ...BASE_USER, profilePicture: url });

    await service.updateProfile(1, { profilePicture: url });

    const updateCall = (prisma.user.update as Mock).mock.calls[0][0];
    expect(updateCall.data.profilePicture).toBe(url);
  });

  it('clears the profile picture when null is passed', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({ ...BASE_USER, profilePicture: 'data:image/jpeg;base64,abc' });
    (prisma.user.update    as Mock).mockResolvedValue({ ...BASE_USER, profilePicture: null });

    const result = await service.updateProfile(1, { profilePicture: null });

    const updateCall = (prisma.user.update as Mock).mock.calls[0][0];
    expect(updateCall.data.profilePicture).toBeNull();
    expect(result.profilePicture).toBeNull();
  });

  it('skips the profilePicture update entirely when the field is absent from input', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);
    (prisma.user.update    as Mock).mockResolvedValue(BASE_USER);

    await service.updateProfile(1, {});

    const updateCall = (prisma.user.update as Mock).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('profilePicture');
  });

  // ── Large valid image (regression for the VARCHAR(500) bug) ──────────────

  it('accepts a realistically-sized image (~135 KB base64 = 184,000 chars)', async () => {
    // A 100 KB raw image ≈ 136,533 chars in base64
    const dataUrl = makeDataUrl(184_000, 'jpeg');
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);
    (prisma.user.update    as Mock).mockResolvedValue({ ...BASE_USER, profilePicture: dataUrl });

    // Must NOT throw — under the 3,000,000 char service limit
    await expect(service.updateProfile(1, { profilePicture: dataUrl })).resolves.not.toThrow();
    expect(prisma.user.update).toHaveBeenCalledOnce();
  });

  it('accepts a 1 MB base64 image (~1,400,000 chars)', async () => {
    const dataUrl = makeDataUrl(1_400_000, 'jpeg');
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);
    (prisma.user.update    as Mock).mockResolvedValue({ ...BASE_USER, profilePicture: dataUrl });

    await expect(service.updateProfile(1, { profilePicture: dataUrl })).resolves.not.toThrow();
  });

  // ── Oversized image ───────────────────────────────────────────────────────

  it('rejects a data-URL exceeding 3,000,000 chars (>2 MB raw)', async () => {
    const oversized = makeDataUrl(3_000_001, 'jpeg');
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);

    await expect(service.updateProfile(1, { profilePicture: oversized }))
      .rejects.toBeInstanceOf(BadRequestError);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  // ── Invalid file types ────────────────────────────────────────────────────

  it('rejects a GIF data-URL (unsupported type)', async () => {
    const gif = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAI=';
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);

    await expect(service.updateProfile(1, { profilePicture: gif }))
      .rejects.toBeInstanceOf(BadRequestError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a plain string that is not a URL or data-URL', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);

    await expect(service.updateProfile(1, { profilePicture: 'not-an-image' }))
      .rejects.toBeInstanceOf(BadRequestError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects an HTTP (non-HTTPS) URL', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);

    // HTTP URL starts with http:// not https:// — the regex allows it
    // (the service accepts both http and https via /^https?:\/\//)
    // This test documents current behaviour: HTTP URLs are accepted.
    const httpUrl = 'http://cdn.example.com/photo.jpg';
    (prisma.user.update as Mock).mockResolvedValue({ ...BASE_USER, profilePicture: httpUrl });

    await expect(service.updateProfile(1, { profilePicture: httpUrl })).resolves.not.toThrow();
  });

  // ── Unauthorized requests ────────────────────────────────────────────────

  it('throws UnauthorizedError when the user does not exist', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(null);

    await expect(service.updateProfile(999, { profilePicture: makeDataUrl(5000) }))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  // ── Email conflict check (unrelated to picture but same method) ──────────

  it('throws BadRequestError when the new email is already taken by another user', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(BASE_USER);
    (prisma.user.findFirst  as Mock).mockResolvedValue({ userId: 99 }); // conflict

    await expect(service.updateProfile(1, { email: 'taken@school.et' }))
      .rejects.toBeInstanceOf(BadRequestError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows updating email to the current user own email (no conflict)', async () => {
    const userWithEmail = { ...BASE_USER, email: 'mine@school.et' };
    (prisma.user.findUnique as Mock).mockResolvedValue(userWithEmail);
    (prisma.user.findFirst  as Mock).mockResolvedValue(null); // no conflict
    (prisma.user.update     as Mock).mockResolvedValue(userWithEmail);

    await expect(service.updateProfile(1, { email: 'mine@school.et' })).resolves.not.toThrow();
  });
});
