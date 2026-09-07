"use client";

import { useEffect, useRef } from "react";

/** Animate presentation changes, not the minute-by-minute schedule refreshes. */
export function useReviewForecastMotion(ready: boolean, presentation: string) {
  const contentRef = useRef<HTMLDivElement>(null);
  const lastPresentation = useRef<string | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!ready || !content || lastPresentation.current === presentation) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    let disposed = false;
    const cancel = () => animations.forEach((animation) => animation.cancel());
    const onMotionPreferenceChange = () => { if (reducedMotion?.matches) cancel(); };
    const reveal = () => {
      if (disposed || lastPresentation.current === presentation) return;
      const firstAppearance = lastPresentation.current === null;
      lastPresentation.current = presentation;
      if (reducedMotion?.matches || typeof content.animate !== "function") return;

      const easing = getComputedStyle(content).getPropertyValue("--ease-out").trim() || "cubic-bezier(0.16, 1, 0.3, 1)";
      const bars = [...content.querySelectorAll<HTMLElement>("[data-forecast-bar]")].filter((bar) => !bar.closest("[hidden]"));
      animations.push(content.animate([
        { opacity: firstAppearance ? 0 : .4, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: firstAppearance ? 280 : 200, easing }));
      bars.forEach((bar, index) => {
        const axis = bar.dataset.horizontal === "true" ? "X" : "Y";
        animations.push(bar.animate([
          { transform: `scale${axis}(${firstAppearance ? 0 : .92})` },
          { transform: `scale${axis}(1)` },
        ], {
          duration: firstAppearance ? 280 : 200,
          // Keep even the 48-column entrance under 400 ms altogether.
          delay: firstAppearance ? index / Math.max(1, bars.length - 1) * 96 : 0,
          easing,
          fill: "backwards",
        }));
      });
    };

    // Both widgets sit below the fold: don't spend their entrance before they are seen.
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        reveal();
        observer?.disconnect();
      }
    }, { threshold: .08 });
    if (observer) observer.observe(content);
    else reveal();
    reducedMotion?.addEventListener("change", onMotionPreferenceChange);

    return () => {
      disposed = true;
      observer?.disconnect();
      reducedMotion?.removeEventListener("change", onMotionPreferenceChange);
      cancel();
    };
  }, [ready, presentation]);

  return contentRef;
}
