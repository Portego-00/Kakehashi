"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

export const REVIEW_DETAILS_DURATION_MS = 520;
const reviewScrollOrigins = new WeakMap<Element, number>();

/** Animate real layout height, including sections that finish loading while open. */
export function ReviewDetailsReveal({ open, children, revealInViewport = false }: { open: boolean; children: ReactNode; revealInViewport?: boolean }) {
  const content = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const previousScroll = useRef<number | null>(null);
  const [height, setHeight] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [children]);

  useEffect(() => {
    // Wait for both the prompt and disclosure to settle, then expose just the
    // start of the panel so the answer controls remain nearby.
    if (!revealInViewport || !window.matchMedia?.("(min-width: 48rem)").matches) return;
    const session = container.current?.closest('[data-study-session="active"]');
    if (!open) {
      const top = previousScroll.current;
      previousScroll.current = null;
      const anotherPanelOpen = session?.querySelector('[data-review-details-reveal][data-open="true"][data-reveal-in-viewport="true"]');
      if (top !== null && !anotherPanelOpen) {
        window.scrollTo({ top: (session && reviewScrollOrigins.get(session)) ?? top, behavior: reducedMotion ? "instant" : "smooth" });
        if (session) reviewScrollOrigins.delete(session);
      }
      return;
    }
    previousScroll.current = window.scrollY;
    if (session && !reviewScrollOrigins.has(session)) reviewScrollOrigins.set(session, window.scrollY);
    let frame = 0;
    const scrollToStart = () => {
      const element = container.current;
      if (!element || !element.getBoundingClientRect().height) return;
      const visibleStart = Math.min(240, window.innerHeight * 0.3);
      const distance = element.getBoundingClientRect().top - (window.innerHeight - visibleStart);
      if (distance > 0) window.scrollBy({ top: distance, behavior: reducedMotion ? "instant" : "smooth" });
    };
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(scrollToStart); });
    }, reducedMotion ? 0 : REVIEW_DETAILS_DURATION_MS);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [open, revealInViewport, reducedMotion]);

  return <div ref={container} data-review-details-reveal data-open={open} data-reveal-in-viewport={revealInViewport} aria-hidden={!open} inert={!open ? true : undefined}
    style={{ height: open ? height : 0, opacity: open ? 1 : 0, overflow: "hidden", minWidth: 0, overflowAnchor: "none",
      transition: reducedMotion ? "none" : `height ${REVIEW_DETAILS_DURATION_MS}ms cubic-bezier(.4, 0, .6, 1), opacity 320ms ease-in-out` }}>
    <div ref={content} style={{ display: "flow-root" }}>{children}</div>
  </div>;
}
