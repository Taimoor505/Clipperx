import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold font-mono tabular-nums transition-colors whitespace-nowrap shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-violet-500/30 bg-violet-500/15 text-violet-200',
        gradient:
          'border-violet-400/30 bg-gradient-to-r from-violet-600/30 to-cyan-500/30 text-cyan-200',
        green:
          'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
        yellow:
          'border-amber-500/40 bg-amber-500/15 text-amber-300',
        outline:
          'border-slate-700 bg-slate-900/80 text-slate-300',
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
