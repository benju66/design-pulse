/**
 * Shared formatting utilities for the DataTable component system.
 * Eliminates 5+ inline `new Intl.NumberFormat(...)` instances and duplicated date formatting.
 */

/** Currency formatting — used in ImpactCell, summaries, everywhere */
export function formatCurrency(
  value: number,
  options?: { maximumFractionDigits?: number }
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(value);
}

/** Date display — used in DateCell, detail panels */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Date to input value — for <input type="date"> */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  return new Date(value).toISOString().split('T')[0];
}

/** Number formatting (no currency symbol) */
export function formatNumber(
  value: number,
  options?: { maximumFractionDigits?: number }
): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(value);
}
