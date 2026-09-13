"use client";

import { useCallback } from "react";
import { PHONE_STUDY_MEDIA_QUERY } from "./use-phone-study-input";

/** Follow the space above a phone keyboard without changing the desktop viewport. */
export function useMobileReviewViewport<T extends HTMLElement = HTMLElement>(active: boolean) {
  // The question can mount after the phase changes while its study data loads.
  // A callback ref follows that mount (and replacement), unlike a phase-only effect.
  return useCallback((element: T | null) => {
    const viewport = window.visualViewport;
    if (!active || !element || !viewport) return;

    const phone = window.matchMedia(PHONE_STUDY_MEDIA_QUERY);
    let fullHeight = Math.max(window.innerHeight, viewport.height);
    let keyboardOpen = false;
    let frame = 0;

    const reset = () => {
      keyboardOpen = false;
      element.removeAttribute("data-mobile-review-keyboard");
      element.style.removeProperty("--review-viewport-height");
      element.style.removeProperty("--review-viewport-top");
    };

    const update = () => {
      // Pinch zoom must retain ordinary browser panning and magnification.
      if (!phone.matches || viewport.scale !== 1) {
        reset();
        return;
      }
      const input = document.activeElement;
      const answering = input instanceof HTMLInputElement && element.contains(input);
      if (!answering && !keyboardOpen) fullHeight = Math.max(window.innerHeight, viewport.height);
      const height = viewport.height;
      const hasKeyboard = fullHeight - height > 100 && (answering || keyboardOpen);
      if (!hasKeyboard) {
        fullHeight = Math.max(fullHeight, window.innerHeight, height);
        reset();
        return;
      }
      keyboardOpen = true;
      element.style.setProperty("--review-viewport-height", `${height}px`);
      element.style.setProperty("--review-viewport-top", `${viewport.offsetTop}px`);
      element.setAttribute("data-mobile-review-keyboard", "true");
    };

    const focusChanged = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    phone.addEventListener?.("change", update);
    element.addEventListener("focusin", focusChanged);
    element.addEventListener("focusout", focusChanged);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      phone.removeEventListener?.("change", update);
      element.removeEventListener("focusin", focusChanged);
      element.removeEventListener("focusout", focusChanged);
      reset();
    };
  }, [active]);
}
