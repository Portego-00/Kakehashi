import { describe, expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "./settings";
import { BUILT_IN_JITAI_FONTS, resolveJitaiFontFamily } from "./jitai";

describe("Jitai font selection", () => {
  it("includes all six built-in fonts in the default pool", () => {
    expect(BUILT_IN_JITAI_FONTS).toHaveLength(6);
    expect(DEFAULT_WEB_SETTINGS.study.jitaiSelectedFontIds).toEqual(BUILT_IN_JITAI_FONTS.map((font) => font.id));
  });
  it.each(["zen-kurenaido", "yuji-syuku", "reggae-one"])("can select %s on its own", (id) => {
    const settings = { ...DEFAULT_WEB_SETTINGS.study, jitaiEnabled: true, jitaiSelectedFontIds: [id] };
    expect(resolveJitaiFontFamily(settings, "1:meaning")).toBe(BUILT_IN_JITAI_FONTS.find((font) => font.id === id)?.family);
  });
  it("does not alter prompts while disabled", () => expect(resolveJitaiFontFamily(DEFAULT_WEB_SETTINGS.study, "1:meaning")).toBeUndefined());
  it("selects only from the persisted enabled pool", () => {
    const settings = { ...DEFAULT_WEB_SETTINGS.study, jitaiEnabled: true, jitaiSelectedFontIds: ["mincho"] };
    expect(resolveJitaiFontFamily(settings, "1:meaning")).toContain("Mincho");
  });
});
