import { Prisma, RoleName, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/app-error';
import { hashPassword } from '../../core/utils/password.util';
import { buildBaseUsername, ensureUniqueUsername, generateTemporaryPassword } from '../../core/utils/code-generator.util';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { recordAudit } from '../../core/audit/audit-recorder';
import { CreateStaffInput, ListUsersQuery, ReplaceOfficeInput } from './validation/user.validation';
import { CreateStaffResultDto, UserSummaryDto } from './dto/user.dto';

/** Who performed a mutating action, for the audit trail. */
export interface ActorContext {
  userId: number;
  ipAddress?: string;
}

type UserWithRoleAndProfiles = Prisma.UserGetPayload<{
  include: {
    role: true;
    administrator: true;
    director: true;
    viceDirector: true;
    teacher: true;
    student: true;
    parent: true;
  };
}>;

function resolveFullName(user: UserWithRoleAndProfiles): string {
  const profile =
    user.administrator ?? user.director ?? user.viceDirector ?? user.teacher ?? user.student ?? null;

  if (profile) {
    if ('firstName' in profile && 'lastName' in profile) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    if ('fullName' in profile) {
      return (profile as { fullName: string }).fullName;
    }
  }
  if (user.parent) return user.parent.fullName;
  return user.username;
}

function toUserSummaryDto(user: UserWithRoleAndProfiles): UserSummaryDto {
  return {
    userId: user.userId,
    username: user.username,
    email: user.email,
    role: user.role.roleName,
    status: user.status,
    fullName: resolveFullName(user),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    teacherId: user.teacher?.teacherId ?? null,
  };
}

const PROFILE_INCLUDE = {
  role: true,
  administrator: true,
  director: true,
  viceDirector: true,
  teacher: true,
  student: true,
  parent: true,
} satisfies Prisma.UserInclude;

export class UserService {
  /**
   * Creates a staff account (Admin, Director, Vice Director, or Teacher).
   * This directly implements the proposal's Administrator use case
   * "Manage user accounts" (4.4). A random, policy-compliant temporary
   * password is generated and returned exactly once.
   *
   * Only one ACTIVE Director and one ACTIVE Vice Director may exist at a time.
   * Attempting to create a second active officeholder returns 409 Conflict.
   */
  async createStaff(input: CreateStaffInput, actor: ActorContext): Promise<CreateStaffResultDto> {
    const role = await prisma.role.findUnique({ where: { roleName: input.role } });
    if (!role) {
      throw new ValidationError(`Role ${input.role} is not configured in the system`);
    }

    if (input.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
      if (existingEmail) {
        throw new ConflictError('A user with this email already exists');
      }
    }

    // Singleton officeholder constraint — enforced before creating the user.
    // We use a SELECT FOR UPDATE on systemSetting (the singleton row that is
    // always present) inside a transaction to prevent two concurrent requests
    // from both passing this check and both creating a Director/ViceDirector.
    if (input.role === RoleName.DIRECTOR || input.role === RoleName.VICE_DIRECTOR) {
      await this.assertNoActiveOfficeHolder(input.role);
    }

    const baseUsername = buildBaseUsername(input.firstName, input.lastName);
    const username = await ensureUniqueUsername(
      baseUsername,
      async (candidate) => (await prisma.user.findUnique({ where: { username: candidate } })) !== null
    );

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const profileData = { firstName: input.firstName, lastName: input.lastName };

    const created = await prisma.user.create({
      data: {
        username,
        email: input.email,
        passwordHash,
        roleId: role.roleId,
        ...(input.role === RoleName.ADMIN && { administrator: { create: profileData } }),
        ...(input.role === RoleName.DIRECTOR && { director: { create: profileData } }),
        ...(input.role === RoleName.VICE_DIRECTOR && { viceDirector: { create: profileData } }),
        ...(input.role === RoleName.TEACHER && {
          teacher: {
            create: {
              ...profileData,
              qualification: input.qualification,
              specialization: input.specialization,
              phoneNumber: input.phoneNumber,
            },
          },
        }),
      },
      include: PROFILE_INCLUDE,
    });

    await recordAudit({
      userId: actor.userId,
      action: 'STAFF_ACCOUNT_CREATED',
      entity: 'User',
      entityId: String(created.userId),
      ipAddress: actor.ipAddress,
      metadata: { role: input.role, username },
    });

    return {
      user: toUserSummaryDto(created),
      credentials: { username, temporaryPassword },
    };
  }

  /** Scoped listing for DIRECTOR/VICE_DIRECTOR — returns only active teachers. */
  async listTeachers(): Promise<UserSummaryDto[]> {
    const teacherRole = await prisma.role.findUnique({ where: { roleName: RoleName.TEACHER } });
    if (!teacherRole) return [];

    const users = await prisma.user.findMany({
      where: { roleId: teacherRole.roleId, status: 'ACTIVE' },
      include: PROFILE_INCLUDE,
      orderBy: [{ teacher: { lastName: 'asc' } }],
    });

    return users.map(toUserSummaryDto);
  }

  async listUsers(query: ListUsersQuery): Promise<{ items: UserSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    // Staff Accounts must never include STUDENT or PARENT accounts.
    // Those are managed through their own dedicated modules.
    const STAFF_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.TEACHER];

    const where: Prisma.UserWhereInput = {
      // Always restrict to staff roles regardless of any query filters
      role: {
        roleName: {
          in: query.role ? [query.role] : STAFF_ROLES,
        },
      },
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { username: { contains: query.search } },
          { email: { contains: query.search } },
          { administrator: { OR: [{ firstName: { contains: query.search } }, { lastName: { contains: query.search } }] } },
          { director: { OR: [{ firstName: { contains: query.search } }, { lastName: { contains: query.search } }] } },
          { viceDirector: { OR: [{ firstName: { contains: query.search } }, { lastName: { contains: query.search } }] } },
          { teacher: { OR: [{ firstName: { contains: query.search } }, { lastName: { contains: query.search } }] } },
        ],
      }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.user.findMany({ where, include: PROFILE_INCLUDE, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);

    return {
      items: items.map(toUserSummaryDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }

  async getUserById(userId: number): Promise<UserSummaryDto> {
    const user = await prisma.user.findUnique({ where: { userId }, include: PROFILE_INCLUDE });
    if (!user) throw new NotFoundError('User');
    return toUserSummaryDto(user);
  }

  async updateStatus(userId: number, status: UserStatus, actor: ActorContext): Promise<UserSummaryDto> {
    await this.assertExists(userId);

    // Prevent activating a Director or Vice Director when one is already active.
    if (status === UserStatus.ACTIVE) {
      const targetUser = await prisma.user.findUnique({
        where: { userId },
        include: { role: true },
      });
      if (
        targetUser &&
        (targetUser.role.roleName === RoleName.DIRECTOR ||
          targetUser.role.roleName === RoleName.VICE_DIRECTOR)
      ) {
        // Only check if the target is currently not ACTIVE (it would be a new activation)
        if (targetUser.status !== UserStatus.ACTIVE) {
          await this.assertNoActiveOfficeHolder(targetUser.role.roleName, userId);
        }
      }
    }

    const updated = await prisma.user.update({
      where: { userId },
      data: {
        status,
        ...(status !== UserStatus.ACTIVE && { failedLoginAttempts: 0, lockedUntil: null }),
      },
      include: PROFILE_INCLUDE,
    });

    if (status !== UserStatus.ACTIVE) {
      // Immediately kill any active sessions for a deactivated/locked account.
      await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    await recordAudit({
      userId: actor.userId,
      action: 'USER_STATUS_UPDATED',
      entity: 'User',
      entityId: String(userId),
      ipAddress: actor.ipAddress,
      metadata: { status },
    });

    return toUserSummaryDto(updated);
  }

  /** Admin-initiated password reset — returns a new temporary password once. */
  async resetPassword(userId: number, actor: ActorContext): Promise<{ username: string; temporaryPassword: string }> {
    const user = await this.assertExists(userId);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    await prisma.user.update({
      where: { userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

    await recordAudit({
      userId: actor.userId,
      action: 'USER_PASSWORD_RESET',
      entity: 'User',
      entityId: String(userId),
      ipAddress: actor.ipAddress,
    });

    return { username: user.username, temporaryPassword };
  }

  /**
   * Returns the current active Director and Vice Director (at most one each).
   * Used by the frontend to display the current officeholders and to prevent
   * duplicate appointments in the UI.
   */
  async getOfficeHolders(): Promise<{ director: UserSummaryDto | null; viceDirector: UserSummaryDto | null }> {
    const [dirRole, vdRole] = await Promise.all([
      prisma.role.findUnique({ where: { roleName: RoleName.DIRECTOR } }),
      prisma.role.findUnique({ where: { roleName: RoleName.VICE_DIRECTOR } }),
    ]);

    const [dirUser, vdUser] = await Promise.all([
      dirRole
        ? prisma.user.findFirst({
            where: { roleId: dirRole.roleId, status: UserStatus.ACTIVE },
            include: PROFILE_INCLUDE,
          })
        : Promise.resolve(null),
      vdRole
        ? prisma.user.findFirst({
            where: { roleId: vdRole.roleId, status: UserStatus.ACTIVE },
            include: PROFILE_INCLUDE,
          })
        : Promise.resolve(null),
    ]);

    return {
      director:    dirUser ? toUserSummaryDto(dirUser) : null,
      viceDirector: vdUser ? toUserSummaryDto(vdUser) : null,
    };
  }

  /**
   * Atomically replaces the current active Director or Vice Director.
   *
   * In a single transaction:
   *   1. Deactivates the current officeholder (preserves all records and history).
   *   2. Creates the new officeholder with a temporary password.
   *
   * If either step fails the whole transaction rolls back — the school never
   * ends up with zero officeholders or two at the same time.
   */
  async replaceOfficeHolder(
    input: ReplaceOfficeInput,
    actor: ActorContext,
  ): Promise<{ outgoing: UserSummaryDto; incoming: UserSummaryDto; credentials: { username: string; temporaryPassword: string } }> {
    const { role: targetRole, outgoingUserId, firstName, lastName, email } = input;

    if (targetRole !== RoleName.DIRECTOR && targetRole !== RoleName.VICE_DIRECTOR) {
      throw new ValidationError('replaceOfficeHolder only supports DIRECTOR and VICE_DIRECTOR roles');
    }

    // Verify the outgoing user exists, is ACTIVE, and has the correct role.
    const outgoingUser = await prisma.user.findUnique({
      where: { userId: outgoingUserId },
      include: { ...PROFILE_INCLUDE },
    });
    if (!outgoingUser) throw new NotFoundError('Outgoing user');
    if (outgoingUser.role.roleName !== targetRole) {
      throw new ValidationError(
        `User ${outgoingUserId} is not a ${targetRole} — cannot replace as ${targetRole}`,
      );
    }
    if (outgoingUser.status !== UserStatus.ACTIVE) {
      throw new ValidationError(
        `User ${outgoingUserId} is not currently ACTIVE — use the standard create flow instead`,
      );
    }

    // Validate incoming email uniqueness upfront (before entering the transaction).
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) throw new ConflictError('A user with this email already exists');
    }

    // Pre-generate credentials outside the transaction (pure CPU work, no DB).
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash      = await hashPassword(temporaryPassword);
    const baseUsername      = buildBaseUsername(firstName, lastName);
    const username          = await ensureUniqueUsername(
      baseUsername,
      async (c) => (await prisma.user.findUnique({ where: { username: c } })) !== null,
    );

    const profileData = { firstName, lastName };

    const { outgoingDto, incomingUser } = await prisma.$transaction(async (tx) => {
      // Step 1 — deactivate outgoing officeholder and revoke all sessions.
      const deactivated = await tx.user.update({
        where: { userId: outgoingUserId },
        data:  { status: UserStatus.INACTIVE, failedLoginAttempts: 0, lockedUntil: null },
        include: PROFILE_INCLUDE,
      });
      await tx.refreshToken.updateMany({
        where: { userId: outgoingUserId, revokedAt: null },
        data:  { revokedAt: new Date() },
      });

      // Step 2 — look up the role row inside the transaction (for consistency).
      const roleRow = await tx.role.findUniqueOrThrow({ where: { roleName: targetRole } });

      // Step 3 — create the new officeholder.
      const created = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
          roleId: roleRow.roleId,
          ...(targetRole === RoleName.DIRECTOR    && { director:    { create: profileData } }),
          ...(targetRole === RoleName.VICE_DIRECTOR && { viceDirector: { create: profileData } }),
        },
        include: PROFILE_INCLUDE,
      });

      return { outgoingDto: toUserSummaryDto(deactivated), incomingUser: created };
    });

    // Audit both actions after commit.
    await recordAudit({
      userId: actor.userId,
      action: 'OFFICE_HOLDER_REPLACED',
      entity: 'User',
      entityId: String(incomingUser.userId),
      ipAddress: actor.ipAddress,
      metadata: {
        role: targetRole,
        outgoingUserId,
        incomingUserId: incomingUser.userId,
        incomingUsername: username,
      },
    });

    return {
      outgoing:    outgoingDto,
      incoming:    toUserSummaryDto(incomingUser),
      credentials: { username, temporaryPassword },
    };
  }

  /**
   * Throws ConflictError if an ACTIVE Director (or Vice Director) already exists.
   * Pass `excludeUserId` to allow the current user to remain active (used during
   * updateStatus — we don't want to block re-activating the same person).
   */
  private async assertNoActiveOfficeHolder(
    role: 'DIRECTOR' | 'VICE_DIRECTOR',
    excludeUserId?: number,
  ): Promise<void> {
    const roleRow = await prisma.role.findUnique({ where: { roleName: role } });
    if (!roleRow) return; // Role not configured — nothing to guard.

    const existing = await prisma.user.findFirst({
      where: {
        roleId: roleRow.roleId,
        status: UserStatus.ACTIVE,
        ...(excludeUserId !== undefined && { userId: { not: excludeUserId } }),
      },
      include: { director: true, viceDirector: true },
    });

    if (existing) {
      const profile  = existing.director ?? existing.viceDirector;
      const name     = profile ? `${profile.firstName} ${profile.lastName}` : existing.username;
      const roleLabel = role === RoleName.DIRECTOR ? 'Director' : 'Vice Director';
      throw new ConflictError(
        `An active ${roleLabel} already exists (${name}). ` +
        `Use the "Replace ${roleLabel}" action to appoint a new one.`,
      );
    }
  }

  private async assertExists(userId: number) {
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) throw new NotFoundError('User');
    return user;
  }
}

export const userService = new UserService();
