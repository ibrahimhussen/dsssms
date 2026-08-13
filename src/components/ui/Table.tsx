import type { ReactNode } from 'react';
import { MdErrorOutline } from 'react-icons/md';
import { ApiError } from '../../lib/api-error';

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  isLoading?: boolean;
  /** Pass the error from useQuery to display a proper error row instead of empty state */
  error?: unknown;
  onRetry?: () => void;
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  rows,
  getRowKey,
  isLoading,
  error,
  onRetry,
  emptyMessage = 'No records found.',
}: TableProps<T>) {
  function renderBody() {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
            <span
              className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700 align-middle"
              aria-hidden="true"
            />
            Loading…
          </td>
        </tr>
      );
    }

    if (error) {
      const isForbidden = error instanceof ApiError && error.isForbidden;
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
          ? error.message
          : 'Failed to load data';

      return (
        <tr>
          <td colSpan={columns.length} className="px-4 py-8 text-center">
            <div className="inline-flex flex-col items-center gap-2">
              <MdErrorOutline className="h-6 w-6 text-danger-400" />
              <span className="text-sm font-medium text-danger-600">
                {isForbidden ? 'Access denied' : 'Failed to load'}
              </span>
              <span className="max-w-xs text-xs text-slate-500">{message}</span>
              {onRetry && !isForbidden && (
                <button
                  onClick={onRetry}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-paper-100"
                >
                  Retry
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    }

    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
            {emptyMessage}
          </td>
        </tr>
      );
    }

    return rows.map((row) => (
      <tr key={getRowKey(row)} className="border-b border-paper-100 last:border-b-0 hover:bg-paper-50">
        {columns.map((col) => (
          <td key={col.header} className={`px-4 py-3 align-middle text-ink-900 ${col.className ?? ''}`}>
            {col.render(row)}
          </td>
        ))}
      </tr>
    ));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className="border-b border-slate-200 bg-paper-100 px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-700 uppercase"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{renderBody()}</tbody>
      </table>
    </div>
  );
}
