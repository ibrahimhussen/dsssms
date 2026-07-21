import { Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/app-error';
import { hashPassword } from '../../core/utils/password.util';
import { buildBaseUsername, ensureUniqueUsername, generateTemporaryPassword } from '../../core/utils/code-generator.util';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { CreateParentInput, ListParentsQuery } from './validation/parent.validation';
import { CreateParentResultDto, ParentSummaryDto } from './dto/parent.dto';

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

const PARENT_INCLUDE = {
  user: true,
  links: { include: { student: true } },
} satisfies Prisma.ParentInclude;

type ParentWithLinks = Prisma.ParentGetPayload<{ include: typeof PARENT_INCLUDE }>;

function toParentSummaryDto(parent: ParentWithLinks): ParentSummaryDto {
  return {
    parentId: parent.parentId,
    userId: parent.userId,
    username: parent.user.username,
    fullName: parent.fullName,
    phoneNumber: parent.phoneNumber,
    email: parent.user.email,
    children: parent.links.map((link) => ({
      studentId: link.student.studentId,
      admissionNumber: link.student.admissionNumber,
      firstName: link.student.firstName,
      lastName: link.student.lastName,
      relationship: link.relationship,
    })),
  };
}

export class ParentService {
  /**
   * Creates a parent/guardian account. Accepts an optional transaction
   * client so the Student module can create a brand-new parent and link
   * it to a student atomically in a single transaction.
   */
  async createParent(input: CreateParentInput, client: PrismaClientOrTx = prisma): Promise<CreateParentResultDto> {
    if (input.email) {
      const existingEmail = await client.user.findUnique({ where: { email: input.email } });
      if (existingEmail) throw new ConflictError('A user with this email already exists');
    }

    const role = await client.role.findUnique({ where: { roleName: RoleName.PARENT } });
    if (!role) throw new ValidationError('PARENT role is not configured in the system');

    const nameParts = input.fullName.trim().split(/\s+/);
    const baseUsername = buildBaseUsername(nameParts[0] ?? 'parent', nameParts[nameParts.length - 1] ?? 'account');
    const username = await ensureUniqueUsername(
      baseUsername,
      async (candidate) => (await client.user.findUnique({ where: { username: candidate } })) !== null
    );

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const created = await client.user.create({
      data: {
        username,
        email: input.email,
        passwordHash,
        roleId: role.roleId,
        parent: { create: { fullName: input.fullName, phoneNumber: input.phoneNumber } },
      },
      include: { parent: { include: PARENT_INCLUDE } },
    });

    if (!created.parent) {
      throw new ValidationError('Failed to create parent profile');
    }

    return {
      parent: toParentSummaryDto(created.parent),
      credentials: { username, temporaryPassword },
    };
  }

  async getParentById(parentId: number): Promise<ParentSummaryDto> {
    const parent = await prisma.parent.findUnique({ where: { parentId }, include: PARENT_INCLUDE });
    if (!parent) throw new NotFoundError('Parent');
    return toParentSummaryDto(parent);
  }

  async getParentByUserId(userId: number): Promise<ParentSummaryDto> {
    const parent = await prisma.parent.findUnique({ where: { userId }, include: PARENT_INCLUDE });
    if (!parent) throw new NotFoundError('Parent');
    return toParentSummaryDto(parent);
  }

  async listParents(
    query: ListParentsQuery
  ): Promise<{ items: ParentSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.ParentWhereInput = query.search
      ? {
          OR: [
            { fullName: { contains: query.search } },
            { phoneNumber: { contains: query.search } },
            { user: { email: { contains: query.search } } },
          ],
        }
      : {};

    const [items, totalItems] = await Promise.all([
      prisma.parent.findMany({ where, include: PARENT_INCLUDE, skip, take, orderBy: { parentId: 'desc' } }),
      prisma.parent.count({ where }),
    ]);

    return {
      items: items.map(toParentSummaryDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }
}

export const parentService = new ParentService();
