"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { normalizeMangaOcrSelection, type MangaOcrSelection } from "./manga-ocr";
import styles from "./content.module.css";

interface Point {
  x: number;
  y: number;
}

interface TooltipPosition {
  left: number;
  placement: "above" | "below";
  top: number;
}

interface DraftSelection {
  selection: MangaOcrSelection;
  src: string;
}

export interface MangaPageSelectorTooltip {
  busy?: boolean;
  content: ReactNode;
  onDismiss?: () => void;
  selection: MangaOcrSelection;
  tone?: "default" | "error";
}

const MIN_SELECTION_SIZE = 0.01;
const KEYBOARD_SELECTION_SIZE = 0.5;
const KEYBOARD_SELECTION_STEP = 0.02;
const TOOLTIP_GAP_PX = 8;

function cropFromPoints(origin: Point, current: Point): MangaOcrSelection {
  const x = Math.min(origin.x, current.x);
  const y = Math.min(origin.y, current.y);
  return { x, y, width: Math.abs(origin.x - current.x), height: Math.abs(origin.y - current.y) };
}

function pointerPoint(event: ReactPointerEvent<HTMLDivElement>): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width))),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height))),
  };
}

function isCompleteSelection(selection: MangaOcrSelection) {
  return selection.width >= MIN_SELECTION_SIZE && selection.height >= MIN_SELECTION_SIZE;
}

function sameTooltipPosition(left: TooltipPosition | null, right: TooltipPosition | null) {
  if (!left || !right) return left === right;
  return left.left === right.left && left.top === right.top && left.placement === right.placement;
}

function placeTooltip(surface: DOMRect, tooltip: DOMRect, selection: MangaOcrSelection): TooltipPosition | null {
  if (!surface.width || !surface.height || !tooltip.width || !tooltip.height) return null;
  const centerX = (selection.x + selection.width / 2) * surface.width;
  const selectionTop = selection.y * surface.height;
  const selectionBottom = (selection.y + selection.height) * surface.height;
  const roomAbove = selectionTop;
  const roomBelow = surface.height - selectionBottom;
  const placement = roomBelow >= tooltip.height + TOOLTIP_GAP_PX || roomBelow >= roomAbove ? "below" : "above";
  const desiredTop = placement === "below"
    ? selectionBottom + TOOLTIP_GAP_PX
    : selectionTop - tooltip.height - TOOLTIP_GAP_PX;
  const maxLeft = Math.max(TOOLTIP_GAP_PX, surface.width - tooltip.width - TOOLTIP_GAP_PX);
  const maxTop = Math.max(TOOLTIP_GAP_PX, surface.height - tooltip.height - TOOLTIP_GAP_PX);
  return {
    left: Math.max(TOOLTIP_GAP_PX, Math.min(maxLeft, centerX - tooltip.width / 2)),
    placement,
    top: Math.max(TOOLTIP_GAP_PX, Math.min(maxTop, desiredTop)),
  };
}

