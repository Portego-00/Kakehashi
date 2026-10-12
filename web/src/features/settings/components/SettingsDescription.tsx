"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";
import { Info } from "lucide-react";
import styles from "./SettingsDescription.module.css";

/** Keeps help searchable and available to assistive technology, without a paragraph in every row. */
export function SettingsDescription({ children, label, id }: { children: ReactNode; label?: string; id?: string }) {
  const generatedId = useId();
  const descriptionId = id ?? generatedId;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [inferredLabel, setInferredLabel] = useState("");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (hovered || focused || pinned);
  const { refs: floatingRefs, floatingStyles } = useFloating({
    open, placement: "top", middleware: [offset(8), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });
  const { setReference: positionReference, setFloating: positionTooltip } = floatingRefs;
  const setReference = useCallback((node: HTMLButtonElement | null) => { buttonRef.current = node; positionReference(node); }, [positionReference]);
  const setTooltip = useCallback((node: HTMLSpanElement | null) => { tooltipRef.current = node; positionTooltip(node); }, [positionTooltip]);
  useEffect(() => {
    if (label) return;
    const parent = buttonRef.current?.parentElement?.parentElement;
    setInferredLabel(parent?.querySelector("strong,h2,h3")?.textContent?.trim() ?? "this setting");
  }, [label]);
  useEffect(() => {
    if (!open) return;
    function key(event: KeyboardEvent) { if (event.key === "Escape") { setDismissed(true); setPinned(false); } }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !buttonRef.current?.contains(event.target) && !tooltipRef.current?.contains(event.target)) { setDismissed(true); setPinned(false); }
    }
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  return <span className={styles.inline}>
    <span id={descriptionId} data-settings-description className={styles.hidden}>{children}</span>
    <button type="button" data-settings-info ref={setReference} className={styles.button}
      aria-label={`About ${label ?? (inferredLabel || "this setting")}`} aria-describedby={descriptionId} aria-expanded={open}
      onMouseEnter={() => { setHovered(true); setDismissed(false); }} onMouseLeave={() => setHovered(false)}
      onFocus={() => { setFocused(true); setDismissed(false); }} onBlur={() => { setFocused(false); setPinned(false); }}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); setPinned(!pinned); setDismissed(pinned); }}>
      <Info size={16} aria-hidden />
    </button>
    {open ? createPortal(<span ref={setTooltip} style={floatingStyles} className={styles.tooltip} role="tooltip"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>{children}</span>, document.body) : null}
  </span>;
}
