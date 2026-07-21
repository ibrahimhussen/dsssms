import clsx from 'clsx';

/**
 * A thin ruled divider with a short "margin rule" accent — the same visual
 * language as the ruled line in a school register/exercise book. Used
 * consistently under page titles and section headers as the app's
 * recurring signature element.
 */
export function LedgerRule({ className }: { className?: string }) {
  return (
    <div className={clsx('ledger-rule', className)} role="presentation">
      <span className="ledger-rule-margin" />
      <span className="ledger-rule-line" />
    </div>
  );
}
