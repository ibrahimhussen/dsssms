import { Button } from './Button';
import type { PaginationMeta } from '../../types/api';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  if (meta.totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-4">
      <Button variant="ghost" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1}>
        Previous
      </Button>
      <span className="text-[0.8125rem] text-slate-500">
        Page {meta.page} of {meta.totalPages} · {meta.totalItems} total
      </span>
      <Button variant="ghost" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
        Next
      </Button>
    </div>
  );
}
