"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, size, useFloating } from "@floating-ui/react-dom";
import { ArrowRight, Download, ExternalLink, Languages, LoaderCircle, LockKeyhole, Square, Volume2 } from "lucide-react";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { JAPANESE_VOICE_DOWNLOAD_LABEL, JAPANESE_VOICE_NAME } from "@/features/speech/japanese-voice-assets";
import { useJapaneseVoice } from "@/features/speech/use-japanese-voice";
import { useStudyDataset } from "@/features/study/use-study-dataset";
import type { JpdbTokenAnnotation } from "./jpdb";
import type { FuriganaRange } from "./types";
import { annotateJpdbTokens, annotateWithWaniKaniFallback, readerPieces, srsStageLabel, type ReaderAnnotation, type ReaderPiece } from "./annotation";
import { proxyNewsImageUrl } from "./news-images";
import styles from "./content.module.css";

export interface JapaneseReaderAnalysis {
  status: "idle" | "loading" | "ready" | "error";
  sourceText: string;
  tokens: JpdbTokenAnnotation[];
  message: string;
}

const EMPTY_ANALYSIS: JapaneseReaderAnalysis = { status: "idle", sourceText: "", tokens: [], message: "" };
const JPDB_ANALYSIS_CHUNK_MAX_CHARACTERS = 30_000;
const JPDB_ANALYSIS_CONCURRENCY = 2;
const JPDB_ANALYSIS_CACHE_CHUNKS = 6;

export type JapaneseReaderBlock =
  | { type: "text"; text: string; furigana?: readonly FuriganaRange[] }
  | { type: "image"; url: string; alt?: string };

export interface JapaneseReaderAnalysisContext {
  text: string;
  start: number;
  analysis?: JapaneseReaderAnalysis;
}

type JapaneseReaderAnalysisSource = { id: string; text: string };
type JapaneseReaderAnalysisChunk = {
  id: string;
  text: string;
  sources: Array<{ id: string; start: number; end: number }>;
};

function buildJapaneseReaderAnalysisChunks(sources: readonly JapaneseReaderAnalysisSource[]) {
  const chunks: JapaneseReaderAnalysisChunk[] = [];
  let chunkText = "";
  let chunkSources: JapaneseReaderAnalysisChunk["sources"] = [];

  function commitChunk() {
    if (!chunkSources.length) return;
    chunks.push({ id: `reader-analysis-${chunks.length}`, text: chunkText, sources: chunkSources });
    chunkText = "";
    chunkSources = [];
  }

  for (const source of sources) {
    if (!source.text) continue;
    if (source.text.length > JPDB_ANALYSIS_CHUNK_MAX_CHARACTERS) {
      commitChunk();
      const text = source.text.slice(0, JPDB_ANALYSIS_CHUNK_MAX_CHARACTERS);
      chunks.push({
        id: `reader-analysis-${chunks.length}`,
        text,
        sources: [{ id: source.id, start: 0, end: text.length }],
      });
      continue;
    }
    const separator = chunkText ? "\n\n" : "";
    if (chunkText && chunkText.length + separator.length + source.text.length > JPDB_ANALYSIS_CHUNK_MAX_CHARACTERS) {
      commitChunk();
    }
    const nextSeparator = chunkText ? "\n\n" : "";
    const start = chunkText.length + nextSeparator.length;
    chunkText += `${nextSeparator}${source.text}`;
    chunkSources.push({ id: source.id, start, end: start + source.text.length });
  }
  commitChunk();
  return chunks;
}

function japaneseReaderAnalysisCacheKey(text: string, apiKey: string) {
  return `${apiKey}\u0000${text}`;
}

