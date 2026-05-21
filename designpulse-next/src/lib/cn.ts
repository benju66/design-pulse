import { type ClassValue, clsx } from 'clsx';

/**
 * Utility for conditionally joining class names.
 * Wraps `clsx` for consistent usage across the app.
 *
 * @example
 *   cn('base-class', isActive && 'active', className)
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
