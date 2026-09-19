"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Expand, X, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { AnalyticsCardLayout } from "../analytics-layout";
import styles from "../analytics.module.css";
import panelStyles from "../analytics-panel.module.css";

export function AnalyticsPanel({ card, title, icon: Icon, expanded, onExpand, onClose, children }: { card: AnalyticsCardLayout; title: string; icon: LucideIcon; expanded: boolean; onExpand: () => void; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const [collapsedHeight, setCollapsedHeight] = useState<number | undefined>();
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (expanded) {
      const overflow = document.body.style.overflow;
      const gutter = document.documentElement.style.scrollbarGutter;
      const scroll = { left: window.scrollX, top: window.scrollY };
      document.documentElement.style.scrollbarGutter = "stable";
      document.body.style.overflow = "hidden";
      dialog.close?.();
      dialog.showModal?.();
      wasExpanded.current = true;
      return () => {
        document.body.style.overflow = overflow;
        document.documentElement.style.scrollbarGutter = gutter;
        dialog.close?.();
        dialog.setAttribute("open", "");
        window.scrollTo(scroll);
      };
    }
    if (wasExpanded.current) {
      dialog.close?.();
      dialog.setAttribute("open", "");
      wasExpanded.current = false;
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [expanded]);

  const expand = () => { setCollapsedHeight(sectionRef.current?.getBoundingClientRect().height); onExpand(); };
  return <motion.section ref={sectionRef} style={expanded ? { minHeight: collapsedHeight } : undefined} layout={reduced ? false : "position"} initial={false} transition={{ duration: reduced ? 0 : 0.22, ease: [0.2, 0, 0, 1] }} className={styles.widget} data-size={card.size} data-widget={card.id} data-expanded={expanded || undefined}>
    <dialog open ref={dialogRef} className={expanded ? styles.dialog : styles.inlineDialog} role={expanded ? "dialog" : "region"} aria-modal={expanded || undefined} aria-labelledby={`widget-${card.id}`} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }} onClick={(event) => { if (expanded && event.target === event.currentTarget) onClose(); }}>
      <div className={expanded ? styles.dialogSheet : panelStyles.inlineSheet}>
        <header className={expanded ? styles.dialogHead : styles.widgetHead}><div className={styles.widgetTitle}><Icon size={18} aria-hidden /><h2 id={`widget-${card.id}`}>{title}</h2></div><button ref={buttonRef} type="button" className={styles.iconButton} aria-label={`${expanded ? "Close" : "Expand"} ${title}`} title={`${expanded ? "Close" : "Expand"} ${title}`} onClick={expanded ? onClose : expand}>{expanded ? <X size={18} /> : <Expand size={16} />}</button></header>
        <div data-analytics-body data-expanded={expanded || undefined} className={`${expanded ? styles.dialogBody : styles.widgetBody} ${panelStyles.body}`}>{children}</div>
      </div>
    </dialog>
  </motion.section>;
}
