import clsx from 'clsx';
import type { ReactNode } from 'react';

interface BadgeProps {
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  children: ReactNode;
}

const TONE_CLASSES: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-paper-100 text-ink-700',
  positive: 'bg-pine-100 text-pine-800',
  warning: 'bg-gold-100 text-gold-600',
  danger: 'bg-danger-100 text-danger-600',
};

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE_CLASSES[tone])}>
      {children}
    </span>
  );
}
