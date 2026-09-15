import { act, render } from "@testing-library/react-native";
import React from "react";
import * as Font from "expo-font";
import { Platform, StyleSheet } from "react-native";
import ReviewPromptCharacters from "../ReviewPromptCharacters";
import type { Subject } from "../../types/wanikani";
import { getCachedDownloadedJitaiFonts, loadDownloadedJitaiFonts, type DownloadedJitaiFont } from "../../utils/jitaiFonts";

const mockSettings = {
  jitaiEnabled: true,
  jitaiSelectedFontIds: ["custom-handwriting"],
};

jest.mock("../../utils/store", () => ({
  useSettingsStore: () => mockSettings,
}));
jest.mock("../../utils/radicalSvg", () => ({
  pickBestImage: jest.fn(() => null),
  useRemoteSvg: jest.fn(() => null),
}));
jest.mock("../../utils/jitaiFonts", () => ({
  ...jest.requireActual("../../utils/jitaiFonts"),
  loadDownloadedJitaiFonts: jest.fn(),
  getCachedDownloadedJitaiFonts: jest.fn(),
}));

const subject: Subject = {
  id: 100,
  object: "vocabulary",
  data: {
    level: 1,
    characters: "付き合い",
    meanings: [{ meaning: "Association", primary: true, accepted_answer: true }],
    auxiliary_meanings: [],
    readings: [{ reading: "つきあい", primary: true, accepted_answer: true }],
    component_subject_ids: [],
    pronunciation_audios: [],
  },
};
const customFont: DownloadedJitaiFont = {
  id: "custom-handwriting",
  family: "JitaiCustom_handwriting",
  displayName: "Handwriting",
  fileUri: "file:///handwriting.ttf",
  downloadedAt: "2026-09-14T00:00:00.000Z",
  origin: "custom",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Font.isLoaded).mockReturnValue(true);
  jest.mocked(getCachedDownloadedJitaiFonts).mockReturnValue(null);
  mockSettings.jitaiEnabled = true;
  mockSettings.jitaiSelectedFontIds = ["custom-handwriting"];
});
afterEach(() => jest.restoreAllMocks());

it("never paints a fallback prompt while the selected downloaded font is loading", async () => {
  let resolveFonts!: (fonts: DownloadedJitaiFont[]) => void;
  jest.mocked(loadDownloadedJitaiFonts).mockReturnValue(new Promise((resolve) => { resolveFonts = resolve; }));
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  const initialPrompt = screen.queryByText("付き合い");
  if (initialPrompt) {
    expect(StyleSheet.flatten(initialPrompt.props.style).fontFamily).toBe(customFont.family);
  }
  await act(async () => { resolveFonts([customFont]); });
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(customFont.family);
});

it("does not switch an already visible bundled font when downloaded fonts finish loading", async () => {
  mockSettings.jitaiSelectedFontIds = ["source-han-sans", "reggae-one"];
  let resolveFonts!: (fonts: DownloadedJitaiFont[]) => void;
  jest.mocked(loadDownloadedJitaiFonts).mockReturnValue(new Promise((resolve) => { resolveFonts = resolve; }));
  jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValue(0.99);
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  const initialFont = StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily;
  await act(async () => { resolveFonts([]); });
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(initialFont);
});

it("shows the default font immediately when extra fonts are disabled", () => {
  mockSettings.jitaiEnabled = false;
  jest.mocked(loadDownloadedJitaiFonts).mockReturnValue(new Promise(() => {}));
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("SourceHanSansJP-Regular");
});

it("keeps the chosen font when temporarily showing the default font", async () => {
  mockSettings.jitaiSelectedFontIds = ["reggae-one", "yuji-syuku"];
  jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValue(0.99);
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  const initialFont = StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily;
  screen.rerender(<ReviewPromptCharacters subject={subject} forceDefaultFont />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("SourceHanSansJP-Regular");
  screen.rerender(<ReviewPromptCharacters subject={subject} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(initialFont);
  expect(loadDownloadedJitaiFonts).not.toHaveBeenCalled();
});

it("ignores an old font load after changing the selected downloaded font", async () => {
  let resolveOld!: (fonts: DownloadedJitaiFont[]) => void;
  let resolveNew!: (fonts: DownloadedJitaiFont[]) => void;
  jest.mocked(loadDownloadedJitaiFonts)
    .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
    .mockReturnValueOnce(new Promise((resolve) => { resolveNew = resolve; }));
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  const nextFont = { ...customFont, id: "custom-brush", family: "JitaiCustom_brush" };
  mockSettings.jitaiSelectedFontIds = [nextFont.id];
  screen.rerender(<ReviewPromptCharacters subject={{ ...subject, id: 101 }} />);
  await act(async () => { resolveOld([customFont]); });
  expect(screen.queryByText("付き合い")).toBeNull();
  await act(async () => { resolveNew([customFont, nextFont]); });
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(nextFont.family);
});

it("still displays a prompt when a stored font cannot be registered", async () => {
  jest.mocked(loadDownloadedJitaiFonts).mockResolvedValue([customFont]);
  jest.mocked(Font.isLoaded).mockReturnValue(false);
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  await act(async () => {});
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).not.toBe(customFont.family);
});

it("still displays a prompt when the downloaded-font lookup fails", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(loadDownloadedJitaiFonts).mockRejectedValue(new Error("Storage temporarily unavailable"));
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  await act(async () => {});
  expect(screen.getByText("付き合い")).toBeTruthy();
});


it("shows an already loaded downloaded font immediately on the next question", () => {
  jest.mocked(getCachedDownloadedJitaiFonts).mockReturnValue([customFont]);
  jest.mocked(loadDownloadedJitaiFonts).mockReturnValue(new Promise(() => {}));
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(customFont.family);
  expect(loadDownloadedJitaiFonts).not.toHaveBeenCalled();
});


// Native Android screenshot repro (#54): selectable + auto-fit cropped this
// prompt to 114px of its 222px glyph height at 1.15x, and blank at 1.5x.
// This test protects the platform guard; pixel correctness is checked natively.
it.each(["android", "ios"] as const)(
  "uses the safe native prompt renderer on %s",
  (platform) => {
    jest.replaceProperty(Platform, "OS", platform);
    mockSettings.jitaiEnabled = false;
    const screen = render(<ReviewPromptCharacters subject={subject} size={150} />);
    const prompt = screen.getByText("付き合い");
    expect(prompt.props.selectable).toBe(platform !== "android");
    expect(prompt.props.adjustsFontSizeToFit).toBe(true);
    expect(prompt.props.numberOfLines).toBe(1);
  },
);
