import { act, render } from "@testing-library/react-native";
import React from "react";
import * as Font from "expo-font";
import { Platform, StyleSheet } from "react-native";
import ReviewPromptCharacters from "../ReviewPromptCharacters";
import type { Subject } from "../../types/wanikani";
import { getCachedDownloadedJitaiFonts, loadDownloadedJitaiFonts, type DownloadedJitaiFont } from "../../utils/jitaiFonts";

const mockSettings = {
  jitaiEnabled: true,
  jitaiCycleAllFonts: false,
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
  mockSettings.jitaiCycleAllFonts = false;
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

it.each([false, true])("shows Source Han Sans on the first tap while fonts load (cycle all: %s)", async (cycleAllFonts) => {
  mockSettings.jitaiCycleAllFonts = cycleAllFonts;
  let resolveFonts!: (fonts: DownloadedJitaiFont[]) => void;
  jest.mocked(loadDownloadedJitaiFonts).mockReturnValue(new Promise((resolve) => { resolveFonts = resolve; }));
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  expect(screen.queryByText("付き合い")).toBeNull();

  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={1} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("SourceHanSansJP-Regular");

  await act(async () => { resolveFonts([customFont]); });
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("SourceHanSansJP-Regular");

  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={2} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(customFont.family);
});

it.each([
  { initialFont: "Source Han Sans", randomValue: 0, pendingPresses: 1 },
  { initialFont: "custom", randomValue: 0.99, pendingPresses: 1 },
  { initialFont: "Source Han Sans", randomValue: 0, pendingPresses: 2 },
  { initialFont: "custom", randomValue: 0.99, pendingPresses: 2 },
  { initialFont: "Source Han Sans", randomValue: 0, pendingPresses: 3 },
  { initialFont: "custom", randomValue: 0.99, pendingPresses: 3 },
])("keeps the displayed default after loading with $initialFont initially selected and $pendingPresses pending taps", async ({ randomValue, pendingPresses }) => {
  mockSettings.jitaiCycleAllFonts = true;
  mockSettings.jitaiSelectedFontIds = ["source-han-sans", customFont.id];
  jest.spyOn(Math, "random").mockReturnValue(randomValue);
  let resolveFonts!: (fonts: DownloadedJitaiFont[]) => void;
  jest.mocked(loadDownloadedJitaiFonts).mockReturnValue(new Promise((resolve) => { resolveFonts = resolve; }));
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  expect(screen.queryByText("付き合い")).toBeNull();

  for (let fontCycleIndex = 1; fontCycleIndex <= pendingPresses; fontCycleIndex += 1) {
    screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={fontCycleIndex} />);
    expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("SourceHanSansJP-Regular");
  }

  await act(async () => { resolveFonts([customFont]); });
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("SourceHanSansJP-Regular");

  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={pendingPresses + 1} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(customFont.family);
  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={pendingPresses + 2} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("SourceHanSansJP-Regular");

  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={0} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(
    randomValue === 0 ? "SourceHanSansJP-Regular" : customFont.family,
  );
  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={1} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(
    randomValue === 0 ? customFont.family : "SourceHanSansJP-Regular",
  );
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
  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={3} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("SourceHanSansJP-Regular");
});

it("cycles through every selected style with Source Han Sans second, then wraps", () => {
  mockSettings.jitaiCycleAllFonts = true;
  mockSettings.jitaiSelectedFontIds = ["source-han-sans", "reggae-one", "yuji-syuku", "hachi-maru-pop"];
  jest.spyOn(Math, "random").mockReturnValue(0.6);
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  const expectedFonts = [
    "YujiSyuku-Regular",
    "SourceHanSansJP-Regular",
    "ReggaeOne-Regular",
    "HachiMaruPop-Regular",
    "YujiSyuku-Regular",
  ];

  expectedFonts.forEach((fontFamily, fontCycleIndex) => {
    screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={fontCycleIndex} />);
    expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(fontFamily);
  });
});

it("includes Source Han Sans only once when it is the initially displayed font", () => {
  mockSettings.jitaiCycleAllFonts = true;
  mockSettings.jitaiSelectedFontIds = ["source-han-sans", "reggae-one", "yuji-syuku"];
  jest.spyOn(Math, "random").mockReturnValue(0.99);
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  const expectedFonts = [
    "SourceHanSansJP-Regular",
    "ReggaeOne-Regular",
    "YujiSyuku-Regular",
    "SourceHanSansJP-Regular",
  ];

  expectedFonts.forEach((fontFamily, fontCycleIndex) => {
    screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={fontCycleIndex} />);
    expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(fontFamily);
  });
});

it("keeps the chosen font stable while cycling through unselected Source Han Sans and rerendering", () => {
  mockSettings.jitaiCycleAllFonts = true;
  mockSettings.jitaiSelectedFontIds = ["reggae-one", "yuji-syuku"];
  jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValue(0.99);
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("ReggaeOne-Regular");
  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={1} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("SourceHanSansJP-Regular");
  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={2} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("YujiSyuku-Regular");
  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={2} size={90} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("YujiSyuku-Regular");
  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={3} size={90} />);
  expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe("ReggaeOne-Regular");
  expect(loadDownloadedJitaiFonts).not.toHaveBeenCalled();
});

it("cycles through selected downloaded and custom fonts, excluding failed registrations", async () => {
  mockSettings.jitaiCycleAllFonts = true;
  const downloadedFont: DownloadedJitaiFont = {
    ...customFont,
    id: "dot-gothic-16",
    family: "DotGothic16-Regular",
    origin: "catalog",
  };
  const failedFont: DownloadedJitaiFont = {
    ...customFont,
    id: "custom-failed",
    family: "JitaiCustom_failed",
  };
  mockSettings.jitaiSelectedFontIds = ["reggae-one", customFont.id, downloadedFont.id, failedFont.id];
  jest.mocked(loadDownloadedJitaiFonts).mockResolvedValue([customFont, downloadedFont, failedFont]);
  jest.mocked(Font.isLoaded).mockImplementation((family) => family !== failedFont.family);
  jest.spyOn(Math, "random").mockReturnValue(0);
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  await act(async () => {});
  const expectedFonts = [
    customFont.family,
    "SourceHanSansJP-Regular",
    "ReggaeOne-Regular",
    downloadedFont.family,
    customFont.family,
  ];

  expectedFonts.forEach((fontFamily, fontCycleIndex) => {
    screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={fontCycleIndex} />);
    expect(StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily).toBe(fontFamily);
  });
});

it("preserves the initial random font when switching between toggle modes", () => {
  mockSettings.jitaiSelectedFontIds = ["reggae-one", "yuji-syuku"];
  jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValue(0.99);
  const screen = render(<ReviewPromptCharacters subject={subject} />);
  const currentFont = () => StyleSheet.flatten(screen.getByText("付き合い").props.style).fontFamily;
  expect(currentFont()).toBe("ReggaeOne-Regular");

  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={2} />);
  expect(currentFont()).toBe("ReggaeOne-Regular");
  mockSettings.jitaiCycleAllFonts = true;
  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={2} size={90} />);
  expect(currentFont()).toBe("YujiSyuku-Regular");

  mockSettings.jitaiCycleAllFonts = false;
  screen.rerender(<ReviewPromptCharacters subject={subject} fontCycleIndex={2} size={100} />);
  expect(currentFont()).toBe("ReggaeOne-Regular");
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
