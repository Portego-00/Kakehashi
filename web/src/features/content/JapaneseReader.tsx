"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ExternalLink, Languages, Volume2 } from "lucide-react";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useStudyDataset } from "@/features/study/use-study-dataset";
import type { JpdbTokenAnnotation } from "./jpdb";
import type { FuriganaRange } from "./types";
import { annotateJpdbTokens, annotateWithWaniKaniFallback, readerPieces, srsStageLabel, type ReaderAnnotation, type ReaderPiece } from "./annotation";
import { proxyNewsImageUrl } from "./news-images";
import styles from "./content.module.css";

interface AnalysisState {
  status: "idle" | "loading" | "ready" | "error";
  sourceText: string;
  tokens: JpdbTokenAnnotation[];
  message: string;
}

const EMPTY_ANALYSIS: AnalysisState = { status: "idle", sourceText: "", tokens: [], message: "" };

export type JapaneseReaderBlock =
  | { type: "text"; text: string; furigana?: readonly FuriganaRange[] }
  | { type: "image"; url: string; alt?: string };

export interface JapaneseReaderAnalysisContext {
  text: string;
  start: number;
}

export interface JapaneseReaderProps {
  text: string;
  blocks?: readonly JapaneseReaderBlock[];
  analysisContext?: JapaneseReaderAnalysisContext;
  ariaLabel?: string;
  onProgress?: (progress: number) => void;
  appearance?: "default" | "compact";
  showFurigana?: boolean;
  onShowFuriganaChange?: (value: boolean) => void;
  supplement?: ReactNode;
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
  if (annotation.source === "jpdb" && annotation.reading) return annotation.reading;
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

function readerSourceLabel(annotation: ReaderAnnotation) {
  if (annotation.subject) {
    return `${annotation.source === "jpdb" ? "JPDB + WaniKani" : "WaniKani"} · ${srsStageLabel(annotation.srsStage)}`;
  }
  return "JPDB · No WaniKani match";
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

export function JapaneseReader({ text, blocks, analysisContext, ariaLabel = "Japanese reading text", onProgress, appearance = "default", showFurigana = false, onShowFuriganaChange, supplement }: JapaneseReaderProps) {
  const { user, dataset, loading } = useStudyDataset();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const jpdbApiKey = settings.integrations.jpdbApiKey;
  const detailsInteraction = settings.reader.detailsInteraction;
  const jpdbRecognitionEnabled = settings.reader.recognitionMode === "wk-jpdb";
  const jpdbAnalysisEnabled = jpdbRecognitionEnabled && Boolean(jpdbApiKey);
  const [analysis, setAnalysis] = useState<AnalysisState>(EMPTY_ANALYSIS);
  const [selected, setSelected] = useState<ReaderAnnotation | null>(null);
  const document = useMemo(() => prepareReaderDocument(text, blocks), [blocks, text]);
  const sourceText = document.text;
  const analysisSourceText = analysisContext?.text ?? sourceText;
  const analysisStart = analysisContext?.start ?? 0;

  useEffect(() => {
    if (!jpdbAnalysisEnabled || !analysisSourceText.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAnalysis({ status: "loading", sourceText: analysisSourceText, tokens: [], message: "Analyzing Japanese with JPDB…" });
      void fetch("/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: analysisSourceText, apiKey: jpdbApiKey }),
        signal: controller.signal,
      }).then(async (response) => {
        const payload = await response.json() as { tokens?: JpdbTokenAnnotation[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "JPDB analysis failed.");
        setAnalysis({ status: "ready", sourceText: analysisSourceText, tokens: Array.isArray(payload.tokens) ? payload.tokens : [], message: "JPDB parsing mapped against your WaniKani library." });
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAnalysis({ status: "error", sourceText: analysisSourceText, tokens: [], message: error instanceof Error ? error.message : "JPDB analysis failed." });
      });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [analysisSourceText, jpdbAnalysisEnabled, jpdbApiKey]);

  const subjects = useMemo(() => dataset?.subjects ?? [], [dataset?.subjects]);
  const assignments = useMemo(() => dataset?.assignments ?? [], [dataset?.assignments]);
  const jpdbReady = Boolean(jpdbAnalysisEnabled && analysis.status === "ready" && analysis.sourceText === analysisSourceText && analysis.tokens.length);
  const annotations = useMemo(() => {
    if (!jpdbReady) return annotateWithWaniKaniFallback(sourceText, subjects, assignments);
    const analysisEnd = analysisStart + sourceText.length;
    return annotateJpdbTokens(analysis.tokens, subjects, assignments)
      .filter((annotation) => annotation.start >= analysisStart && annotation.end <= analysisEnd)
      .map((annotation) => ({ ...annotation, start: annotation.start - analysisStart, end: annotation.end - analysisStart }));
  }, [analysis.tokens, analysisStart, assignments, jpdbReady, sourceText, subjects]);
  const renderedBlocks = useMemo(() => document.blocks.map((block) => {
    if (block.type === "image") return block;
    const localAnnotations = annotations
      .filter((annotation) => annotation.start >= block.start && annotation.end <= block.end)
      .map((annotation) => ({ ...annotation, start: annotation.start - block.start, end: annotation.end - block.start }))
      .filter((annotation) => !showFurigana || (block.furigana ?? []).every((range) => {
        const overlaps = annotation.start < range.end && annotation.end > range.start;
        return !overlaps || (annotation.start <= range.start && annotation.end >= range.end);
      }));
    return { ...block, pieces: readerPieces(block.text, localAnnotations) };
  }), [annotations, document.blocks, showFurigana]);
  const pieceCount = renderedBlocks.reduce((total, block) => total + (block.type === "text" ? block.pieces.length : 0), 0);

  function select(annotation: ReaderAnnotation, index: number) {
    setSelected(annotation);
    onProgress?.(pieceCount ? Math.min(1, (index + 1) / pieceCount) : 0);
  }

  function inspect(annotation: ReaderAnnotation) {
    setSelected(annotation);
  }

  function speak() {
    if (!selected || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selected.text);
    utterance.lang = "ja-JP";
    speechSynthesis.speak(utterance);
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
    if (!annotation.subject && annotation.source === "wanikani") return <span key={piece.id}>{contents}</span>;
    const tokenKind = readerTokenKind(annotation);
    const tokenClass = tokenKind === "grammar" ? styles.tokenGrammar : tokenKind === "verb" ? styles.tokenVerb : styles.tokenVocabulary;
    const isSelected = selected?.id === annotation.id;
    return <button
      key={piece.id}
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

  return (
    <div className={styles.readerGrid} data-appearance={appearance} data-details-interaction={detailsInteraction} data-has-selection={selected ? "true" : "false"}>
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
      {selected || appearance === "default" ? <aside className={`${styles.panel} ${styles.sticky} ${styles.inspector}`} aria-live="polite" data-kind={selected ? readerInspectorKind(selected) : undefined}>
        {selected ? (
          <>
            <div className={styles.readerInspectorHeader}>
              <strong className={styles.lookupTerm} lang="ja">{selected.text}</strong>
              <span>{selected.subject ? `Lv ${selected.subject.data.level}` : "JPDB"}</span>
              <button type="button" className={styles.readerInspectorSpeak} onClick={speak} aria-label={`Speak ${selected.text}`}><Volume2 size={18} aria-hidden="true" /></button>
            </div>
            <div className={styles.readerInspectorBody}>
              <dl className={styles.readerFacts}>
              {annotationReading(selected) ? <div><dt>Reading</dt><dd lang="ja">{annotationReading(selected)}</dd></div> : null}
              <div><dt>Meaning</dt><dd>{annotationMeanings(selected).slice(0, 4).join(" · ")}</dd></div>
              {(selected.spelling || selected.subject?.data.characters) && (selected.spelling || selected.subject?.data.characters) !== selected.text ? <div><dt>Dictionary</dt><dd lang="ja">{selected.spelling || selected.subject?.data.characters}</dd></div> : null}
              <div><dt>Type</dt><dd>{selected.partsOfSpeech.length ? [...new Set(selected.partsOfSpeech.map(partOfSpeechLabel))].join(" · ") : partOfSpeechLabel(selected.tokenType)}</dd></div>
              {selected.alternativeSpellings.length ? <div><dt>Alternative forms</dt><dd lang="ja">{selected.alternativeSpellings.slice(0, 5).join(" · ")}</dd></div> : null}
              <div><dt>Status</dt><dd>{readerSourceLabel(selected)}</dd></div>
              </dl>
              <div className={styles.readerInspectorActions}>
                {selected.subject ? <Link className={styles.readerDetailsButton} href={`/subjects/${selected.subject.id}`}>View details <ArrowRight size={16} aria-hidden="true" /></Link> : null}
                <a className={styles.secondaryButton} href={`https://jisho.org/search/${encodeURIComponent(selected.spelling || selected.text)}`} target="_blank" rel="noreferrer">Jisho <ExternalLink size={15} aria-hidden="true" /></a>
              </div>
            </div>
          </>
        ) : <div className={styles.readerInspectorEmpty}><strong>Word details</strong><p className={styles.hint}>{detailsInteraction === "hover" ? "Hover over or click an underlined word to see its reading and meaning." : "Click an underlined word to see its reading and meaning. Hover only highlights it."}</p>{jpdbRecognitionEnabled && !jpdbApiKey ? <Link className={styles.secondaryButton} href="/settings#jpdb-api-key">Add JPDB key</Link> : null}</div>}
      </aside> : null}
    </div>
  );
}
