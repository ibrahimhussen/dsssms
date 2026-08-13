import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { userService } from './user.service';
import {
  CreateStaffInput,
  ListUsersQuery,
  listUsersQuerySchema,
  UserIdParam,
  UpdateUserStatusInput,
} from './validation/user.validation';

export class UserController {
  createStaff = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateStaffInput;
    const result = await userService.createStaff(input, { userId: req.user!.userId, ipAddress: req.ip });
    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Staff account created. Share the temporary credentials securely — they will not be shown again.',
      data: result,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query: ListUsersQuery = listUsersQuerySchema.parse(req.query);
    const { items, meta } = await userService.listUsers(query);
    ApiResponse.success(res, { message: 'Users retrieved', data: items, pagination: meta });
  });

  listTeachers = asyncHandler(async (_req: Request, res: Response) => {
    const items = await userService.listTeachers();
    ApiResponse.success(res, { message: 'Teachers retrieved', data: items });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserIdParam;
    const user = await userService.getUserById(id);
    ApiResponse.success(res, { message: 'User retrieved', data: user });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserIdParam;
    const { status } = req.body as UpdateUserStatusInput;
    const user = await userService.updateStatus(id, status, { userId: req.user!.userId, ipAddress: req.ip });
    ApiResponse.success(res, { message: `User status updated to ${status}`, data: user });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserIdParam;
    const result = await userService.resetPassword(id, { userId: req.user!.userId, ipAddress: req.ip });
    ApiResponse.success(res, {
      message: 'Password reset. Share the new temporary credentials securely — they will not be shown again.',
      data: result,
    });
  });
}

export const userController = new UserController();
