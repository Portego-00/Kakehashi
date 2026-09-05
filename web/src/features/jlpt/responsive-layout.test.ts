import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "src/features/jlpt/jlpt.module.css"),
  "utf8",
);
const resultsCss = readFileSync(
  resolve(process.cwd(), "src/features/jlpt/components/JlptResults.module.css"),
  "utf8",
);

describe("JLPT responsive layout contracts", () => {
  it("stacks testing choices and result panels on mobile", () => {
    expect(css).toMatch(
      /@media \(max-width: 48rem\)[\s\S]*?\.modeGrid,[\s\S]*?\.resultsGrid\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 48rem\)[\s\S]*?\.options\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(resultsCss).toMatch(
      /@media \(max-width: 48rem\)[\s\S]*?\.summary\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(resultsCss).toMatch(
      /@media \(max-width: 48rem\)[\s\S]*?\.answerComparison\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  });

  it("keeps primary controls at touch-friendly sizes and respects safe areas", () => {
    expect(css).toMatch(/\.option\s*{[\s\S]*?min-height:\s*4rem;/);
    expect(css).toMatch(
      /\.examFooter\s*{[\s\S]*?env\(safe-area-inset-bottom\)/,
    );
  });

  it("has a 320px-class refinement and removes nonessential keyboard copy", () => {
    expect(css).toContain("@media (max-width: 24rem)");
    expect(css).toMatch(
      /@media \(max-width: 48rem\)[\s\S]*?\.keyboardCue\s*{[^}]*display:\s*none;/,
    );
  });

  it("provides a reduced-motion question transition fallback", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.questionStage\s*{[^}]*animation:\s*none;/,
    );
  });

  it("keeps the selected level visibly selected in dark themes", () => {
    expect(css).toMatch(
      /\.levelOption\[data-selected\]\s*{[^}]*background:\s*color-mix\(in oklch, var\(--color-extra-study-primary\) 70%, black\)/,
    );
    expect(css).toMatch(
      /\.levelOption\[data-selected\]\s*{[^}]*color:\s*white/,
    );
    expect(css).toMatch(
      /\.levelOption\[data-selected\] strong\s*{[^}]*color:\s*white/,
    );
  });
});
