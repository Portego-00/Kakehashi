"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LocateFixed, Minus, Move, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { buildConstellationLayout, type ConstellationBounds, type ConstellationNodePosition } from "@/features/subjects/constellation-canvas-layout";
import { wkCollection, wkRequest } from "@/lib/wanikani/client";
import type { Subject } from "@/types/wanikani";
import styles from "../subjects.module.css";

const MIN_SCALE = 0.14;
const MAX_SCALE = 2.4;
const ZOOM_STEP = 1.18;

type ViewTransform = { x: number; y: number; scale: number };
type PanGesture = { kind: "pan"; startX: number; startY: number; transform: ViewTransform };
type PinchGesture = { kind: "pinch"; startDistance: number; startScale: number; worldX: number; worldY: number };
type CanvasGesture = PanGesture | PinchGesture;

const INITIAL_TRANSFORM: ViewTransform = { x: 0, y: 0, scale: 1 };

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function fittedTransform(bounds: ConstellationBounds, width: number, height: number): ViewTransform {
  const padding = Math.max(36, Math.min(104, Math.min(width, height) * 0.12));
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const naturalScale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
  const scale = Math.min(1, Math.max(MIN_SCALE, naturalScale));
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return { x: width / 2 - centerX * scale, y: height / 2 - centerY * scale, scale };
}

export function SubjectConstellation({ id }: { id: number }) {
  const center = useQuery({ queryKey: ["wanikani", "subject", id], queryFn: () => wkRequest<Subject>(`subjects/${id}`), staleTime: 24 * 60 * 60_000 });
  const relationIds = useMemo(() => Array.from(new Set([
    ...(center.data?.data.component_subject_ids ?? []),
    ...(center.data?.data.amalgamation_subject_ids ?? []),
  ])).slice(0, 160), [center.data]);
  const relations = useQuery({ queryKey: ["wanikani", "subjects", `constellation:${relationIds.join(",")}`], queryFn: () => wkCollection<Subject>(`subjects?ids=${relationIds.join(",")}`), enabled: relationIds.length > 0, staleTime: 24 * 60 * 60_000 });

  if (center.isLoading || relations.isLoading) return <main className={styles.constellationPage} data-constellation="active" aria-busy="true"><Skeleton className={styles.constellationSkeleton} height="100%" /></main>;
  if (!center.data || center.isError) return <main className={`page ${styles.page}`}><EmptyState title="Constellation unavailable" description="This subject could not be loaded." /></main>;

  return <ConstellationScene subject={center.data} relations={relations.data ?? []} />;
}

