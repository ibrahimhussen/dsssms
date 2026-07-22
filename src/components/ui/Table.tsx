import type { ReactNode } from 'react';

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
  emptyMessage?: string;
}

export function Table<T>({ columns, rows, getRowKey, isLoading, emptyMessage = 'No records found.' }: TableProps<T>) {
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
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                <span
                  className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-900/15 border-t-pine-700 align-middle"
                  aria-hidden="true"
                />
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-b border-paper-100 last:border-b-0 hover:bg-paper-50">
                {columns.map((col) => (
                  <td key={col.header} className={`px-4 py-3 align-middle text-ink-900 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
