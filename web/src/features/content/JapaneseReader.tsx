"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Volume2 } from "lucide-react";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useStudyDataset } from "@/features/study/use-study-dataset";
import type { JpdbTokenAnnotation } from "./jpdb";
import { annotateJpdbTokens, annotateWithWaniKaniFallback, readerPieces, srsStageLabel, type ReaderAnnotation } from "./annotation";
import styles from "./content.module.css";

interface AnalysisState {
  status: "idle" | "loading" | "ready" | "error";
  sourceText: string;
  tokens: JpdbTokenAnnotation[];
  message: string;
}

const EMPTY_ANALYSIS: AnalysisState = { status: "idle", sourceText: "", tokens: [], message: "" };

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

export function JapaneseReader({ text, ariaLabel = "Japanese reading text", onProgress }: { text: string; ariaLabel?: string; onProgress?: (progress: number) => void }) {
  const { user, dataset, loading } = useStudyDataset();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const jpdbApiKey = settings.integrations.jpdbApiKey;
  const [analysis, setAnalysis] = useState<AnalysisState>(EMPTY_ANALYSIS);
  const [selected, setSelected] = useState<ReaderAnnotation | null>(null);

  useEffect(() => {
    if (!jpdbApiKey || !text.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAnalysis({ status: "loading", sourceText: text, tokens: [], message: "Analyzing article vocabulary with JPDB…" });
      void fetch("/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, apiKey: jpdbApiKey }),
        signal: controller.signal,
      }).then(async (response) => {
        const payload = await response.json() as { tokens?: JpdbTokenAnnotation[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "JPDB analysis failed.");
        setAnalysis({ status: "ready", sourceText: text, tokens: Array.isArray(payload.tokens) ? payload.tokens : [], message: "JPDB parsing mapped against your WaniKani library." });
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAnalysis({ status: "error", sourceText: text, tokens: [], message: error instanceof Error ? error.message : "JPDB analysis failed." });
      });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [jpdbApiKey, text]);

  const subjects = useMemo(() => dataset?.subjects ?? [], [dataset?.subjects]);
  const assignments = useMemo(() => dataset?.assignments ?? [], [dataset?.assignments]);
  const jpdbReady = Boolean(jpdbApiKey && analysis.status === "ready" && analysis.sourceText === text && analysis.tokens.length);
  const annotations = useMemo(() => jpdbReady
    ? annotateJpdbTokens(analysis.tokens, subjects, assignments)
    : annotateWithWaniKaniFallback(text, subjects, assignments), [analysis.tokens, assignments, jpdbReady, subjects, text]);
  const pieces = useMemo(() => readerPieces(text, annotations), [annotations, text]);

  function select(annotation: ReaderAnnotation, index: number) {
    setSelected(annotation);
    onProgress?.(pieces.length ? Math.min(1, (index + 1) / pieces.length) : 0);
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
        ? analysis.sourceText === text ? analysis.message || "Preparing JPDB analysis…" : "Preparing JPDB analysis…"
        : "WaniKani exact matching is active. Add a JPDB key in Settings for full parse-first annotation.";

  return (
    <div className={styles.readerGrid}>
      <div className={styles.readerColumn}>
        <div className={styles.readerAnnotationBar} aria-label="Annotation key">
          <span data-state="known"><i aria-hidden="true" />Known</span>
          <span data-state="learning"><i aria-hidden="true" />Not yet passed</span>
          <span data-state="jpdb"><i aria-hidden="true" />JPDB only</span>
          <small role="status" className={analysis.status === "error" ? styles.error : undefined}>{analysisMessage}</small>
        </div>
        <article className={`${styles.panel} ${styles.readingSurface}`} aria-label={ariaLabel} lang="ja">
          {pieces.map((piece, index) => {
            if (piece.kind === "text") return <span key={piece.id}>{piece.text}</span>;
            const annotation = piece.annotation;
            if (!annotation.subject && annotation.source === "wanikani") return <span key={piece.id}>{annotation.text}</span>;
            const tokenClass = annotation.subject ? (annotation.known ? styles.tokenKnown : styles.tokenLearning) : styles.tokenJpdb;
            if (annotation.subject) return <Link key={piece.id} href={`/subjects/${annotation.subject.id}`} className={`${styles.token} ${tokenClass} ${selected?.id === annotation.id ? styles.tokenSelected : ""}`} aria-label={`${annotationLabel(annotation)}. Open subject details.`} onFocus={() => inspect(annotation)} onMouseEnter={() => inspect(annotation)}>{annotation.text}</Link>;
            return <button key={piece.id} type="button" className={`${styles.token} ${tokenClass} ${selected?.id === annotation.id ? styles.tokenSelected : ""}`} aria-label={`Inspect ${annotationLabel(annotation)}`} onClick={() => select(annotation, index)} onFocus={() => inspect(annotation)} onMouseEnter={() => inspect(annotation)}>{annotation.text}</button>;
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
