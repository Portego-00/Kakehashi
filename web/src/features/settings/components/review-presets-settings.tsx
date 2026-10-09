"use client";

import { useRef, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MAX_REVIEW_PRESETS, REVIEW_PRESET_NAME_MAX_LENGTH, normalizeReviewPresets, type ReviewPreset } from "../../../../../src/utils/review-presets";
import { REVIEW_ORDER_OPTIONS, getReviewOrderLabel, type ReviewOrderSetting } from "../../../../../src/utils/reviewOrdering";
import { REVIEW_BATCH_SIZE_VALUES } from "../settings";
import styles from "../settings.module.css";

export function ReviewPresetsSettings({ presets, onChange }: { presets: ReviewPreset[]; onChange: (presets: ReviewPreset[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [batchSize, setBatchSize] = useState(5);
  const [order, setOrder] = useState<ReviewOrderSetting>("random");
  const [error, setError] = useState("");
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const editorTrigger = useRef<HTMLButtonElement | null>(null);
  const atLimit = presets.length >= MAX_REVIEW_PRESETS;

  const openEditor = (preset?: ReviewPreset) => {
    if (!preset && atLimit) return;
    setId(preset?.id ?? null);
    setName(preset?.name ?? "");
    setBatchSize(preset?.batchSize ?? 5);
    setOrder(preset?.reviewOrder ?? "random");
    setError("");
    setEditing(true);
    requestAnimationFrame(() => editorHeading.current?.focus());
  };
  const closeEditor = () => {
    setEditing(false);
    requestAnimationFrame(() => editorTrigger.current?.focus());
  };
  const save = () => {
    if (!name.trim()) { setError("Enter a name for this preset."); return; }
    if (id && !presets.some((preset) => preset.id === id)) { setError("This preset was deleted. Cancel to add another."); return; }
    if (!id && atLimit) { setError("You can save up to 3 presets."); return; }
    const preset: ReviewPreset = { id: id ?? crypto.randomUUID(), name: name.trim(), batchSize, reviewOrder: order };
    onChange(normalizeReviewPresets(id ? presets.map((entry) => entry.id === id ? preset : entry) : [...presets, preset]));
    closeEditor();
  };

  return <div data-settings-search="" data-search-keywords="review presets batch size session order" className={styles.reviewPresets}>
    <div className={styles.reviewPresetList}>
      {presets.map((preset) => <button key={preset.id} type="button" className={styles.reviewPresetEntry} aria-label={`Edit ${preset.name} preset`} onClick={(event) => { editorTrigger.current = event.currentTarget; openEditor(preset); }}><span><strong>{preset.name}</strong><small>{preset.batchSize} reviews · {getReviewOrderLabel(preset.reviewOrder)}</small></span><ChevronRight size={17} aria-hidden /></button>)}
    </div>
    <Button type="button" size="small" disabled={atLimit} onClick={(event) => { editorTrigger.current = event.currentTarget; openEditor(); }}><Plus size={16} aria-hidden />Add Preset</Button>
    <p className={styles.reviewPresetLimit}>{presets.length} of {MAX_REVIEW_PRESETS} presets{atLimit ? " · limit reached" : ""}</p>
    {editing ? <form className={styles.reviewPresetEditor} onSubmit={(event) => { event.preventDefault(); save(); }}>
      <h3 ref={editorHeading} tabIndex={-1}>{id ? "Edit Preset" : "Add Preset"}</h3>
      <label>Preset name<input className={styles.textInput} aria-label="Preset name" value={name} maxLength={REVIEW_PRESET_NAME_MAX_LENGTH} onChange={(event) => { setName(event.target.value); setError(""); }} aria-invalid={Boolean(error)} /></label>
      <label>Batch size<select aria-label="Preset batch size" value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))}>{REVIEW_BATCH_SIZE_VALUES.map((value) => <option key={value} value={value}>{value} reviews</option>)}</select></label>
      <label>Review order<select aria-label="Preset review order" value={order} onChange={(event) => setOrder(event.target.value as ReviewOrderSetting)}>{REVIEW_ORDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      {error ? <p role="alert" className={styles.inlineError}>{error}</p> : null}
      <div className={styles.reviewPresetEditorActions}><Button type="submit" size="small">Save Preset</Button><Button type="button" size="small" tone="ghost" onClick={closeEditor}>Cancel</Button>{id ? <Button type="button" size="small" tone="danger" onClick={() => { onChange(presets.filter((preset) => preset.id !== id)); closeEditor(); }}>Delete Preset</Button> : null}</div>
    </form> : null}
  </div>;
}
