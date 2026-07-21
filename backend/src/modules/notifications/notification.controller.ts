import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { notificationService } from './notification.service';
import {
  CreateNotificationInput,
  SendToParentsInput,
  ListNotificationsQuery,
  ListAllNotificationsQuery,
  NotificationIdParam,
  StudentIdParam,
} from './validation/notification.validation';

export class NotificationController {
  send = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateNotificationInput;
    const notification = await notificationService.send(input);
    ApiResponse.success(res, { statusCode: 201, message: 'Notification sent', data: notification });
  });

  sendToParents = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { studentId } = req.params as unknown as StudentIdParam;
    const input = req.body as SendToParentsInput;
    const result = await notificationService.sendToParents(req.user, studentId, input);
    ApiResponse.success(res, { statusCode: 201, message: `Notification sent to ${result.notificationsSent} parent(s)`, data: result });
  });

  getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as ListNotificationsQuery;
    const { items, meta, unreadCount } = await notificationService.getMyNotifications(req.user.userId, query);
    ApiResponse.success(res, { message: 'Notifications retrieved', data: { items, unreadCount }, pagination: meta });
  });

  markAsRead = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as NotificationIdParam;
    const notification = await notificationService.markAsRead(req.user.userId, id);
    ApiResponse.success(res, { message: 'Notification marked as read', data: notification });
  });

  markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const result = await notificationService.markAllAsRead(req.user.userId);
    ApiResponse.success(res, { message: `${result.updatedCount} notification(s) marked as read`, data: result });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as NotificationIdParam;
    await notificationService.delete(req.user.userId, id);
    ApiResponse.success(res, { message: 'Notification deleted', data: null });
  });

  listAll = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListAllNotificationsQuery;
    const { items, meta } = await notificationService.listAll(query);
    ApiResponse.success(res, { message: 'All notifications retrieved', data: items, pagination: meta });
  });
}

export const notificationController = new NotificationController();
