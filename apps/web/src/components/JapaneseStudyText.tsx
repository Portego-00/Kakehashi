"use client";

import {
  getAllWaniKaniSubjects,
  type WaniKaniSubjectResource,
} from "@kakehashi/core";
import { Loader2, Settings } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  loadJpdbApiKey,
  parseTextWithJpdb,
  type JpdbParsedToken,
} from "@/lib/jpdb";
import {
  buildHighlightSegments,
  type HighlightMatch,
  type HighlightSegment,
} from "@/lib/text-highlighting";
import {
  loadWaniKaniSession,
  type StoredWaniKaniSession,
} from "@/lib/wanikani-session";

export type StudyMode = "wk" | "full" | "none";
type StudyStatus = "idle" | "loading" | "error";

type UseJapaneseStudyTextOptions = {
  enabled?: boolean;
};

type TooltipPosition = {
  left: number;
  top: number;
};

const subjectCache = new Map<string, Promise<WaniKaniSubjectResource[]>>();

export function useJapaneseStudyText(
  matchingText: string,
  options: UseJapaneseStudyTextOptions = {}
) {
  const enabled = options.enabled ?? true;
  const [studyMode, setStudyMode] = useState<StudyMode>("wk");
  const [subjects, setSubjects] = useState<WaniKaniSubjectResource[]>([]);
  const [jpdbTokens, setJpdbTokens] = useState<JpdbParsedToken[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<HighlightMatch | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [userLevel, setUserLevel] = useState(0);
  const [subjectStatus, setSubjectStatus] = useState<StudyStatus>("idle");
  const [jpdbStatus, setJpdbStatus] = useState<StudyStatus>("idle");
  const [subjectMessage, setSubjectMessage] = useState<string | null>(null);
  const [jpdbMessage, setJpdbMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadSubjects() {
      if (!enabled) {
        setSubjectStatus("idle");
        setSubjectMessage(null);
        return;
      }

      const session = loadWaniKaniSession();
      if (!session) {
        setUserLevel(0);
        setSubjectStatus("idle");
        setSubjectMessage("Connect WaniKani to enable vocabulary highlighting.");
        return;
      }

      setUserLevel(session.user.level);
      setSubjectStatus("loading");
      setSubjectMessage(null);

      try {
        const nextSubjects = await getCachedWaniKaniSubjects(session);
        if (isCancelled) return;
        setSubjects(nextSubjects);
        setSubjectStatus("idle");
      } catch (error) {
        if (isCancelled) return;
        setSubjectStatus("error");
        setSubjectMessage(
          error instanceof Error ? error.message : "Could not load WaniKani subjects."
        );
      }
    }

    void loadSubjects();

    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    let isCancelled = false;

    async function loadJpdbTokens() {
      if (!enabled || !matchingText.trim()) {
        setJpdbTokens([]);
        setJpdbStatus("idle");
        setJpdbMessage(null);
        return;
      }

      if (studyMode !== "full") {
        setJpdbTokens([]);
        setJpdbStatus("idle");
        setJpdbMessage(null);
        return;
      }

      const apiKey = loadJpdbApiKey();
      if (!apiKey) {
        setJpdbTokens([]);
        setJpdbStatus("idle");
        setJpdbMessage("Save a JPDB API key in Settings to use full grammar + vocabulary mode.");
        return;
      }

      setJpdbStatus("loading");
      setJpdbMessage(null);

      try {
        const tokens = await parseTextWithJpdb(matchingText, apiKey);
        if (isCancelled) return;
        setJpdbTokens(tokens);
        setJpdbStatus("idle");
      } catch (error) {
        if (isCancelled) return;
        setJpdbTokens([]);
        setJpdbStatus("error");
        setJpdbMessage(error instanceof Error ? error.message : "JPDB parse failed.");
      }
    }

    void loadJpdbTokens();

    return () => {
      isCancelled = true;
    };
  }, [enabled, matchingText, studyMode]);

  function selectSegment(segment: HighlightSegment, target: HTMLElement) {
    if (!segment.match) return;
    const rect = target.getBoundingClientRect();
    setSelectedMatch(segment.match);
    setTooltipPosition(getTooltipPosition(rect));
  }

  const status = getCombinedStatus(subjectStatus, jpdbStatus);
  const message = [subjectMessage, jpdbMessage].filter(Boolean).join(" ");

  return {
    studyMode,
    setStudyMode,
    subjects,
    jpdbTokens,
    selectedMatch,
    tooltipPosition,
    userLevel,
    selectSegment,
    clearSelectedMatch: () => {
      setSelectedMatch(null);
      setTooltipPosition(null);
    },
    status,
    message: message || null,
  };
}

