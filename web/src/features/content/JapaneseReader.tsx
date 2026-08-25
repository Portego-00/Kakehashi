"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Volume2 } from "lucide-react";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useStudyDataset } from "@/features/study/use-study-dataset";
import type { JpdbTokenAnnotation } from "./jpdb";
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
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt?: string };

export interface JapaneseReaderAnalysisContext {
  text: string;
  start: number;
}

type PreparedReaderBlock =
  | { type: "text"; id: string; text: string; start: number; end: number }
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

function subjectMeaning(annotation: ReaderAnnotation) {
  return annotation.subject?.data.meanings.find((meaning) => meaning.primary)?.meaning
    ?? annotation.subject?.data.meanings[0]?.meaning
    ?? annotation.meaning
    ?? "No English gloss returned";
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

export function JapaneseReader({ text, blocks, analysisContext, ariaLabel = "Japanese reading text", onProgress, interaction = "navigate" }: { text: string; blocks?: readonly JapaneseReaderBlock[]; analysisContext?: JapaneseReaderAnalysisContext; ariaLabel?: string; onProgress?: (progress: number) => void; interaction?: "navigate" | "tooltip" }) {
  const { user, dataset, loading } = useStudyDataset();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const jpdbApiKey = settings.integrations.jpdbApiKey;
  const [analysis, setAnalysis] = useState<AnalysisState>(EMPTY_ANALYSIS);
  const [selected, setSelected] = useState<ReaderAnnotation | null>(null);
  const document = useMemo(() => prepareReaderDocument(text, blocks), [blocks, text]);
  const sourceText = document.text;
  const analysisSourceText = analysisContext?.text ?? sourceText;
  const analysisStart = analysisContext?.start ?? 0;

  useEffect(() => {
    if (!jpdbApiKey || !analysisSourceText.trim()) return;
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
  }, [analysisSourceText, jpdbApiKey]);

  const subjects = useMemo(() => dataset?.subjects ?? [], [dataset?.subjects]);
  const assignments = useMemo(() => dataset?.assignments ?? [], [dataset?.assignments]);
  const jpdbReady = Boolean(jpdbApiKey && analysis.status === "ready" && analysis.sourceText === analysisSourceText && analysis.tokens.length);
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
      .map((annotation) => ({ ...annotation, start: annotation.start - block.start, end: annotation.end - block.start }));
    return { ...block, pieces: readerPieces(block.text, localAnnotations) };
  }), [annotations, document.blocks]);
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
    : analysis.status === "loading" || analysis.status === "error"
      ? analysis.message
      : jpdbApiKey
        ? analysis.sourceText === analysisSourceText ? analysis.message || "Preparing JPDB analysis…" : "Preparing JPDB analysis…"
        : "WaniKani exact matching is active. Add a JPDB key in Settings for full parse-first annotation.";

  function renderPiece(piece: ReaderPiece, index: number) {
    if (piece.kind === "text") return <span key={piece.id}>{piece.text}</span>;
    const annotation = piece.annotation;
    if (!annotation.subject && annotation.source === "wanikani") return <span key={piece.id}>{annotation.text}</span>;
    const tokenClass = annotation.subject ? (annotation.known ? styles.tokenKnown : styles.tokenLearning) : styles.tokenJpdb;
    if (annotation.subject && interaction === "navigate") {
      return <Link key={piece.id} href={`/subjects/${annotation.subject.id}`} className={`${styles.token} ${tokenClass} ${selected?.id === annotation.id ? styles.tokenSelected : ""}`} aria-label={`${annotationLabel(annotation)}. Open subject details.`} onFocus={() => inspect(annotation)} onMouseEnter={() => inspect(annotation)}>{annotation.text}</Link>;
    }
    return <button key={piece.id} type="button" className={`${styles.token} ${tokenClass} ${selected?.id === annotation.id ? styles.tokenSelected : ""}`} aria-label={`Inspect ${annotationLabel(annotation)}`} onClick={() => select(annotation, index)} onFocus={() => inspect(annotation)} onMouseEnter={() => inspect(annotation)}>{annotation.text}</button>;
  }

  let pieceCursor = 0;

  return (
    <div className={styles.readerGrid}>
      <div className={styles.readerColumn}>
        <div className={styles.readerAnnotationBar} aria-label="Annotation key">
          <span data-state="known"><i aria-hidden="true" />Known</span>
          <span data-state="learning"><i aria-hidden="true" />Not yet passed</span>
          <span data-state="jpdb"><i aria-hidden="true" />JPDB only</span>
          <small role="status" className={analysis.status === "error" ? styles.error : undefined}>{analysisMessage}</small>
        </div>
        <article className={`${styles.panel} ${styles.readingSurface}`} aria-label={ariaLabel} lang="ja" data-document={blocks?.length ? "true" : "false"}>
          {renderedBlocks.map((block) => {
            if (block.type === "image") {
              const imageUrl = proxyNewsImageUrl(block.url);
              if (!imageUrl) return null;
              return <figure className={styles.readerDocumentImage} data-reader-block="image" key={block.id}><Image src={imageUrl} alt={block.alt || "Story illustration"} width={1200} height={675} sizes="(max-width: 960px) 100vw, 760px" unoptimized /></figure>;
            }
            return <div className={styles.readerTextBlock} data-reader-block="text" key={block.id}>{block.pieces.map((piece) => renderPiece(piece, pieceCursor++))}</div>;
          })}
        </article>
      </div>
      <aside className={`${styles.panel} ${styles.sticky} ${styles.inspector}`} aria-live="polite">
        {selected ? (
          <>
            <div className={styles.inline}><strong className={styles.lookupTerm} lang="ja">{selected.text}</strong><button type="button" className={styles.iconButton} onClick={speak} aria-label={`Speak ${selected.text}`}><Volume2 size={18} aria-hidden="true" /></button></div>
            <div className={styles.readerItemState} data-state={selected.subject ? (selected.known ? "known" : "learning") : "jpdb"}>{selected.subject && selected.srsStage ? <SrsStageIcon stage={selected.srsStage} size={18} /> : null}<span>{selected.source === "jpdb" ? "JPDB analysis" : "WaniKani exact match"}{selected.subject ? ` · ${srsStageLabel(selected.srsStage)}` : " · No WaniKani match"}</span></div>
            <dl className={styles.readerFacts}>
              <div><dt>Dictionary form</dt><dd lang="ja">{selected.spelling || selected.subject?.data.characters || selected.text}</dd></div>
              {annotationReading(selected) ? <div><dt>Reading</dt><dd lang="ja">{annotationReading(selected)}</dd></div> : null}
              <div><dt>Part of speech</dt><dd>{selected.partsOfSpeech.length ? [...new Set(selected.partsOfSpeech.map(partOfSpeechLabel))].join(" · ") : selected.tokenType}</dd></div>
              {selected.alternativeSpellings.length ? <div><dt>Alternative forms</dt><dd lang="ja">{selected.alternativeSpellings.slice(0, 5).join(" · ")}</dd></div> : null}
              {selected.subject ? <div><dt>WaniKani match</dt><dd>{selected.subject.object.replace("_", " ")} · Level {selected.subject.data.level} · {subjectMeaning(selected)}</dd></div> : null}
            </dl>
            <div className={styles.readerMeanings}><strong>Meanings</strong><ol>{annotationMeanings(selected).map((meaning, index) => <li key={`${meaning}-${index}`}>{meaning}</li>)}</ol></div>
            <div className={styles.inline}>
              {selected.subject ? <Link className={styles.secondaryButton} href={`/subjects/${selected.subject.id}`}>Open subject details</Link> : null}
              <a className={styles.secondaryButton} href={`https://jisho.org/search/${encodeURIComponent(selected.spelling || selected.text)}`} target="_blank" rel="noreferrer">Jisho <ExternalLink size={15} aria-hidden="true" /></a>
            </div>
          </>
        ) : <><strong>Article annotations</strong><p className={styles.hint}>Green terms are passed in WaniKani. Red terms are WaniKani subjects you have not passed yet. Dotted terms come from JPDB. WaniKani terms open their full subject page.</p>{!jpdbApiKey ? <Link className={styles.secondaryButton} href="/settings">Add JPDB key</Link> : null}</>}
      </aside>
    </div>
  );
}
