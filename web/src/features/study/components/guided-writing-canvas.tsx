"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type HanziWriter from "hanzi-writer";
import type { StrokeData as HanziWriterStrokeData } from "hanzi-writer";

import type { KanjiStrokeData } from "../stroke-data";
import styles from "../study.module.css";

const WRITER_SIZE = 1024;
const MOBILE_PADDING_RATIO = 20 / 300;

export const MOBILE_GUIDED_STROKE_TRANSFORM =
  "translate(68.2666667 848.2666667) scale(0.8666667 -0.8666667)";

export interface GuidedWritingCanvasHandle {
  highlight(strokeIndex: number): void;
  replay(): void;
  restart(): void;
}

interface GuidedWritingCanvasProps {
  character: string;
  complete: boolean;
  data: KanjiStrokeData | null;
  label: string;
  leniency: number;
  onComplete(): void;
  onCorrectStroke(data: HanziWriterStrokeData): void;
  onError(): void;
  onMistake(data: HanziWriterStrokeData): void;
  onReady(): void;
  onReplayStateChange(replaying: boolean): void;
  ready: boolean;
  showGrid: boolean;
  showOutline: boolean;
  state: "error" | "loading" | "ready";
}

type CapturedDocumentListener = {
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
  type: "mouseup" | "touchend";
};

function createWithDocumentListenerCleanup<T>(create: () => T) {
  // Hanzi Writer has no destroy API and otherwise leaves its anonymous global end listeners behind.
  const captured: CapturedDocumentListener[] = [];
  const originalAddEventListener = document.addEventListener;
  document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    if (type === "mouseup" || type === "touchend") captured.push({ listener, options, type });
    originalAddEventListener.call(document, type, listener, options);
  }) as typeof document.addEventListener;

  try {
    const value = create();
    return {
      value,
      cleanup() {
        captured.forEach(({ listener, options, type }) => document.removeEventListener(type, listener, options));
      },
    };
  } catch (error) {
    captured.forEach(({ listener, options, type }) => document.removeEventListener(type, listener, options));
    throw error;
  } finally {
    document.addEventListener = originalAddEventListener;
  }
}

function destroyWriter(writer: HanziWriter) {
  writer.cancelQuiz();
  void writer.pauseAnimation();
  writer._hanziWriterRenderer?.destroy();
}

function writerColors() {
  const theme = document.documentElement.dataset.theme;
  const dark = theme === "dark" || theme === "midnight";
  return {
    drawingColor: dark ? "#ffffff" : "#1a1a1a",
    highlightColor: "#3a86ff",
    strokeColor: dark ? "#ffffff" : "#1a1a1a",
  };
}

