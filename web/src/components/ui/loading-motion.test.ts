import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const uiCss = readFileSync(resolve(process.cwd(), "src/components/ui/ui.module.css"), "utf8");
const shellCss = readFileSync(resolve(process.cwd(), "src/components/shell/shell.module.css"), "utf8");

describe("loading motion CSS", () => {
  it("uses directional progress rather than a generic opacity pulse", () => {
    expect(uiCss).toContain("@keyframes skeletonShimmer");
    expect(uiCss).toContain("@keyframes loadingProgress");
    expect(uiCss).toContain("@keyframes buttonStateIconIn");
    expect(uiCss).not.toContain("skeletonPulse");
  });

  it("provides static reduced-motion fallbacks for shared and shell loading motion", () => {
    expect(uiCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.skeleton::after \{ animation: none;/);
    expect(uiCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.loadingTrack > span \{[^}]*animation: none;/);
    expect(uiCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.spinner[^}]*animation: none;/);
    expect(shellCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.bootstrapLogo[^}]*animation: none;/);
  });
});