export function useJapaneseReaderAnalysisContexts(
  sources: readonly JapaneseReaderAnalysisSource[],
  options: { apiKey: string; enabled: boolean },
) {
  const chunks = useMemo(() => buildJapaneseReaderAnalysisChunks(sources), [sources]);
  const [analyses, setAnalyses] = useState<Record<string, JapaneseReaderAnalysis>>({});
  const analysisCacheRef = useRef(new Map<string, JapaneseReaderAnalysis>());

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const chunkRequests = chunks.map((chunk) => {
      const cacheKey = japaneseReaderAnalysisCacheKey(chunk.text, options.apiKey);
      const cached = options.enabled ? analysisCacheRef.current.get(cacheKey) : undefined;
      return { cacheKey, cached, chunk };
    });
    const initialAnalyses = Object.fromEntries(chunkRequests.map(({ cached, chunk }) => [chunk.id, cached ?? {
      status: options.enabled ? "loading" : "idle",
      sourceText: chunk.text,
      tokens: [],
      message: options.enabled ? "Analyzing Japanese with JPDB…" : "",
    } satisfies JapaneseReaderAnalysis]));
    setAnalyses(initialAnalyses);
    if (!options.enabled || !options.apiKey || chunks.length === 0) {
      return () => {
        current = false;
        controller.abort();
      };
    }

    const pendingRequests = chunkRequests.filter(({ cached }) => !cached);
    let nextChunkIndex = 0;
    const analyzeNextChunk = async () => {
      while (current && !controller.signal.aborted) {
        const request = pendingRequests[nextChunkIndex];
        nextChunkIndex += 1;
        if (!request) return;
        const { cacheKey, chunk } = request;
        try {
          const response = await fetch("/news/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunk.text, apiKey: options.apiKey }),
            signal: controller.signal,
          });
          const payload = await response.json() as { tokens?: JpdbTokenAnnotation[]; error?: string };
          if (!response.ok) throw new Error(payload.error || "JPDB analysis failed.");
          if (!current || controller.signal.aborted) return;
          const readyAnalysis: JapaneseReaderAnalysis = {
            status: "ready",
            sourceText: chunk.text,
            tokens: Array.isArray(payload.tokens) ? payload.tokens : [],
            message: "JPDB parsing mapped against your WaniKani library.",
          };
          analysisCacheRef.current.delete(cacheKey);
          analysisCacheRef.current.set(cacheKey, readyAnalysis);
          while (analysisCacheRef.current.size > JPDB_ANALYSIS_CACHE_CHUNKS) {
            const oldest = analysisCacheRef.current.keys().next().value as string | undefined;
            if (!oldest) break;
            analysisCacheRef.current.delete(oldest);
          }
          setAnalyses((currentAnalyses) => ({
            ...currentAnalyses,
            [chunk.id]: readyAnalysis,
          }));
        } catch (error) {
          if (!current || controller.signal.aborted) return;
          setAnalyses((currentAnalyses) => ({
            ...currentAnalyses,
            [chunk.id]: {
              status: "error",
              sourceText: chunk.text,
              tokens: [],
              message: error instanceof Error ? error.message : "JPDB analysis failed.",
            },
          }));
        }
      }
    };
    void Promise.all(Array.from(
      { length: Math.min(JPDB_ANALYSIS_CONCURRENCY, pendingRequests.length) },
      () => analyzeNextChunk(),
    ));

    return () => {
      current = false;
      controller.abort();
    };
  }, [chunks, options.apiKey, options.enabled]);

  return useMemo(() => {
    const contexts = new Map<string, JapaneseReaderAnalysisContext>();
    for (const chunk of chunks) {
      const currentAnalysis = analyses[chunk.id];
      const chunkAnalysis: JapaneseReaderAnalysis = currentAnalysis?.sourceText === chunk.text ? currentAnalysis : {
        status: options.enabled ? "loading" : "idle",
        sourceText: chunk.text,
        tokens: [],
        message: options.enabled ? "Analyzing Japanese with JPDB…" : "",
      };
      for (const source of chunk.sources) {
        contexts.set(source.id, {
          text: chunk.text,
          start: source.start,
          analysis: {
            ...chunkAnalysis,
            tokens: chunkAnalysis.tokens.filter((token) => token.start >= source.start && token.end <= source.end),
          },
        });
      }
    }
    return contexts;
  }, [analyses, chunks, options.enabled]);
}

export interface JapaneseReaderProps {
  text: string;
  blocks?: readonly JapaneseReaderBlock[];
  analysisContext?: JapaneseReaderAnalysisContext;
  ariaLabel?: string;
  onProgress?: (progress: number) => void;
  appearance?: "default" | "compact";
  inspectorMode?: "inline" | "floating";
  onSelectionChange?: (open: boolean) => void;
  inspectorActive?: boolean;
  subjectReturnTo?: string;
  showFurigana?: boolean;
  onShowFuriganaChange?: (value: boolean) => void;
  supplement?: ReactNode;
  selectionRequest?: { id: string; index: number };
  inspectorOnly?: boolean;
  onSelectionResolved?: (selection: { requestId: string; text: string; start: number; end: number }) => void;
}

type PreparedReaderBlock =
  | { type: "text"; id: string; text: string; start: number; end: number; furigana?: readonly FuriganaRange[] }
  | { type: "image"; id: string; url: string; alt?: string };

function prepareReaderDocument(text: string, blocks?: readonly JapaneseReaderBlock[]) {
  const sourceBlocks = blocks?.length ? blocks : [{ type: "text" as const, text }];
  const prepared: PreparedReaderBlock[] = [];
  let cursor = 0;
  let textBlockCount = 0;

  sourceBlocks.forEach((block, index) => {
    if (block.type === "image") {
      prepared.push({ ...block, id: `image-${index}` });
      return;
    }
    if (textBlockCount > 0) cursor += 2;
    const start = cursor;
    cursor += block.text.length;
    prepared.push({ ...block, id: `text-${index}`, start, end: cursor });
    textBlockCount += 1;
  });

  if (textBlockCount === 0 && text) {
    prepared.push({ type: "text", id: "text-fallback", text, start: 0, end: text.length });
  }

  return {
    blocks: prepared,
    text: prepared.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n\n") || text,
  };
}

