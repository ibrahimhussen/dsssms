import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { systemSettingService } from './system-setting.service';
import { UpdateSystemSettingInput } from './validation/system-setting.validation';

export class SystemSettingController {
  get = asyncHandler(async (_req: Request, res: Response) => {
    const data = await systemSettingService.get();
    ApiResponse.success(res, { message: 'System settings retrieved', data });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as UpdateSystemSettingInput;
    const data = await systemSettingService.update(input, { userId: req.user!.userId, ipAddress: req.ip });
    ApiResponse.success(res, { message: 'System settings updated', data });
  });
}

export const systemSettingController = new SystemSettingController();
