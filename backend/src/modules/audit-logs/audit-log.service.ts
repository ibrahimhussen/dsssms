import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { BadRequestError } from '../../core/errors/app-error';
import { AuditLogEntryDto } from './dto/audit-log.dto';
import { ListAuditLogsQuery } from './validation/audit-log.validation';

type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: { user: { include: { role: true } } };
}>;

function toAuditLogEntryDto(row: AuditLogWithUser): AuditLogEntryDto {
  return {
    id: row.id.toString(),
    userId: row.userId,
    username: row.user?.username ?? null,
    role: row.user?.role.roleName ?? null,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    ipAddress: row.ipAddress,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class AuditLogService {
  async list(query: ListAuditLogsQuery): Promise<{ items: AuditLogEntryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    let createdAtFilter: Prisma.DateTimeFilter | undefined;
    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;
      if ((query.from && Number.isNaN(from?.getTime())) || (query.to && Number.isNaN(to?.getTime()))) {
        throw new BadRequestError('Invalid `from`/`to` date');
      }
      createdAtFilter = { ...(from && { gte: from }), ...(to && { lte: to }) };
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(query.action && { action: { contains: query.action } }),
      ...(query.entity && { entity: query.entity }),
      ...(query.userId && { userId: query.userId }),
      ...(createdAtFilter && { createdAt: createdAtFilter }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map(toAuditLogEntryDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }
}

export const auditLogService = new AuditLogService();