export const GuidedWritingCanvas = forwardRef<GuidedWritingCanvasHandle, GuidedWritingCanvasProps>(function GuidedWritingCanvas(props, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const generationRef = useRef(0);
  const replayingRef = useRef(false);
  const latestRef = useRef<GuidedWritingCanvasProps>(props);
  const activateRef = useRef<(writer: HanziWriter, generation: number) => Promise<void>>(async () => {});
  latestRef.current = props;

  activateRef.current = async (writer, generation) => {
    const { character, data, leniency } = latestRef.current;
    if (replayingRef.current) {
      replayingRef.current = false;
      latestRef.current.onReplayStateChange(false);
    }
    writer.cancelQuiz();
    if (!data) {
      await writer.hideCharacter({ duration: 0 });
      return;
    }
    await writer.setCharacter(character);
    if (writerRef.current !== writer) {
      destroyWriter(writer);
      return;
    }
    if (generation !== generationRef.current || latestRef.current.character !== character) return;

    await writer.quiz({
      acceptBackwardsStrokes: false,
      highlightOnComplete: false,
      leniency,
      showHintAfterMisses: 3,
      onComplete: () => {
        if (writerRef.current === writer && generation === generationRef.current) latestRef.current.onComplete();
      },
      onCorrectStroke: (data) => {
        if (writerRef.current === writer && generation === generationRef.current) latestRef.current.onCorrectStroke(data);
      },
      onMistake: (data) => {
        if (writerRef.current === writer && generation === generationRef.current) latestRef.current.onMistake(data);
      },
    });
    if (writerRef.current === writer && generation === generationRef.current) latestRef.current.onReady();
  };

  useImperativeHandle(ref, () => ({
    highlight(strokeIndex) {
      const writer = writerRef.current;
      if (writer) void writer.highlightStroke(strokeIndex);
    },
    replay() {
      const writer = writerRef.current;
      if (!writer || replayingRef.current) return;
      const generation = generationRef.current;
      replayingRef.current = true;
      latestRef.current.onReplayStateChange(true);
      writer.cancelQuiz();
      const finishReplay = () => {
        if (writerRef.current !== writer || generation !== generationRef.current || !replayingRef.current) return;
        replayingRef.current = false;
        latestRef.current.onReplayStateChange(false);
      };
      void writer.animateCharacter({ onComplete: finishReplay }).catch(finishReplay);
    },
    restart() {
      const writer = writerRef.current;
      if (!writer) return;
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      void activateRef.current(writer, generation).catch(() => {
        if (generation === generationRef.current) latestRef.current.onError();
      });
    },
  }), []);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const writer = writerRef.current;
    if (writer) void activateRef.current(writer, generation).catch(() => {
      if (generation === generationRef.current) latestRef.current.onError();
    });
  }, [props.character, props.data, props.leniency]);

  useEffect(() => {
    const host = hostRef.current;
    const target = targetRef.current;
    if (!host || !target) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let removeDocumentListeners = () => {};

    void import("hanzi-writer").then(({ default: HanziWriterClass }) => {
      if (disposed) return;
      const initialSize = Math.round(Math.min(host.clientWidth, host.clientHeight)) || WRITER_SIZE;
      const created = createWithDocumentListenerCleanup(() => new HanziWriterClass(target, {
        ...writerColors(),
        charDataLoader: (character) => {
          const latest = latestRef.current;
          if (latest.character !== character || !latest.data) throw new Error(`Unexpected guided character data request: ${character}`);
          return latest.data;
        },
        delayBetweenStrokes: 400,
        drawingFadeDuration: 200,
        drawingWidth: initialSize * (8 / 300),
        height: initialSize,
        padding: initialSize * MOBILE_PADDING_RATIO,
        showCharacter: false,
        showOutline: false,
        strokeAnimationSpeed: 1,
        strokeFadeDuration: 300,
        strokeHighlightSpeed: 2,
        width: initialSize,
      }));
      const writer = created.value;
      removeDocumentListeners = created.cleanup;
      writerRef.current = writer;
      const generation = generationRef.current;
      void activateRef.current(writer, generation).catch(() => {
        if (generation === generationRef.current) latestRef.current.onError();
      });

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(([entry]) => {
          if (!entry || disposed) return;
          const size = Math.round(Math.min(entry.contentRect.width, entry.contentRect.height));
          if (size > 0) writer.updateDimensions({ height: size, padding: size * MOBILE_PADDING_RATIO, width: size });
        });
        resizeObserver.observe(host);
      }
    }).catch(() => {
      if (!disposed) latestRef.current.onError();
    });

    return () => {
      disposed = true;
      generationRef.current += 1;
      replayingRef.current = false;
      resizeObserver?.disconnect();
      removeDocumentListeners();
      const writer = writerRef.current;
      writerRef.current = null;
      if (writer) destroyWriter(writer);
      target.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`${styles.writingCanvas} ${styles.guidedWritingCanvas}`}
      data-disabled={props.complete || !props.ready || props.state !== "ready" || !props.data}
      data-state={props.complete ? "complete" : props.state}
      role="img"
      aria-label={props.label}
    >
      {props.showGrid ? (
        <svg className={styles.guidedWritingGrid} viewBox="0 0 1024 1024" aria-hidden="true">
          <path d="M512 0V1024M0 512H1024M0 0L1024 1024M1024 0L0 1024" className={styles.guideLines} />
        </svg>
      ) : null}
      {props.showOutline && props.data ? (
        <svg className={styles.guidedWritingSource} data-guided-source-outline viewBox="0 0 1024 1024" aria-hidden="true">
          <g transform={MOBILE_GUIDED_STROKE_TRANSFORM}>
            {props.data.strokes.map((stroke, index) => <path key={index} d={stroke} className={styles.sourceOutlineStroke} />)}
          </g>
        </svg>
      ) : null}
      <div ref={targetRef} className={styles.hanziWriterTarget} data-hanzi-writer-target />
    </div>
  );
});
