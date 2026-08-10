import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { userPermissionService } from './user-permission.service';
import {
  GrantPermissionInput,
  RemovePermissionParam,
} from './validation/user-permission.validation';
import { UserIdParam } from './validation/user.validation';

export class UserPermissionController {
  getPermissions = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserIdParam;
    const permissions = await userPermissionService.getPermissions(id);
    ApiResponse.success(res, { message: 'Permissions retrieved', data: permissions });
  });

  grantPermission = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserIdParam;
    const input = req.body as GrantPermissionInput;
    const permission = await userPermissionService.grantPermission(id, input, {
      userId: req.user!.userId,
      ipAddress: req.ip,
    });
    ApiResponse.success(res, { statusCode: 201, message: 'Permission granted', data: permission });
  });

  revokePermission = asyncHandler(async (req: Request, res: Response) => {
    const { id, permissionId } = req.params as unknown as RemovePermissionParam;
    await userPermissionService.revokePermission(id, permissionId, {
      userId: req.user!.userId,
      ipAddress: req.ip,
    });
    ApiResponse.success(res, { message: 'Permission revoked' });
  });
}

export const userPermissionController = new UserPermissionController();
