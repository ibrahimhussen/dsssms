import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '../lib/audit-logs-api';
import type { ListAuditLogsParams } from '../types/audit-log';

export function useAuditLogs(params: ListAuditLogsParams) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditLogsApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}
