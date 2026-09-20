"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

export const REVIEW_DETAILS_DURATION_MS = 520;

/** Animate real layout height, including sections that finish loading while open. */
export function ReviewDetailsReveal({ open, children }: { open: boolean; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
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

  return <div data-review-details-reveal data-open={open} aria-hidden={!open} inert={!open ? true : undefined}
    style={{ height: open ? height : 0, opacity: open ? 1 : 0, overflow: "hidden", minWidth: 0, overflowAnchor: "none",
      transition: reducedMotion ? "none" : `height ${REVIEW_DETAILS_DURATION_MS}ms cubic-bezier(.4, 0, .6, 1), opacity 320ms ease-in-out` }}>
    <div ref={content} style={{ display: "flow-root" }}>{children}</div>
  </div>;
}
