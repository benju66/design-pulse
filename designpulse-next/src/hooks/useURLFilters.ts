import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Pure URL parser — extracted as a module-level function to avoid
 * ref-in-closure issues with React 19's refs-during-render lint.
 */
function parseURLParams<T extends Record<string, string | string[] | boolean | number | undefined>>(
  defaults: T
): T {
  if (typeof window === 'undefined') return { ...defaults } as T;
  const searchParams = new URLSearchParams(window.location.search);
  const parsed = { ...defaults } as Record<string, string | string[] | boolean | number | undefined>;

  for (const key of Object.keys(defaults)) {
    const val = searchParams.get(key);
    if (val === null) {
      continue;
    }

    const defaultValue = defaults[key];
    if (Array.isArray(defaultValue)) {
      // Multi-select CSV values safely URL-decoded
      parsed[key] = val ? val.split(',').map(decodeURIComponent) : [];
    } else if (typeof defaultValue === 'boolean') {
      parsed[key] = val === 'true';
    } else if (typeof defaultValue === 'number') {
      const num = Number(val);
      parsed[key] = isNaN(num) ? defaultValue : num;
    } else {
      parsed[key] = val;
    }
  }
  return parsed as T;
}

/**
 * Custom hook to synchronize React filter state with URL query search parameters.
 * Uses native window.history.replaceState for high-performance shallow routing,
 * bypassing Next.js server-component re-fetches and grid layout jumps.
 *
 * Architecture: React useState is the canonical source of truth.
 * URL is a one-way serialization target (for bookmarking/sharing).
 * Reads from window.location.search directly — never from useSearchParams()
 * which desynchronizes when paired with window.history.replaceState.
 *
 * @param defaultValues - Type-safe default filter keys and fallback values.
 * @returns [state, setFilters] - Safe state object and setter callback.
 */
export function useURLFilters<T extends Record<string, string | string[] | boolean | number | undefined>>(
  defaultValues: T
): [T, (updater: T | ((prev: T) => T)) => void] {
  // Capture defaultValues once via ref — callers pass inline object literals
  // which create new references every render. The shape never changes for a
  // given call site so a ref is safe and avoids useCallback instability.
  const defaultsRef = useRef(defaultValues);

  // Hydrate from URL on first mount only — reads defaultValues directly
  // (safe during initial render, not a ref read).
  const [state, setState] = useState<T>(() => parseURLParams(defaultValues));

  // Keep stateRef in sync for the popstate handler closure
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // Handle browser back/forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlState = parseURLParams(defaultsRef.current);
      if (JSON.stringify(stateRef.current) !== JSON.stringify(urlState)) {
        setState(urlState);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Serializer to write state safely into window.history.replaceState
  const setURLState = useCallback((newState: T) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    for (const [key, val] of Object.entries(newState)) {
      if (val === undefined || val === null || (Array.isArray(val) && val.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(val)) {
        // Safe URI escaping for each parameter in the CSV
        params.set(key, val.map(encodeURIComponent).join(','));
      } else {
        params.set(key, String(val));
      }
    }

    const newSearch = params.toString();
    const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '');

    // Native shallow routing prevents grid scroll jumps and dynamic layout remounts
    window.history.replaceState({ ...window.history.state, as: newPath, url: newPath }, '', newPath);
  }, []);

  const setFilters = useCallback((updater: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof updater === 'function'
        ? (updater as (prev: T) => T)(prev)
        : updater;

      setURLState(next);
      return next;
    });
  }, [setURLState]);

  return [state, setFilters];
}
