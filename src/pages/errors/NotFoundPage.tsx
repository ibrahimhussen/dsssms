import { Link } from 'react-router-dom';
import { LedgerRule } from '../../components/ui/LedgerRule';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-[720px] flex-col justify-center px-8">
      <h1 className="text-2xl">Page not found</h1>
      <LedgerRule />
      <p className="text-[0.9375rem] text-ink-700">The page you're looking for doesn't exist or may have moved.</p>
      <Link
        to="/"
        className="mt-3 inline-flex w-fit items-center justify-center rounded-lg border border-pine-900 px-4.5 py-2.5 text-[0.9375rem] font-semibold text-pine-900 hover:bg-pine-100"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
