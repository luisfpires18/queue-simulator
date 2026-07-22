"use client";

import { useEffect, useRef, useState } from "react";

/** Persists a piece of client state to localStorage under `key`.
 *
 * Always initializes to `defaultValue` (never reads localStorage in the
 * initializer) - the server render has no localStorage, so reading it
 * synchronously would make the client's first render diverge from the
 * server-rendered HTML and cause a hydration mismatch (same reasoning as
 * CountdownLight deferring Date.now() to an effect). The stored value, if
 * any, is applied in a mount-only effect instead.
 *
 * `key` should be version-suffixed (e.g. "mplus-filters-lo-v1") - there's no
 * migration logic, a shape change just bumps the suffix and orphans the old
 * entry rather than trying to upgrade it in place. */
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  opts?: { toJSON?: (value: T) => unknown; fromJSON?: (raw: unknown) => T | null }
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(defaultValue);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return;
      const parsed = JSON.parse(raw);
      const value = opts?.fromJSON ? opts.fromJSON(parsed) : (parsed as T);
      if (value != null) setState(value);
    } catch {
      // corrupt/stale storage - fall back to defaultValue
    } finally {
      loaded.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded.current) return; // don't clobber storage with defaultValue before the load effect runs
    try {
      window.localStorage.setItem(key, JSON.stringify(opts?.toJSON ? opts.toJSON(state) : state));
    } catch {
      // e.g. Safari private mode - degrade to non-persistent silently
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function clear() {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    setState(defaultValue);
  }

  return [state, setState, clear];
}
