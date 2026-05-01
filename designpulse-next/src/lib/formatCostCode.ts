/**
 * Formats a 6-digit normalized cost code for DISPLAY ONLY.
 *
 * "090000" → "09-0000"
 * "093016" → "09-3016"
 *
 * IMPORTANT: The raw value attribute on <option> must ALWAYS remain the original
 * code string. This function must NEVER be called before submitting data to the
 * database — it is a pure presentation-layer transform.
 *
 * iOS Safety (AGENTS.md Rule A): No regex lookbehinds. Uses only string
 * indexing and Array.prototype.every() for digit validation — zero regex.
 */
export function formatCostCode(code: string): string {
  if (
    code.length === 6 &&
    code.split('').every(ch => ch >= '0' && ch <= '9')
  ) {
    return `${code.slice(0, 2)}-${code.slice(2)}`;
  }
  // Passthrough for non-standard or non-numeric codes (e.g. legacy alpha codes)
  return code;
}
