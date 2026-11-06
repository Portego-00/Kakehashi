import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { DefaultTheme, ThemeProvider as NavigationThemeProvider } from "expo-router";
import { useTheme as useNavigationTheme } from "expo-router/react-navigation";
import React from "react";
import { Appearance, Pressable, Text, useColorScheme } from "react-native";
import { ThemeProvider, useTheme, type ThemeMode } from "../theme";

function NavigationThemeProbe() {
  const navigationTheme = useNavigationTheme();
  const { theme, setThemeMode } = useTheme();
  return <>
    <Text testID="navigation-theme">{JSON.stringify(navigationTheme)}</Text>
    <Text testID="app-theme">{JSON.stringify(theme)}</Text>
    {(["light", "dark", "midnight", "sepia", "system"] as const).map((mode) =>
      <Pressable key={mode} accessibilityLabel={mode} onPress={() => setThemeMode(mode)}>
        <Text>{mode}</Text>
      </Pressable>,
    )}
  </>;
}

function renderTheme() {
  // ExpoRoot supplies this light fallback until the app overrides it.
  return render(<NavigationThemeProvider value={DefaultTheme}>
    <ThemeProvider><NavigationThemeProbe /></ThemeProvider>
  </NavigationThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue();
  jest.mocked(useColorScheme).mockReturnValue("light");
  jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it.each<ThemeMode>(["light", "dark", "midnight", "sepia", "system"])(
  "uses the saved %s palette beneath the navigation stack",
  async (mode) => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(mode);
    jest.mocked(useColorScheme).mockReturnValue("dark");
    const screen = renderTheme();
    await waitFor(() => expect(screen.getByTestId("navigation-theme")).toBeTruthy());
    const appTheme = JSON.parse(screen.getByTestId("app-theme").props.children);
    const navigationTheme = JSON.parse(screen.getByTestId("navigation-theme").props.children);
    expect(navigationTheme).toMatchObject({
      dark: appTheme.isDark,
      colors: {
        background: appTheme.backgroundColor,
        card: appTheme.cardBackground,
        text: appTheme.textColor,
        border: appTheme.border,
        primary: appTheme.primary,
      },
    });
  },
);

it("updates the stack palette when the selected theme changes", async () => {
  const screen = renderTheme();
  await waitFor(() => expect(screen.getByTestId("navigation-theme")).toBeTruthy());
  for (const mode of ["dark", "midnight", "sepia", "light"] as const) {
    fireEvent.press(screen.getByLabelText(mode));
    const appTheme = JSON.parse(screen.getByTestId("app-theme").props.children);
    const navigationTheme = JSON.parse(screen.getByTestId("navigation-theme").props.children);
    expect(navigationTheme.colors.background).toBe(appTheme.backgroundColor);
    expect(navigationTheme.dark).toBe(appTheme.isDark);
  }
});
