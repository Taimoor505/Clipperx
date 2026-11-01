import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold font-mono tabular-nums transition-colors whitespace-nowrap shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-accent bg-accent-soft text-ink',
        gradient:
          'border-accent bg-accent text-on-accent',
        green:
          'border-success/40 bg-success/10 text-success',
        yellow:
          'border-accent bg-accent-soft text-ink',
        outline:
          'border-line bg-surface text-ink',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
