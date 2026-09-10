import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Hand, Maximize2, Minimize2, Pencil, Redo2, SlidersHorizontal, Undo2 } from "lucide-react";
import { isNotebookPaperColor, resolveNotebookPaperColor, type NotebookPaperAppearance, type NotebookPaperColor } from "../../../web/src/features/notebooks/paper-appearance";
import type { NotebookInkFormat } from "../../../web/src/features/notebooks/handwriting";
import type { NativeInkGeometry, NativeInkRect, NativeInlineHandwritingProps } from "./native-inline-contract";
import { HandwritingResizeFrame, type HandwritingPaperSize } from "./handwriting-resize-frame";

interface Props extends NativeInlineHandwritingProps {
  blockId: string; drawingId: string; inkFormat: NotebookInkFormat; width: number; height: number;
  paperColor?: string; previewFormat?: string; theme: "light" | "dark"; themeBackground?: string;
  loadPreview?: (drawingId: string, appearance?: NotebookPaperAppearance) => Promise<string>;
  onPaperColorChange?: (blockId: string, paperColor: NotebookPaperColor) => Promise<void>;
  saveAndClose: (blockId: string, drawingId: string) => Promise<void>;
  autoStart?: boolean;
  onPreparing?: () => void;
  onPrepared?: () => void;
  onFullscreenChange?: (blockId: string, fullscreen: boolean) => void;
}
type ResizeJob = { size: HandwritingPaperSize; blockId: string; sessionId?: string; waiters: { resolve: () => void; reject: (error: unknown) => void }[] };
function message(error: unknown) { return error instanceof Error ? error.message : "Handwriting could not be updated. Please try again."; }
const box = (rect: DOMRect): NativeInkRect => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });

