"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

export type ThemeMode = "system" | "light" | "dark" | "midnight" | "sepia";
type ThemeContextValue = { theme: ThemeMode; resolvedTheme: Exclude<ThemeMode, "system">; setTheme: (theme: ThemeMode) => void };

const STORAGE_KEY = "kakehashi-web-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemTheme(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSystemTheme() { return window.matchMedia(DARK_QUERY).matches; }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const systemIsDark = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => false);
  const resolvedTheme: Exclude<ThemeMode, "system"> = theme === "system" ? (systemIsDark ? "dark" : "light") : theme;

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const next = saved && ["system", "light", "dark", "midnight", "sepia"].includes(saved) ? saved : "system";
    const timer = window.setTimeout(() => setThemeState(next), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemeMode) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
