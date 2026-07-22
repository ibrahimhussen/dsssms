import { Prisma, RoleName, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/app-error';
import { hashPassword } from '../../core/utils/password.util';
import { buildBaseUsername, ensureUniqueUsername, generateTemporaryPassword } from '../../core/utils/code-generator.util';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { CreateStaffInput, ListUsersQuery } from './validation/user.validation';
import { CreateStaffResultDto, UserSummaryDto } from './dto/user.dto';

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

  if (profile) return `${profile.firstName} ${profile.lastName}`;
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
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
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
   */
  async createStaff(input: CreateStaffInput): Promise<CreateStaffResultDto> {
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

    return {
      user: toUserSummaryDto(created),
      credentials: { username, temporaryPassword },
    };
  }

  async listUsers(query: ListUsersQuery): Promise<{ items: UserSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: { roleName: query.role } }),
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

  async updateStatus(userId: number, status: UserStatus): Promise<UserSummaryDto> {
    await this.assertExists(userId);

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

    return toUserSummaryDto(updated);
  }

  /** Admin-initiated password reset — returns a new temporary password once. */
  async resetPassword(userId: number): Promise<{ username: string; temporaryPassword: string }> {
    const user = await this.assertExists(userId);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    await prisma.user.update({
      where: { userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

    return { username: user.username, temporaryPassword };
  }

  private async assertExists(userId: number) {
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) throw new NotFoundError('User');
    return user;
  }
}

export const userService = new UserService();