export function MangaPageSelector({
  src,
  width,
  height,
  alt,
  onSelectionComplete,
  tooltip = null,
  disabled = false,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  onSelectionComplete: (selection: MangaOcrSelection) => void;
  tooltip?: MangaPageSelectorTooltip | null;
  disabled?: boolean;
}) {
  const instructionsId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hadDismissibleTooltip = useRef(false);
  const drag = useRef<{ pointerId: number; origin: Point; src: string } | null>(null);
  const [draft, setDraft] = useState<DraftSelection | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const selection = draft?.src === src ? draft.selection : null;
  const tooltipX = tooltip?.selection.x;
  const tooltipY = tooltip?.selection.y;
  const tooltipWidth = tooltip?.selection.width;
  const tooltipHeight = tooltip?.selection.height;
  const tooltipDismissible = Boolean(tooltip?.onDismiss);
  const tooltipSelection = useMemo(() => (
    tooltipX === undefined || tooltipY === undefined || tooltipWidth === undefined || tooltipHeight === undefined
      ? null
      : normalizeMangaOcrSelection({ x: tooltipX, y: tooltipY, width: tooltipWidth, height: tooltipHeight })
  ), [tooltipHeight, tooltipWidth, tooltipX, tooltipY]);

  function updateSelection(next: MangaOcrSelection | null) {
    setDraft(next ? { selection: next, src } : null);
  }

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const result = tooltipRef.current;
    if (!surface || !result || !tooltipSelection || selection) {
      setTooltipPosition(null);
      return;
    }

    function updatePosition() {
      if (!surface || !result || !tooltipSelection) return;
      const next = placeTooltip(surface.getBoundingClientRect(), result.getBoundingClientRect(), tooltipSelection);
      setTooltipPosition((current) => sameTooltipPosition(current, next) ? current : next);
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
    observer?.observe(surface);
    observer?.observe(result);
    return () => {
      window.removeEventListener("resize", updatePosition);
      observer?.disconnect();
    };
  }, [selection, tooltip?.content, tooltipSelection]);

  useEffect(() => {
    const wasDismissible = hadDismissibleTooltip.current;
    hadDismissibleTooltip.current = tooltipDismissible;
    if (tooltipDismissible && !wasDismissible) tooltipRef.current?.focus({ preventScroll: true });
    else if (!tooltipDismissible && wasDismissible) surfaceRef.current?.focus({ preventScroll: true });
  }, [tooltipDismissible]);

  function commitSelection(selectionToCommit: MangaOcrSelection) {
    if (disabled) return;
    const normalized = normalizeMangaOcrSelection(selectionToCommit);
    updateSelection(null);
    if (isCompleteSelection(normalized)) onSelectionComplete(normalized);
  }

  function startSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    const origin = pointerPoint(event);
    drag.current = { pointerId: event.pointerId, origin, src };
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSelection({ x: origin.x, y: origin.y, width: 0, height: 0 });
  }

  function moveSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    if (!drag.current || drag.current.pointerId !== event.pointerId || drag.current.src !== src) return;
    updateSelection(cropFromPoints(drag.current.origin, pointerPoint(event)));
  }

  function finishSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    if (!drag.current || drag.current.pointerId !== event.pointerId || drag.current.src !== src) return;
    const crop = cropFromPoints(drag.current.origin, pointerPoint(event));
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    commitSelection(crop);
  }

  function cancelSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId || drag.current.src !== src) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    updateSelection(null);
  }

  function handleKeyboardSelection(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.target !== event.currentTarget && event.key !== "Escape") return;
    if (event.key === "Escape" && selection) {
      event.preventDefault();
      event.stopPropagation();
      updateSelection(null);
      return;
    }
    if (event.key === "Escape" && tooltip?.onDismiss) {
      event.preventDefault();
      event.stopPropagation();
      tooltip.onDismiss();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (selection) commitSelection(selection);
      else updateSelection({ x: 0.25, y: 0.25, width: KEYBOARD_SELECTION_SIZE, height: KEYBOARD_SELECTION_SIZE });
      return;
    }
    if (!selection || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) {
      const selectionWidth = Math.max(KEYBOARD_SELECTION_STEP, Math.min(1 - selection.x, selection.width + (event.key === "ArrowRight" ? KEYBOARD_SELECTION_STEP : event.key === "ArrowLeft" ? -KEYBOARD_SELECTION_STEP : 0)));
      const selectionHeight = Math.max(KEYBOARD_SELECTION_STEP, Math.min(1 - selection.y, selection.height + (event.key === "ArrowDown" ? KEYBOARD_SELECTION_STEP : event.key === "ArrowUp" ? -KEYBOARD_SELECTION_STEP : 0)));
      updateSelection({ ...selection, width: selectionWidth, height: selectionHeight });
      return;
    }
    const x = Math.max(0, Math.min(1 - selection.width, selection.x + (event.key === "ArrowRight" ? KEYBOARD_SELECTION_STEP : event.key === "ArrowLeft" ? -KEYBOARD_SELECTION_STEP : 0)));
    const y = Math.max(0, Math.min(1 - selection.height, selection.y + (event.key === "ArrowDown" ? KEYBOARD_SELECTION_STEP : event.key === "ArrowUp" ? -KEYBOARD_SELECTION_STEP : 0)));
    updateSelection({ ...selection, x, y });
  }

  const selectionStyle = selection ? {
    left: `${selection.x * 100}%`,
    top: `${selection.y * 100}%`,
    width: `${selection.width * 100}%`,
    height: `${selection.height * 100}%`,
  } satisfies CSSProperties : undefined;
  const resultStyle = tooltipPosition ? {
    left: `${tooltipPosition.left}px`,
    top: `${tooltipPosition.top}px`,
  } satisfies CSSProperties : undefined;
  const pageSurfaceStyle = {
    "--manga-page-aspect": String(width / height),
  } as CSSProperties;

  return <div className={styles.mangaPageStage}>
    <div
      ref={surfaceRef}
      className={styles.mangaPageSurface}
      data-testid="manga-page-surface"
      style={pageSurfaceStyle}
      role="group"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={`Select text on ${alt}`}
      aria-describedby={instructionsId}
      aria-keyshortcuts="Enter Space ArrowLeft ArrowRight ArrowUp ArrowDown Escape"
      onPointerDown={startSelection}
      onPointerMove={moveSelection}
      onPointerUp={finishSelection}
      onPointerCancel={cancelSelection}
      onKeyDown={handleKeyboardSelection}
    >
      <span className="sr-only" id={instructionsId}>Press Enter or Space to create a crop. Use arrow keys to move it, Shift plus arrow keys to resize it, Enter or Space to recognize it, and Escape to cancel a crop or close the OCR result.</span>
      <Image
        className={styles.mangaPageImage}
        src={src}
        width={width}
        height={height}
        sizes="(max-width: 56rem) 100vw, 70vw"
        loading="eager"
        decoding="async"
        unoptimized
        draggable={false}
        alt={alt}
      />
      {selection ? <span className={styles.mangaSelection} style={selectionStyle} aria-hidden="true" /> : null}
      {!selection && tooltip ? <div
        ref={tooltipRef}
        className={styles.mangaSelectionTooltip}
        style={resultStyle}
        data-placement={tooltipPosition?.placement}
        data-tone={tooltip.tone ?? "default"}
        data-dismissible={tooltip.onDismiss ? "true" : undefined}
        role={tooltip.onDismiss ? "dialog" : "status"}
        aria-label={tooltip.onDismiss ? "OCR result" : undefined}
        aria-live={tooltip.onDismiss ? undefined : "polite"}
        aria-atomic="true"
        aria-busy={tooltip.busy || undefined}
        tabIndex={tooltip.onDismiss ? -1 : undefined}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {tooltip.onDismiss ? <button
          className={styles.mangaSelectionTooltipDismiss}
          type="button"
          aria-label="Close OCR result"
          onClick={tooltip.onDismiss}
        >
          <X size={17} aria-hidden="true" />
        </button> : null}
        {tooltip.content}
      </div> : null}
    </div>
  </div>;
}
