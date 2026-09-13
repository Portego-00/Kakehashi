export type NotebookPaperColor = "auto" | `#${string}`;
export type NotebookPaperAppearance = "light" | "dark";

export function isNotebookPaperColor(value: unknown): value is NotebookPaperColor {
  return value === "auto" || typeof value === "string" && /^#[0-9a-f]{6}$/.test(value);
}

function themeHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const asHex = (channels: number[]) => `#${channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
  // The web app's surface tokens use OKLCH. Convert that paper color to sRGB;
  // the actual ink image always comes directly from PencilKit.
  const oklch = /^oklch\(\s*(\d+(?:\.\d+)?)(%)?\s+(\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:deg)?\s*\)$/.exec(value);
  if (oklch) {
    const light = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    const chroma = Number(oklch[3]); const angle = Number(oklch[4]) * Math.PI / 180;
    const a = chroma * Math.cos(angle); const b = chroma * Math.sin(angle);
    const l = (light + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (light - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (light - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return asHex([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((linear) => 255 * (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055)));
  }
  // Computed browser colors use rgb/rgba, while the native theme uses hex.
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*1(?:\.0*)?)?\s*\)$/.exec(value);
  if (!rgb) return "#ffffff";
  return asHex(rgb.slice(1, 4).map(Number));
}

/** Select a real PencilKit-rendered ink variant for the actual paper color. */
export function resolveNotebookPaperColor(choice: unknown, themeBackground: string): { color: string; appearance: NotebookPaperAppearance } {
  const color = isNotebookPaperColor(choice) && choice !== "auto" ? choice : themeHex(themeBackground.trim());
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  // The crossover gives dark ink and light ink the same contrast against paper.
  return { color, appearance: luminance < Math.sqrt(0.05 * 1.05) - 0.05 ? "dark" : "light" };
}
