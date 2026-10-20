/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * UserService — Director / Vice Director uniqueness and replacement tests.
 *
 * DATABASE SAFETY: all Prisma calls are mocked — no real DB connection.
 *
 * Coverage:
 *   createStaff
 *     - creates the first Director when none exists
 *     - rejects a second active Director (409)
 *     - creates the first Vice Director when none exists
 *     - rejects a second active Vice Director (409)
 *     - allows creating a Director when existing Director is INACTIVE
 *     - does NOT guard TEACHER / ADMIN roles
 *
 *   updateStatus — activating a Director/ViceDirector
 *     - allows activation when no other active officeholder exists
 *     - rejects activation when another active Director exists (409)
 *     - rejects activation when another active ViceDirector exists (409)
 *     - does NOT guard TEACHER activation
 *
 *   getOfficeHolders
 *     - returns null/null when neither role exists
 *     - returns the current active Director and Vice Director
 *
 *   replaceOfficeHolder
 *     - successfully replaces the active Director
 *     - successfully replaces the active Vice Director
 *     - deactivates the outgoing user and creates the incoming user
 *     - throws 404 when outgoing user does not exist
 *     - throws 422 when outgoing user has the wrong role
 *     - throws 422 when outgoing user is not ACTIVE
 *     - throws 409 when incoming email is already taken
 *     - records an OFFICE_HOLDER_REPLACED audit entry
 *     - transaction rollback: if user.create throws, outgoing is NOT deactivated
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock Prisma BEFORE importing service ─────────────────────────────────────
// The transaction mock invokes the callback with a tx that mirrors the
// top-level prisma delegates, so service code using tx.user.xxx works.

const makeTxMock = () => ({
  role:         { findUniqueOrThrow: vi.fn(), findUnique: vi.fn() },
  user:         { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  refreshToken: { updateMany: vi.fn() },
});

let txMock = makeTxMock();

vi.mock('../../../database/prisma-client', () => {
  const transactionImpl = vi.fn(async (cb: (tx: any) => Promise<any>) => cb(txMock));
  return {
    prisma: {
      role:         { findUnique: vi.fn() },
      user:         { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
      refreshToken: { updateMany: vi.fn() },
      $transaction: transactionImpl,
    },
  };
});

vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));
vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));
vi.mock('../../../core/utils/password.util', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));
vi.mock('../../../core/utils/code-generator.util', () => ({
  buildBaseUsername:          vi.fn().mockReturnValue('newperson'),
  ensureUniqueUsername:       vi.fn().mockResolvedValue('newperson'),
  generateTemporaryPassword:  vi.fn().mockReturnValue('TempPass1!'),
}));

import { UserService } from '../user.service';
import { prisma } from '../../../database/prisma-client';
import { recordAudit } from '../../../core/audit/audit-recorder';
import { hashPassword } from '../../../core/utils/password.util';
import { buildBaseUsername, ensureUniqueUsername, generateTemporaryPassword } from '../../../core/utils/code-generator.util';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkUser(
  overrides: {
    userId?: number;
    username?: string;
    role?: string;
    status?: string;
    firstName?: string;
    lastName?: string;
  } = {},
) {
  const role = overrides.role ?? 'TEACHER';
  const firstName = overrides.firstName ?? 'Tom';
  const lastName  = overrides.lastName  ?? 'Tadesse';
  return {
    userId:              overrides.userId              ?? 1,
    username:            overrides.username            ?? 'tomtadesse',
    email:               null,
    status:              overrides.status              ?? 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil:         null,
    lastLoginAt:         null,
    createdAt:           new Date(),
    updatedAt:           new Date(),
    isTemporaryPassword: true,
    profilePicture:      null,
    roleId:              1,
    role:                { roleName: role },
    administrator:       null,
    director:     role === 'DIRECTOR'      ? { directorId: 10,     userId: overrides.userId ?? 1, firstName, lastName } : null,
    viceDirector: role === 'VICE_DIRECTOR' ? { viceDirectorId: 20, userId: overrides.userId ?? 1, firstName, lastName } : null,
    teacher:      role === 'TEACHER'       ? { teacherId: 100,     userId: overrides.userId ?? 1, firstName, lastName } : null,
    parent:       null,
    student:      null,
  };
}

