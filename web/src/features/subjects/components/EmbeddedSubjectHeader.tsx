"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Subject } from "@/types/wanikani";
import { SubjectCharacter } from "./SubjectCharacter";
import styles from "../subjects.module.css";

type Placement = { top: number; left: number; width: number };

/** Keep the reference character outside disclosure clipping and nested scroll areas. */
export function EmbeddedSubjectHeader({ subject, meaning, detailsRef }: {
  subject: Subject;
  meaning: string;
  detailsRef: RefObject<HTMLDivElement | null>;
}) {
  const reducedMotion = useReducedMotion();
  const [placement, setPlacement] = useState<Placement | null>(null);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;
    const ancestors: HTMLElement[] = [];
    for (let parent = details.parentElement; parent; parent = parent.parentElement) ancestors.push(parent);
    const navigation = document.querySelector<HTMLElement>("[data-app-header]");
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = details.getBoundingClientRect();
      let top = Math.max(0, navigation?.getBoundingClientRect().bottom ?? 0);
      let bottom = window.innerHeight;
      const hidden = ancestors.some((parent) => parent.inert || parent.getAttribute("aria-hidden") === "true");
      for (const parent of ancestors) {
        if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) continue;
        const rect = parent.getBoundingClientRect();
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
      }
      const next = !hidden && bounds.width > 0 && bounds.top < top && Math.min(bounds.bottom, bottom) > top + 64
        ? { top, left: bounds.left, width: bounds.width } : null;
      setPlacement((previous) => previous?.top === next?.top && previous?.left === next?.left && previous?.width === next?.width ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(details);
    if (navigation) resize?.observe(navigation);
    // Disclosures stay mounted while closed; their inert state must hide the portal too.
    const visibility = new MutationObserver(schedule);
    for (const parent of ancestors) visibility.observe(parent, { attributes: true, attributeFilter: ["inert", "aria-hidden", "style", "class"] });
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      visibility.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [detailsRef, subject.id]);

  if (typeof document === "undefined") return null;
  const tone = subject.object === "radical" ? "radical" : subject.object === "kanji" ? "kanji" : "vocabulary";
  return createPortal(
    <AnimatePresence>
    {placement ? <motion.button key={subject.id} type="button" className={styles.embeddedSubjectHeader}
      initial={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : -4, transition: { duration: reducedMotion ? 0 : 0.12 } }}
      transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.2, 0, 0, 1] }}
      style={{ ...placement, "--subject-color": `var(--color-${tone})` } as CSSProperties}
      aria-label={`Back to ${meaning} details`}
      onClick={() => detailsRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}>
      <SubjectCharacter subject={subject} imageTone="subject" imageSize="2.5rem" className={styles.embeddedStickyCharacter} />
      <span>{meaning}</span>
    </motion.button> : null}
    </AnimatePresence>, document.body,
  );
}
