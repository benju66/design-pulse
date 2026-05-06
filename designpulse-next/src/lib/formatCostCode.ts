/**
 * Formats a normalized CSI cost code for DISPLAY ONLY.
 *
 * "090000" → "09-0000"
 * "093016" → "09-3016"
 *
 * Defensive padding: all-numeric codes shorter than 6 digits are left-padded
 * with zeros before formatting. This handles codes that were stored without
 * their leading zero (e.g. Excel stripping "011000" → "11000").
 *
 *   "11000"  → padded → "011000" → "01-1000"
 *   "9000"   → padded → "009000" → "00-9000"  (unusual but safe)
 *
 * IMPORTANT: The raw value attribute on <option> must ALWAYS remain the
 * original database code string. This function must NEVER be called before
 * submitting data to the database — it is a pure presentation-layer transform.
 *
 * iOS Safety (AGENTS.md Rule A): No regex lookbehinds. Uses only string
 * indexing and Array.prototype.every() for digit validation — zero regex.
 */
export function formatCostCode(code: string): string {
  // Check if the code is all-numeric using a character loop (iOS-safe, no regex)
  const allDigits = code.length > 0 && code.split('').every(ch => ch >= '0' && ch <= '9');

  if (allDigits) {
    // Pad to 6 digits if short (defensive fix for codes stored without leading zero)
    const padded = code.length < 6 ? code.padStart(6, '0') : code;
    if (padded.length === 6) {
      return `${padded.slice(0, 2)}-${padded.slice(2)}`;
    }
  }

  // Passthrough for non-standard or non-numeric codes (e.g. legacy alpha codes,
  // codes already containing a dash, or codes longer than 6 digits)
  return code;
}
