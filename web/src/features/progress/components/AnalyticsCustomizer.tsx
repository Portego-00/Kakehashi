"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Columns2, GripVertical, RectangleHorizontal, RotateCcw, X } from "lucide-react";
import { MotionConfig, Reorder, motion, useDragControls, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import {
  ANALYTICS_PRESETS,
  ANALYTICS_WIDGET_CATALOG,
  createAnalyticsPreset,
  matchingAnalyticsPreset,
  moveAnalyticsCardBy,
  normalizeAnalyticsDashboardConfig,
  type AnalyticsCardId,
  type AnalyticsCardLayout,
  type AnalyticsCardSize,
  type AnalyticsDashboardConfig,
  type AnalyticsWidgetDefinition,
} from "../analytics-layout";
import styles from "../analytics-customizer.module.css";

export type AnalyticsCustomizerProps = {
  open: boolean;
  config: AnalyticsDashboardConfig;
  onApply: (config: AnalyticsDashboardConfig) => void;
  onClose: () => void;
};

export function AnalyticsCustomizer({ open, config, onApply, onClose }: AnalyticsCustomizerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      previouslyFocused?.focus();
    };
  }, [open]);

  return <dialog
    ref={dialogRef}
    className={styles.dialog}
    aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={(event) => event.stopPropagation()}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    {open ? <AnalyticsLayoutEditor config={config} onApply={onApply} onClose={onClose} titleId={titleId} /> : null}
  </dialog>;
}

function AnalyticsLayoutEditor({ config, onApply, onClose, titleId }: Omit<AnalyticsCustomizerProps, "open"> & { titleId: string }) {
  const [draft, setDraft] = useState(() => normalizeAnalyticsDashboardConfig(config));
  const [announcement, setAnnouncement] = useState("");
  const hiddenSizes = useRef(new Map<AnalyticsCardId, AnalyticsCardSize>());
  const editorRef = useRef<HTMLDivElement>(null);
  const presetName = useId();
  const visibleIds = new Set(draft.cards.map((card) => card.id));
  const hiddenWidgets = ANALYTICS_WIDGET_CATALOG.filter((widget) => !visibleIds.has(widget.id));
  const activePreset = matchingAnalyticsPreset(draft);

  function changeVisibility(widget: AnalyticsWidgetDefinition, visible: boolean) {
    setDraft((current) => {
      if (visible) {
        if (current.cards.some((card) => card.id === widget.id)) return current;
        return { version: 2, cards: [...current.cards, { id: widget.id, size: hiddenSizes.current.get(widget.id) ?? widget.defaultSize }] };
      }
      const previous = current.cards.find((card) => card.id === widget.id);
      if (previous) hiddenSizes.current.set(widget.id, previous.size);
      return { version: 2, cards: current.cards.filter((card) => card.id !== widget.id) };
    });
    setAnnouncement(`${widget.title} ${visible ? "added" : "hidden"}.`);
    requestAnimationFrame(() => {
      editorRef.current?.querySelector<HTMLInputElement>(`[data-widget-toggle="${widget.id}"]`)?.focus({ preventScroll: true });
    });
  }

  function moveCard(id: AnalyticsCardId, offset: -1 | 1) {
    const cards = moveAnalyticsCardBy(draft.cards, id, offset);
    setDraft({ version: 2, cards });
    const title = ANALYTICS_WIDGET_CATALOG.find((widget) => widget.id === id)!.title;
    setAnnouncement(`${title} moved to position ${cards.findIndex((card) => card.id === id) + 1} of ${cards.length}.`);
  }

  function resizeCard(id: AnalyticsCardId, size: AnalyticsCardSize) {
    setDraft((current) => ({ version: 2, cards: current.cards.map((card) => card.id === id ? { ...card, size } : card) }));
  }

  return <MotionConfig reducedMotion="user">
    <div className={styles.editor} ref={editorRef}>
      <header className={styles.header}>
        <h2 id={titleId}>Customize analytics</h2>
        <button type="button" className={styles.iconButton} aria-label="Close customization" title="Close customization" onClick={onClose}><X size={19} aria-hidden /></button>
      </header>

      <fieldset className={styles.presets}>
        <legend>Layout preset</legend>
        <div className={styles.presetOptions}>
          {ANALYTICS_PRESETS.map((preset) => <label key={preset.id} className={styles.presetOption} data-selected={activePreset === preset.id || undefined}>
            <input type="radio" name={presetName} checked={activePreset === preset.id} onChange={() => {
              setDraft(createAnalyticsPreset(preset.id));
              setAnnouncement(`${preset.title} preset selected.`);
            }} />
            <span>{preset.title}</span>
          </label>)}
        </div>
      </fieldset>

      <motion.div className={styles.scrollArea} layoutScroll>
        <section aria-labelledby={`${titleId}-visible`}>
          <div className={styles.sectionHeading}><h3 id={`${titleId}-visible`}>On your dashboard</h3><span>{draft.cards.length}</span></div>
          <Reorder.Group
            as="ol"
            axis="y"
            className={styles.widgetList}
            values={draft.cards.map((card) => card.id)}
            aria-label="Dashboard widget order"
            layoutScroll
            onReorder={(ids: AnalyticsCardId[]) => {
              const cardsById = new Map(draft.cards.map((card) => [card.id, card]));
              setDraft({ version: 2, cards: ids.map((id) => cardsById.get(id)!) });
            }}
          >
            {draft.cards.map((card, index) => <EditableWidget
              key={card.id}
              card={card}
              index={index}
              total={draft.cards.length}
              widget={ANALYTICS_WIDGET_CATALOG.find((widget) => widget.id === card.id)!}
              onHide={(widget) => changeVisibility(widget, false)}
              onMove={(offset) => moveCard(card.id, offset)}
              onResize={(size) => resizeCard(card.id, size)}
              onDragEnd={() => {
                const title = ANALYTICS_WIDGET_CATALOG.find((widget) => widget.id === card.id)!.title;
                setAnnouncement(`${title} moved to position ${draft.cards.findIndex((entry) => entry.id === card.id) + 1} of ${draft.cards.length}.`);
              }}
            />)}
          </Reorder.Group>
          {draft.cards.length === 0 ? <p className={styles.empty}>Select at least one widget.</p> : null}
        </section>

        {hiddenWidgets.length > 0 ? <section aria-labelledby={`${titleId}-available`} className={styles.available}>
          <div className={styles.sectionHeading}><h3 id={`${titleId}-available`}>Available widgets</h3><span>{hiddenWidgets.length}</span></div>
          <ul className={styles.availableList}>
            {hiddenWidgets.map((widget) => <li key={widget.id}>
              <label className={styles.availableWidget}>
                <input type="checkbox" checked={false} data-widget-toggle={widget.id} onChange={() => changeVisibility(widget, true)} aria-label={`Show ${widget.title}`} />
                <span className={styles.widgetLabel}><strong>{widget.title}</strong><span>{widget.detail}</span></span>
              </label>
            </li>)}
          </ul>
        </section> : null}
      </motion.div>

      <footer className={styles.footer}>
        <Button type="button" tone="ghost" className={styles.restoreButton} aria-label="Restore defaults" title="Restore defaults" onClick={() => { setDraft(createAnalyticsPreset("overview")); setAnnouncement("Default layout restored in your draft."); }}><RotateCcw size={16} aria-hidden /><span className={styles.restoreLabel}>Restore defaults</span></Button>
        <div className={styles.actions}>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="button" tone="primary" disabled={draft.cards.length === 0} onClick={() => { onApply(normalizeAnalyticsDashboardConfig(draft)); onClose(); }}><Check size={16} aria-hidden />Apply</Button>
        </div>
      </footer>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </div>
  </MotionConfig>;
}

