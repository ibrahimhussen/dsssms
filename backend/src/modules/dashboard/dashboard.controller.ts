import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  getAdminDashboard = asyncHandler(async (_req: Request, res: Response) => {
    const data = await dashboardService.getAdminDashboard();
    ApiResponse.success(res, { message: 'Admin dashboard retrieved', data });
  });

  getDirectorDashboard = asyncHandler(async (_req: Request, res: Response) => {
    const data = await dashboardService.getDirectorDashboard();
    ApiResponse.success(res, { message: 'Director dashboard retrieved', data });
  });

  getViceDirectorDashboard = asyncHandler(async (_req: Request, res: Response) => {
    const data = await dashboardService.getViceDirectorDashboard();
    ApiResponse.success(res, { message: 'Vice director dashboard retrieved', data });
  });
}

export const dashboardController = new DashboardController();
