import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { auditLogService } from './audit-log.service';
import { ListAuditLogsQuery, listAuditLogsQuerySchema } from './validation/audit-log.validation';

export class AuditLogController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query: ListAuditLogsQuery = listAuditLogsQuerySchema.parse(req.query);
    const { items, meta } = await auditLogService.list(query);
    ApiResponse.success(res, { message: 'Audit logs retrieved', data: items, pagination: meta });
  });
}

export const auditLogController = new AuditLogController();