/** Native PencilKit covers only the measured paper; tools and resize grips stay in the DOM. */
export function NativeHandwriting(props: Props) {
  const actions = useRef(props); actions.current = props;
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fullScreenRef = useRef(false);
  const placeholderHeight = useRef(0);
  const previousScroll = useRef(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const mounted = useRef(true);
  const revision = useRef(0);
  const resizeTail = useRef(Promise.resolve());
  const resizeQueue = useRef<{ running: boolean; next: ResizeJob | null }>({ running: false, next: null });
  const resizing = useRef(false);
  const autoStarted = useRef(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [error, setError] = useState("");
  const [finger, setFinger] = useState(false);
  const [resizeActive, setResizeActive] = useState(false);
  const choice = isNotebookPaperColor(props.paperColor) ? props.paperColor : "auto";
  const paperAppearance = resolveNotebookPaperColor(choice, props.themeBackground || (props.theme === "dark" ? "#1e1e1e" : "#ffffff"));
  const previewAppearance = props.previewFormat === "themed-v1" ? paperAppearance.appearance : undefined;
  const { drawingId, loadPreview } = props;
  const state = props.nativeHandwritingState?.blockId === props.blockId ? props.nativeHandwritingState : null;
  const active = !!state;
  const dimensions = { width: state?.width ?? props.width, height: state?.height ?? props.height };
  const widthScale = stageSize.width ? Math.max(1, stageSize.width) / dimensions.width : 1;
  const scale = fullscreen ? Math.max(0.01, Math.min(widthScale, Math.max(1, stageSize.height - 36) / dimensions.height)) : Math.min(1, widthScale);
  const paper = useCallback(() => root.current?.querySelector<HTMLElement>("[data-handwriting-paper]") ?? null, []);
  const geometry = useCallback((): NativeInkGeometry => {
    const element = paper(); const scroll = root.current?.closest<HTMLElement>(".nb-scroll");
    if (!element || !scroll) throw new Error("This handwriting area is not visible. Try again.");
    const rect = box(element.getBoundingClientRect()); const bounds = fullScreenRef.current && stage.current ? stage.current.getBoundingClientRect() : scroll.getBoundingClientRect(); const viewport = window.visualViewport;
    const left = Math.max(rect.x, bounds.left, viewport?.offsetLeft ?? 0);
    const top = Math.max(rect.y, bounds.top, viewport?.offsetTop ?? 0);
    const right = Math.min(rect.x + rect.width, bounds.right, (viewport?.offsetLeft ?? 0) + (viewport?.width || window.innerWidth));
    const bottom = Math.min(rect.y + rect.height, bounds.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height || window.innerHeight));
    return { rect, clipRect: { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }, revision: ++revision.current, viewport: { width: window.innerWidth, height: window.innerHeight } };
  }, [paper]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (fullScreenRef.current) actions.current.onFullscreenChange?.(actions.current.blockId, false); };
  }, []);
  useEffect(() => {
    const update = () => {
      const rect = stage.current?.getBoundingClientRect();
      if (rect && stage.current) {
        const style = getComputedStyle(stage.current);
        const width = rect.width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
        const height = rect.height - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);
        setStageSize((current) => current.width === width && current.height === height ? current : { width, height });
      }
    };
    update(); const observer = new ResizeObserver(update); if (stage.current) observer.observe(stage.current);
    window.addEventListener("resize", update); window.visualViewport?.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); };
  }, [fullscreen]);
  const setViewportMode = (enabled: boolean) => {
    if (enabled === fullScreenRef.current || enabled && resizing.current) return;
    const scroll = root.current?.closest<HTMLElement>(".nb-scroll");
    if (enabled) { placeholderHeight.current = root.current?.getBoundingClientRect().height ?? 0; previousScroll.current = scroll?.scrollTop ?? 0; }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    fullScreenRef.current = enabled; setFullscreen(enabled);
    actions.current.onFullscreenChange?.(actions.current.blockId, enabled);
    if (!enabled && scroll) requestAnimationFrame(() => { if (mounted.current) scroll.scrollTop = previousScroll.current; });
  };
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active && fullScreenRef.current) {
      fullScreenRef.current = false; setFullscreen(false); actions.current.onFullscreenChange?.(actions.current.blockId, false);
      const scroll = root.current?.closest<HTMLElement>(".nb-scroll"); if (scroll) scroll.scrollTop = previousScroll.current;
    }
    wasActive.current = active;
  }, [active]);
  useEffect(() => {
    let current = true; setPreview(null); setPreviewError("");
    if (!drawingId) return;
    if (!loadPreview) { setPreviewError("Reopen this notebook to load its handwriting."); return; }
    void loadPreview(drawingId, previewAppearance).then((value) => { if (current) setPreview(value); }).catch((caught) => { if (current) setPreviewError(message(caught)); });
    return () => { current = false; };
  }, [drawingId, loadPreview, previewAppearance, retry]);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!mounted.current || actions.current.nativeHandwritingState?.blockId !== actions.current.blockId) return;
        try {
          void actions.current.onNativeHandwritingLayout?.(actions.current.blockId, geometry()).catch((caught) => { if (mounted.current) setError(message(caught)); });
        } catch (caught) { if (mounted.current) setError(message(caught)); }
      });
    };
    update(); const observer = new ResizeObserver(update);
    const element = paper(); if (element) observer.observe(element);
    const scroll = root.current?.closest<HTMLElement>(".nb-scroll"); if (scroll) observer.observe(scroll);
    window.addEventListener("resize", update); window.visualViewport?.addEventListener("resize", update); window.visualViewport?.addEventListener("scroll", update);
    return () => { if (frame) cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); };
  }, [active, dimensions.width, dimensions.height, geometry, paper, scale, fullscreen]);
  const start = async () => {
    if (busy || active || props.nativeHandwritingState) return;
    setBusy(true); setError(""); setRecoveryNotice("");
    props.onPreparing?.();
    try {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.getSelection()?.removeAllRanges();
      if (!fullScreenRef.current) paper()?.scrollIntoView({ block: "center", behavior: "instant" });
      // Let keyboard/visual-viewport changes settle before handing native its first rectangle.
      await new Promise<void>((resolve) => {
        let quiet = setTimeout(done, 120); const deadline = setTimeout(done, 900);
        function update() { clearTimeout(quiet); quiet = setTimeout(done, 120); }
        function done() { clearTimeout(quiet); clearTimeout(deadline); window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); resolve(); }
        window.visualViewport?.addEventListener("resize", update); window.visualViewport?.addEventListener("scroll", update);
      });
      if (!mounted.current) return;
      const callback = actions.current.onNativeHandwritingStart;
      if (!callback) throw new Error("This build does not support inline handwriting yet.");
      await callback({ blockId: props.blockId, drawingId: props.drawingId, inkFormat: props.inkFormat, width: props.width, height: props.height, paperColor: choice, geometry: geometry() });
    } catch (caught) { if (mounted.current) setError(message(caught)); }
    finally { actions.current.onPrepared?.(); if (mounted.current) setBusy(false); }
  };
  const startAction = useRef(start); startAction.current = start;
  useEffect(() => {
    if (!props.autoStart || autoStarted.current) return;
    autoStarted.current = true;
    void startAction.current();
  }, [props.autoStart]);
  const command = async (name: "tools" | "undo" | "redo" | "finger", enabled?: boolean) => {
    setError("");
    try { await props.onNativeHandwritingCommand?.(props.blockId, name, enabled); }
    catch (caught) { if (mounted.current) setError(message(caught)); }
  };
  const resize = (size: HandwritingPaperSize) => {
    const queue = resizeQueue.current;
    const current = actions.current;
    const request = new Promise<void>((resolve, reject) => {
      if (queue.next) { queue.next.size = size; queue.next.waiters.push({ resolve, reject }); }
      else queue.next = { size, blockId: current.blockId, sessionId: current.nativeHandwritingState?.sessionId, waiters: [{ resolve, reject }] };
    });
    if (!queue.running) {
      queue.running = true;
      resizeTail.current = (async () => {
        try { while (queue.next) {
          const job = queue.next; queue.next = null;
          try {
            const current = actions.current;
            if (!mounted.current || current.blockId !== job.blockId || current.nativeHandwritingState?.sessionId !== job.sessionId) throw new Error("This handwriting area is no longer open.");
            if (!current.onNativeHandwritingResize) throw new Error("This handwriting area cannot be resized yet.");
            await current.onNativeHandwritingResize(job.blockId, job.size);
            job.waiters.forEach((waiter) => waiter.resolve());
          } catch (caught) { job.waiters.forEach((waiter) => waiter.reject(caught)); }
        } } finally { queue.running = false; }
      })();
    }
    // Rejections reach the gesture so it can roll back, while the drained queue
    // always settles successfully. A past resize error must never block Done.
    void request.catch((caught) => { if (mounted.current) setError(message(caught)); });
    return request;
  };
  const save = async () => {
    if (busy || state?.busy || resizing.current) return;
    setBusy(true); setError("");
    try { await resizeTail.current; await actions.current.saveAndClose(props.blockId, props.drawingId); if (mounted.current) setError(""); }
    catch (caught) { if (mounted.current) setError(message(caught)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const changePaperColor = async (paperColor: NotebookPaperColor) => {
    if (busy || state?.busy || resizing.current || !props.onPaperColorChange) return;
    setBusy(true); setError("");
    try { await props.onPaperColorChange(props.blockId, paperColor); }
    catch (caught) { if (mounted.current) setError(message(caught)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const leaveWriting = async () => {
    if (leaving || !actions.current.onNativeHandwritingClose) return;
    setLeaving(true);
    try {
      // Close captures native recovery directly; it never depends on a failed
      // resize or cloud save and does not discard the original drawing.
      await actions.current.onNativeHandwritingClose(props.blockId);
      resizing.current = false; if (mounted.current) setResizeActive(false);
      setViewportMode(false);
      if (mounted.current) { setError(""); setRecoveryNotice("Drawing kept on this iPad. Tap Write to continue."); }
    } catch (caught) { if (mounted.current) setError(message(caught)); }
    finally { if (mounted.current) setLeaving(false); }
  };
  const locked = busy || leaving || !!state?.busy;
  const paperStyle = { "--nb-paper-color": paperAppearance.color, "--nb-paper-text": paperAppearance.appearance === "dark" ? "#dddddd" : "#555555" } as CSSProperties;
  return <div className="nb-native-handwriting-slot" style={fullscreen ? { minHeight: placeholderHeight.current } : undefined}><figure ref={root} className="nb-handwriting nb-native-handwriting" data-fullscreen={fullscreen ? "true" : undefined} style={paperStyle} contentEditable={false} onPointerDown={(event) => { if (event.target instanceof Element && event.target.closest("button")) { event.preventDefault(); event.stopPropagation(); } }} onMouseDown={(event) => event.stopPropagation()}>
    <div className="nb-native-ink-tools" role="toolbar" aria-label="Handwriting tools">
      {active ? <>
        <button type="button" disabled={locked} onClick={() => void command("tools")}><SlidersHorizontal size={18} />Tools</button>
        <button type="button" className="nb-icon-button" aria-label="Undo handwriting" disabled={locked || !state.canUndo} onClick={() => void command("undo")}><Undo2 size={18} /></button>
        <button type="button" className="nb-icon-button" aria-label="Redo handwriting" disabled={locked || !state.canRedo} onClick={() => void command("redo")}><Redo2 size={18} /></button>
        <span className="nb-native-ink-tool-space" />
        <button type="button" className="nb-native-ink-fullscreen" aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} disabled={resizeActive} onClick={() => setViewportMode(!fullscreen)}>{fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}<span>{fullscreen ? "Exit full screen" : "Full screen"}</span></button>
        <button type="button" disabled={locked} onClick={() => void save()}><Hand size={18} />Scroll page</button>
        <button type="button" className="nb-native-ink-done" disabled={locked} onClick={() => void save()}><Check size={18} />{locked ? "Saving…" : "Done"}</button>
      </> : <><span>Handwriting</span><span className="nb-native-ink-tool-space" /><button type="button" className="nb-native-ink-fullscreen" aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} disabled={busy || !!props.nativeHandwritingState} onClick={() => setViewportMode(!fullscreen)}>{fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}<span>{fullscreen ? "Exit full screen" : "Full screen"}</span></button><button type="button" disabled={busy || !!props.nativeHandwritingState} onClick={() => void start()}><Pencil size={18} />{busy ? "Opening…" : "Write"}</button></>}
    </div>
    {props.onPaperColorChange ? <div className="nb-native-paper-options" role="group" aria-label="Paper color">
      <span>Paper</span>
      {([['auto', 'Auto'], ['#ffffff', 'White'], ['#fff8e7', 'Cream'], ['#202020', 'Dark']] as const).map(([color, label]) => <button key={color} type="button" aria-pressed={choice === color} disabled={locked || resizeActive || !!props.nativeHandwritingState && !active} onClick={() => void changePaperColor(color)}><span className="nb-paper-swatch" style={{ background: color === "auto" ? "var(--nb-bg)" : color }} />{label}</button>)}
      <label className="nb-paper-custom">Custom<input aria-label="Custom paper color" type="color" value={paperAppearance.color} disabled={locked || resizeActive || !!props.nativeHandwritingState && !active} onInput={(event) => { const color = event.currentTarget.value.toLowerCase(); if (isNotebookPaperColor(color)) void changePaperColor(color); }} /></label>
    </div> : null}
    <div ref={stage} className="nb-native-ink-stage"><HandwritingResizeFrame width={dimensions.width} height={dimensions.height} scale={scale} minHeight={Math.max(128, state?.minimumHeight ?? 128)} maxHeight={4096} disabled={!active || locked} onResizeStart={() => { resizing.current = true; setResizeActive(true); }} onResizePreview={(size) => { if (active) void resize(size); }} onResizeCommit={async (size) => { try { await resize(size); } finally { resizing.current = false; if (mounted.current) setResizeActive(false); } }} onResizeCancel={(size) => { resizing.current = false; if (mounted.current) setResizeActive(false); if (active) void resize(size); }}>
      {preview ? <img className="nb-native-ink-preview" src={preview} width={props.width * scale} height={props.height * scale} alt="Handwritten notebook content" onError={() => setPreviewError("The handwriting preview could not be displayed.")} /> : <div className="nb-native-ink-placeholder">{props.drawingId ? previewError || "Loading handwriting…" : active ? "" : "Write with Apple Pencil"}</div>}
      {!active ? <button type="button" className="nb-native-ink-start" aria-label="Write in handwriting area" disabled={busy || !!props.nativeHandwritingState} onClick={() => void start()} /> : null}
    </HandwritingResizeFrame></div>
    {active ? <label className="nb-native-ink-finger"><input type="checkbox" checked={finger} disabled={locked} onChange={(event) => { setFinger(event.target.checked); void command("finger", event.target.checked); }} />Draw with finger</label> : null}
    {error || state?.error ? <div className="nb-ink-error" role="alert">{error || state?.error}{props.onNativeHandwritingClose ? <button type="button" disabled={leaving} onClick={() => void leaveWriting()}>{leaving ? "Leaving…" : "Leave writing"}</button> : null}</div> : null}
    {recoveryNotice && !active ? <p className="nb-native-recovery-notice" role="status">{recoveryNotice}</p> : null}
    {!active && previewError ? <div className="nb-ink-error" role="alert">{previewError}<button type="button" onClick={() => setRetry((value) => value + 1)}>Retry preview</button></div> : null}
  </figure></div>;
}
