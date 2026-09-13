import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/features/subjects/subjects.module.css"), "utf8");

describe("subject detail style contracts", () => {
  it("keeps embedded answer details inset from their container", () => {
    expect(css).toMatch(
      /\.embeddedDetailContent\s*{[^}]*padding:\s*var\(--space-lg\) var\(--space-md\) 0;/,
    );
  });

  it("uses the neutral separator between context sentences", () => {
    const rule = css.match(/\.contextList blockquote\s*{([^}]*)}/)?.[1] ?? "";
    expect(rule).toContain("border-block-start: var(--rule-thin) solid var(--color-rule-2)");
    expect(rule).not.toContain("var(--color-vocabulary)");
  });
});
