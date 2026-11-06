import { createContext } from "react";

export type ThemeMode = "system" | "light" | "dark" | "midnight" | "sepia";
type ThemeContextValue = { theme: ThemeMode; resolvedTheme: Exclude<ThemeMode, "system">; setTheme: (theme: ThemeMode) => void };

export const ThemeContext = createContext<ThemeContextValue | null>(null);
