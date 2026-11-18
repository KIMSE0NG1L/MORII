"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "./maps";

const KEY = "archi-home-theme";
const listeners = new Set<() => void>();

function readTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    return isThemeId(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function subscribeTheme(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** The home map theme chosen on this device. */
export function useHomeTheme(): [ThemeId, (id: ThemeId) => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => DEFAULT_THEME);
  const set = useCallback((id: ThemeId) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // ignore: the choice just won't persist
    }
    listeners.forEach((l) => l());
  }, []);
  return [theme, set];
}

const WIDE_QUERY = "(min-aspect-ratio: 1/1)";

function subscribeWide(cb: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** true = landscape screen (PC), false = portrait (mobile), null = not known yet (server). */
export function useWideScreen(): boolean | null {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => null,
  );
}
