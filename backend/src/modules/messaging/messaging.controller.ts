import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { UnauthorizedError } from '../../core/errors/app-error';
import { messagingService } from './messaging.service';
import {
  SendMessageInput,
  ReplyMessageInput,
  MessageIdParam,
  ListThreadsQuery,
  ThreadQuery,
} from './validation/messaging.validation';

export class MessagingController {
  /** GET /messaging/eligible-teachers?studentId= — parent only */
  getEligibleTeachers = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const studentId = Number(req.query.studentId);
    const data = await messagingService.getEligibleTeachers(req.user, studentId);
    ApiResponse.success(res, { message: 'Eligible teachers', data });
  });

  /** POST /messaging — parent sends a new message */
  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const input = req.body as SendMessageInput;
    const data = await messagingService.sendMessage(req.user, input);
    ApiResponse.success(res, { statusCode: 201, message: 'Message sent', data });
  });

  /** POST /messaging/:id/reply — teacher or parent replies */
  replyToMessage = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as MessageIdParam;
    const input = req.body as ReplyMessageInput;
    const data = await messagingService.replyToMessage(req.user, id, input);
    ApiResponse.success(res, { statusCode: 201, message: 'Reply sent', data });
  });

  /** GET /messaging — list threads */
  listThreads = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as ListThreadsQuery;
    const { items, meta } = await messagingService.listThreads(req.user, query);
    ApiResponse.success(res, { message: 'Threads retrieved', data: items, pagination: meta });
  });

  /** GET /messaging/thread?studentId=&otherUserId= — get full conversation */
  getThread = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as ThreadQuery;
    const data = await messagingService.getThread(req.user, query);
    ApiResponse.success(res, { message: 'Thread retrieved', data });
  });

  /** GET /messaging/unread-count */
  getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const count = await messagingService.getUnreadCount(req.user);
    ApiResponse.success(res, { message: 'Unread count', data: { count } });
  });
}

export const messagingController = new MessagingController();