function ConstellationScene({ subject, relations }: { subject: Subject; relations: Subject[] }) {
  const router = useRouter();
  const viewportRef = useRef<HTMLElement>(null);
  const transformRef = useRef<ViewTransform>(INITIAL_TRANSFORM);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<CanvasGesture | null>(null);
  const draggedRef = useRef(false);
  const clearDragTimerRef = useRef<number | null>(null);
  const [transform, setTransform] = useState<ViewTransform>(INITIAL_TRANSFORM);
  const [dragging, setDragging] = useState(false);
  const layout = useMemo(() => buildConstellationLayout(subject, relations), [relations, subject]);
  const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.slug;
  const primaryReading = subject.data.readings?.find((reading) => reading.primary)?.reading ?? "";
  const instructionsId = `constellation-instructions-${subject.id}`;

  const commitTransform = useCallback((next: ViewTransform) => {
    const constrained = { ...next, scale: clampScale(next.scale) };
    transformRef.current = constrained;
    setTransform(constrained);
  }, []);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    commitTransform(fittedTransform(layout.bounds, rect.width, rect.height));
  }, [commitTransform, layout.bounds]);

  const zoomAt = useCallback((clientX: number, clientY: number, nextScale: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const current = transformRef.current;
    const scale = clampScale(nextScale);
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - current.x) / current.scale;
    const worldY = (localY - current.y) / current.scale;
    commitTransform({ x: localX - worldX * scale, y: localY - worldY * scale, scale });
  }, [commitTransform]);

  const zoomFromCenter = useCallback((factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, transformRef.current.scale * factor);
  }, [zoomAt]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const frame = window.requestAnimationFrame(fitToView);
    const observer = new ResizeObserver(() => fitToView());
    observer.observe(viewport);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [fitToView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const normalizedDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 18 : event.deltaY;
      zoomAt(event.clientX, event.clientY, transformRef.current.scale * Math.exp(-normalizedDelta * 0.0016));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => () => {
    if (clearDragTimerRef.current !== null) window.clearTimeout(clearDragTimerRef.current);
  }, []);

  const beginPinch = useCallback(() => {
    const viewport = viewportRef.current;
    const points = Array.from(pointersRef.current.values()).slice(0, 2);
    if (!viewport || points.length < 2) return;
    const [first, second] = points;
    const rect = viewport.getBoundingClientRect();
    const midpointX = (first.x + second.x) / 2 - rect.left;
    const midpointY = (first.y + second.y) / 2 - rect.top;
    const current = transformRef.current;
    gestureRef.current = {
      kind: "pinch",
      startDistance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      startScale: current.scale,
      worldX: (midpointX - current.x) / current.scale,
      worldY: (midpointY - current.y) / current.scale,
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.pointerType === "mouse" && event.button !== 0) || (event.target as Element).closest("[data-canvas-control]")) return;
    if (clearDragTimerRef.current !== null) window.clearTimeout(clearDragTimerRef.current);
    draggedRef.current = false;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointersRef.current.size > 1) beginPinch();
    else gestureRef.current = { kind: "pan", startX: event.clientX, startY: event.clientY, transform: transformRef.current };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size > 1) {
      if (gestureRef.current?.kind !== "pinch") beginPinch();
      const gesture = gestureRef.current;
      const viewport = viewportRef.current;
      const points = Array.from(pointersRef.current.values()).slice(0, 2);
      if (!viewport || gesture?.kind !== "pinch" || points.length < 2) return;
      const [first, second] = points;
      const rect = viewport.getBoundingClientRect();
      const midpointX = (first.x + second.x) / 2 - rect.left;
      const midpointY = (first.y + second.y) / 2 - rect.top;
      const scale = clampScale(gesture.startScale * (Math.hypot(second.x - first.x, second.y - first.y) / gesture.startDistance));
      commitTransform({ x: midpointX - gesture.worldX * scale, y: midpointY - gesture.worldY * scale, scale });
      draggedRef.current = true;
      return;
    }

    const gesture = gestureRef.current;
    if (gesture?.kind !== "pan") return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (Math.hypot(deltaX, deltaY) > 4) draggedRef.current = true;
    commitTransform({ x: gesture.transform.x + deltaX, y: gesture.transform.y + deltaY, scale: gesture.transform.scale });
  };

  const finishPointer = (event: ReactPointerEvent<HTMLElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const remaining = Array.from(pointersRef.current.values())[0];
    if (remaining) gestureRef.current = { kind: "pan", startX: remaining.x, startY: remaining.y, transform: transformRef.current };
    else {
      gestureRef.current = null;
      setDragging(false);
    }
    if (draggedRef.current) clearDragTimerRef.current = window.setTimeout(() => { draggedRef.current = false; }, 0);
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!draggedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    draggedRef.current = false;
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const current = transformRef.current;
    const panDistance = event.shiftKey ? 96 : 48;
    if (event.key === "ArrowLeft") commitTransform({ ...current, x: current.x + panDistance });
    else if (event.key === "ArrowRight") commitTransform({ ...current, x: current.x - panDistance });
    else if (event.key === "ArrowUp") commitTransform({ ...current, y: current.y + panDistance });
    else if (event.key === "ArrowDown") commitTransform({ ...current, y: current.y - panDistance });
    else if (event.key === "+" || event.key === "=") zoomFromCenter(ZOOM_STEP);
    else if (event.key === "-") zoomFromCenter(1 / ZOOM_STEP);
    else if (event.key === "0" || event.key === "Home") fitToView();
    else return;
    event.preventDefault();
  };

  const worldStyle = { transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})` } as CSSProperties;
  const connectionLayerStyle = {
    left: `${layout.bounds.minX}px`,
    top: `${layout.bounds.minY}px`,
  } as CSSProperties;
  const connectionViewBox = `${layout.bounds.minX} ${layout.bounds.minY} ${layout.bounds.width} ${layout.bounds.height}`;

  return <main className={styles.constellationPage} data-constellation="active">
    <p id={instructionsId} className="sr-only">Drag to move around. Scroll or pinch to zoom. Use the arrow keys to pan, plus and minus to zoom, and zero to fit the constellation.</p>

    <header className={styles.constellationHeader} data-canvas-control>
      <button type="button" aria-label={`Back to ${meaning}`} onClick={() => router.back()}><ArrowLeft size={22} aria-hidden /></button>
      <h1>Constellation</h1>
      <button type="button" aria-label="Close constellation" onClick={() => router.back()}><X size={22} aria-hidden /></button>
    </header>

    <section
      ref={viewportRef}
      className={styles.constellationCanvas}
      aria-label={`Relationship constellation for ${meaning}`}
      aria-describedby={instructionsId}
      data-dragging={dragging ? "true" : undefined}
      data-scale={transform.scale.toFixed(3)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
    >
      <div className={styles.constellationWorld} data-constellation-world style={worldStyle}>
        <svg
          className={styles.constellationLines}
          data-connection-layer
          style={connectionLayerStyle}
          width={layout.bounds.width}
          height={layout.bounds.height}
          viewBox={connectionViewBox}
          preserveAspectRatio="none"
          aria-hidden
        >
          {layout.connections.map((connection) => <line key={connection.key} x1={connection.x1} y1={connection.y1} x2={connection.x2} y2={connection.y2} data-kind={connection.kind} />)}
        </svg>
        {layout.anchors.map((anchor) => <span key={anchor.key} className={styles.constellationAnchor} style={{ left: `${anchor.x}px`, top: `${anchor.y}px` }} lang="ja">{anchor.reading}</span>)}
        {layout.nodes.map((node) => <ConstellationNode key={`${node.kind}-${node.subject.id}`} node={node} centerId={subject.id} />)}
      </div>

      <div className={styles.constellationHint} data-canvas-control><Move size={17} aria-hidden /><span>Drag to move · Scroll or pinch to zoom</span></div>
      <div className={styles.constellationControls} data-canvas-control onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" aria-label="Zoom out" onClick={() => zoomFromCenter(1 / ZOOM_STEP)}><Minus size={18} aria-hidden /></button>
        <output aria-label="Current zoom">{Math.round(transform.scale * 100)}%</output>
        <button type="button" aria-label="Zoom in" onClick={() => zoomFromCenter(ZOOM_STEP)}><Plus size={18} aria-hidden /></button>
        <button type="button" aria-label="Fit constellation" onClick={fitToView}><LocateFixed size={18} aria-hidden /></button>
      </div>
    </section>

    <footer className={styles.constellationFooter}><strong>{subject.object.replace("kana_vocabulary", "vocabulary").toLocaleUpperCase()} · {meaning}</strong>{primaryReading ? <span lang="ja">{primaryReading}</span> : null}</footer>
  </main>;
}

function ConstellationNode({ node, centerId }: { node: ConstellationNodePosition; centerId: number }) {
  const subject = node.subject;
  const tone = subject.object === "kana_vocabulary" ? "vocabulary" : subject.object;
  const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.slug;
  const reading = subject.data.readings?.find((item) => item.primary)?.reading;
  const content = <><strong lang={subject.data.characters ? "ja" : undefined}>{subject.data.characters ?? meaning}</strong>{(node.kind === "center" || tone === "vocabulary") && reading ? <small lang="ja">{reading}</small> : null}</>;
  const style = { left: `${node.x}px`, top: `${node.y}px` } as CSSProperties;

  if (node.subject.id === centerId) return <div className={styles.constellationNode} data-kind="center" data-type={tone} style={style} title={`${meaning}, current subject`}>{content}</div>;
  return <Link draggable={false} className={styles.constellationNode} data-kind={node.kind} data-type={tone} style={style} href={`/subjects/${subject.id}/constellation`} title={`${subject.data.characters ?? meaning}: ${meaning}`} onDragStart={(event) => event.preventDefault()}>{content}</Link>;
}