function subjectReading(annotation: ReaderAnnotation) {
  return annotation.subject?.data.readings?.find((reading) => reading.primary)?.reading
    ?? annotation.subject?.data.readings?.[0]?.reading
    ?? annotation.reading;
}

function annotationReading(annotation: ReaderAnnotation) {
  if (annotation.source === "jpdb" && (annotation.surfaceReading || annotation.reading)) return annotation.surfaceReading || annotation.reading;
  return subjectReading(annotation);
}

const PART_OF_SPEECH_LABELS: Record<string, string> = {
  n: "Noun", prt: "Particle", adv: "Adverb", aux: "Auxiliary", "aux-v": "Auxiliary verb", "aux-adj": "Auxiliary adjective",
  conj: "Conjunction", cop: "Copula", ctr: "Counter", exp: "Expression", int: "Interjection", pref: "Prefix", suf: "Suffix",
  "adj-i": "い-adjective", "adj-na": "な-adjective", "adj-no": "の-adjective", "adj-pn": "Prenominal adjective", vi: "Intransitive verb", vt: "Transitive verb",
};

function partOfSpeechLabel(value: string) {
  if (PART_OF_SPEECH_LABELS[value]) return PART_OF_SPEECH_LABELS[value];
  if (value.startsWith("v1")) return "Ichidan verb";
  if (value.startsWith("v5")) return "Godan verb";
  if (value.startsWith("vs")) return "する verb";
  if (value.startsWith("vk")) return "くる verb";
  if (value.startsWith("adj")) return "Adjective";
  return value.replaceAll("-", " ");
}

function annotationMeanings(annotation: ReaderAnnotation) {
  if (annotation.meanings.length) return annotation.meanings.slice(0, 6);
  const subjectMeanings = annotation.subject?.data.meanings.map(({ meaning }) => meaning).filter(Boolean) ?? [];
  if (subjectMeanings.length) return subjectMeanings.slice(0, 6);
  return annotation.meaning ? [annotation.meaning] : ["No English meaning returned"];
}

function annotationLabel(annotation: ReaderAnnotation) {
  const state = annotation.subject ? `${srsStageLabel(annotation.srsStage)} WaniKani item` : annotation.source === "jpdb" ? "JPDB term, not matched in WaniKani" : "Japanese term";
  return `${annotation.text}, ${state}`;
}

type ReaderTokenKind = "grammar" | "verb" | "vocabulary";
type ReaderInspectorKind = ReaderTokenKind | "radical" | "kanji";

function readerTokenKind(annotation: ReaderAnnotation): ReaderTokenKind {
  if (annotation.tokenType === "grammar") return "grammar";
  if (annotation.tokenType === "verb") return "verb";
  return "vocabulary";
}

function readerInspectorKind(annotation: ReaderAnnotation): ReaderInspectorKind {
  if (annotation.subject?.object === "radical") return "radical";
  if (annotation.subject?.object === "kanji") return "kanji";
  if (annotation.subject) return "vocabulary";
  return readerTokenKind(annotation);
}

function isInteractiveAnnotation(annotation: ReaderAnnotation) {
  return annotation.source !== "wanikani" || Boolean(annotation.subject);
}

