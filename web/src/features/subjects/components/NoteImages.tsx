"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { normalizeNoteImageUrl } from "../../../../../shared/note-images";
import { isStudyMaterialPermissionError, STUDY_MATERIAL_PERMISSION_SUMMARY } from "../../../../../shared/study-material-permissions";
import { containNoteImageTransform, INITIAL_NOTE_IMAGE_TRANSFORM, noteImageTouchGeometry, pinchNoteImage, type NoteImageTransform } from "../../../../../shared/note-image-gestures";
import styles from "../note-images.module.css";

// User-provided URLs are loaded directly, without a server-side image proxy.
/* eslint-disable @next/next/no-img-element */
function Preview({ url, onReady }: { url: string; onReady?: (ready: boolean) => void }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    if (status !== "loading" || !onReady) return;
    const timer = setTimeout(() => { setStatus("error"); onReady?.(false); }, 15000);
    return () => clearTimeout(timer);
  }, [status, onReady]);
  return <div className={styles.preview} data-status={status}>
    <img src={url} alt="Note image" loading={onReady ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer"
      onLoad={() => { setStatus("ready"); onReady?.(true); }}
      onError={() => { setStatus("error"); onReady?.(false); }} />
    {status === "loading" ? <span role="status">Loading image…</span> : null}
    {status === "error" ? <span>Image unavailable. Check the link or try again later.</span> : null}
  </div>;
}

export function NoteImageComposer({ onAdd, onCancel, disabled }: { onAdd: (url: string) => void; onCancel: () => void; disabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const id = useId();
  const validUrl = normalizeNoteImageUrl(draft);
  useEffect(() => {
    const timer = setTimeout(() => setPreview(normalizeNoteImageUrl(draft)), 400);
    return () => clearTimeout(timer);
  }, [draft]);
  return <div className={styles.composer}>
    <Field id={id} label="Image URL" value={draft} autoFocus type="url" autoComplete="off" disabled={disabled}
      placeholder="https://example.com/image.jpg" helper="Paste a direct link to a publicly accessible image."
      error={draft.trim() && !validUrl ? "Use a complete http:// or https:// image URL." : undefined}
      onChange={(event) => { setDraft(event.target.value); setReady(false); setPreview(null); }} onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (ready && preview === validUrl && preview) onAdd(preview);
        }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); }
      }} />
    {preview ? <Preview key={preview} url={preview} onReady={setReady} /> : null}
    <div className={styles.actions}>
      <Button type="button" tone="ghost" onClick={onCancel} disabled={disabled}>Cancel image</Button>
      <Button type="button" onClick={() => { if (ready && preview && preview === validUrl) onAdd(preview); }} disabled={disabled || !ready || preview !== validUrl}><ImagePlus size={16} aria-hidden />Add to note</Button>
    </div>
    <p className={styles.saveHint}>Then choose Save note to save your text and images together.</p>
  </div>;
}

export function NoteImageGallery({ images, onRemove, disabled }: {
  images: string[]; onRemove?: (index: number) => void | Promise<unknown>; disabled?: boolean;
}) {
  const [opened, setOpened] = useState<number | null>(null);
  if (!images.length) return null;
  return <>
    <div className={styles.gallery}>
      {images.map((url, index) => <div key={`${index}:${url}`} className={styles.thumbnail}>
        <button type="button" className={styles.openImage} aria-label={`Open note image ${index + 1}`} onClick={() => setOpened(index)}><Preview url={url} /></button>
      </div>)}
    </div>
    {opened !== null && images[opened] ? <ImageViewer key={images[opened]} url={images[opened]} onClose={() => setOpened(null)}
      onRemove={onRemove && !disabled ? async () => { await onRemove(opened); setOpened(null); } : undefined} /> : null}
  </>;
}

