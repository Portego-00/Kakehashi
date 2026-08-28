import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const globalsCss = source("src/app/globals.css");
const settingsCss = source("src/features/settings/settings.module.css");
const coreStudyCss = source("src/features/core-study/core-study.module.css");
const ankiCss = source("src/features/core-study/AnkiAnswerContent.module.css");

describe("review workspace responsive CSS contracts", () => {
  it("does not turn the 20rem body floor into horizontal overflow at larger text scales", () => {
    expect(globalsCss).toMatch(/body\s*{[\s\S]*?min-width:\s*min\(20rem,\s*100%\)/);
  });

  it("reserves room for mobile setting switches instead of overlaying their copy", () => {
    expect(settingsCss).toMatch(
      /@media \(max-width: 30rem\)[\s\S]*?\.toggleRow > span\s*{[^}]*width:\s*100%;[^}]*padding-inline-end:\s*calc\(2\.75rem \+ var\(--space-md\)\)/,
    );
  });

  it("lets dense review actions wrap and stacks grading controls only on narrow phones", () => {
    expect(coreStudyCss).toMatch(/\.bandActions\s*{[\s\S]*?flex-wrap:\s*wrap;/);
    expect(ankiCss).toMatch(
      /@media \(max-width: 24rem\)[\s\S]*?\.gradeActions\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
  });

  it("keeps buttonless touch gestures reliable and reserves narrow prompt space for the previous answer", () => {
    expect(ankiCss).toMatch(/\.card\[data-buttonless="true"\]\s*{[^}]*touch-action:\s*none;/);
    expect(coreStudyCss).toMatch(
      /@media \(max-width: 32rem\)[\s\S]*?\.subjectGlyph\s*{[^}]*padding-block-start:\s*calc\(var\(--space-md\) \+ 3\.25rem \+ var\(--space-sm\)\)/,
    );
  });

  it("reserves a mode-sized SRS notice slot and disables its entrance motion when requested", () => {
    expect(coreStudyCss).toMatch(/\.srsProgressionSlot\s*{[\s\S]*?min-height:\s*4rem;/);
    expect(coreStudyCss).toMatch(/\.srsProgressionSlot\[data-mode="compact"\]\s*{\s*min-height:\s*2\.75rem;/);
    expect(coreStudyCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.srsProgression,[\s\S]*?animation:\s*none;/,
    );
  });
});
