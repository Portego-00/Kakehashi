import {
  getCustomJitaiFontFileValidationError,
  getInstalledJitaiFonts,
  JITAI_DOWNLOADABLE_FONTS,
  MAX_CUSTOM_JITAI_FONT_SIZE_BYTES,
  type DownloadedJitaiFont,
} from "../jitaiFonts";

describe("Jitai fonts", () => {
  it("offers the additional calligraphy fonts", () => {
    const calligraphyFontIds = JITAI_DOWNLOADABLE_FONTS.filter(
      (font) => font.styleLabel,
    ).map((font) => font.id);

    expect(calligraphyFontIds).toEqual(
      expect.arrayContaining([
        "yuji-mai",
        "yuji-boku",
        "kaisei-harunoumi",
      ]),
    );
  });

  it("accepts TTF and OTF custom font files within the size limit", () => {
    expect(
      getCustomJitaiFontFileValidationError({
        name: "JapaneseBrush.TTF",
        size: MAX_CUSTOM_JITAI_FONT_SIZE_BYTES,
      }),
    ).toBeNull();
    expect(
      getCustomJitaiFontFileValidationError({
        name: "JapaneseBrush.otf",
      }),
    ).toBeNull();
  });

  it("rejects unsupported and oversized custom font files", () => {
    expect(
      getCustomJitaiFontFileValidationError({
        name: "JapaneseBrush.woff2",
      }),
    ).toContain(".ttf");
    expect(
      getCustomJitaiFontFileValidationError({
        name: "JapaneseBrush.ttf",
        size: MAX_CUSTOM_JITAI_FONT_SIZE_BYTES + 1,
      }),
    ).toContain("smaller");
  });

  it("marks imported fonts as custom in the installed list", () => {
    const storedFonts: DownloadedJitaiFont[] = [
      {
        id: "custom-example",
        family: "JitaiCustom_example",
        displayName: "Japanese Brush",
        fileUri: "file:///jitai-fonts/custom-example.ttf",
        downloadedAt: "2026-07-23T10:00:00.000Z",
        origin: "custom",
      },
      {
        id: "yomogi",
        family: "Yomogi-Regular",
        displayName: "Yomogi",
        fileUri: "file:///jitai-fonts/Yomogi-Regular.ttf",
        downloadedAt: "2026-07-23T10:00:00.000Z",
        origin: "catalog",
      },
    ];

    const installedFonts = getInstalledJitaiFonts(storedFonts);

    expect(
      installedFonts.find((font) => font.id === "custom-example")?.source,
    ).toBe("custom");
    expect(installedFonts.find((font) => font.id === "yomogi")?.source).toBe(
      "downloaded",
    );
  });
});
