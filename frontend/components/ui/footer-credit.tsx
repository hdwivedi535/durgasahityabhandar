import { cn } from '@/lib/utils';

interface FooterCreditProps {
  className?: string;
}

export function FooterCredit({ className }: FooterCreditProps) {
  return (
    <p className={cn('text-sm text-muted', className)}>
      Designed and Developed by Himanshu Dwivedi
    </p>
  );
}
