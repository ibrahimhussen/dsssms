import { Response } from 'express';

interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
  pagination?: Pagination;
}

interface ErrorBody {
  success: false;
  message: string;
  errorCode: string;
  details?: unknown;
}

/**
 * Every response leaving this API — success or failure — follows the same
 * envelope shape so frontend clients never have to branch on endpoint-specific
 * response formats.
 */
export class ApiResponse {
  static success<T>(
    res: Response,
    params: { statusCode?: number; message: string; data: T; pagination?: Pagination }
  ): Response {
    const body: SuccessBody<T> = {
      success: true,
      message: params.message,
      data: params.data,
      ...(params.pagination ? { pagination: params.pagination } : {}),
    };
    return res.status(params.statusCode ?? 200).json(body);
  }

  static error(
    res: Response,
    params: { statusCode: number; message: string; errorCode: string; details?: unknown }
  ): Response {
    const body: ErrorBody = {
      success: false,
      message: params.message,
      errorCode: params.errorCode,
      ...(params.details !== undefined ? { details: params.details } : {}),
    };
    return res.status(params.statusCode).json(body);
  }
}
