export interface AuditLogEntryDto {
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
