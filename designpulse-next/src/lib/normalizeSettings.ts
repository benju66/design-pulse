import type { CategoryConfig } from '@/types/models';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

/**
 * Normalizes the raw `categories` JSONB value from project_settings into
 * a strongly-typed CategoryConfig[]. Handles the legacy string[] format
 * stored by projects created before this feature was introduced.
 *
 * No SQL migration needed — runs at read time.
 * The next save from ProjectSettings will persist the new structured format.
 *
 * The /\s+/g regex used here is a positive-match pattern — NOT a negative
 * lookbehind — and is iOS/WebKit safe per AGENTS.md Rule A.
 */
export function normalizeCategories(raw: unknown): CategoryConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_CATEGORIES];
  return (raw as unknown[]).map((c): CategoryConfig => {
    if (typeof c === 'string') {
      // Legacy flat string format — migrate forward with safe defaults
      return {
        id: `legacy_${c.toLowerCase().replace(/\s+/g, '_')}`,
        label: c,
        no_coord_default: false,
      };
    }
    const cat = c as Partial<CategoryConfig>;
    return {
      id:               cat.id    ?? `legacy_${(cat.label ?? 'unknown').toLowerCase().replace(/\s+/g, '_')}`,
      label:            cat.label ?? 'Unknown',
      no_coord_default: cat.no_coord_default ?? false,
    };
  });
}
