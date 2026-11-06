import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { useSyncExternalStore } from "react";
import { Appearance, Platform, Pressable, Text, useColorScheme } from "react-native";
import { ThemeProvider, useTheme, type ThemeMode } from "../theme";

const listeners = new Set<() => void>();
let systemScheme: "light" | "dark" = "light";
let override: "light" | "dark" | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitAppearanceChange() {
  for (const listener of listeners) listener();
}

function ThemeControls() {
  const { colorScheme, themeMode, setThemeMode } = useTheme();
  return <>
    <Text testID="active-theme">{`${themeMode}:${colorScheme}`}</Text>
    {(["light", "dark", "midnight", "sepia", "system"] as const).map((mode) =>
      <Pressable key={mode} accessibilityRole="button" accessibilityLabel={mode}
        onPress={() => setThemeMode(mode)}><Text>{mode}</Text></Pressable>,
    )}
  </>;
}

beforeEach(() => {
  listeners.clear();
  systemScheme = "light";
  override = null;
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue();
  jest.mocked(useColorScheme).mockImplementation(() =>
    useSyncExternalStore(subscribe, () => override ?? systemScheme),
  );
  jest.spyOn(Appearance, "setColorScheme").mockImplementation((scheme) => {
    override = scheme === "light" || scheme === "dark" ? scheme : null;
    emitAppearanceChange();
  });
});

afterEach(() => jest.restoreAllMocks());

it.each<[ThemeMode, "light" | "dark", "light" | "dark"]>([
  ["light", "dark", "light"],
  ["sepia", "dark", "light"],
  ["dark", "light", "dark"],
  ["midnight", "light", "dark"],
])("restores stored %s appearance when the phone is %s", async (mode, phoneScheme, appScheme) => {
  systemScheme = phoneScheme;
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(mode);
  const screen = render(<ThemeProvider><ThemeControls /></ThemeProvider>);
  await waitFor(() => expect(screen.getByTestId("active-theme").props.children).toBe(`${mode}:${appScheme}`));
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith(appScheme);
  expect(override).toBe(appScheme);
});

it("releases an explicit override before following the phone again", async () => {
  systemScheme = "dark";
  const screen = render(<ThemeProvider><ThemeControls /></ThemeProvider>);
  await waitFor(() => expect(screen.getByTestId("active-theme").props.children).toBe("system:dark"));
  fireEvent.press(screen.getByLabelText("light"));
  await waitFor(() => expect(screen.getByTestId("active-theme").props.children).toBe("light:light"));
  expect(override).toBe("light");

  fireEvent.press(screen.getByLabelText("system"));
  await waitFor(() => expect(screen.getByTestId("active-theme").props.children).toBe("system:dark"));
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith("unspecified");
  expect(override).toBeNull();

  const overrideCalls = jest.mocked(Appearance.setColorScheme).mock.calls.length;
  act(() => { systemScheme = "light"; emitAppearanceChange(); });
  expect(screen.getByTestId("active-theme").props.children).toBe("system:light");
  act(() => { systemScheme = "dark"; emitAppearanceChange(); });
  expect(screen.getByTestId("active-theme").props.children).toBe("system:dark");
  expect(Appearance.setColorScheme).toHaveBeenCalledTimes(overrideCalls);
});

it("applies explicit appearance immediately even while saving is pending or fails", async () => {
  let rejectSave!: (reason: Error) => void;
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const screen = render(<ThemeProvider><ThemeControls /></ThemeProvider>);
  await waitFor(() => expect(screen.getByTestId("active-theme")).toBeTruthy());
  fireEvent.press(screen.getByLabelText("dark"));
  expect(screen.getByTestId("active-theme").props.children).toBe("dark:dark");
  expect(override).toBe("dark");
  await act(async () => rejectSave(new Error("Storage unavailable")));
  expect(screen.getByTestId("active-theme").props.children).toBe("dark:dark");
  expect(warn).toHaveBeenCalledWith("Failed to save theme preference", expect.any(Error));
});

it("restores system appearance when the provider unmounts", async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue("midnight");
  const screen = render(<ThemeProvider><ThemeControls /></ThemeProvider>);
  await waitFor(() => expect(screen.getByTestId("active-theme").props.children).toBe("midnight:dark"));
  screen.unmount();
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith("unspecified");
  expect(override).toBeNull();
});

it("uses system appearance when loading preferences fails", async () => {
  systemScheme = "dark";
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("Storage unavailable"));
  jest.spyOn(console, "warn").mockImplementation(() => {});
  const screen = render(<ThemeProvider><ThemeControls /></ThemeProvider>);
  await waitFor(() => expect(screen.getByTestId("active-theme").props.children).toBe("system:dark"));
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith("unspecified");
});

it("does not call the unsupported native appearance override on web", async () => {
  jest.replaceProperty(Platform, "OS", "web");
  jest.mocked(AsyncStorage.getItem).mockResolvedValue("dark");
  const screen = render(<ThemeProvider><ThemeControls /></ThemeProvider>);
  await waitFor(() => expect(screen.getByTestId("active-theme").props.children).toBe("dark:dark"));
  screen.unmount();
  expect(Appearance.setColorScheme).not.toHaveBeenCalled();
});