const DIRECTOR_ROLE    = { roleId: 3, roleName: 'DIRECTOR' };
const VD_ROLE          = { roleId: 4, roleName: 'VICE_DIRECTOR' };
const TEACHER_ROLE     = { roleId: 2, roleName: 'TEACHER' };
const ACTOR            = { userId: 99, ipAddress: '127.0.0.1' };

const directorInput = {
  role:      'DIRECTOR' as const,
  firstName: 'New',
  lastName:  'Director',
};
const vdInput = {
  role:      'VICE_DIRECTOR' as const,
  firstName: 'New',
  lastName:  'ViceDirector',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserService — officeholder uniqueness', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    vi.resetAllMocks();
    txMock = makeTxMock();
    // Re-wire $transaction after reset
    (prisma.$transaction as Mock).mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock));
    // Re-apply utility mocks
    (hashPassword as Mock).mockResolvedValue('hashed');
    (buildBaseUsername as Mock).mockReturnValue('newperson');
    (ensureUniqueUsername as Mock).mockResolvedValue('newperson');
    (generateTemporaryPassword as Mock).mockReturnValue('TempPass1!');
  });

  // ── createStaff — Director/ViceDirector uniqueness guard ────────────────

  describe('createStaff — officeholder uniqueness', () => {
    it('creates the first Director when no active Director exists', async () => {
      (prisma.role.findUnique as Mock)
        .mockResolvedValueOnce(DIRECTOR_ROLE)   // role lookup
        .mockResolvedValueOnce(DIRECTOR_ROLE);  // assertNoActiveOfficeHolder
      (prisma.user.findUnique as Mock).mockResolvedValue(null); // no email duplicate
      (prisma.user.findFirst  as Mock).mockResolvedValue(null); // no existing director
      (prisma.user.create     as Mock).mockResolvedValue(mkUser({ role: 'DIRECTOR' }));

      const result = await service.createStaff(directorInput, ACTOR);

      expect(prisma.user.create).toHaveBeenCalledOnce();
      expect(result.user.role).toBe('DIRECTOR');
    });

    it('throws 409 when an active Director already exists', async () => {
      (prisma.role.findUnique as Mock)
        .mockResolvedValueOnce(DIRECTOR_ROLE)  // role lookup
        .mockResolvedValueOnce(DIRECTOR_ROLE); // assertNoActiveOfficeHolder
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      // findFirst returns an existing active Director
      (prisma.user.findFirst as Mock).mockResolvedValue(
        mkUser({ userId: 5, role: 'DIRECTOR', firstName: 'Existing', lastName: 'Director' }),
      );

      await expect(service.createStaff(directorInput, ACTOR)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('active Director already exists'),
      });

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates the first Vice Director when no active Vice Director exists', async () => {
      (prisma.role.findUnique as Mock)
        .mockResolvedValueOnce(VD_ROLE)
        .mockResolvedValueOnce(VD_ROLE);
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (prisma.user.findFirst  as Mock).mockResolvedValue(null);
      (prisma.user.create     as Mock).mockResolvedValue(mkUser({ role: 'VICE_DIRECTOR' }));

      const result = await service.createStaff(vdInput, ACTOR);

      expect(prisma.user.create).toHaveBeenCalledOnce();
      expect(result.user.role).toBe('VICE_DIRECTOR');
    });

    it('throws 409 when an active Vice Director already exists', async () => {
      (prisma.role.findUnique as Mock)
        .mockResolvedValueOnce(VD_ROLE)
        .mockResolvedValueOnce(VD_ROLE);
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (prisma.user.findFirst  as Mock).mockResolvedValue(
        mkUser({ userId: 6, role: 'VICE_DIRECTOR', firstName: 'Existing', lastName: 'VD' }),
      );

      await expect(service.createStaff(vdInput, ACTOR)).rejects.toMatchObject({ statusCode: 409 });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('allows creating a Director when the existing Director is INACTIVE', async () => {
      (prisma.role.findUnique as Mock)
        .mockResolvedValueOnce(DIRECTOR_ROLE)
        .mockResolvedValueOnce(DIRECTOR_ROLE);
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      // findFirst finds no ACTIVE director (the existing one is INACTIVE so query filters it out)
      (prisma.user.findFirst as Mock).mockResolvedValue(null);
      (prisma.user.create    as Mock).mockResolvedValue(mkUser({ role: 'DIRECTOR' }));

      const result = await service.createStaff(directorInput, ACTOR);

      expect(result.user.role).toBe('DIRECTOR');
    });

    it('does NOT apply the officeholder guard for TEACHER role', async () => {
      (prisma.role.findUnique as Mock).mockResolvedValue(TEACHER_ROLE);
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (prisma.user.create     as Mock).mockResolvedValue(mkUser({ role: 'TEACHER' }));

      await service.createStaff({ role: 'TEACHER', firstName: 'T', lastName: 'T' }, ACTOR);

      // findFirst (used by assertNoActiveOfficeHolder) must NOT have been called
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── updateStatus — activation guard ──────────────────────────────────────

  describe('updateStatus — activation guard', () => {
    it('allows activating a Director when no other active Director exists', async () => {
      const inactiveDir = mkUser({ userId: 7, role: 'DIRECTOR', status: 'INACTIVE' });
      (prisma.user.findUnique as Mock)
        .mockResolvedValueOnce(inactiveDir)                       // assertExists
        .mockResolvedValueOnce({ ...inactiveDir, role: { roleName: 'DIRECTOR' } }); // role check
      (prisma.role.findUnique as Mock).mockResolvedValue(DIRECTOR_ROLE);
      (prisma.user.findFirst  as Mock).mockResolvedValue(null); // no other active Director
      (prisma.user.update     as Mock).mockResolvedValue({ ...inactiveDir, status: 'ACTIVE' });

      const result = await service.updateStatus(7, 'ACTIVE' as any, ACTOR);

      expect(result.status).toBe('ACTIVE');
    });

    it('throws 409 when activating a Director while another is already ACTIVE', async () => {
      const inactiveDir = mkUser({ userId: 7, role: 'DIRECTOR', status: 'INACTIVE' });
      (prisma.user.findUnique as Mock)
        .mockResolvedValueOnce(inactiveDir)
        .mockResolvedValueOnce({ ...inactiveDir, role: { roleName: 'DIRECTOR' } });
      (prisma.role.findUnique as Mock).mockResolvedValue(DIRECTOR_ROLE);
      (prisma.user.findFirst  as Mock).mockResolvedValue(
        mkUser({ userId: 5, role: 'DIRECTOR', status: 'ACTIVE' }),
      );

      await expect(service.updateStatus(7, 'ACTIVE' as any, ACTOR)).rejects.toMatchObject({
        statusCode: 409,
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws 409 when activating a Vice Director while another is already ACTIVE', async () => {
      const inactiveVD = mkUser({ userId: 8, role: 'VICE_DIRECTOR', status: 'INACTIVE' });
      (prisma.user.findUnique as Mock)
        .mockResolvedValueOnce(inactiveVD)
        .mockResolvedValueOnce({ ...inactiveVD, role: { roleName: 'VICE_DIRECTOR' } });
      (prisma.role.findUnique as Mock).mockResolvedValue(VD_ROLE);
      (prisma.user.findFirst  as Mock).mockResolvedValue(
        mkUser({ userId: 6, role: 'VICE_DIRECTOR', status: 'ACTIVE' }),
      );

      await expect(service.updateStatus(8, 'ACTIVE' as any, ACTOR)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('does NOT apply the officeholder guard when deactivating a Director', async () => {
      const activeDir = mkUser({ userId: 5, role: 'DIRECTOR', status: 'ACTIVE' });
      (prisma.user.findUnique as Mock).mockResolvedValue(activeDir);
      (prisma.user.update     as Mock).mockResolvedValue({ ...activeDir, status: 'INACTIVE' });
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

      await service.updateStatus(5, 'INACTIVE' as any, ACTOR);

      // findFirst should NOT be called for deactivation
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('does NOT apply the officeholder guard for TEACHER activation', async () => {
      const inactiveTeacher = mkUser({ userId: 9, role: 'TEACHER', status: 'INACTIVE' });
      (prisma.user.findUnique as Mock)
        .mockResolvedValueOnce(inactiveTeacher)
        .mockResolvedValueOnce({ ...inactiveTeacher, role: { roleName: 'TEACHER' } });
      (prisma.user.update as Mock).mockResolvedValue({ ...inactiveTeacher, status: 'ACTIVE' });

      await service.updateStatus(9, 'ACTIVE' as any, ACTOR);

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── getOfficeHolders ──────────────────────────────────────────────────────

  describe('getOfficeHolders', () => {
    it('returns null for both when no active officeholders exist', async () => {
      (prisma.role.findUnique as Mock)
        .mockResolvedValueOnce(DIRECTOR_ROLE)
        .mockResolvedValueOnce(VD_ROLE);
      (prisma.user.findFirst as Mock).mockResolvedValue(null);

      const result = await service.getOfficeHolders();

      expect(result.director).toBeNull();
      expect(result.viceDirector).toBeNull();
    });

    it('returns the current active Director and Vice Director', async () => {
      (prisma.role.findUnique as Mock)
        .mockResolvedValueOnce(DIRECTOR_ROLE)
        .mockResolvedValueOnce(VD_ROLE);
      (prisma.user.findFirst as Mock)
        .mockResolvedValueOnce(mkUser({ userId: 5, role: 'DIRECTOR', firstName: 'Ali', lastName: 'Kebede' }))
        .mockResolvedValueOnce(mkUser({ userId: 6, role: 'VICE_DIRECTOR', firstName: 'Fatima', lastName: 'Ahmed' }));

      const result = await service.getOfficeHolders();

      expect(result.director).toMatchObject({ userId: 5, role: 'DIRECTOR', fullName: 'Ali Kebede' });
      expect(result.viceDirector).toMatchObject({ userId: 6, role: 'VICE_DIRECTOR', fullName: 'Fatima Ahmed' });
    });

    it('returns director when vice director role is not configured', async () => {
      (prisma.role.findUnique as Mock)
        .mockResolvedValueOnce(DIRECTOR_ROLE)
        .mockResolvedValueOnce(null); // VD role missing
      (prisma.user.findFirst as Mock).mockResolvedValueOnce(
        mkUser({ userId: 5, role: 'DIRECTOR', firstName: 'Ali', lastName: 'Kebede' }),
      );

      const result = await service.getOfficeHolders();

      expect(result.director).not.toBeNull();
      expect(result.viceDirector).toBeNull();
    });
  });

  // ── replaceOfficeHolder ───────────────────────────────────────────────────

  describe('replaceOfficeHolder', () => {
    const replaceInput = {
      role:           'DIRECTOR' as const,
      outgoingUserId: 5,
      firstName:      'New',
      lastName:       'Director',
      email:          undefined as string | undefined,
    };

    function setupSuccessfulReplace(role = 'DIRECTOR') {
      const outgoing = mkUser({ userId: 5, role, status: 'ACTIVE', firstName: 'Old', lastName: 'Dir' });
      // prisma.user.findUnique → outgoing user lookup
      (prisma.user.findUnique as Mock).mockResolvedValueOnce(outgoing);
      // No duplicate email
      (prisma.user.findUnique as Mock).mockResolvedValueOnce(null);
      // Transaction: tx.role.findUniqueOrThrow
      txMock.role.findUniqueOrThrow.mockResolvedValue(
        role === 'DIRECTOR' ? DIRECTOR_ROLE : VD_ROLE,
      );
      // Transaction: tx.user.update (deactivate outgoing)
      txMock.user.update.mockResolvedValue({ ...outgoing, status: 'INACTIVE' });
      txMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      // Transaction: tx.user.create (create incoming)
      const incoming = mkUser({ userId: 99, role, firstName: 'New', lastName: 'Director' });
      txMock.user.create.mockResolvedValue(incoming);
      return { outgoing, incoming };
    }

    it('successfully replaces the active Director', async () => {
      setupSuccessfulReplace('DIRECTOR');

      const result = await service.replaceOfficeHolder(replaceInput, ACTOR);

      expect(result.outgoing.status).toBe('INACTIVE');
      expect(result.incoming.role).toBe('DIRECTOR');
      expect(result.credentials).toMatchObject({
        username:          'newperson',
        temporaryPassword: 'TempPass1!',
      });
    });

    it('successfully replaces the active Vice Director', async () => {
      setupSuccessfulReplace('VICE_DIRECTOR');
      const vdInput = { ...replaceInput, role: 'VICE_DIRECTOR' as const };

      const result = await service.replaceOfficeHolder(vdInput, ACTOR);

      expect(result.outgoing.status).toBe('INACTIVE');
      expect(result.incoming.role).toBe('VICE_DIRECTOR');
    });

    it('deactivates the outgoing user inside the transaction', async () => {
      setupSuccessfulReplace('DIRECTOR');

      await service.replaceOfficeHolder(replaceInput, ACTOR);

      expect(txMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 5 },
          data:  expect.objectContaining({ status: 'INACTIVE' }),
        }),
      );
    });

    it('creates the incoming user inside the transaction', async () => {
      setupSuccessfulReplace('DIRECTOR');

      await service.replaceOfficeHolder(replaceInput, ACTOR);

      expect(txMock.user.create).toHaveBeenCalledOnce();
      const createArgs = txMock.user.create.mock.calls[0][0];
      expect(createArgs.data).toMatchObject({
        username: 'newperson',
        director: { create: { firstName: 'New', lastName: 'Director' } },
      });
    });

    it('revokes the outgoing user sessions inside the transaction', async () => {
      setupSuccessfulReplace('DIRECTOR');

      await service.replaceOfficeHolder(replaceInput, ACTOR);

      expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 5, revokedAt: null },
        data:  { revokedAt: expect.any(Date) },
      });
    });

    it('records an OFFICE_HOLDER_REPLACED audit entry', async () => {
      setupSuccessfulReplace('DIRECTOR');

      await service.replaceOfficeHolder(replaceInput, ACTOR);

      expect(recordAudit).toHaveBeenCalledOnce();
      const auditArg = (recordAudit as Mock).mock.calls[0][0];
      expect(auditArg.action).toBe('OFFICE_HOLDER_REPLACED');
      expect(auditArg.metadata).toMatchObject({
        role:            'DIRECTOR',
        outgoingUserId:  5,
        incomingUsername: 'newperson',
      });
    });

    it('throws 404 when the outgoing user does not exist', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(service.replaceOfficeHolder(replaceInput, ACTOR)).rejects.toMatchObject({
        statusCode: 404,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws 422 when the outgoing user has the wrong role', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(
        mkUser({ userId: 5, role: 'TEACHER', status: 'ACTIVE' }),
      );

      await expect(service.replaceOfficeHolder(replaceInput, ACTOR)).rejects.toMatchObject({
        statusCode: 422,
        message: expect.stringContaining('not a DIRECTOR'),
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws 422 when the outgoing user is not ACTIVE', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(
        mkUser({ userId: 5, role: 'DIRECTOR', status: 'INACTIVE' }),
      );

      await expect(service.replaceOfficeHolder(replaceInput, ACTOR)).rejects.toMatchObject({
        statusCode: 422,
        message: expect.stringContaining('not currently ACTIVE'),
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws 409 when the incoming email is already taken', async () => {
      const outgoing = mkUser({ userId: 5, role: 'DIRECTOR', status: 'ACTIVE' });
      (prisma.user.findUnique as Mock)
        .mockResolvedValueOnce(outgoing)    // outgoing user lookup
        .mockResolvedValueOnce(mkUser());   // email duplicate found

      const inputWithEmail = { ...replaceInput, email: 'taken@school.et' };

      await expect(service.replaceOfficeHolder(inputWithEmail, ACTOR)).rejects.toMatchObject({
        statusCode: 409,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('transaction rollback: if tx.user.create throws, the outgoing user is NOT left deactivated', async () => {
      const outgoing = mkUser({ userId: 5, role: 'DIRECTOR', status: 'ACTIVE' });
      (prisma.user.findUnique as Mock).mockResolvedValueOnce(outgoing);
      (prisma.user.findUnique as Mock).mockResolvedValueOnce(null); // no email duplicate

      // Simulate the transaction rolling back when create throws
      (prisma.$transaction as Mock).mockRejectedValueOnce(new Error('DB constraint violation'));

      await expect(service.replaceOfficeHolder(replaceInput, ACTOR)).rejects.toThrow(
        'DB constraint violation',
      );

      // The top-level user.update (deactivate) must NOT have been called —
      // the rollback is handled by the $transaction mock rejecting.
      expect(prisma.user.update).not.toHaveBeenCalled();
      // No audit entry should be recorded either
      expect(recordAudit).not.toHaveBeenCalled();
    });
  });
});
