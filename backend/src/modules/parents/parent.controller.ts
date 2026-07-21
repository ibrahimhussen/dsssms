import { Request, Response } from 'express';
import { asyncHandler } from '../../core/http/async-handler';
import { ApiResponse } from '../../core/http/api-response';
import { parentService } from './parent.service';
import { CreateParentInput, ListParentsQuery, ParentIdParam } from './validation/parent.validation';
import { UnauthorizedError } from '../../core/errors/app-error';

export class ParentController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateParentInput;
    const result = await parentService.createParent(input);
    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Parent account created. Share the temporary credentials securely — they will not be shown again.',
      data: result,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ListParentsQuery;
    const { items, meta } = await parentService.listParents(query);
    ApiResponse.success(res, { message: 'Parents retrieved', data: items, pagination: meta });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as ParentIdParam;
    const parent = await parentService.getParentById(id);
    ApiResponse.success(res, { message: 'Parent retrieved', data: parent });
  });

  /** A parent viewing their own profile + linked children (self-service). */
  getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const parent = await parentService.getParentByUserId(req.user.userId);
    ApiResponse.success(res, { message: 'Your profile', data: parent });
  });
}

export const parentController = new ParentController();
