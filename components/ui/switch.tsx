'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  id,
  disabled = false,
  className,
}: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-gradient-to-r from-violet-500 to-cyan-500'
          : 'bg-slate-800',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}
