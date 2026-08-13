'use client';

import { cn } from '@/lib/utils';

interface FooterCreditProps {
  className?: string;
}

function formatLastUpdated(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

export function FooterCredit({ className }: FooterCreditProps) {
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString();
  const lastUpdated = formatLastUpdated(buildTime);

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p>Designed and Developed by Himanshu Dwivedi</p>
      <p className="sm:text-right">Last updated on {lastUpdated}</p>
    </div>
  );
}
