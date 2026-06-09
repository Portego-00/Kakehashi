import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ColorSchemeName, useColorScheme } from "react-native";

// Define light and dark color themes
export const lightTheme = {
  backgroundColor: "#f6f6f6",
  cardBackground: "#ffffff",
  textColor: "#333333",
  textSecondary: "#666666",
  textLight: "#999999",
  primary: "#3A86FF",
  secondary: "#fa1f62",
  accent: "#ff9e00",
  border: "#eeeeee",
  error: "#e53935",
  statusBarStyle: "dark" as "dark" | "light" | "auto",
  headerBackground: "#3A86FF",
  headerSurface: "rgba(0, 0, 0, 0.18)",
  headerText: "#ffffff",
  isDark: false,
};

export const darkTheme = {
  backgroundColor: "#121212",
  cardBackground: "#1e1e1e",
  textColor: "#f5f5f5",
  textSecondary: "#b0b0b0",
  textLight: "#808080",
  primary: "#3A86FF",
  secondary: "#fa1f62",
  accent: "#ff9e00",
  border: "#333333",
  error: "#e57373",
  statusBarStyle: "light" as "dark" | "light" | "auto",
  headerBackground: "#1e1e1e",
  headerSurface: "rgba(255, 255, 255, 0.10)",
  headerText: "#ffffff",
  isDark: true,
};

export const midnightTheme = {
  backgroundColor: "#000000",
  cardBackground: "#0A0A0A",
  textColor: "#F6F6F6",
  textSecondary: "#B8B8B8",
  textLight: "#7A7A7A",
  primary: "#3A86FF",
  secondary: "#FA1F62",
  accent: "#FF9E00",
  border: "#1E1E1E",
  error: "#F28B82",
  statusBarStyle: "light" as "dark" | "light" | "auto",
  headerBackground: "#000000",
  headerSurface: "rgba(255, 255, 255, 0.08)",
  headerText: "#FFFFFF",
  isDark: true,
};

export const sepiaTheme = {
  backgroundColor: "#F4EDE2",
  cardBackground: "#FBF6ED",
  textColor: "#3B2F22",
  textSecondary: "#6C5A45",
  textLight: "#9B896F",
  primary: "#8B5E3C",
  secondary: "#C26A3D",
  accent: "#B08968",
  border: "#E4D8C8",
  error: "#C94F3D",
  statusBarStyle: "dark" as "dark" | "light" | "auto",
  headerBackground: "#8B5E3C",
  headerSurface: "rgba(0, 0, 0, 0.20)",
  headerText: "#FFFFFF",
  isDark: false,
};

// Theme mode type
export type ThemeMode = "light" | "dark" | "system" | "midnight" | "sepia";

// Theme context
type ThemeContextType = {
  theme: typeof lightTheme;
  isDark: boolean;
  colorScheme: ColorSchemeName;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false, // Default fallback
  colorScheme: "light",
  themeMode: "system",
  toggleTheme: () => {},
  setThemeMode: () => {},
});

// Hook to use the theme
export const useTheme = () => useContext(ThemeContext);

// Storage keys
const THEME_STORAGE_KEY = "wanikani_theme_mode";

// Theme provider component
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [currentTheme, setCurrentTheme] = useState(lightTheme);
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const savedThemeMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);

        if (savedThemeMode === "dark") {
          setThemeModeState("dark");
          setCurrentTheme(darkTheme);
        } else if (savedThemeMode === "midnight") {
          setThemeModeState("midnight");
          setCurrentTheme(midnightTheme);
        } else if (savedThemeMode === "sepia") {
          setThemeModeState("sepia");
          setCurrentTheme(sepiaTheme);
        } else if (savedThemeMode === "light") {
          setThemeModeState("light");
          setCurrentTheme(lightTheme);
        } else if (savedThemeMode === "system") {
          setThemeModeState("system");
          // Follow system preference
          if (systemColorScheme === "dark") {
            setCurrentTheme(darkTheme);
          } else {
            setCurrentTheme(lightTheme);
          }
        } else {
          // If no preference is saved, default to system
          setThemeModeState("system");
          if (systemColorScheme === "dark") {
            setCurrentTheme(darkTheme);
          } else {
            setCurrentTheme(lightTheme);
          }
        }
      } catch (error) {
        console.warn("Failed to load theme preferences", error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadSavedTheme();
  }, []); // Run only on mount

  // Listen for system color scheme changes when in "system" mode
  useEffect(() => {
    if (themeMode === "system" && isLoaded) {
      if (systemColorScheme === "dark") {
        setCurrentTheme(darkTheme);
      } else {
        setCurrentTheme(lightTheme);
      }
    }
  }, [systemColorScheme, themeMode, isLoaded]);

  // Handler for setting theme mode
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);

    // Save to storage
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.warn("Failed to save theme preference", error);
    }

    // Apply the theme
    if (mode === "dark") {
      setCurrentTheme(darkTheme);
    } else if (mode === "midnight") {
      setCurrentTheme(midnightTheme);
    } else if (mode === "sepia") {
      setCurrentTheme(sepiaTheme);
    } else if (mode === "light") {
      setCurrentTheme(lightTheme);
    }
    // For "system" mode, the useEffect above will handle it
  }, []);

  // Handler for toggling the theme manually.
  const toggleTheme = useCallback(async () => {
    let newMode: ThemeMode;
    if (themeMode === "light") {
      newMode = "dark";
    } else if (themeMode === "dark") {
      newMode = "midnight";
    } else if (themeMode === "midnight") {
      newMode = "sepia";
    } else if (themeMode === "sepia") {
      newMode = "system";
    } else {
      newMode = "light";
    }
    await setThemeMode(newMode);
  }, [themeMode, setThemeMode]);

  if (!isLoaded) {
    return null; // Or a loading spinner, but null avoids flash of wrong theme
  }

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        isDark: currentTheme.isDark,
        colorScheme: currentTheme.isDark ? "dark" : "light",
        themeMode,
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
