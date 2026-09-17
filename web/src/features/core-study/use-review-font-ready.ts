"use client";

import { useEffect, useState } from "react";

// Japanese fonts are split into unicode ranges. Load every subject glyph while
// the queue is preparing, so later questions cannot trigger a fallback-font swap.
export function useReviewFontReady(family: string, text: string) {
  const [loadedRequest, setLoadedRequest] = useState<string | null>(null);
  const request = `${family}:${text}`;
  useEffect(() => {
    if (!text || typeof document.fonts?.load !== "function") return;
    let cancelled = false;
    void document.fonts.load(`350 1em ${family}`, text).catch(() => []).then(() => {
      // Font failures must not prevent studying with the system fallback.
      if (!cancelled) setLoadedRequest(request);
    });
    return () => { cancelled = true; };
  }, [family, text, request]);
  return !text || typeof document === "undefined" || typeof document.fonts?.load !== "function" || loadedRequest === request;
}
