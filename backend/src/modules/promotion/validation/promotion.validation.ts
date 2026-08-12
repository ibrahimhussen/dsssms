import { z } from 'zod';
import { EligibilityStatus, PromotionDecision } from '@prisma/client';
import { paginationQuerySchema } from '../../../core/http/pagination';

// ── Params ────────────────────────────────────────────────────────────────────

export const batchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const entryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  entryId: z.coerce.number().int().positive(),
});

// ── Create batch ─────────────────────────────────────────────────────────────

export const createBatchSchema = z.object({
  sourceClassroomId: z.coerce.number().int().positive(),
  targetAcademicYear: z
    .string()
    .trim()
    .min(1, 'Target academic year is required')
    .max(20),
});

// ── Update a single entry (Vice Director sets decision / target classroom) ────

export const updateEntrySchema = z.object({
  decision: z.nativeEnum(PromotionDecision).optional(),
  targetClassroomId: z.coerce.number().int().positive().optional().nullable(),
  overrideReason: z.string().trim().max(500).optional().nullable(),
});

// ── Bulk-assign a target classroom to all PROMOTED entries in a batch ─────────

export const bulkAssignClassroomSchema = z.object({
  targetClassroomId: z.coerce.number().int().positive(),
  onlyDecision: z.nativeEnum(PromotionDecision).optional(), // default: PROMOTED
});

// ── Submit for Director approval ──────────────────────────────────────────────

export const submitBatchSchema = z.object({
  // No body needed — submission is a state transition triggered by batch id.
});

// ── Director: approve or reject ───────────────────────────────────────────────

export const approveBatchSchema = z.object({
  // Approval has no body either; the batch id is sufficient.
});

export const rejectBatchSchema = z.object({
  rejectionReason: z.string().trim().min(1, 'A rejection reason is required').max(500),
});

// ── Correct / reverse a completed promotion ───────────────────────────────────

export const correctEntrySchema = z.object({
  targetClassroomId: z.coerce.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
});

// ── List batches ──────────────────────────────────────────────────────────────

export const listBatchesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED']).optional(),
  sourceClassroomId: z.coerce.number().int().positive().optional(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type BatchIdParam = z.infer<typeof batchIdParamSchema>;
export type EntryIdParam = z.infer<typeof entryIdParamSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type BulkAssignClassroomInput = z.infer<typeof bulkAssignClassroomSchema>;
export type RejectBatchInput = z.infer<typeof rejectBatchSchema>;
export type CorrectEntryInput = z.infer<typeof correctEntrySchema>;
export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;
