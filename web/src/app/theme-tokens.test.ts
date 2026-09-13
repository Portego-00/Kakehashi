import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("tokens.css", "utf8");

function tokenValue(selector: string, token: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = tokens.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
  return block?.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1].trim();
}

describe("theme color tokens", () => {
  it.each(["dark", "midnight"])("uses light text on accent controls in the %s theme", (theme) => {
    const accentInk = tokenValue(`[data-theme="${theme}"]`, "--color-accent-ink");
    const lightness = Number(accentInk?.match(/^oklch\(([\d.]+)%/)?.[1]);

    expect(lightness).toBeGreaterThanOrEqual(90);
  });
});
