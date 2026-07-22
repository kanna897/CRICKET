"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme?: Theme;
  resolvedTheme?: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  attribute?: "class";
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

const THEME_KEY = "theme";
const THEME_EVENT = "crickpulse-theme-change";
const ThemeContext = createContext<ThemeContextValue>({ setTheme: () => undefined });

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getThemeSnapshot() {
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  const theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  return theme === "system" ? `system:${systemTheme()}` : theme;
}

function subscribeToTheme(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const notify = () => onStoreChange();
  window.addEventListener("storage", notify);
  window.addEventListener(THEME_EVENT, notify);
  media.addEventListener("change", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(THEME_EVENT, notify);
    media.removeEventListener("change", notify);
  };
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const snapshot = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "");
  const theme: Theme | undefined = snapshot
    ? snapshot.startsWith("system:") ? "system" : snapshot as Theme
    : undefined;
  const resolvedTheme: ResolvedTheme | undefined = snapshot
    ? snapshot.startsWith("system:") ? snapshot.slice(7) as ResolvedTheme : snapshot as ResolvedTheme
    : undefined;

  useEffect(() => {
    if (resolvedTheme) applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme === "system" ? systemTheme() : nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