export function JapaneseStudyToolbar({
  actions,
  onStudyModeChange,
  status,
  studyMode,
  variant = "framed",
}: {
  actions?: ReactNode;
  onStudyModeChange: (mode: StudyMode) => void;
  status: StudyStatus;
  studyMode: StudyMode;
  variant?: "framed" | "plain";
}) {
  return (
    <div
      className={
        variant === "plain"
          ? "flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between"
          : "flex flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between"
      }
    >
      <div className="flex flex-wrap gap-2">
        {[
          ["wk", "WaniKani"],
          ["full", "Full + JPDB"],
          ["none", "Plain"],
        ].map(([value, label]) => (
          <button
            aria-pressed={studyMode === value}
            className={[
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              studyMode === value
                ? "bg-sakura-500 text-white"
                : "border border-white/10 text-gray-300 hover:border-sakura-300 hover:text-white",
            ].join(" ")}
            key={value}
            onClick={() => onStudyModeChange(value as StudyMode)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {status === "loading" ? (
          <span className="inline-flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading
          </span>
        ) : null}
        <Link
          className="inline-flex items-center gap-2 text-sm text-sakura-300 hover:text-sakura-200"
          href="/app/settings#jpdb"
        >
          <Settings className="h-4 w-4" />
          JPDB key
        </Link>
        {actions}
      </div>
    </div>
  );
}

export function HighlightedJapaneseText({
  className,
  jpdbTokens,
  onSelectSegment,
  prefix,
  prefixClassName,
  studyMode,
  subjects,
  text,
  userLevel = 0,
}: {
  className?: string;
  jpdbTokens?: JpdbParsedToken[];
  onSelectSegment: (segment: HighlightSegment, target: HTMLElement) => void;
  prefix?: string;
  prefixClassName?: string;
  studyMode: StudyMode;
  subjects: WaniKaniSubjectResource[];
  text: string;
  userLevel?: number;
}) {
  const segments = useMemo(
    () =>
      studyMode === "none"
        ? [{ text }]
        : buildHighlightSegments({
            text,
            subjects,
            jpdbTokens,
          }),
    [jpdbTokens, studyMode, subjects, text]
  );

  return (
    <p className={className}>
      {prefix ? <span className={prefixClassName}>{prefix}</span> : null}
      {segments.map((segment, segmentIndex) =>
        segment.match ? segment.match.source === "jpdb" && segment.tokenType === "grammar" ? (
          <button
            className="mx-0.5 rounded border-b-2 border-amber-300 bg-amber-300/10 px-1 py-0.5 text-left align-baseline text-amber-100 transition-colors hover:bg-amber-300/20"
            key={`${segment.text}-${segmentIndex}`}
            onClick={(event) => onSelectSegment(segment, event.currentTarget)}
            type="button"
          >
            {segment.text}
          </button>
        ) : (
          <button
            className="relative mx-0.5 inline-flex items-center rounded-lg px-1.5 py-0.5 text-left align-baseline font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            key={`${segment.text}-${segmentIndex}`}
            onClick={(event) => onSelectSegment(segment, event.currentTarget)}
            style={{
              backgroundColor: getItemColor(segment.match.type),
              opacity: shouldDimHighlight(segment.match, userLevel) ? 0.7 : 1,
            }}
            type="button"
          >
            {segment.text}
            {shouldShowLevelBadge(segment.match, userLevel) ? (
              <span
                className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-white/50 px-1 text-[10px] font-bold leading-none text-white"
                style={{ backgroundColor: getItemColor(segment.match.type) }}
              >
                {segment.match.level}
              </span>
            ) : null}
            {segment.match.source === "jpdb" ? (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold leading-none text-white">
                JP
              </span>
            ) : null}
          </button>
        ) : (
          <span key={`${segment.text}-${segmentIndex}`}>{segment.text}</span>
        )
      )}
    </p>
  );
}

export function VocabularyTooltip({
  match,
  onClose,
  position,
}: {
  match: HighlightMatch | null;
  onClose: () => void;
  position: TooltipPosition | null;
}) {
  if (!match || !position) return null;

  return (
    <div className="fixed inset-0 z-50 bg-transparent">
      <button
        aria-label="Close tooltip"
        className="absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <section
        className="absolute w-[280px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-white/10 bg-dark-950 shadow-2xl"
        style={{
          left: position.left,
          top: position.top,
        }}
      >
        <div className="px-4 py-3 text-white" style={{ backgroundColor: getItemColor(match.type) }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-japanese text-3xl font-bold">{match.characters}</h2>
            <span className="rounded-full bg-black/20 px-2 py-1 text-xs font-semibold">
              {match.source === "wanikani" ? `Lv ${match.level}` : "JPDB"}
            </span>
          </div>
        </div>
        <div className="space-y-3 p-4 text-sm leading-6">
          {match.readings?.[0]?.reading ? (
            <div className="flex items-start gap-2">
              <p className="mt-0.5 min-w-[60px] text-xs font-semibold text-gray-500">Reading:</p>
              <p className="flex-1 font-japanese text-base font-medium text-white">
                {match.readings[0].reading}
              </p>
            </div>
          ) : null}
          <div className="flex items-start gap-2">
            <p className="mt-0.5 min-w-[60px] text-xs font-semibold text-gray-500">Meaning:</p>
            <p className="flex-1 whitespace-pre-wrap font-medium text-white">{match.meaning}</p>
          </div>
          {match.partsOfSpeech?.length ? (
            <div className="flex items-start gap-2">
              <p className="mt-0.5 min-w-[60px] text-xs font-semibold text-gray-500">Form:</p>
              <p className="flex-1 font-medium text-white">{match.partsOfSpeech.join(", ")}</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function getJpdbTokensForSlice(
  tokens: JpdbParsedToken[],
  offset: number,
  length: number
): JpdbParsedToken[] {
  return tokens
    .filter((token) => token.start >= offset && token.end <= offset + length)
    .map((token) => ({
      ...token,
      start: token.start - offset,
      end: token.end - offset,
    }));
}

function getCombinedStatus(left: StudyStatus, right: StudyStatus): StudyStatus {
  if (left === "loading" || right === "loading") return "loading";
  if (left === "error" || right === "error") return "error";
  return "idle";
}

function getCachedWaniKaniSubjects(
  session: StoredWaniKaniSession
): Promise<WaniKaniSubjectResource[]> {
  const cacheKey = `${session.apiToken}:${session.user.level}`;
  const cached = subjectCache.get(cacheKey);
  if (cached) return cached;

  const request = getAllWaniKaniSubjects(session.apiToken, {
    types: "kanji,vocabulary,kana_vocabulary",
    levels: buildLevelRange(1, session.user.level),
  });
  subjectCache.set(cacheKey, request);
  return request;
}

function getTooltipPosition(rect: DOMRect): TooltipPosition {
  const tooltipWidth = 280;
  const margin = 12;
  const centeredLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
  const maxLeft = Math.max(margin, window.innerWidth - tooltipWidth - margin);

  return {
    left: Math.min(Math.max(margin, centeredLeft), maxLeft),
    top: rect.bottom + 8,
  };
}

function getItemColor(type: HighlightMatch["type"]): string {
  if (type === "radical") return "#3c9bff";
  if (type === "kanji") return "#fa1f62";
  return "#9c38d9";
}

function shouldDimHighlight(match: HighlightMatch, userLevel: number): boolean {
  return match.source === "wanikani" && userLevel > 0 && match.level > userLevel;
}

function shouldShowLevelBadge(match: HighlightMatch, userLevel: number): boolean {
  return match.source === "wanikani" && userLevel > 0 && match.level > userLevel;
}

function buildLevelRange(min: number, max: number): string {
  const levels: number[] = [];
  for (let level = min; level <= max; level += 1) {
    levels.push(level);
  }
  return levels.join(",");
}
