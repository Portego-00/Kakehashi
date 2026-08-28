import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const contentCss = readFileSync(resolve(process.cwd(), "src/features/content/content.module.css"), "utf8");

describe("manga page-turn motion", () => {
  it("uses one synchronized transform-only push for both spread layers", () => {
    const animationRules = contentCss
      .split("\n")
      .filter((line) => line.includes("animation: mangaPages"));

    expect(animationRules).toHaveLength(4);
    for (const rule of animationRules) {
      expect(rule).toMatch(/animation: mangaPages\w+ 320ms cubic-bezier\(0\.2, 0, 0, 1\) both;/);
    }

    for (const name of [
      "mangaPagesOldToRight",
      "mangaPagesOldToLeft",
      "mangaPagesNewFromLeft",
      "mangaPagesNewFromRight",
    ]) {
      const keyframes = contentCss.split("\n").find((line) => line.startsWith(`@keyframes ${name}`));
      expect(keyframes).toContain("translateX(");
      expect(keyframes).not.toContain("opacity");
      expect(keyframes).not.toContain("scale(");
    }
  });
});
