"use client";

import { type PointerEvent, useRef } from "react";
import { Check, Eye, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  pitchAccentLabel,
  splitReadingIntoMoras,
  type PitchAccentEntry,
} from "@/features/subjects/enrichments";
import styles from "./AnkiAnswerContent.module.css";

export type AnkiAnswerContentProps = {
  revealed: boolean;
  hideAnswerCompletely?: boolean;
  questionKind: "meaning" | "reading";
  groupQuestions?: boolean;
  meaningAnswer: string;
  readingAnswer?: string;
  showReadingWithMeaning?: boolean;
  otherMeaningAnswers?: readonly string[];
  otherReadingAnswers?: readonly string[];
  userSynonyms?: readonly string[];
  partsOfSpeech?: readonly string[];
  pitchAccents?: readonly PitchAccentEntry[];
  showOtherAcceptedAnswersAndUserSynonyms?: boolean;
  showWaniKaniGrammarTags?: boolean;
  showPitchAccentNumbers?: boolean;
  showPitchAccentGraph?: boolean;
  showReplayAudioButton?: boolean;
  buttonlessMode?: boolean;
  replayingAudio?: boolean;
  onReveal: () => void;
  onReplayAudio?: () => void | Promise<void>;
  onGradeIncorrect: () => void;
  onGradeCorrect: () => void;
  onShowDetails?: () => void;
  onSkip?: () => void;
};

type SupplementaryRow = {
  key: string;
  label: string;
  values: string[];
  japanese?: boolean;
};

type ButtonlessGestureStart = {
  centerX: number;
  pointerId: number;
  startedOnGradeButton: boolean;
  x: number;
  y: number;
};

const BUTTONLESS_SWIPE_DISTANCE = 44;
const BUTTONLESS_VERTICAL_DOMINANCE = 1.2;
const BUTTONLESS_TAP_TOLERANCE = 14;

function uniqueValues(values: readonly string[] | undefined) {
  const unique = new Map<string, string>();
  for (const value of values ?? []) {
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();
    if (trimmed && !unique.has(key)) unique.set(key, trimmed);
  }
  return [...unique.values()];
}

function formatPartOfSpeech(value: string) {
  return value.replaceAll("_", " ");
}

function PrimaryAnswers({
  groupQuestions,
  meaningAnswer,
  questionKind,
  readingAnswer,
  showReadingWithMeaning,
}: Pick<
  AnkiAnswerContentProps,
  "groupQuestions" | "meaningAnswer" | "questionKind" | "readingAnswer" | "showReadingWithMeaning"
>) {
  if (groupQuestions) {
    return (
      <div className={styles.primaryAnswers} data-grouped="true">
        <div className={styles.primaryAnswer}>
          <span>Meaning</span>
          <strong>{meaningAnswer}</strong>
        </div>
        {readingAnswer ? (
          <div className={styles.primaryAnswer}>
            <span>Reading</span>
            <strong lang="ja">{readingAnswer}</strong>
          </div>
        ) : null}
      </div>
    );
  }

  const isReading = questionKind === "reading";
  return (
    <div className={styles.primaryAnswers} data-grouped="false">
      <div className={styles.primaryAnswer}>
        <span>Expected {questionKind}</span>
        <strong lang={isReading ? "ja" : undefined}>
          {isReading ? readingAnswer || "—" : meaningAnswer}
        </strong>
      </div>
      {showReadingWithMeaning && !isReading && readingAnswer ? (
        <div className={styles.primaryAnswer}>
          <span>Reading</span>
          <strong lang="ja">{readingAnswer}</strong>
        </div>
      ) : null}
    </div>
  );
}

function normalizeAccents(accents: readonly number[]) {
  return [...new Set(accents.filter((accent) => Number.isInteger(accent) && accent >= 0))].sort(
    (left, right) => left - right,
  );
}

