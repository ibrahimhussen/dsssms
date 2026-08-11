import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError } from '../../core/errors/app-error';
import { recordAudit } from '../../core/audit/audit-recorder';
import { ActorContext } from './user.service';
import { GrantPermissionInput } from './validation/user-permission.validation';

export class UserPermissionService {
  async getPermissions(userId: number) {
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) throw new NotFoundError('User not found');

    const permissions = await prisma.userPermission.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });

    return permissions;
  }

  async grantPermission(userId: number, input: GrantPermissionInput, actor: ActorContext) {
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) throw new NotFoundError('User not found');

    const existing = await prisma.userPermission.findUnique({
      where: { userId_permission: { userId, permission: input.permission } },
    });

    if (existing) {
      const updated = await prisma.userPermission.update({
        where: { id: existing.id },
        data: { expiresAt: input.expiresAt ?? null },
      });
      await recordAudit({
        userId: actor.userId,
        ipAddress: actor.ipAddress,
        action: 'UPDATE',
        entity: 'USER_PERMISSION',
        entityId: updated.id.toString(),
        metadata: { details: `Updated permission '${input.permission}' for user ${userId}` },
      });
      return updated;
    }

    const permission = await prisma.userPermission.create({
      data: {
        userId,
        permission: input.permission,
        expiresAt: input.expiresAt,
      },
    });

    await recordAudit({
      userId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'CREATE',
      entity: 'USER_PERMISSION',
      entityId: permission.id.toString(),
      metadata: { details: `Granted permission '${input.permission}' to user ${userId}` },
    });

    return permission;
  }

  async revokePermission(userId: number, permissionId: number, actor: ActorContext) {
    const permission = await prisma.userPermission.findUnique({
      where: { id: permissionId },
    });

    if (!permission || permission.userId !== userId) {
      throw new NotFoundError('Permission not found for this user');
    }

    await prisma.userPermission.delete({ where: { id: permissionId } });

    await recordAudit({
      userId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'DELETE',
      entity: 'USER_PERMISSION',
      entityId: permission.id.toString(),
      metadata: { details: `Revoked permission '${permission.permission}' from user ${userId}` },
    });
  }
}

export const userPermissionService = new UserPermissionService();
