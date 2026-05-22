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

/** Date display — used in DateCell, detail panels. Formats as timezone-independent 'MM/DD/YYYY' */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';

  if (value instanceof Date) {
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    const yyyy = value.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  const str = String(value).trim();
  if (!str) return '';

  // 1. Check YYYY-MM-DD (standard PostgREST/Supabase DATE format)
  const matchYmd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchYmd) {
    return `${matchYmd[2]}/${matchYmd[3]}/${matchYmd[1]}`;
  }

  // 2. Check YYYY-MM-DDThh:mm:ss... (ISO datetime substring)
  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ]/);
  if (matchIso) {
    return `${matchIso[2]}/${matchIso[3]}/${matchIso[1]}`;
  }

  // 3. Check YYYY/MM/DD
  const matchYmdSlash = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (matchYmdSlash) {
    return `${matchYmdSlash[2]}/${matchYmdSlash[3]}/${matchYmdSlash[1]}`;
  }

  // 4. Check MM/DD/YYYY or M/D/YYYY
  const matchMdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchMdy) {
    const mm = matchMdy[1].padStart(2, '0');
    const dd = matchMdy[2].padStart(2, '0');
    const yyyy = matchMdy[3];
    return `${mm}/${dd}/${yyyy}`;
  }

  // 5. Check MM/DD/YY or M/D/YY (2-digit year)
  const matchMdy2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (matchMdy2) {
    const mm = matchMdy2[1].padStart(2, '0');
    const dd = matchMdy2[2].padStart(2, '0');
    const yyyy = `20${matchMdy2[3]}`;
    return `${mm}/${dd}/${yyyy}`;
  }

  // Fallback wrapping native Date construction safely in try/catch
  try {
    const date = new Date(str);
    if (isNaN(date.getTime())) return '';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  } catch {
    return '';
  }
}

/** Date to input value — for <input type="date"> (returns 'YYYY-MM-DD') */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';

  if (value instanceof Date) {
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    const yyyy = value.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  const str = String(value).trim();
  if (!str) return '';

  // 1. Check YYYY-MM-DD
  const matchYmd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchYmd) {
    return matchYmd[0];
  }

  // 2. Check YYYY-MM-DDThh:mm:ss... (ISO datetime substring)
  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ]/);
  if (matchIso) {
    return matchIso[0].substring(0, 10);
  }

  // 3. Check YYYY/MM/DD
  const matchYmdSlash = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (matchYmdSlash) {
    return `${matchYmdSlash[1]}-${matchYmdSlash[2]}-${matchYmdSlash[3]}`;
  }

  // 4. Check MM/DD/YYYY or M/D/YYYY
  const matchMdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchMdy) {
    const mm = matchMdy[1].padStart(2, '0');
    const dd = matchMdy[2].padStart(2, '0');
    const yyyy = matchMdy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // 5. Check MM/DD/YY or M/D/YY (2-digit year)
  const matchMdy2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (matchMdy2) {
    const mm = matchMdy2[1].padStart(2, '0');
    const dd = matchMdy2[2].padStart(2, '0');
    const yyyy = `20${matchMdy2[3]}`;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback wrapping native Date construction safely in try/catch
  try {
    const date = new Date(str);
    if (isNaN(date.getTime())) return '';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
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
