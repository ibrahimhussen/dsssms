import clsx from 'clsx';

/**
 * The app's signature structural motif — a thin ruled divider with a short
 * gold "margin rule" accent, echoing the ruled line in a school register or
 * exercise book. Reused under page titles and section headers throughout
 * the app as a recurring visual signature.
 */
export function LedgerRule({ className }: { className?: string }) {
  return (
    <div className={clsx('my-2.5 mb-5.5 flex items-center gap-2.5', className)} role="presentation">
      <span className="h-0.5 w-4.5 shrink-0 rounded-full bg-gold-500" />
      <span className="ledger-rule-line h-px flex-1" />
    </div>
  );
}
