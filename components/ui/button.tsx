import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:pointer-events-none disabled:opacity-50 cursor-pointer shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-sm hover:from-violet-500 hover:to-cyan-400',
        secondary:
          'bg-slate-900 text-slate-100 border border-slate-800 hover:bg-slate-800 hover:border-slate-700',
        outline:
          'border border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900 hover:text-white hover:border-slate-700',
        ghost: 'text-slate-400 hover:bg-slate-900 hover:text-slate-100',
        emerald:
          'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-md px-2.5 text-xs',
        lg: 'h-11 rounded-lg px-6 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
