/**
 * Strips HTML tags from a string for plaintext contexts (Excel export, search, etc.)
 * Safely handles both Browser (DOMParser) and Server (Regex) environments in Next.js.
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  // Browser environment: Use robust DOMParser
  if (typeof window !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }

  // Server environment (SSR / API): Fallback to Regex
  return html.replace(/<[^>]*>?/gm, '');
}

/**
 * Checks if an HTML description string has meaningful content.
 * Handles both legacy plaintext AND TipTap HTML (where empty = "<p></p>").
 */
export function hasDescriptionContent(description: string | null | undefined): boolean {
  if (!description) return false;
  // Replace zero-width spaces/nbsp that TipTap sometimes leaves behind
  const cleanText = stripHtml(description).replace(/&nbsp;/g, ' ').trim();
  return cleanText.length > 0;
}
