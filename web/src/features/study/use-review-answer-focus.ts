"use client";

import { useCallback, useEffect, type RefObject } from "react";

/** Keep pointer-driven review sessions ready for typing, without trapping Tab navigation. */
export function useReviewAnswerFocus(inputRef: RefObject<HTMLInputElement | null>, active = true) {
  const focusAnswer = useCallback(() => {
    const input = inputRef.current;
    if (!active || !input?.isConnected || input.disabled || document.visibilityState === "hidden") return;
    if (input.closest('[hidden], [inert], [aria-hidden="true"]') || document.querySelector('dialog[open], [role="dialog"], [role="menu"]')) return;
    const focused = document.activeElement;
    if (focused !== input && focused instanceof HTMLElement && focused.matches('input, textarea, select, [contenteditable="true"]')) return;
    input.focus({ preventScroll: true });
  }, [active, inputRef]);

  const attachInput = useCallback((input: HTMLInputElement | null) => {
    inputRef.current = input;
    // Mount may happen after the queue is ready (fonts and answer data load separately).
    if (input && window.matchMedia?.("(min-width: 48rem)").matches) focusAnswer();
  }, [focusAnswer, inputRef]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const restore = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(focusAnswer);
    };
    const onClick = (event: MouseEvent) => {
      // Keyboard activation must retain focus on the control the learner tabbed to.
      if (!event.detail || !(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      const session = inputRef.current?.closest('[data-study-session="active"], [data-review-answer-focus]');
      if (button && session?.contains(button) && !button.closest('dialog, [role="dialog"], [role="menu"]')) restore();
    };
    window.addEventListener("focus", restore);
    document.addEventListener("visibilitychange", restore);
    document.addEventListener("click", onClick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("focus", restore);
      document.removeEventListener("visibilitychange", restore);
      document.removeEventListener("click", onClick);
    };
  }, [active, focusAnswer, inputRef]);

  return attachInput;
}