function EditableWidget({ card, index, total, widget, onHide, onMove, onResize, onDragEnd }: {
  card: AnalyticsCardLayout;
  index: number;
  total: number;
  widget: AnalyticsWidgetDefinition;
  onHide: (widget: AnalyticsWidgetDefinition) => void;
  onMove: (offset: -1 | 1) => void;
  onResize: (size: AnalyticsCardSize) => void;
  onDragEnd: () => void;
}) {
  const dragControls = useDragControls();
  const reducedMotion = useReducedMotion();
  const [dragging, setDragging] = useState(false);

  return <Reorder.Item
    as="li"
    value={card.id}
    className={styles.widgetRow}
    data-dragging={dragging || undefined}
    dragListener={false}
    dragControls={dragControls}
    dragMomentum={false}
    layout="position"
    initial={false}
    transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
    onDragStart={() => setDragging(true)}
    onDragEnd={() => { setDragging(false); onDragEnd(); }}
  >
    <button
      type="button"
      className={`${styles.iconButton} ${styles.dragHandle}`}
      title={`Reorder ${widget.title}`}
      aria-label={`Reorder ${widget.title}`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      disabled={total < 2}
      onPointerDown={(event) => { event.preventDefault(); dragControls.start(event); }}
      onKeyDown={(event) => {
        if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
        event.preventDefault();
        onMove(event.key === "ArrowUp" ? -1 : 1);
      }}
    ><GripVertical size={17} aria-hidden /></button>

    <label className={styles.visibleWidget}>
      <input type="checkbox" checked data-widget-toggle={widget.id} onChange={() => onHide(widget)} aria-label={`Show ${widget.title}`} />
      <span className={styles.widgetLabel}><strong>{widget.title}</strong><span>{widget.category}</span></span>
    </label>

    <div className={styles.rowControls}>
      <div className={styles.widthOptions} role="group" aria-label={`${widget.title} width`}>
        <button type="button" className={styles.iconButton} aria-pressed={card.size === "compact"} aria-label={`Compact ${widget.title}`} title="Compact width" onClick={() => onResize("compact")}><Columns2 size={17} aria-hidden /></button>
        <button type="button" className={styles.iconButton} aria-pressed={card.size === "wide"} aria-label={`Wide ${widget.title}`} title="Full width" onClick={() => onResize("wide")}><RectangleHorizontal size={17} aria-hidden /></button>
      </div>
      <div className={styles.moveOptions}>
        <button type="button" className={styles.iconButton} disabled={index === 0} aria-label={`Move ${widget.title} earlier`} title="Move earlier" onClick={() => onMove(-1)}><ArrowUp size={17} aria-hidden /></button>
        <button type="button" className={styles.iconButton} disabled={index === total - 1} aria-label={`Move ${widget.title} later`} title="Move later" onClick={() => onMove(1)}><ArrowDown size={17} aria-hidden /></button>
      </div>
    </div>
  </Reorder.Item>;
}
