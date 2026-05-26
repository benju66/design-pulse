import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Custom hook to synchronize React filter state with URL query search parameters.
 * Uses native window.history.replaceState for high-performance shallow routing, 
 * bypassing Next.js server-component re-fetches and grid layout jumps.
 *
 * @param defaultValues - Type-safe default filter keys and fallback values.
 * @returns [state, setFilters] - Safe state object and setter callback.
 */
export function useURLFilters<T extends Record<string, string | string[] | boolean | number | undefined>>(
  defaultValues: T
): [T, (updater: T | ((prev: T) => T)) => void] {
  const searchParams = useSearchParams();

  // Helper to deserialize URL param values safely
  const parseParams = useCallback((): T => {
    const parsed = { ...defaultValues } as Record<string, string | string[] | boolean | number | undefined>;
    
    for (const key of Object.keys(defaultValues)) {
      const val = searchParams.get(key);
      if (val === null) {
        continue;
      }
      
      const defaultValue = defaultValues[key];
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
  }, [searchParams, defaultValues]);

  const [state, setState] = useState<T>(parseParams);

  // Sync state with URL if URL changes externally (e.g. forward/back buttons or layout reset)
  // Derived state pattern with inline rendering state updates avoids layout re-renders or useEffect cascades
  const currentParams = parseParams();
  if (JSON.stringify(state) !== JSON.stringify(currentParams)) {
    setState(currentParams);
  }

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
