'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ──────────────────────────────────────────────────────────
   Variant + Intent + Size style maps
   ────────────────────────────────────────────────────────── */

const baseStyles =
  'inline-flex items-center justify-center font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';

/* ── Variant × Intent ─────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
type ButtonIntent = 'default' | 'coordination' | 'drawings' | 'amber';
type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

const variantIntentStyles: Record<ButtonVariant, Record<ButtonIntent, string> | string> = {
  primary: {
    default: 'bg-sky-500 hover:bg-sky-600 text-white',
    coordination: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    drawings: 'bg-teal-500 hover:bg-teal-600 text-white',
    amber: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white',
  },
  secondary:
    'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300',
  ghost: {
    default:
      'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-none',
    coordination:
      'hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-none',
    drawings:
      'hover:bg-teal-100 dark:hover:bg-teal-900/30 text-teal-600 dark:text-teal-400 shadow-none',
    amber:
      'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 shadow-none',
  },
  destructive: 'bg-rose-600 hover:bg-rose-700 text-white',
  outline:
    'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-none',
};

/* ── Size presets ─────────────────────────────────────── */

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 gap-1.5 text-xs rounded-xl',
  default: 'px-4 py-2 gap-2 text-sm rounded-xl',
  lg: 'px-5 py-2.5 gap-2 text-sm rounded-xl',
  icon: 'p-2 rounded-xl',
};

/* ──────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────── */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  intent?: ButtonIntent;
  size?: ButtonSize;
  /** Shows a Loader2 spinner and disables the button */
  isLoading?: boolean;
  /** Text to display while loading (replaces children) */
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      intent = 'default',
      size = 'default',
      isLoading = false,
      loadingText,
      disabled,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    // Resolve variant styles — some variants are intent-aware, others are flat strings
    const variantDef = variantIntentStyles[variant];
    const variantClasses =
      typeof variantDef === 'string' ? variantDef : variantDef[intent] ?? variantDef['default'];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantClasses, sizeStyles[size], className)}
        {...rest}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText ?? children}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
export { Button };
