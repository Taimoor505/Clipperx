import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 cursor-pointer shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-accent text-on-accent shadow-sm ',
        secondary:
          'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line',
        outline:
          'border border-line bg-canvas text-ink hover:bg-surface hover:text-ink hover:border-line',
        ghost: 'text-ink-muted hover:bg-surface hover:text-ink',
        emerald:
          'bg-success/10 text-success border border-success/40 hover:bg-success/10',
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
