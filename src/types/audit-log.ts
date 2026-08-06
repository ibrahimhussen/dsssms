import type { PaginationParams } from './pagination';

export interface AuditLogEntry {
  id: string;
  userId: number | null;
  username: string | null;
  role: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListAuditLogsParams extends PaginationParams {
  action?: string;
  entity?: string;
  userId?: number;
  from?: string;
  to?: string;
}