function waniKaniPronunciationAudio(annotation: ReaderAnnotation, preferredVoiceActorId?: number) {
  const subject = annotation.subject;
  if (!subject || (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary")) return undefined;
  const audio = subject.data.pronunciation_audios ?? [];
  return audio.find((item) => item.content_type.includes("mpeg") && item.metadata.voice_actor_id === preferredVoiceActorId)
    ?? audio.find((item) => item.content_type.includes("mpeg"))
    ?? audio[0];
}

function renderFurigana(text: string, start: number, end: number, ranges: readonly FuriganaRange[] | undefined, enabled: boolean): ReactNode {
  if (!enabled || !ranges?.length || text.length !== end - start) return text;
  const children: ReactNode[] = [];
  let cursor = start;
  for (const range of ranges) {
    if (range.start < cursor || range.start < start || range.end > end || range.end <= range.start || !range.reading) continue;
    if (range.start > cursor) children.push(text.slice(cursor - start, range.start - start));
    children.push(<ruby key={`${range.start}-${range.end}-${range.reading}`}>{text.slice(range.start - start, range.end - start)}<rt>{range.reading}</rt></ruby>);
    cursor = range.end;
  }
  if (!children.length) return text;
  if (cursor < end) children.push(text.slice(cursor - start));
  return children;
}

function renderAnnotationFurigana(annotation: ReaderAnnotation, enabled: boolean): ReactNode {
  const reading = annotationReading(annotation)?.trim();
  if (
    !enabled ||
    !reading ||
    annotation.text.normalize("NFKC") === reading.normalize("NFKC") ||
    !/[\u3400-\u9fff\uf900-\ufaff々〆ヵヶ]/u.test(annotation.text)
  ) return annotation.text;
  return <ruby>{annotation.text}<rt>{reading}</rt></ruby>;
}

export function JapaneseReader({ text, blocks, analysisContext, ariaLabel = "Japanese reading text", onProgress, appearance = "default", inspectorMode = "inline", onSelectionChange, inspectorActive, subjectReturnTo, showFurigana = false, onShowFuriganaChange, supplement, selectionRequest, inspectorOnly = false, onSelectionResolved }: JapaneseReaderProps) {
  const { user, dataset, loading } = useStudyDataset();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const voice = useJapaneseVoice();
  const jpdbApiKey = settings.integrations.jpdbApiKey;
  const detailsInteraction = settings.reader.detailsInteraction;
  const jpdbRecognitionEnabled = settings.reader.recognitionMode === "wk-jpdb";
  const jpdbAnalysisEnabled = jpdbRecognitionEnabled && Boolean(jpdbApiKey);
  const [localAnalysis, setLocalAnalysis] = useState<JapaneseReaderAnalysis>(EMPTY_ANALYSIS);
  const [selectedToken, setSelectedToken] = useState<ReaderAnnotation | null>(null);
  const [voicePromptTokenId, setVoicePromptTokenId] = useState<string | null>(null);
  const [waniKaniAudioState, setWaniKaniAudioState] = useState<{ url: string; text: string; status: "loading" | "playing" } | null>(null);
  const voicePromptId = useId();
  const waniKaniAudioRef = useRef<HTMLAudioElement | null>(null);
  const tokenRefs = useRef(new Map<string, HTMLButtonElement>());
  const inspectorRef = useRef<HTMLElement | null>(null);
  const resolvedSelectionRef = useRef("");
  const { refs: floatingRefs, floatingStyles } = useFloating({
    open: inspectorMode === "floating" && inspectorActive !== false && Boolean(selectedToken),
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 12, fallbackStrategy: "bestFit" }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableWidth, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            width: `${Math.min(448, Math.max(0, availableWidth))}px`,
            maxHeight: `${Math.max(0, availableHeight)}px`,
          });
        },
      }),
    ],
  });
  const setFloatingElement = useCallback((node: HTMLDivElement | null) => {
    floatingRefs.setFloating(node);
  }, [floatingRefs]);
  const readerDocument = useMemo(() => prepareReaderDocument(text, blocks), [blocks, text]);
  const sourceText = readerDocument.text;
  const analysisSourceText = analysisContext?.text ?? sourceText;
  const analysisStart = analysisContext?.start ?? 0;
  const managedAnalysis = analysisContext?.analysis;
  const analysis = managedAnalysis ?? localAnalysis;
  const selectionAnalysisPending = Boolean(
    selectionRequest
    && (
      loading
      || (
        jpdbAnalysisEnabled
        && (
          analysis.status === "idle"
          || analysis.status === "loading"
          || analysis.sourceText !== analysisSourceText
        )
      )
    )
  );

  useEffect(() => {
    if (managedAnalysis || !jpdbAnalysisEnabled || !analysisSourceText.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLocalAnalysis({ status: "loading", sourceText: analysisSourceText, tokens: [], message: "Analyzing Japanese with JPDB…" });
      void fetch("/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: analysisSourceText, apiKey: jpdbApiKey }),
        signal: controller.signal,
      }).then(async (response) => {
        const payload = await response.json() as { tokens?: JpdbTokenAnnotation[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "JPDB analysis failed.");
        setLocalAnalysis({ status: "ready", sourceText: analysisSourceText, tokens: Array.isArray(payload.tokens) ? payload.tokens : [], message: "JPDB parsing mapped against your WaniKani library." });
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLocalAnalysis({ status: "error", sourceText: analysisSourceText, tokens: [], message: error instanceof Error ? error.message : "JPDB analysis failed." });
      });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [analysisSourceText, jpdbAnalysisEnabled, jpdbApiKey, managedAnalysis]);

  useEffect(() => () => {
    if (waniKaniAudioRef.current) {
      waniKaniAudioRef.current.onended = null;
      waniKaniAudioRef.current.onerror = null;
      waniKaniAudioRef.current.onpause = null;
      waniKaniAudioRef.current.pause();
    }
    waniKaniAudioRef.current = null;
  }, []);

  const closeInspector = useCallback(() => {
    setVoicePromptTokenId(null);
    setSelectedToken(null);
    onSelectionChange?.(false);
  }, [onSelectionChange]);

  const subjects = useMemo(() => dataset?.subjects ?? [], [dataset?.subjects]);
  const assignments = useMemo(() => dataset?.assignments ?? [], [dataset?.assignments]);
  const jpdbReady = Boolean(jpdbAnalysisEnabled && analysis.status === "ready" && analysis.sourceText === analysisSourceText && analysis.tokens.length);
  const annotations = useMemo(() => {
    if (selectionAnalysisPending) return [];
    if (!jpdbReady) return annotateWithWaniKaniFallback(sourceText, subjects, assignments);
    const analysisEnd = analysisStart + sourceText.length;
    return annotateJpdbTokens(analysis.tokens, subjects, assignments)
      .filter((annotation) => annotation.start >= analysisStart && annotation.end <= analysisEnd)
      .map((annotation) => ({ ...annotation, start: annotation.start - analysisStart, end: annotation.end - analysisStart }));
  }, [analysis.tokens, analysisStart, assignments, jpdbReady, selectionAnalysisPending, sourceText, subjects]);
  const renderedBlocks = useMemo(() => readerDocument.blocks.map((block) => {
    if (block.type === "image") return block;
    const localAnnotations = annotations
      .filter((annotation) => annotation.start >= block.start && annotation.end <= block.end)
      .map((annotation) => ({ ...annotation, start: annotation.start - block.start, end: annotation.end - block.start }))
      .filter((annotation) => !showFurigana || (block.furigana ?? []).every((range) => {
        const overlaps = annotation.start < range.end && annotation.end > range.start;
        return !overlaps || (annotation.start <= range.start && annotation.end >= range.end);
      }));
    return { ...block, pieces: readerPieces(block.text, localAnnotations) };
  }), [annotations, readerDocument.blocks, showFurigana]);
  const renderedAnnotations = useMemo(() => renderedBlocks.flatMap((block) => block.type === "text"
    ? block.pieces.flatMap((piece) => piece.kind === "annotation" && (selectionRequest || isInteractiveAnnotation(piece.annotation)) ? [piece.annotation] : [])
    : []), [renderedBlocks, selectionRequest]);
  const requestedAnnotation = useMemo(() => {
    if (!selectionRequest || !renderedAnnotations.length) return null;
    for (const delta of [0, -1, 1, -2, 2]) {
      const offset = Math.max(0, Math.min(sourceText.length - 1, selectionRequest.index + delta));
      const annotation = renderedAnnotations.find((candidate) => offset >= candidate.start && offset < candidate.end);
      if (annotation) return annotation;
    }
    return null;
  }, [renderedAnnotations, selectionRequest, sourceText.length]);
  const selected = useMemo(() => {
    if (inspectorActive === false) return null;
    if (selectionRequest) return requestedAnnotation;
    if (!selectedToken) return null;
    const exact = renderedAnnotations.find((annotation) => annotation.id === selectedToken.id);
    if (exact) return exact;
    const replacements = renderedAnnotations.filter((annotation) => (
      annotation.start === selectedToken.start
      && annotation.end === selectedToken.end
      && annotation.text === selectedToken.text
    ));
    return replacements.length === 1 ? replacements[0] : null;
  }, [inspectorActive, renderedAnnotations, requestedAnnotation, selectedToken, selectionRequest]);
  const pieceCount = renderedBlocks.reduce((total, block) => total + (block.type === "text" ? block.pieces.length : 0), 0);

  useEffect(() => {
    if (!selectionRequest || !requestedAnnotation) {
      resolvedSelectionRef.current = "";
      return;
    }
    const signature = `${selectionRequest.id}:${requestedAnnotation.start}:${requestedAnnotation.end}:${requestedAnnotation.text}`;
    if (resolvedSelectionRef.current === signature) return;
    resolvedSelectionRef.current = signature;
    onSelectionResolved?.({
      requestId: selectionRequest.id,
      text: requestedAnnotation.text,
      start: requestedAnnotation.start,
      end: requestedAnnotation.end,
    });
  }, [onSelectionResolved, requestedAnnotation, selectionRequest]);

  useEffect(() => {
    if (!selectedToken || selected === selectedToken) return;
    let current = true;
    void Promise.resolve().then(() => {
      if (!current) return;
      if (selected) setSelectedToken(selected);
      else closeInspector();
    });
    return () => { current = false; };
  }, [closeInspector, selected, selectedToken]);

  useLayoutEffect(() => {
    if (inspectorMode !== "floating" || !selected) {
      floatingRefs.setReference(null);
      return;
    }
    floatingRefs.setReference(tokenRefs.current.get(selected.id) ?? null);
  }, [floatingRefs, inspectorMode, selected]);

  useEffect(() => {
    if (inspectorMode !== "floating" || !selected) return;
    let iframeBlurTimer: number | null = null;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const readerToken = [...tokenRefs.current.values()].some((token) => token.contains(target));
      if (readerToken || inspectorRef.current?.contains(target)) return;
      closeInspector();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeInspector();
    };
    const handleWindowBlur = () => {
      if (document.activeElement?.tagName === "IFRAME") {
        closeInspector();
        return;
      }
      if (iframeBlurTimer !== null) window.clearTimeout(iframeBlurTimer);
      iframeBlurTimer = window.setTimeout(() => {
        iframeBlurTimer = null;
        if (document.activeElement?.tagName === "IFRAME") closeInspector();
      }, 0);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      if (iframeBlurTimer !== null) window.clearTimeout(iframeBlurTimer);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [closeInspector, inspectorMode, selected]);

  function select(annotation: ReaderAnnotation, index: number) {
    setVoicePromptTokenId((current) => current === annotation.id ? current : null);
    setSelectedToken(annotation);
    onSelectionChange?.(true);
    onProgress?.(pieceCount ? Math.min(1, (index + 1) / pieceCount) : 0);
  }

  function inspect(annotation: ReaderAnnotation) {
    setVoicePromptTokenId((current) => current === annotation.id ? current : null);
    setSelectedToken(annotation);
    onSelectionChange?.(true);
  }

  const stopWaniKaniAudio = useCallback(() => {
    const audio = waniKaniAudioRef.current;
    waniKaniAudioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;
      audio.pause();
    }
    setWaniKaniAudioState(null);
  }, []);

  async function speak() {
    if (!selected) return;
    const activeTts = voice.activeSentence === selected.text && (voice.activity === "synthesizing" || voice.activity === "playing");
    if (activeTts) {
      stopWaniKaniAudio();
      voice.stop();
      return;
    }
    const waniKaniAudio = waniKaniPronunciationAudio(selected, user?.data.preferences.default_voice_actor_id);
    if (waniKaniAudio) {
      if (waniKaniAudioState?.url === waniKaniAudio.url) {
        stopWaniKaniAudio();
        return;
      }
      voice.stop();
      stopWaniKaniAudio();
      const audio = new Audio(waniKaniAudio.url);
      waniKaniAudioRef.current = audio;
      const selectedText = selected.text;
      const resetAudio = () => {
        if (waniKaniAudioRef.current !== audio) return;
        waniKaniAudioRef.current = null;
        setWaniKaniAudioState(null);
      };
      audio.onended = resetAudio;
      audio.onerror = resetAudio;
      audio.onpause = resetAudio;
      setWaniKaniAudioState({ url: waniKaniAudio.url, text: selectedText, status: "loading" });
      try {
        await audio.play();
        if (waniKaniAudioRef.current === audio) {
          setWaniKaniAudioState({ url: waniKaniAudio.url, text: selectedText, status: "playing" });
        }
      } catch {
        resetAudio();
        if (voice.downloaded) await voice.play(selectedText);
      }
      return;
    }
    if (!voice.downloaded) return;
    stopWaniKaniAudio();
    await voice.play(selected.text);
  }

  const analysisMessage = loading
    ? "Loading your WaniKani study state…"
    : jpdbAnalysisEnabled && (analysis.status === "loading" || analysis.status === "error")
      ? analysis.message
      : !jpdbRecognitionEnabled
        ? "WaniKani-only recognition is active."
        : jpdbApiKey
        ? analysis.sourceText === analysisSourceText ? analysis.message || "Preparing JPDB analysis…" : "Preparing JPDB analysis…"
        : "WaniKani matching is active. Add a JPDB key in Settings to enable grammar, verb, and vocabulary recognition.";

  function renderPiece(piece: ReaderPiece, index: number, furigana?: readonly FuriganaRange[]) {
    const sourceContents = renderFurigana(piece.text, piece.start, piece.end, furigana, showFurigana);
    const contents = piece.kind === "annotation" && sourceContents === piece.text
      ? renderAnnotationFurigana(piece.annotation, showFurigana)
      : sourceContents;
    if (piece.kind === "text") return <span key={piece.id}>{contents}</span>;
    const annotation = piece.annotation;
    if (!isInteractiveAnnotation(annotation)) return <span key={piece.id}>{contents}</span>;
    const tokenKind = readerTokenKind(annotation);
    const tokenClass = tokenKind === "grammar" ? styles.tokenGrammar : tokenKind === "verb" ? styles.tokenVerb : styles.tokenVocabulary;
    const isSelected = selected?.id === annotation.id;
    return <button
      key={piece.id}
      ref={(node) => {
        if (node) tokenRefs.current.set(annotation.id, node);
        else tokenRefs.current.delete(annotation.id);
      }}
      type="button"
      className={`${styles.token} ${tokenClass} ${isSelected ? styles.tokenSelected : ""}`}
      aria-label={`Inspect ${annotationLabel(annotation)}`}
      data-token-kind={tokenKind}
      data-selected={isSelected ? "true" : undefined}
      onClick={() => select(annotation, index)}
      onMouseEnter={detailsInteraction === "hover" ? () => inspect(annotation) : undefined}
    >{contents}</button>;
  }

  let pieceCursor = 0;
  const selectedWaniKaniAudio = selected ? waniKaniPronunciationAudio(selected, user?.data.preferences.default_voice_actor_id) : undefined;
  const selectedWaniKaniState = selectedWaniKaniAudio && waniKaniAudioState?.url === selectedWaniKaniAudio.url && waniKaniAudioState.text === selected?.text
    ? waniKaniAudioState.status
    : null;
  const selectedTtsState = selected && voice.activeSentence === selected.text && (voice.activity === "synthesizing" || voice.activity === "playing")
    ? voice.activity
    : null;
  const selectedAudioState = selectedWaniKaniState ?? selectedTtsState ?? "idle";
  const selectedAudioSource = selectedTtsState ? "tts" : selectedWaniKaniAudio ? "wanikani" : "tts";
  const selectedAudioLoading = selectedAudioState === "loading" || selectedAudioState === "synthesizing";
  const selectedAudioLabel = selected
    ? selectedAudioLoading
      ? `Cancel speaking ${selected.text}`
      : selectedAudioState === "playing"
        ? `Stop speaking ${selected.text}`
        : `Speak ${selected.text}`
    : "Speak";
  const selectedAudioTitle = selectedAudioState === "idle"
    ? selectedWaniKaniAudio ? "Play WaniKani pronunciation" : "Play the downloaded Japanese voice"
    : selectedAudioLabel;
  const voicePromptOpen = Boolean(selected && voicePromptTokenId === selected.id && voice.checked && voice.supported && !voice.downloaded);
  const downloadingVoice = voice.activity === "downloading";
  const voiceDownloadLabel = downloadingVoice
    ? "Cancel download"
    : voice.error
      ? "Retry download"
      : `Download voice · ${JAPANESE_VOICE_DOWNLOAD_LABEL}`;

  const inspector = selected || (!inspectorOnly && (selectionAnalysisPending || (appearance === "default" && inspectorMode === "inline"))) ? <aside
    ref={(node) => { inspectorRef.current = node; }}
    className={`${styles.panel} ${styles.sticky} ${styles.inspector} ${inspectorMode === "floating" ? styles.readerFloatingInspector : ""}`}
    aria-live="polite"
    data-kind={selected ? readerInspectorKind(selected) : undefined}
    data-floating={inspectorMode === "floating" ? "true" : undefined}
  >
    {selected ? (
      <>
        <div className={styles.readerInspectorHeader}>
          <strong className={styles.lookupTerm} lang="ja">{selected.text}</strong>
          <span className={styles.readerInspectorMeta}>
            <span>{selected.subject ? `Lv ${selected.subject.data.level}` : selected.source === "jpdb" ? "JPDB" : "Lookup"}</span>
            {selected.subject ? typeof selected.srsStage === "number" && selected.srsStage > 0
              ? <SrsStageIcon stage={selected.srsStage} size={18} title={srsStageLabel(selected.srsStage)} />
              : <LockKeyhole size={16} role="img" aria-label={srsStageLabel(selected.srsStage)} />
            : null}
          </span>
          {selectedWaniKaniAudio || voice.downloaded ? <button
            type="button"
            className={styles.readerInspectorSpeak}
            onClick={() => void speak()}
            aria-label={selectedAudioLabel}
            aria-busy={selectedAudioLoading}
            data-state={selectedAudioState}
            data-audio-source={selectedAudioSource}
            title={selectedAudioTitle}
          >{selectedAudioLoading ? <LoaderCircle className={styles.spin} size={18} aria-hidden /> : selectedAudioState === "playing" ? <Square size={16} aria-hidden /> : <Volume2 size={18} aria-hidden />}</button> : !voice.checked ? <button
            type="button"
            className={styles.readerInspectorSpeak}
            aria-label={`Checking Japanese voice for ${selected.text}`}
            aria-busy="true"
            data-state="loading"
            disabled
          ><LoaderCircle className={styles.spin} size={18} aria-hidden /></button> : voice.supported ? <button
            type="button"
            className={styles.readerInspectorSpeak}
            aria-label={`Download Japanese voice for ${selected.text}`}
            aria-expanded={voicePromptOpen}
            aria-controls={`${voicePromptId}-prompt`}
            data-audio-source="download"
            title="Download the Japanese voice"
            onClick={() => setVoicePromptTokenId((current) => current === selected.id ? null : selected.id)}
          ><Volume2 size={18} aria-hidden="true" /></button> : <button
            type="button"
            className={styles.readerInspectorSpeak}
            aria-label={`Japanese voice unavailable for ${selected.text}`}
            title="The Japanese voice is unavailable in this browser"
            disabled
          ><Volume2 size={18} aria-hidden="true" /></button>}
        </div>
        <div className={styles.readerInspectorBody}>
          {voicePromptOpen ? <div
            id={`${voicePromptId}-prompt`}
            className={styles.readerVoicePrompt}
            role="group"
            aria-labelledby={`${voicePromptId}-label`}
          >
            <strong id={`${voicePromptId}-label`}>Download Japanese voice?</strong>
            <p>Download {JAPANESE_VOICE_NAME} once and keep it in this browser ({JAPANESE_VOICE_DOWNLOAD_LABEL}).</p>
            {downloadingVoice && voice.message ? <p className={styles.hint} role="status">{voice.message}</p> : null}
            {voice.error ? <p className={styles.error} role="alert">{voice.error}</p> : null}
            <button
              type="button"
              className={styles.button}
              onClick={() => downloadingVoice ? voice.cancelDownload() : void voice.download()}
            >
              {downloadingVoice ? <LoaderCircle className={styles.spin} size={16} aria-hidden /> : <Download size={16} aria-hidden />}
              {voiceDownloadLabel}
            </button>
          </div> : null}
          <div className={styles.readerFacts}>
            <dl className={styles.readerPrimaryFacts} data-reader-primary-facts aria-label="Reading and meaning">
              {annotationReading(selected) ? <div><dt>Reading</dt><dd lang="ja">{annotationReading(selected)}</dd></div> : null}
              <div><dt>Meaning</dt><dd>{annotationMeanings(selected).slice(0, 4).join(" · ")}</dd></div>
            </dl>
            <dl className={styles.readerSecondaryFacts}>
              {(selected.spelling || selected.subject?.data.characters) && (selected.spelling || selected.subject?.data.characters) !== selected.text ? <div><dt>Dictionary</dt><dd lang="ja">{selected.spelling || selected.subject?.data.characters}</dd></div> : null}
              <div><dt>Type</dt><dd>{selected.partsOfSpeech.length ? [...new Set(selected.partsOfSpeech.map(partOfSpeechLabel))].join(" · ") : partOfSpeechLabel(selected.tokenType)}</dd></div>
              {selected.alternativeSpellings.length ? <div><dt>Alternative forms</dt><dd lang="ja">{selected.alternativeSpellings.slice(0, 5).join(" · ")}</dd></div> : null}
            </dl>
          </div>
          <div className={styles.readerInspectorActions}>
            {selected.subject ? <Link className={styles.readerDetailsButton} href={`/subjects/${selected.subject.id}${subjectReturnTo ? `?returnTo=${encodeURIComponent(subjectReturnTo)}` : ""}`}>View details <ArrowRight size={16} aria-hidden="true" /></Link> : null}
            <a className={styles.secondaryButton} href={`https://jisho.org/search/${encodeURIComponent(selected.spelling || selected.text)}`} target="_blank" rel="noreferrer">Jisho <ExternalLink size={15} aria-hidden="true" /></a>
          </div>
        </div>
      </>
    ) : selectionAnalysisPending
      ? <div className={styles.readerInspectorEmpty} role="status"><LoaderCircle className={styles.spin} size={18} aria-hidden /><strong>Preparing word details…</strong></div>
      : <div className={styles.readerInspectorEmpty}><strong>Word details</strong><p className={styles.hint}>{detailsInteraction === "hover" ? "Hover over or click an underlined word to see its reading and meaning." : "Click an underlined word to see its reading and meaning. Hover only highlights it."}</p>{jpdbRecognitionEnabled && !jpdbApiKey ? <Link className={styles.secondaryButton} href="/settings#jpdb-api-key">Add JPDB key</Link> : null}</div>}
  </aside> : null;

  const positionedInspector = inspectorMode === "floating" && selected && inspector && typeof window !== "undefined"
    ? createPortal(<div ref={setFloatingElement} className={styles.readerFloatingLayer} style={floatingStyles}>{inspector}</div>, window.document.body)
    : inspector;

  if (inspectorOnly) return <div
    className={styles.readerGrid}
    data-appearance={appearance}
    data-inspector-mode={inspectorMode}
    data-details-interaction={detailsInteraction}
    data-has-selection={selected ? "true" : "false"}
    data-inspector-only="true"
  >{positionedInspector}</div>;

  return (
    <div className={styles.readerGrid} data-appearance={appearance} data-inspector-mode={inspectorMode} data-details-interaction={detailsInteraction} data-has-selection={selected ? "true" : "false"}>
      <div className={styles.readerColumn}>
        {appearance === "default" ? <div className={styles.readerAnnotationBar} aria-label="Annotation key">
          <span data-token-kind="vocabulary"><i aria-hidden="true" />Vocabulary</span>
          <span data-token-kind="verb"><i aria-hidden="true" />Verbs</span>
          <span data-token-kind="grammar"><i aria-hidden="true" />Grammar</span>
          {onShowFuriganaChange ? <button type="button" className={styles.furiganaToggle} aria-pressed={showFurigana} aria-label="Furigana" onClick={() => onShowFuriganaChange(!showFurigana)}><Languages size={15} aria-hidden="true" />Furigana {showFurigana ? "on" : "off"}</button> : null}
          <small role="status" className={analysis.status === "error" ? styles.error : undefined}>{analysisMessage}</small>
        </div> : null}
        <article className={`${styles.panel} ${styles.readingSurface}`} aria-label={ariaLabel} lang="ja" data-document={blocks?.length ? "true" : "false"}>
          {renderedBlocks.map((block) => {
            if (block.type === "image") {
              const imageUrl = proxyNewsImageUrl(block.url);
              if (!imageUrl) return null;
              return <figure className={styles.readerDocumentImage} data-reader-block="image" key={block.id}><Image src={imageUrl} alt={block.alt || "Story illustration"} width={1200} height={675} sizes="(max-width: 960px) 100vw, 760px" unoptimized /></figure>;
            }
            return <div className={styles.readerTextBlock} data-reader-block="text" key={block.id}>{block.pieces.map((piece) => renderPiece(piece, pieceCursor++, block.furigana))}</div>;
          })}
        </article>
        {supplement}
      </div>
      {positionedInspector}
    </div>
  );
}
