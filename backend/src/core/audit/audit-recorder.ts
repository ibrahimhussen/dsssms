import { prisma } from '../../database/prisma-client';
import { logger } from '../logger/logger';

/**
 * Writes one row to the `audit_logs` table. Used across modules to record
 * security- and data-significant actions (logins, staff account changes,
 * backups/restores, settings changes, etc).
 *
 * Deliberately swallows its own errors — a failure to write an audit
 * entry must never break the primary action it's describing (e.g. a
 * successful login or a student being created).
 */
export async function recordAudit(params: {
  userId?: number;
  action: string;
  entity?: string;
  entityId?: string;
  ipAddress?: string;
  metadata?: any;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        ipAddress: params.ipAddress,
        metadata: params.metadata,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log');
  }
}
