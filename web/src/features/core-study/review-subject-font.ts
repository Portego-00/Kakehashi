import { Noto_Sans_JP } from "next/font/google";

// WaniKani renders Japanese subjects in Noto Sans JP at its regular 350 weight.
// Keep the font scoped to quiz characters, without changing the rest of the UI.
export const reviewSubjectFont = Noto_Sans_JP({
  weight: "variable",
  display: "swap",
  preload: false,
  fallback: ["Hiragino Sans", "Yu Gothic", "sans-serif"],
  adjustFontFallback: false,
});
