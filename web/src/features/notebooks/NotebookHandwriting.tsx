"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Expand, X } from "lucide-react";
import type { NotebookInkFormat, NotebookPreviewFormat } from "./handwriting";
import { isNotebookPaperColor, resolveNotebookPaperColor, type NotebookPaperColor } from "./paper-appearance";
import styles from "./handwriting.module.css";

export interface NotebookHandwritingProps {
  drawingId: string;
  width: number;
  height: number;
  inkFormat?: NotebookInkFormat;
  previewFormat?: NotebookPreviewFormat | "";
  paperColor?: string;
  onPaperColorChange?: (color: NotebookPaperColor) => void;
}

function observeTheme(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
  return () => observer.disconnect();
}
function themeSurface() {
  const element = document.documentElement;
  return getComputedStyle(element).getPropertyValue("--color-surface").trim() || (element.dataset.theme === "dark" || element.dataset.theme === "midnight" ? "#1e1e1e" : "#ffffff");
}
function usePaper(props: NotebookHandwritingProps) {
  const background = useSyncExternalStore(observeTheme, themeSurface, () => "#ffffff");
  const paper = resolveNotebookPaperColor(props.paperColor, background);
  const themed = props.previewFormat === "themed-v1" || !props.drawingId;
  const appearance = themed ? paper.appearance : "light";
  return { appearance, foreground: appearance === "dark" ? "#f5f5f5" : "#171717", background: themed ? isNotebookPaperColor(props.paperColor) && props.paperColor !== "auto" ? props.paperColor : "var(--color-surface)" : "#ffffff" };
}

export default function NotebookHandwriting(props: NotebookHandwritingProps) {
  const paper = usePaper(props);
  if (props.drawingId === "" && props.inkFormat === "strokes-v1") {
    return <div className={styles.block} contentEditable={false}>
      <div className={styles.frame} style={{ aspectRatio: `${props.width} / ${props.height}`, background: paper.background, color: paper.foreground }} aria-label="Empty handwriting area">
        <div className={styles.state}>Write in this area on your iPad.</div>
      </div>
      <PaperColorControls {...props} />
    </div>;
  }
  // A replacement drawing is a new immutable asset; never show the previous
  // drawing while its replacement is loading.
  return <HandwritingPreview key={props.drawingId} {...props} />;
}

function HandwritingPreview(props: NotebookHandwritingProps) {
  const [expanded, setExpanded] = useState(false);
  return <div className={styles.block} contentEditable={false}>
    <HandwritingImage {...props} onExpand={() => setExpanded(true)} expanded={expanded} />
    <PaperColorControls {...props} />
    {expanded ? createPortal(<HandwritingDialog {...props} onClose={() => setExpanded(false)} />, document.body) : null}
  </div>;
}

function PaperColorControls({ paperColor, drawingId, previewFormat, onPaperColorChange }: NotebookHandwritingProps) {
  const id = useId();
  if (!onPaperColorChange || drawingId && previewFormat !== "themed-v1") return null;
  const choice = isNotebookPaperColor(paperColor) ? paperColor : "auto";
  const preset = ["auto", "#ffffff", "#fff8e7", "#202020"].includes(choice) ? choice : "custom";
  return <div className={styles.paperControls} contentEditable={false}>
    <label htmlFor={`${id}-preset`}>Paper</label>
    <select id={`${id}-preset`} aria-label="Paper color" value={preset} onChange={(event) => { if (isNotebookPaperColor(event.target.value)) onPaperColorChange(event.target.value); }}>
      <option value="auto">Automatic</option><option value="#ffffff">White</option><option value="#fff8e7">Cream</option><option value="#202020">Dark</option>{preset === "custom" ? <option value="custom" disabled>Custom</option> : null}
    </select>
    <input type="color" aria-label="Custom paper color" value={choice === "auto" ? "#ffffff" : choice} onInput={(event) => { if (isNotebookPaperColor(event.currentTarget.value)) onPaperColorChange(event.currentTarget.value); }} />
  </div>;
}

function HandwritingImage(props: NotebookHandwritingProps & { onExpand?: () => void; expanded?: boolean }) {
  const { drawingId, width, height, onExpand, expanded } = props;
  const paper = usePaper(props);
  // Each variant has its own readiness state; a theme switch never exposes an
  // old dark-ink image on dark paper while its replacement is loading.
  return <HandwritingImageVariant key={`${drawingId}:${paper.appearance}`} {...props} appearance={paper.appearance} background={paper.background} foreground={paper.foreground} onExpand={onExpand} expanded={expanded} width={width} height={height} />;
}

function HandwritingImageVariant({ drawingId, width, height, previewFormat, appearance, background, foreground, onExpand, expanded }: NotebookHandwritingProps & { appearance: string; background: string; foreground: string; onExpand?: () => void; expanded?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(drawingId ? "loading" : "error");
  const query = new URLSearchParams();
  if (previewFormat === "themed-v1") query.set("appearance", appearance);
  if (attempt) query.set("retry", String(attempt));
  const src = drawingId ? `/api/notebooks/drawings/${encodeURIComponent(drawingId)}/preview${query.size ? `?${query}` : ""}` : "";
  const image = src ? <Image
    key={src}
    src={src}
    alt="Handwritten notebook page"
    width={width}
    height={height}
    // The browser must send its session cookie directly to this private route.
    unoptimized
    className={styles.image}
    data-ready={status === "ready"}
    onLoad={() => setStatus("ready")}
    onError={() => setStatus("error")}
  /> : null;

  return <div className={styles.frame} style={{ aspectRatio: `${width} / ${height}`, background, color: foreground }} aria-busy={status === "loading"}>
    {onExpand ? <button
      type="button"
      className={styles.openButton}
      aria-label="Expand handwriting"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      disabled={status !== "ready"}
      onClick={onExpand}
    >{image}{status === "ready" ? <span className={styles.expandHint}><Expand size={15} aria-hidden /> Expand</span> : null}</button> : image}
    {status === "loading" ? <div className={styles.state} role="status">Loading handwriting…</div> : null}
    {status === "error" ? <div className={styles.state}>
      <p role="alert">This handwriting couldn’t be loaded.</p>
      {drawingId ? <button className={styles.retryButton} type="button" onClick={() => { setStatus("loading"); setAttempt((current) => current + 1); }}>Retry handwriting</button> : null}
    </div> : null}
  </div>;
}

function HandwritingDialog({ onClose, ...props }: NotebookHandwritingProps & { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      // React can remove the dialog before the browser restores modal focus.
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={(event) => event.stopPropagation()}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <header className={styles.dialogHeader}>
      <h2 id={titleId}>Handwriting</h2>
      <button type="button" className={styles.closeButton} aria-label="Close handwriting" onClick={onClose}><X size={20} aria-hidden /></button>
    </header>
    <div className={styles.dialogBody}><HandwritingImage {...props} /></div>
  </dialog>;
}
