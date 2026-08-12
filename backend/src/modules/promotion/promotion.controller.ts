import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { promotionService } from './promotion.service';
import {
  BatchIdParam,
  EntryIdParam,
  CreateBatchInput,
  UpdateEntryInput,
  BulkAssignClassroomInput,
  RejectBatchInput,
  CorrectEntryInput,
  ListBatchesQuery,
} from './validation/promotion.validation';
import { UnauthorizedError } from '../../core/errors/app-error';

export class PromotionController {
  createBatch = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const input = req.body as CreateBatchInput;
    const result = await promotionService.createBatch(req.user, input, req.ip);
    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Promotion batch created',
      data: result,
    });
  });

  listBatches = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListBatchesQuery;
    const { items, meta } = await promotionService.listBatches(query);
    ApiResponse.success(res, { message: 'Promotion batches retrieved', data: items, pagination: meta });
  });

  getBatch = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as BatchIdParam;
    const batch = await promotionService.getBatchById(id);
    ApiResponse.success(res, { message: 'Promotion batch retrieved', data: batch });
  });

  updateEntry = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id, entryId } = req.params as unknown as EntryIdParam;
    const input = req.body as UpdateEntryInput;
    const batch = await promotionService.updateEntry(req.user, id, entryId, input);
    ApiResponse.success(res, { message: 'Promotion entry updated', data: batch });
  });

  bulkAssignClassroom = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as BatchIdParam;
    const input = req.body as BulkAssignClassroomInput;
    const batch = await promotionService.bulkAssignClassroom(req.user, id, input);
    ApiResponse.success(res, { message: 'Classrooms assigned to batch entries', data: batch });
  });

  submitBatch = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as BatchIdParam;
    const batch = await promotionService.submitBatch(req.user, id, req.ip);
    ApiResponse.success(res, { message: 'Promotion batch submitted for approval', data: batch });
  });

  approveBatch = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as BatchIdParam;
    const batch = await promotionService.approveBatch(req.user, id, req.ip);
    ApiResponse.success(res, { message: 'Promotion batch approved and executed', data: batch });
  });

  rejectBatch = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id } = req.params as unknown as BatchIdParam;
    const input = req.body as RejectBatchInput;
    const batch = await promotionService.rejectBatch(req.user, id, input, req.ip);
    ApiResponse.success(res, { message: 'Promotion batch rejected', data: batch });
  });

  correctEntry = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { id, entryId } = req.params as unknown as EntryIdParam;
    const input = req.body as CorrectEntryInput;
    const batch = await promotionService.correctEntry(req.user, id, entryId, input, req.ip);
    ApiResponse.success(res, { message: 'Promotion entry corrected', data: batch });
  });

  getStudentEnrollmentHistory = asyncHandler(async (req: Request, res: Response) => {
    const studentId = Number(req.params.studentId);
    const history = await promotionService.getStudentEnrollmentHistory(studentId);
    ApiResponse.success(res, { message: 'Enrollment history retrieved', data: history });
  });
}

export const promotionController = new PromotionController();