function ImageViewer({ url, onClose, onRemove }: { url: string; onClose: () => void; onRemove?: () => Promise<void> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const gestureHintId = useId();
  const [transform, setTransform] = useState(INITIAL_NOTE_IMAGE_TRANSFORM);
  const transformRef = useRef(INITIAL_NOTE_IMAGE_TRANSFORM);
  const zoom = transform.scale;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [imageAttempt, setImageAttempt] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ transform: INITIAL_NOTE_IMAGE_TRANSFORM, touches: noteImageTouchGeometry([]) });
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const apply = useCallback((value: NoteImageTransform) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const next = containNoteImageTransform(value, { width: viewport.clientWidth, height: viewport.clientHeight, imageWidth: imageRef.current?.naturalWidth ?? 0, imageHeight: imageRef.current?.naturalHeight ?? 0 });
    transformRef.current = next;
    setTransform(next);
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => { if (dialog.open && typeof dialog.close === "function") dialog.close(); };
  }, []);
  useEffect(() => {
    if (imageStatus !== "loading") return;
    const timer = setTimeout(() => setImageStatus("error"), 15000);
    return () => clearTimeout(timer);
  }, [imageStatus, imageAttempt]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      // Trackpads emit Ctrl+wheel for a pinch. Keep it inside the image viewer.
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      apply(pinchNoteImage(transformRef.current, transformRef.current.scale * Math.exp(-event.deltaY * 0.01), { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }));
    };
    const resize = () => apply(transformRef.current);
    viewport.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("resize", resize);
    return () => { viewport.removeEventListener("wheel", wheel); window.removeEventListener("resize", resize); };
  }, [apply]);
  const startGesture = () => {
    gesture.current = { transform: { ...transformRef.current }, touches: noteImageTouchGeometry([...pointers.current.values()]) };
  };
  const moveGesture = () => {
    const touches = noteImageTouchGeometry([...pointers.current.values()]);
    if (touches.count !== gesture.current.touches.count) { startGesture(); return; }
    const movement = { x: touches.x - gesture.current.touches.x, y: touches.y - gesture.current.touches.y };
    if (touches.count === 2 && gesture.current.touches.distance > 0) {
      const rect = viewportRef.current!.getBoundingClientRect();
      const anchor = { x: gesture.current.touches.x - rect.left - rect.width / 2, y: gesture.current.touches.y - rect.top - rect.height / 2 };
      apply(pinchNoteImage(gesture.current.transform, gesture.current.transform.scale * touches.distance / gesture.current.touches.distance, anchor, movement));
    } else if (touches.count === 1) {
      apply({ ...gesture.current.transform, x: gesture.current.transform.x + movement.x, y: gesture.current.transform.y + movement.y });
    }
  };
  const trackTouches = (touches: ArrayLike<{ identifier: number; clientX: number; clientY: number }>) => {
    pointers.current.clear();
    Array.from(touches).forEach((touch) => pointers.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY }));
  };
  return <dialog ref={dialogRef} className={styles.viewer} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!saving) onClose(); }}
    onClose={(event) => event.stopPropagation()}
    onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <div className={styles.viewerContent}>
      <div className={styles.toolbar}><h2 id={titleId}>Note image</h2><Button type="button" tone="ghost" aria-label="Close image" onClick={onClose} disabled={saving}><X size={20} aria-hidden /></Button></div>
      <div ref={viewportRef} className={styles.viewport} data-note-image-viewport role="group" aria-label="Image zoom and pan" tabIndex={0}
        aria-describedby={gestureHintId} aria-keyshortcuts="+ - 0 ArrowLeft ArrowRight ArrowUp ArrowDown"
        style={{ cursor: zoom > 1 ? "grab" : "zoom-in" }}
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          apply(pinchNoteImage(transformRef.current, zoom > 1 ? 1 : 2, { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }));
        }}
        onKeyDown={(event) => {
          if (["+", "=", "-", "0"].includes(event.key)) {
            event.preventDefault();
            apply(pinchNoteImage(transformRef.current, event.key === "0" ? 1 : transformRef.current.scale + (event.key === "-" ? -0.5 : 0.5), { x: 0, y: 0 }));
          } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            apply({ ...transformRef.current, x: transformRef.current.x + (event.key === "ArrowLeft" ? 40 : event.key === "ArrowRight" ? -40 : 0), y: transformRef.current.y + (event.key === "ArrowUp" ? 40 : event.key === "ArrowDown" ? -40 : 0) });
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); startGesture();
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "touch") return;
          if (!pointers.current.has(event.pointerId)) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          moveGesture();
        }}
        onPointerUp={(event) => { if (event.pointerType !== "touch") { pointers.current.delete(event.pointerId); startGesture(); } }}
        onPointerCancel={(event) => { if (event.pointerType !== "touch") { pointers.current.delete(event.pointerId); startGesture(); } }}
        onLostPointerCapture={(event) => { if (event.pointerType !== "touch" && pointers.current.delete(event.pointerId)) startGesture(); }}
        onTouchStart={(event) => { trackTouches(event.touches); startGesture(); }}
        onTouchMove={(event) => { trackTouches(event.touches); moveGesture(); }}
        onTouchEnd={(event) => { trackTouches(event.touches); startGesture(); }}
        onTouchCancel={(event) => { trackTouches(event.touches); startGesture(); }}>
        <img key={imageAttempt} ref={imageRef} src={url} alt="Expanded note image" draggable={false} referrerPolicy="no-referrer"
          onLoad={() => { setImageStatus("ready"); apply(transformRef.current); }} onError={() => setImageStatus("error")}
          style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${zoom})` }} />
        {imageStatus !== "ready" ? <div className={styles.imageStatus} onPointerDown={(event) => event.stopPropagation()}>
          {imageStatus === "loading" ? <span>Loading image…</span> : <><p role="alert">Image unavailable.</p><Button type="button" onClick={() => { setImageAttempt((attempt) => attempt + 1); setImageStatus("loading"); }}>Try again</Button></>}
        </div> : null}
      </div>
      {error ? <p role="alert" className={styles.viewerError}>{error}</p> : null}
      <div className={styles.toolbar}>
        <div className={styles.zoomHint}>
          <span id={gestureHintId}>Pinch to zoom · Drag to move</span>
          <output aria-label="Image zoom">{Math.round(zoom * 100)}%</output>
        </div>
        {onRemove ? <Button type="button" tone="danger" state={saving ? "loading" : "idle"} onClick={async () => {
          setSaving(true); setError("");
          try { await onRemove(); } catch (error) { setError(isStudyMaterialPermissionError(error) ? STUDY_MATERIAL_PERMISSION_SUMMARY : "The image wasn’t removed. Check your connection and try again."); setSaving(false); }
        }}><Trash2 size={16} aria-hidden />Remove image</Button> : null}
      </div>
    </div>
  </dialog>;
}
