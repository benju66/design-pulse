import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Pure URL parser — extracted as a module-level function to avoid
 * ref-in-closure issues with React 19's refs-during-render lint.
 *
 * @param defaults - Default filter keys and fallback values.
 * @param namespace - Dot-prefix namespace for URL key isolation (e.g. 've', 'permit').
 */
function parseURLParams<T extends Record<string, string | string[] | boolean | number | undefined>>(
  defaults: T,
  namespace: string
): T {
  if (typeof window === 'undefined') return { ...defaults } as T;
  const searchParams = new URLSearchParams(window.location.search);
  const parsed = { ...defaults } as Record<string, string | string[] | boolean | number | undefined>;

  for (const key of Object.keys(defaults)) {
    const urlKey = `${namespace}.${key}`;
    const val = searchParams.get(urlKey);
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
 * Each caller provides a unique `namespace` string (e.g. 've', 'coord', 'permit')
 * that dot-prefixes all URL keys to prevent cross-view parameter collisions.
 * Example: namespace='permit', key='status' → URL param 'permit.status'.
 *
 * @param defaultValues - Type-safe default filter keys and fallback values.
 * @param namespace - Unique view namespace for URL key isolation.
 * @returns [state, setFilters] - Safe state object and setter callback.
 */
export function useURLFilters<T extends Record<string, string | string[] | boolean | number | undefined>>(
  defaultValues: T,
  namespace: string
): [T, (updater: T | ((prev: T) => T)) => void] {
  // Capture defaultValues and namespace once via ref — callers pass inline
  // object literals which create new references every render. The shape and
  // namespace never change for a given call site so refs are safe and avoid
  // useCallback instability.
  const defaultsRef = useRef(defaultValues);
  const namespaceRef = useRef(namespace);

  // Hydrate from URL on first mount only — reads defaultValues and namespace
  // directly (safe during initial render, not a ref read).
  const [state, setState] = useState<T>(() => parseURLParams(defaultValues, namespace));

  // Keep stateRef in sync for the popstate handler closure
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // Handle browser back/forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlState = parseURLParams(defaultsRef.current, namespaceRef.current);
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
    const ns = namespaceRef.current;

    const params = new URLSearchParams(window.location.search);

    for (const [key, val] of Object.entries(newState)) {
      const urlKey = `${ns}.${key}`;
      if (val === undefined || val === null || (Array.isArray(val) && val.length === 0)) {
        params.delete(urlKey);
      } else if (Array.isArray(val)) {
        // Safe URI escaping for each parameter in the CSV
        params.set(urlKey, val.map(encodeURIComponent).join(','));
      } else {
        params.set(urlKey, String(val));
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
