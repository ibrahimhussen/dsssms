import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { BadRequestError } from '../../core/errors/app-error';
import { backupService } from './backup.service';

export class BackupController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const data = await backupService.list();
    ApiResponse.success(res, { message: 'Backups retrieved', data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const data = await backupService.create({ userId: req.user!.userId, ipAddress: req.ip });
    ApiResponse.success(res, { statusCode: 201, message: 'Backup created', data });
  });

  upload = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new BadRequestError('No file uploaded (expected field name "file")');
    const data = await backupService.saveUploaded(req.file.buffer, { userId: req.user!.userId, ipAddress: req.ip });
    ApiResponse.success(res, { statusCode: 201, message: 'Backup uploaded', data });
  });

  download = asyncHandler(async (req: Request, res: Response) => {
    const { fileName } = req.params as { fileName: string };
    const filePath = await backupService.resolvePath(fileName);
    res.download(filePath, fileName);
  });

  restore = asyncHandler(async (req: Request, res: Response) => {
    const { fileName } = req.params as { fileName: string };
    const result = await backupService.restore(fileName, { userId: req.user!.userId, ipAddress: req.ip });
    ApiResponse.success(res, { message: 'Backup restored', data: result });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { fileName } = req.params as { fileName: string };
    await backupService.delete(fileName, { userId: req.user!.userId, ipAddress: req.ip });
    ApiResponse.success(res, { message: 'Backup deleted', data: null });
  });
}

export const backupController = new BackupController();