function pitchLevels(moraCount: number, accent: number) {
  const clampedAccent = Math.max(0, Math.min(accent, moraCount));
  if (moraCount === 1) return [clampedAccent === 1];
  if (clampedAccent === 1) {
    return Array.from({ length: moraCount }, (_, index) => index === 0);
  }
  return Array.from(
    { length: moraCount },
    (_, index) => index > 0 && (clampedAccent === 0 || index + 1 <= clampedAccent),
  );
}

function PitchAccentGraph({ accent, reading }: { accent: number; reading: string }) {
  const moras = splitReadingIntoMoras(reading);
  if (!moras.length) return null;

  const levels = pitchLevels(moras.length, accent);
  const followingLevel = accent === 0;
  const width = Math.max(148, (moras.length + 1) * 34 + 28);
  const pointCount = moras.length + 1;
  const points = [...levels, followingLevel].map((high, index) => ({
    x: 16 + index * ((width - 32) / Math.max(pointCount - 1, 1)),
    y: high ? 13 : 36,
  }));
  const label = pitchAccentLabel(Math.min(accent, moras.length), moras.length);

  return (
    <figure className={styles.pitchFigure}>
      <figcaption>
        <span lang="ja">{reading}</span>
        <span>{label} ({accent})</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} 76`}
        role="img"
        aria-label={`${reading}, ${label} pitch accent ${accent}`}
      >
        <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
        {points.slice(0, -1).map((point, index) => (
          <g key={`${moras[index]}-${index}`}>
            <circle cx={point.x} cy={point.y} r="3.5" />
            <text x={point.x} y="68" lang="ja">
              {moras[index]}
            </text>
          </g>
        ))}
        <circle
          className={styles.trailingPoint}
          cx={points.at(-1)?.x}
          cy={points.at(-1)?.y}
          r="4"
        />
      </svg>
    </figure>
  );
}

function PitchAccentDetails({
  entries,
  showGraph,
  showNumbers,
}: {
  entries: readonly PitchAccentEntry[];
  showGraph: boolean;
  showNumbers: boolean;
}) {
  const normalizedEntries = entries
    .map((entry) => ({ reading: entry.r.trim(), accents: normalizeAccents(entry.p) }))
    .filter((entry) => entry.reading && entry.accents.length);
  if (!normalizedEntries.length) return null;

  return (
    <div className={styles.supplementaryRow} data-testid="anki-pitch-accent">
      <span className={styles.supplementaryLabel}>Pitch accent</span>
      {showNumbers ? (
        <div className={styles.pitchNotation}>
          {normalizedEntries.map((entry) => {
            const moraCount = splitReadingIntoMoras(entry.reading).length;
            return (
              <span key={`${entry.reading}-${entry.accents.join("-")}`}>
                <span lang="ja">{entry.reading}</span>{" "}
                {entry.accents
                  .map((accent) => `${pitchAccentLabel(Math.min(accent, moraCount), moraCount)} (${accent})`)
                  .join(", ")}
              </span>
            );
          })}
        </div>
      ) : null}
      {showGraph ? (
        <div className={styles.pitchGraphs}>
          {normalizedEntries.flatMap((entry) =>
            entry.accents.map((accent) => (
              <PitchAccentGraph
                key={`${entry.reading}-${accent}`}
                reading={entry.reading}
                accent={accent}
              />
            )),
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AnkiAnswerContent({
  revealed,
  hideAnswerCompletely = false,
  questionKind,
  groupQuestions = false,
  meaningAnswer,
  readingAnswer,
  showReadingWithMeaning = false,
  otherMeaningAnswers,
  otherReadingAnswers,
  userSynonyms,
  partsOfSpeech,
  pitchAccents,
  showOtherAcceptedAnswersAndUserSynonyms = false,
  showWaniKaniGrammarTags = false,
  showPitchAccentNumbers = false,
  showPitchAccentGraph = false,
  showReplayAudioButton = false,
  buttonlessMode = false,
  replayingAudio = false,
  onReveal,
  onReplayAudio,
  onGradeIncorrect,
  onGradeCorrect,
  onShowDetails,
  onSkip,
}: AnkiAnswerContentProps) {
  const gestureStart = useRef<ButtonlessGestureStart | null>(null);
  const gestureHandled = useRef(false);
  const onButtonlessPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    gestureStart.current = {
      centerX: bounds.left + bounds.width / 2,
      pointerId: event.pointerId,
      startedOnGradeButton: event.target instanceof Element && Boolean(event.target.closest("button[data-side]")),
      x: event.clientX,
      y: event.clientY,
    };
    gestureHandled.current = false;
    if (typeof event.currentTarget.setPointerCapture === "function" && event.pointerId >= 0) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The gesture still works while the pointer remains over the card.
      }
    }
  };
  const onButtonlessPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = gestureStart.current;
    gestureStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const isVerticalSwipe = Math.abs(dy) >= BUTTONLESS_SWIPE_DISTANCE
      && Math.abs(dy) > Math.abs(dx) * BUTTONLESS_VERTICAL_DOMINANCE;
    if (isVerticalSwipe) {
      event.preventDefault();
      gestureHandled.current = true;
      if (dy < 0) onShowDetails?.();
      else onSkip?.();
      window.setTimeout(() => { gestureHandled.current = false; }, 0);
      return;
    }
    const isTap = Math.abs(dx) <= BUTTONLESS_TAP_TOLERANCE && Math.abs(dy) <= BUTTONLESS_TAP_TOLERANCE;
    if (!isTap || start.startedOnGradeButton) return;
    if (event.clientX < start.centerX) onGradeIncorrect();
    else onGradeCorrect();
  };
  const onButtonlessPointerCancel = (event: PointerEvent<HTMLElement>) => {
    if (gestureStart.current?.pointerId !== event.pointerId) return;
    gestureStart.current = null;
    gestureHandled.current = false;
  };
  const handleButtonlessGrade = (correct: boolean) => {
    if (gestureHandled.current) {
      gestureHandled.current = false;
      return;
    }
    if (correct) onGradeCorrect(); else onGradeIncorrect();
  };
  const acceptedAnswerRows: SupplementaryRow[] = [];
  const metadataRows: SupplementaryRow[] = [];
  const cleanedOtherMeanings = uniqueValues(otherMeaningAnswers);
  const cleanedOtherReadings = uniqueValues(otherReadingAnswers);
  const cleanedUserSynonyms = uniqueValues(userSynonyms);
  const cleanedPartsOfSpeech = uniqueValues(partsOfSpeech).map(formatPartOfSpeech);

  if (showOtherAcceptedAnswersAndUserSynonyms) {
    if ((groupQuestions || questionKind === "meaning") && cleanedOtherMeanings.length) {
      acceptedAnswerRows.push({
        key: "other-meanings",
        label: groupQuestions ? "Other meaning answers" : "Other accepted answers",
        values: cleanedOtherMeanings,
      });
    }
    if ((groupQuestions || questionKind === "reading") && cleanedOtherReadings.length) {
      acceptedAnswerRows.push({
        key: "other-readings",
        label: groupQuestions ? "Other reading answers" : "Other accepted answers",
        values: cleanedOtherReadings,
        japanese: true,
      });
    }
  }

  const showPitchAccent =
    (groupQuestions || questionKind === "reading") &&
    (showPitchAccentNumbers || showPitchAccentGraph) &&
    Boolean(pitchAccents?.length);

  if (showWaniKaniGrammarTags && cleanedPartsOfSpeech.length) {
    metadataRows.push({
      key: "part-of-speech",
      label: "Part of speech",
      values: cleanedPartsOfSpeech,
    });
  }

  if (
    showOtherAcceptedAnswersAndUserSynonyms &&
    (groupQuestions || questionKind === "meaning") &&
    cleanedUserSynonyms.length
  ) {
    metadataRows.push({
      key: "user-synonyms",
      label: "User synonyms",
      values: cleanedUserSynonyms,
    });
  }

  const primaryAnswers = (
    <PrimaryAnswers
      groupQuestions={groupQuestions}
      meaningAnswer={meaningAnswer}
      questionKind={questionKind}
      readingAnswer={readingAnswer}
      showReadingWithMeaning={revealed && showReadingWithMeaning}
    />
  );

  return (
    <section
      className={styles.card}
      aria-label="Anki answer"
      data-buttonless={revealed && buttonlessMode ? true : undefined}
      onPointerDown={revealed && buttonlessMode ? onButtonlessPointerDown : undefined}
      onPointerUp={revealed && buttonlessMode ? onButtonlessPointerUp : undefined}
      onPointerCancel={revealed && buttonlessMode ? onButtonlessPointerCancel : undefined}
    >
      {revealed ? (
        <div className={styles.revealedContent} data-testid="anki-answer-content">
          {primaryAnswers}
          {acceptedAnswerRows.length || metadataRows.length || showPitchAccent ? (
            <div className={styles.supplementaryAnswers}>
              {acceptedAnswerRows.map((row) => (
                <div className={styles.supplementaryRow} key={row.key}>
                  <span className={styles.supplementaryLabel}>{row.label}</span>
                  <span lang={row.japanese ? "ja" : undefined}>{row.values.join(", ")}</span>
                </div>
              ))}
              {showPitchAccent ? (
                <PitchAccentDetails
                  entries={pitchAccents ?? []}
                  showGraph={showPitchAccentGraph}
                  showNumbers={showPitchAccentNumbers}
                />
              ) : null}
              {metadataRows.map((row) => (
                <div className={styles.supplementaryRow} key={row.key}>
                  <span className={styles.supplementaryLabel}>{row.label}</span>
                  <span lang={row.japanese ? "ja" : undefined}>{row.values.join(", ")}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className={styles.revealSurface}
          onClick={onReveal}
          aria-label="Reveal answer"
          data-testid="anki-answer-preview"
          data-visibility={hideAnswerCompletely ? "hidden" : "blurred"}
        >
          {hideAnswerCompletely ? (
            <span className={styles.hiddenPreview} aria-hidden="true">
              <span />
              <span />
            </span>
          ) : (
            <span className={styles.blurredPreview} aria-hidden="true">
              {primaryAnswers}
            </span>
          )}
          <span className={styles.revealHint}>
            <Eye size={17} aria-hidden />
            Show answer
          </span>
        </button>
      )}

      {revealed && showReplayAudioButton && onReplayAudio && !buttonlessMode ? (
        <div className={styles.replayAction}>
          <Button
            type="button"
            tone="ghost"
            size="small"
            disabled={replayingAudio}
            aria-label="Replay vocabulary audio"
            onClick={() => void onReplayAudio()}
          >
            <Volume2 size={16} aria-hidden />
            {replayingAudio ? "Replaying…" : "Replay"}
          </Button>
        </div>
      ) : null}

      {revealed && buttonlessMode ? (
        <div className={styles.buttonlessControls} role="group" aria-label="Buttonless Anki controls">
          <span className={styles.buttonlessHint} aria-hidden="true">Tap left for wrong · right for correct{onShowDetails && onSkip ? " · swipe up for details · down to skip" : ""}</span>
          <button className={styles.buttonlessZone} data-side="left" type="button" aria-label="Tap left: mark wrong" onClick={() => handleButtonlessGrade(false)} />
          <button className={styles.buttonlessZone} data-side="right" type="button" aria-label="Tap right: mark correct" onClick={() => handleButtonlessGrade(true)} />
        </div>
      ) : revealed ? (
        <div className={styles.gradeActions}>
          <Button type="button" tone="danger" onClick={onGradeIncorrect}>
            <X size={18} aria-hidden />
            1 · Wrong
          </Button>
          <Button type="button" tone="primary" onClick={onGradeCorrect}>
            <Check size={18} aria-hidden />
            2 · Correct
          </Button>
        </div>
      ) : null}
    </section>
  );
}
