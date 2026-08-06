import { apiClient, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { AuditLogEntry, ListAuditLogsParams } from '../types/audit-log';

export const auditLogsApi = {
  list(params: ListAuditLogsParams) {
    return unwrapPaginated(apiClient.get<ApiResponse<AuditLogEntry[]>>('/audit-logs', { params: cleanParams(params) }));
  },
};
