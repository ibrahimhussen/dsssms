import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function getPaginationParams(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

export function buildPaginationMeta(params: { page: number; limit: number; totalItems: number }) {
  return {
    page: params.page,
    limit: params.limit,
    totalItems: params.totalItems,
    totalPages: Math.max(1, Math.ceil(params.totalItems / params.limit)),
  };
}
