"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

export const REVIEW_DETAILS_DURATION_MS = 520;
const reviewScrollOrigins = new WeakMap<Element, number>();

/** Animate real layout height, including sections that finish loading while open. */
export function ReviewDetailsReveal({ open, children, revealInViewport = false, revealToStart = false, availableOnScroll = false, stickyContent = false, onVisible }: { open: boolean; children: ReactNode; revealInViewport?: boolean; revealToStart?: boolean; availableOnScroll?: boolean; stickyContent?: boolean; onVisible?: () => void }) {
  const content = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const previousScroll = useRef<number | null>(null);
  const [height, setHeight] = useState(0);
  const [visited, setVisited] = useState(false);
  const reducedMotion = useReducedMotion();
  const passive = availableOnScroll && !open;
  const visible = open || availableOnScroll;
  const reportVisible = useEffectEvent(() => onVisible?.());

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    if (!passive) { element.style.paddingTop = "0px"; return; }
    const position = () => {
      // Keep scrollable Anki details beyond the initial viewport without moving
      // the answer or shrinking the prompt. Explicit disclosure removes the gap.
      element.style.paddingTop = `${Math.max(24, window.innerHeight - (element.getBoundingClientRect().top + window.scrollY) + 24)}px`;
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [passive, children]);

  useEffect(() => {
    const element = content.current;
    if (!passive || !element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || element.getBoundingClientRect().top >= window.innerHeight) return;
      setVisited(true);
      reportVisible();
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [passive]);

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
    // Wait for layout to settle. Automatic wrong-answer details sit near the
    // top so their contents are readable; manual disclosures peek into view.
    if (!revealInViewport || (!revealToStart && !window.matchMedia?.("(min-width: 48rem)").matches)) return;
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
      const targetTop = revealToStart ? 96 : window.innerHeight - Math.min(240, window.innerHeight * 0.3);
      const distance = element.getBoundingClientRect().top - targetTop;
      if (distance > 0) window.scrollBy({ top: distance, behavior: reducedMotion ? "instant" : "smooth" });
    };
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(scrollToStart); });
    }, reducedMotion ? 0 : REVIEW_DETAILS_DURATION_MS);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [open, revealInViewport, revealToStart, reducedMotion]);

  return <div ref={container} data-review-details-reveal data-open={open} data-available-on-scroll={availableOnScroll || undefined} data-reveal-in-viewport={revealInViewport} aria-hidden={!visible} inert={!visible ? true : undefined}
    style={{ height: passive ? "auto" : open ? height : 0, opacity: visible ? 1 : 0, overflow: stickyContent ? "clip" : "hidden", minWidth: 0, overflowAnchor: "none",
      transition: reducedMotion || passive ? "none" : `height ${REVIEW_DETAILS_DURATION_MS}ms cubic-bezier(.4, 0, .6, 1), opacity 320ms ease-in-out` }}>
    <div ref={content} style={{ display: "flow-root", minHeight: availableOnScroll ? 1 : undefined }}>{passive && !visited ? null : children}</div>
  </div>;
}
