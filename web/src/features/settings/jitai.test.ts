import { describe, expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "./settings";
import { resolveJitaiFontFamily } from "./jitai";

describe("Jitai font selection", () => {
  it("does not alter prompts while disabled", () => expect(resolveJitaiFontFamily(DEFAULT_WEB_SETTINGS.study, "1:meaning")).toBeUndefined());
  it("selects only from the persisted enabled pool", () => {
    const settings = { ...DEFAULT_WEB_SETTINGS.study, jitaiEnabled: true, jitaiSelectedFontIds: ["mincho"] };
    expect(resolveJitaiFontFamily(settings, "1:meaning")).toContain("Mincho");
  });
});
