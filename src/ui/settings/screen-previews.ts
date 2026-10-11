/** Content sketches: emphasize the setting's effect at 82 px, not miniature chrome. */
export type ScreenPreviewName =
  | "news-none" | "news-wk" | "news-full"
  | "lyrics-none" | "lyrics-wk" | "lyrics-full" | "lyrics-quiz"
  | "list" | "tiles" | "tabs" | "page"
  | "light" | "dark" | "midnight" | "sepia" | "system"
  | "meaning" | "reading" | "both";
export type PreviewPalette = {
  background: string; surface: string; text: string; muted: string;
  rule: string; accent: string; kanji: string; vocabulary: string; radical: string;
};
export type PreviewShape = {
  d: string; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number; transform?: string;
} | { text: string; x: number; y: number; color: string; size: number; weight?: string };
export const previewViewBox = "0 0 160 112";

export function screenPreview(name: ScreenPreviewName, platform: "native" | "web", palette: PreviewPalette): PreviewShape[] {
  const shapes: PreviewShape[] = [];
  let p = palette;
  const add = (d: string, fill?: string, stroke?: string, strokeWidth = 2) => shapes.push({ d, fill, stroke, strokeWidth });
  const rect = (x: number, y: number, w: number, h: number, fill: string, stroke?: string, r = 0) => add(
    r ? `M${x + r} ${y}h${w - r * 2}q${r} 0 ${r} ${r}v${h - r * 2}q0 ${r} ${-r} ${r}h${r * 2 - w}q${-r} 0 ${-r} ${-r}v${r * 2 - h}q0 ${-r} ${r} ${-r}Z` : `M${x} ${y}h${w}v${h}h${-w}Z`, fill, stroke);
  const line = (x: number, y: number, w: number, color = p.muted, weight = 3) => add(`M${x} ${y}h${w}`, undefined, color, weight);
  const text = (value: string, x: number, y: number, size = 18, color = p.text, weight = "500") => shapes.push({ text: value, x, y, size, color, weight });
  const mobile = platform === "native";
  const x = mobile ? 14 : 4, w = mobile ? 132 : 152;
  const frame = () => rect(x, 4, w, 104, p.background, p.rule, 5);

  if (["light", "dark", "midnight", "sepia", "system"].includes(name)) {
    if (name === "system") {
      const half = (theme: "light" | "dark", offset: number): PreviewShape[] => screenPreview(theme, platform, palette).map(shape => "text" in shape
        ? { ...shape, x: shape.x * .47 + offset, size: shape.size * .47 }
        : { ...shape, transform: `translate(${offset} 0) scale(.47 1)` });
      return [...half("light", 0), ...half("dark", 85)];
    }
    const themes: Record<string, Partial<PreviewPalette>> = {
      light: { background: "#f6f6f6", surface: "#ffffff", text: "#333333", muted: "#666666", rule: "#dedede", accent: "#3A86FF" },
      dark: { background: "#121212", surface: "#1e1e1e", text: "#f5f5f5", muted: "#b0b0b0", rule: "#414141", accent: "#3A86FF" },
      midnight: { background: "#000000", surface: "#0A0A0A", text: "#ffffff", muted: "#888888", rule: "#303030", accent: "#3A86FF" },
      sepia: { background: "#F4EDE2", surface: "#FBF6ED", text: "#3B2F22", muted: "#6C5A45", rule: "#E4D8C8", accent: "#8B5E3C" },
    };
    p = { ...p, ...themes[name] }; frame();
    line(x + 10, 18, mobile ? 42 : 32, p.text);
    if (mobile) {
      rect(x + 9, 29, w - 18, 27, p.surface, p.rule, 3); line(x + 18, 40, 41, p.text); line(x + 18, 48, 68, p.accent, 4);
      rect(x + 9, 63, w - 18, 27, p.surface, p.rule, 3); line(x + 18, 74, 52, p.text); line(x + 18, 82, 77, p.accent, 4);
      [18, 47, 76, 105].forEach((offset, i) => rect(x + offset, 98, 6, 5, i ? p.muted : p.accent, undefined, 1));
    } else {
      line(65, 18, 19, p.accent); line(96, 18, 19); line(127, 18, 16);
      rect(14, 32, 60, 52, p.surface, p.rule, 3); rect(83, 32, 60, 52, p.surface, p.rule, 3);
      line(23, 46, 30, p.text); line(23, 65, 41, p.accent, 4); line(92, 46, 33, p.text); line(92, 65, 40, p.accent, 4);
      line(14, 97, 129, p.rule, 2);
    }
    return shapes;
  }

  if (name.startsWith("news-") || name.startsWith("lyrics-")) {
    const lyrics = name.startsWith("lyrics-");
    const mode = name.split("-")[1]; frame();
    // One platform cue: native is a single content column; web retains its side panel.
    const bx = mobile ? 25 : lyrics ? 67 : 14;
    const bw = mobile ? 110 : lyrics ? 80 : 88;
    if (!mobile && lyrics) {
      rect(12, 21, 44, 52, p.surface, p.rule, 3); add("M28 36l15 11-15 11Z", p.muted); line(14, 86, 39, p.accent, 3);
    } else if (!mobile) {
      rect(111, 18, 36, 76, p.surface, p.rule, 3); text("日", 117, 48, 24, p.kanji); line(118, 62, 21); line(118, 76, 16, p.rule, 3);
    }
    const wordSize = mobile ? 22 : 20;
    if (mode === "quiz") {
      line(bx, 31, 14, p.text, 4); rect(bx + 22, 18, 46, 23, p.surface, p.accent, 3); line(bx + 76, 31, bw - 76, p.text, 4);
      [[0, 0], [bw / 2 + 4, 0], [0, 24], [bw / 2 + 4, 24]].forEach(([dx, dy]) => {
        const cw = bw / 2 - 4; rect(bx + dx, 50 + dy, cw, 18, p.surface, p.rule, 3); line(bx + dx + 8, 59 + dy, cw - 16, p.muted, 3);
      });
    } else {
      if (mode === "wk" && mobile) rect(bx - 3, 20, 60, 31, p.vocabulary, undefined, 3);
      text(lyrics ? "君の" : "日本", bx + 2, 44, wordSize, mode === "wk" && mobile ? "#ffffff" : p.text);
      line(bx + 65, 37, bw - 65, p.muted, 3);
      text(lyrics ? "声が" : "今日", bx + 2, 76, wordSize, p.text); line(bx + 65, 69, bw - 65, p.muted, 3);
      if (mode === "wk" && !mobile) line(bx, 49, 44, p.vocabulary, 5);
      if (mode === "full") {
        line(bx, 49, 25, p.vocabulary, 5); line(bx + 32, 49, 25, p.accent, 5);
        line(bx, 81, 46, p.kanji, 5); line(bx + 65, 75, bw - 65, p.accent, 4);
      }
    }
    if (mobile && lyrics) {
      line(30, 98, 77, p.rule, 3); line(30, 98, 42, p.accent, 3); add("M121 92l9 6-9 6Z", p.text);
    } else if (!lyrics) line(bx, 97, bw, p.rule, 2);
    return shapes;
  }

  if (name === "tiles" || name === "list") {
    frame();
    const cols = [p.kanji, p.vocabulary];
    cols.forEach((color, i) => {
      if (name === "tiles") {
        const tx = x + 10 + i * (w / 2); rect(tx, 29, w / 2 - 19, 52, color, undefined, 4);
        text(i ? "人" : "水", tx + 10, 64, 27, "#ffffff");
      } else {
        const y = 21 + i * 43; rect(x + 10, y, 32, 32, color, undefined, 3); text(i ? "人" : "水", x + 14, y + 24, 23, "#ffffff");
        line(x + 54, y + 10, w - 70, p.text, 4); line(x + 54, y + 24, w - 88, p.muted, 3);
      }
    });
    return shapes;
  }

  frame(); rect(x + 1, 5, w - 2, 29, p.kanji, undefined, 4); text("水", x + w / 2 - 10, 28, 26, "#ffffff");
  if (name === "tabs") {
    [0, 1, 2].forEach(i => rect(x + 10 + i * (w - 20) / 3, 44, (w - 26) / 3, 9, i ? p.rule : p.accent, undefined, 2));
    text("Water", x + 13, 83, 23); line(x + 13, 97, w - 40, p.muted, 3);
  } else if (name === "page" || name === "both") {
    text("Water", x + 13, 62, 21); line(x + 10, 71, w - 20, p.rule, 2); text("みず", x + 13, 98, 23);
  } else text(name === "meaning" ? "Water" : "みず", x + 14, 79, 27);
  return shapes;
}
