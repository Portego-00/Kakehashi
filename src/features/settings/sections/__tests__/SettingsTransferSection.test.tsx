import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { File } from "expo-file-system";
import { deleteAsync, StorageAccessFramework } from "expo-file-system/legacy";
import { Alert, Platform, Share } from "react-native";

import { useSettingsStore } from "../../../../utils/store";
import { parseSettingsBackup } from "../../settings-transfer";
import { SettingsTransferSection } from "../SettingsTransferSection";

const mockSetThemeMode = jest.fn();
const mockWriteFile = jest.fn();

jest.mock("../../useSettingsController", () => ({
  STOP_DETAILS_PREVIEW_ASPECT_RATIO: 1,
}));

jest.mock("../../SettingsControllerContext", () => ({
  useSettingsControllerContext: () => ({
    themeMode: "light",
    theme: {
      cardBackground: "#fff",
      textColor: "#111",
      textSecondary: "#222",
      border: "#ccc",
      primary: "#007aff",
    },
    updateSectionOffset: jest.fn(),
    setThemeMode: mockSetThemeMode,
  }),
}));

jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  File: Object.assign(
    jest.fn((_path, name: string) => ({ uri: `file:///cache/${name}`, write: mockWriteFile })),
    { pickFileAsync: jest.fn() },
  ),
}));

jest.mock("expo-file-system/legacy", () => ({
  deleteAsync: jest.fn(),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
  },
}));

const initial = useSettingsStore.getInitialState();

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(useSettingsStore.persist, "hasHydrated").mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  useSettingsStore.setState(initial, true);
});

function mockPickedFile(contents: string) {
  jest.mocked(File.pickFileAsync).mockResolvedValue({
    size: contents.length,
    text: async () => contents,
  } as File);
}

it("validates before prompting and applies settings and theme only after confirmation", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockPickedFile(JSON.stringify({
    format: "kakehashi-settings",
    version: 1,
    themeMode: "sepia",
    preferences: { lessonBatchSize: 9 },
  }));

  const screen = render(<SettingsTransferSection />);
  fireEvent.press(screen.getByRole("button", { name: "Import Settings" }));
  await waitFor(() => expect(alert.mock.calls[0]?.[0]).toBe("Import settings?"));
  expect(useSettingsStore.getState().lessonBatchSize).toBe(initial.lessonBatchSize);
  expect(mockSetThemeMode).not.toHaveBeenCalled();

  await act(async () => alert.mock.calls[0][2]?.find(({ text }) => text === "Import")?.onPress?.());
  expect(useSettingsStore.getState().lessonBatchSize).toBe(9);
  expect(mockSetThemeMode).toHaveBeenCalledWith("sepia");
  expect(alert.mock.calls.at(-1)?.[0]).toBe("Settings imported");
});

it("leaves settings alone and reports malformed files", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockPickedFile("not JSON");

  const screen = render(<SettingsTransferSection />);
  fireEvent.press(screen.getByRole("button", { name: "Import Settings" }));
  await waitFor(() => expect(alert.mock.calls[0]?.[0]).toBe("Couldn’t import settings"));
  expect(useSettingsStore.getState().lessonBatchSize).toBe(initial.lessonBatchSize);
});

it("shares a JSON file on iOS", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  const share = jest.spyOn(Share, "share").mockResolvedValue({
    action: Share.sharedAction, activityType: undefined,
  });
  useSettingsStore.setState({ lessonBatchSize: 6 });

  const screen = render(<SettingsTransferSection />);
  fireEvent.press(screen.getByRole("button", { name: "Export Settings" }));

  await waitFor(() => expect(share).toHaveBeenCalledWith({ url: "file:///cache/kakehashi-settings.json" }));
  expect(parseSettingsBackup(mockWriteFile.mock.calls[0][0])).toMatchObject({
    themeMode: "light",
    preferences: { lessonBatchSize: 6 },
  });
});

it("writes the export to the Android folder chosen by the user", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const folder = "content://device/tree/folder";
  const file = "content://device/document/settings.json";
  jest.mocked(StorageAccessFramework.requestDirectoryPermissionsAsync).mockResolvedValue({
    granted: true, directoryUri: folder,
  });
  jest.mocked(StorageAccessFramework.createFileAsync).mockResolvedValue(file);
  jest.mocked(StorageAccessFramework.writeAsStringAsync).mockResolvedValue(undefined);

  const screen = render(<SettingsTransferSection />);
  fireEvent.press(screen.getByRole("button", { name: "Export Settings" }));

  await waitFor(() => expect(alert.mock.calls[0]?.[0]).toBe("Settings exported"));
  expect(StorageAccessFramework.createFileAsync).toHaveBeenCalledWith(
    folder, "kakehashi-settings", "application/json",
  );
  const [uri, contents] = jest.mocked(StorageAccessFramework.writeAsStringAsync).mock.calls[0];
  expect(uri).toBe(file);
  expect(parseSettingsBackup(contents).themeMode).toBe("light");
});

it("cleans up the new Android file if writing fails", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const file = "content://device/document/settings.json";
  jest.mocked(StorageAccessFramework.requestDirectoryPermissionsAsync).mockResolvedValue({
    granted: true, directoryUri: "content://device/tree/folder",
  });
  jest.mocked(StorageAccessFramework.createFileAsync).mockResolvedValue(file);
  jest.mocked(StorageAccessFramework.writeAsStringAsync).mockRejectedValue(new Error("No space"));
  jest.mocked(deleteAsync).mockResolvedValue(undefined);

  const screen = render(<SettingsTransferSection />);
  fireEvent.press(screen.getByRole("button", { name: "Export Settings" }));

  await waitFor(() => expect(alert.mock.calls[0]?.[0]).toBe("Couldn’t export settings"));
  expect(deleteAsync).toHaveBeenCalledWith(file, { idempotent: true });
});
