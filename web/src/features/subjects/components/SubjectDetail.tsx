"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Download, ExternalLink, Headphones, Layers3, LoaderCircle, Pencil, Save, Square, Volume2, X } from "lucide-react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { Button, type ButtonState } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextAreaField } from "@/components/ui/Field";
import { EmptyState, Skeleton } from "@/components/ui/States";
import type { WebSettings } from "@/features/settings/settings";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { JAPANESE_VOICE_DOWNLOAD_LABEL } from "@/features/speech/japanese-voice-assets";
import { useJapaneseVoice } from "@/features/speech/use-japanese-voice";
import { fetchImmersionExamples, type ImmersionExample } from "@/features/study/immersion";
import { fetchSubjectEnrichments, pitchAccentLabel, splitReadingIntoMoras, type PitchAccentEntry, type UsagePattern } from "@/features/subjects/enrichments";
import { groupVocabularyByKanjiReading, normalizeKanjiReading } from "@/features/subjects/reading-examples";
import { subjectReturnLabel } from "@/features/subjects/subject-detail-navigation";
import { useSession } from "@/lib/session";
import { wkCollection, wkRequest } from "@/lib/wanikani/client";
import type { Assignment, ContextSentence, PronunciationAudio, ReviewStatistic, StudyMaterial, Subject, SubjectReading } from "@/types/wanikani";
import { SubjectAudioButton, SubjectAudioProvider } from "./SubjectAudioControls";
import { SubjectCharacter } from "./SubjectCharacter";
import { StrokeOrder } from "./StrokeOrder";
import styles from "../subjects.module.css";

const ENTITIES: Record<string, string> = { "&quot;": '"', "&#39;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };

function ConstellationIcon() {
  return <svg width="22" height="22" viewBox="0 0 512 512" fill="none" data-icon="planet-outline" aria-hidden>
    <path d="M413.48 284.46c58.87 47.24 91.61 89 80.31 108.55-17.85 30.85-138.78-5.48-270.1-81.15S.37 149.84 18.21 119c11.16-19.28 62.58-12.32 131.64 14.09" stroke="currentColor" strokeWidth="32" strokeMiterlimit="10" />
    <circle cx="256" cy="256" r="160" stroke="currentColor" strokeWidth="32" />
  </svg>;
}

export function plainMnemonic(value?: string) {
  if (!value) return [];
  const plain = value.replace(/<[^>]+>/g, "").replace(/&(quot|#39|amp|lt|gt|nbsp);/g, (entity) => ENTITIES[entity] ?? entity).trim();
  return plain.split(/\n\s*\n/).map((paragraph) => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export type SubjectDetailTab = "meaning" | "reading" | "stroke" | "context";

export type SubjectDetailInitialTab = Exclude<SubjectDetailTab, "stroke">;

export function SubjectDetail({ id, returnTo = "/search", presentation = "page" }: { id: number; returnTo?: string; presentation?: "page" | "panel" }) {
  const returnLabel = subjectReturnLabel(returnTo);
  const { user } = useSession();
  const webSettings = useWebSettings(user?.data.username ?? "anonymous");
  const detailSettings = webSettings.subjectDetails;
  const subjectHeroRef = useRef<HTMLElement>(null);
  const subject = useQuery({ queryKey: ["wanikani", "subject", id], queryFn: () => wkRequest<Subject>(`subjects/${id}`), staleTime: 24 * 60 * 60_000 });
  const assignment = useQuery({ queryKey: ["wanikani", "assignments", `subject:${id}`], queryFn: () => wkCollection<Assignment>(`assignments?subject_ids=${id}`), staleTime: 5 * 60_000 });
  const statistic = useQuery({ queryKey: ["wanikani", "review-statistics", `subject:${id}`], queryFn: () => wkCollection<ReviewStatistic>(`review_statistics?subject_ids=${id}`), staleTime: 15 * 60_000 });
  const materialsKey = ["wanikani", "study-materials", `subject:${id}`] as const;
  const material = useQuery({ queryKey: materialsKey, queryFn: () => wkCollection<StudyMaterial>(`study_materials?subject_ids=${id}`), staleTime: 5 * 60_000 });
  const relationIds = useMemo(() => {
    const data = subject.data?.data;
    return Array.from(new Set([...(data?.component_subject_ids ?? []), ...(data?.amalgamation_subject_ids ?? []), ...(data?.visually_similar_subject_ids ?? [])])).slice(0, 150);
  }, [subject.data]);
  const relations = useQuery({ queryKey: ["wanikani", "subjects", `relations:${relationIds.join(",")}`], queryFn: () => wkCollection<Subject>(`subjects?ids=${relationIds.join(",")}`), enabled: relationIds.length > 0, staleTime: 24 * 60 * 60_000 });
  const immersionCharacters = subject.data?.data.characters;
  const immersionSubjectType = subject.data?.object;
  const isImmersionSubject = immersionSubjectType === "vocabulary" || immersionSubjectType === "kana_vocabulary";
  const immersionSources = webSettings.study.immersionKitAnimeSources;
  const immersion = useQuery({
    queryKey: ["immersion", "subject-detail", immersionCharacters, immersionSources.join(",")],
    queryFn: ({ signal }) => fetchImmersionExamples(immersionCharacters!, immersionSources, signal),
    enabled: Boolean(detailSettings.showImmersionExamples && immersionCharacters && isImmersionSubject),
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const enrichmentReadings = useMemo(() => subject.data?.data.readings?.map((reading) => reading.reading) ?? [], [subject.data]);
  const enrichments = useQuery({
    queryKey: ["subject-enrichments", id, immersionCharacters, enrichmentReadings.join(",")],
    queryFn: ({ signal }) => fetchSubjectEnrichments({ id, level: subject.data!.data.level, characters: immersionCharacters!, readings: enrichmentReadings }, signal),
    enabled: Boolean(immersionCharacters && ((detailSettings.showPitchAccent && immersionSubjectType !== "radical") || (detailSettings.showPatternsOfUse && isImmersionSubject))),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });

  if (subject.isLoading) return <SubjectDetailSkeleton />;
  if (subject.isError || !subject.data) return <main className={`page ${styles.page}`}><EmptyState title="Subject not found" description="This subject may be outside your subscription or no longer available." action={<Link href={returnTo} className={styles.inlineButton}>{returnLabel}</Link>} /></main>;

  const record = subject.data;
  const subjectAssignment = assignment.data?.[0];
  const reviewStatistic = statistic.data?.[0];
  const meaning = record.data.meanings.find((item) => item.primary)?.meaning ?? record.data.meanings[0]?.meaning ?? record.data.slug;
  const tone = record.object === "kana_vocabulary" ? "vocabulary" : record.object;
  const identityText = record.data.characters || meaning;
  const characterCount = Array.from(identityText).length;
  const primaryReading = record.data.readings?.filter((reading) => reading.primary).map((reading) => reading.reading).join(" · ") || record.data.readings?.[0]?.reading;

  return <main className={`page ${styles.page} ${styles.subjectDetailPage}`} data-subject-detail-type={tone}>
    <header ref={subjectHeroRef} className={styles.subjectHero} data-type={tone}>
      {presentation === "page" ? <Link href={returnTo} className={styles.subjectHeroBack}><ArrowLeft size={19} aria-hidden /><span>{returnLabel}</span></Link> : null}
      <div className={styles.subjectHeroActions}>
        <Link href={`/subjects/${id}/constellation`} aria-label="Explore subject constellation"><ConstellationIcon /></Link>
        <a href={record.data.document_url} target="_blank" rel="noreferrer" aria-label="Open subject on WaniKani"><ExternalLink size={18} aria-hidden /></a>
      </div>
      <div className={styles.subjectHeroCopy}>
        <SubjectCharacter subject={record} imageSize="5rem" imageTone="subject" eager className={styles.subjectHeroCharacter} data-character-count={Math.min(characterCount, 12)} />
        <h1>{meaning}</h1>
        {primaryReading ? <p lang="ja">{primaryReading}</p> : null}
      </div>
      <div className={styles.subjectHeroMeta}><span>Level {record.data.level}</span><span>{subjectAssignment ? <><SrsStageIcon stage={subjectAssignment.data.srs_stage} size={16} />{srsStageLabel(subjectAssignment.data.srs_stage)}</> : "Locked"}</span>{reviewStatistic ? <span>{reviewStatistic.data.percentage_correct}% accuracy</span> : null}</div>
    </header>

    {presentation === "page" ? <SubjectStickyHeader heroRef={subjectHeroRef} subject={record} meaning={meaning} reading={primaryReading} level={record.data.level} /> : null}

    <SubjectDetailPanels
      record={record}
      assignment={subjectAssignment}
      reviewStatistic={reviewStatistic}
      material={material.data?.[0]}
      materialLoading={material.isLoading}
      materialsKey={materialsKey}
      relatedSubjects={relations.data ?? []}
      pitchAccents={enrichments.data?.pitchAccents ?? []}
      usagePatterns={enrichments.data?.patterns ?? []}
      immersionExamples={immersion.data ?? []}
      immersionLoading={immersion.isLoading}
      immersionFailed={immersion.isError}
      settings={detailSettings}
      returnTo={returnTo}
      replaceRelated={presentation === "panel"}
    />
  </main>;
}

export function SubjectStickyHeader({ heroRef, subject, meaning, reading, level }: { heroRef: RefObject<HTMLElement | null>; subject: Subject; meaning: string; reading?: string; level: number }) {
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const characterCount = Array.from(subject.data.characters || meaning).length;

  useEffect(() => {
    let frame = 0;
    let current = false;

    const update = () => {
      const hero = heroRef.current;
      const stickyHeader = stickyHeaderRef.current;
      if (hero && stickyHeader) {
        const stickyTop = Number.parseFloat(window.getComputedStyle(stickyHeader).top) || 0;
        const next = hero.getBoundingClientRect().bottom <= stickyTop;
        if (next !== current) {
          current = next;
          setVisible(next);
        }
      }
      frame = 0;
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [heroRef]);

  const scrollToSubject = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return <div ref={stickyHeaderRef} className={styles.subjectStickyHeader} data-visible={visible || undefined} aria-hidden={!visible}>
    <button type="button" className={styles.subjectStickyContent} aria-label={`Back to ${meaning}`} tabIndex={visible ? 0 : -1} onClick={scrollToSubject}>
      <SubjectCharacter subject={subject} imageSize="1.75rem" imageTone="subject" className={styles.subjectStickyCharacter} data-character-count={Math.min(characterCount, 12)} />
      <span className={styles.subjectStickyCopy}>
        <strong>{meaning}</strong>
        {reading ? <span lang="ja">{reading}</span> : null}
      </span>
      <span className={styles.subjectStickyLevel}>Level {level}</span>
    </button>
  </div>;
}

type PagerGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  latestX: number;
  startedAt: number;
  axis: "pending" | "horizontal" | "vertical";
};

function DetailPager({ className, activeIndex, count, onNavigate, children }: { className: string; activeIndex: number; count: number; onNavigate: (index: number) => void; children: React.ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<PagerGesture | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const releasePointer = (pointerId: number) => {
    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);
  };

  const resetGesture = (pointerId: number) => {
    releasePointer(pointerId);
    gestureRef.current = null;
    setDragging(false);
    setDragX(0);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.pointerType === "mouse" && event.button !== 0) || (event.target as Element).closest("a, button, input, textarea, select, audio")) return;
    gestureRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, latestX: event.clientX, startedAt: performance.now(), axis: "pending" };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.latestX = event.clientX;
    const distanceX = event.clientX - gesture.startX;
    const distanceY = event.clientY - gesture.startY;
    if (gesture.axis === "pending") {
      if (Math.max(Math.abs(distanceX), Math.abs(distanceY)) < 8) return;
      gesture.axis = Math.abs(distanceX) > Math.abs(distanceY) ? "horizontal" : "vertical";
    }
    if (gesture.axis !== "horizontal") return;
    event.preventDefault();
    const beyondStart = activeIndex === 0 && distanceX > 0;
    const beyondEnd = activeIndex === count - 1 && distanceX < 0;
    setDragging(true);
    setDragX(beyondStart || beyondEnd ? distanceX * 0.22 : distanceX);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distanceX = gesture.latestX - gesture.startX;
    const elapsed = Math.max(performance.now() - gesture.startedAt, 1);
    const velocity = distanceX / elapsed;
    const threshold = Math.min((viewportRef.current?.clientWidth ?? 0) * 0.18, 140);
    const direction = distanceX < 0 ? 1 : -1;
    const nextIndex = activeIndex + direction;
    const shouldNavigate = gesture.axis === "horizontal" && nextIndex >= 0 && nextIndex < count && (Math.abs(distanceX) >= threshold || Math.abs(velocity) >= 0.55);
    if (shouldNavigate) onNavigate(nextIndex);
    resetGesture(event.pointerId);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => resetGesture(event.pointerId);

  return <div ref={viewportRef} className={className} data-dragging={dragging} style={{ "--pager-drag-x": `${dragX}px` } as CSSProperties} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>{children}</div>;
}

function SubjectDetailSkeleton() {
  return <main className={`page ${styles.page} ${styles.subjectDetailPage}`} aria-busy="true"><div className={styles.subjectHeroSkeleton}><Skeleton className={styles.subjectCharacterSkeleton} height="6.5rem" width="6.5rem" /><Skeleton height="1.8rem" width="12rem" /><Skeleton height="1.2rem" width="7rem" /></div><div className={styles.detailTabsSkeleton}>{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height="2.75rem" />)}</div><div className={styles.detailPanelStack}><Skeleton height="10rem" /><Skeleton height="14rem" /><Skeleton height="12rem" /></div></main>;
}

function uniqueAudio(subject: Subject) {
  const seen = new Set<number>();
  return (subject.data.pronunciation_audios ?? []).filter((audio) => {
    if (seen.has(audio.metadata.source_id) || audio.content_type !== "audio/mpeg") return false;
    seen.add(audio.metadata.source_id);
    return true;
  });
}

function PronunciationPlayer({ audio, index }: { audio: PronunciationAudio; index: number }) {
  const actor = audio.metadata.voice_actor_name || "Audio";
  const details = [audio.metadata.voice_description, audio.metadata.pronunciation].filter(Boolean).join(" · ");
  const audioKey = `pronunciation:${audio.metadata.source_id ?? audio.metadata.voice_actor_id ?? index}`;
  return <figure>
    <SubjectAudioButton audioKey={audioKey} src={audio.url} label={`${actor} pronunciation`} variant="pronunciation">
      <span>{actor}{audio.metadata.gender ? ` (${audio.metadata.gender})` : ""}</span>
    </SubjectAudioButton>
    {details ? <figcaption>{details}</figcaption> : null}
  </figure>;
}

function readingLabel(type?: SubjectReading["type"]) {
  if (type === "onyomi") return "On’yomi";
  if (type === "kunyomi") return "Kun’yomi";
  if (type === "nanori") return "Nanori";
  return "Vocabulary";
}

function ReadingGroups({ readings, pitchAccents }: { readings: SubjectReading[]; pitchAccents: PitchAccentEntry[] }) {
  type ReadingGroupType = NonNullable<SubjectReading["type"]> | "vocabulary";
  const groups = [...new Set<ReadingGroupType>(readings.map((reading) => reading.type ?? "vocabulary"))].map((type) => ({ type, readings: readings.filter((reading) => (reading.type ?? "vocabulary") === type) }));
  return <div className={styles.readingGroups}>{groups.map((group) => {
    const normalized = new Set(group.readings.map((reading) => normalizeKanjiReading(reading.reading)));
    const groupPitch = pitchAccents.filter((entry) => normalized.has(normalizeKanjiReading(entry.r)));
    return <section className={styles.readingGroup} key={group.type}>
      <h3>{readingLabel(group.type === "vocabulary" ? undefined : group.type)}</h3>
      <div className={styles.readingChips}>{group.readings.map((reading) => <span key={reading.reading} data-primary={reading.primary} lang="ja">{reading.reading}</span>)}</div>
      {groupPitch.length ? <div className={styles.pitchAccentList}>{groupPitch.flatMap((entry) => entry.p.map((accent) => <PitchAccentCard key={`${entry.r}-${accent}`} reading={entry.r} accent={accent} />))}</div> : null}
    </section>;
  })}</div>;
}

function PitchAccentCard({ reading, accent }: { reading: string; accent: number }) {
  const moras = splitReadingIntoMoras(reading);
  const width = Math.max(168, moras.length * 44);
  const points = moras.map((_, index) => {
    const isHigh = accent === 0 ? index > 0 : accent === 1 ? index === 0 : index > 0 && index < accent;
    const x = moras.length === 1 ? width / 2 : 20 + index * ((width - 40) / Math.max(moras.length - 1, 1));
    return { x, y: isHigh ? 28 : 66 };
  });
  return <figure className={styles.pitchAccentCard}>
    <figcaption><span>{pitchAccentLabel(accent, moras.length)}</span><strong>{accent}</strong></figcaption>
    <svg viewBox={`0 0 ${width} 106`} role="img" aria-label={`${reading}, ${pitchAccentLabel(accent, moras.length)} pitch accent ${accent}`}>
      {points.length > 1 ? <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} /> : null}
      {points.map((point, index) => <g key={`${moras[index]}-${index}`}><circle cx={point.x} cy={point.y} r="5" /><text x={point.x} y="98">{moras[index]}</text></g>)}
    </svg>
  </figure>;
}

function KanjiReadingExamples({ kanji, vocabulary, returnTo, replaceRelated = false }: { kanji: Subject; vocabulary: Subject[]; returnTo: string; replaceRelated?: boolean }) {
  const groups = groupVocabularyByKanjiReading(kanji, vocabulary);
  if (!groups.length) return null;
  return <DetailSection title="Examples by reading"><div className={styles.readingExamples}>{groups.map((group) => <section key={group.normalizedReading}>
    <header><span lang="ja">{group.reading}</span><small>{readingLabel(group.type)}</small></header>
    <div>{group.subjects.map((subject) => <Link key={subject.id} replace={replaceRelated} href={`/subjects/${subject.id}?returnTo=${encodeURIComponent(returnTo)}`}><strong lang="ja">{subject.data.characters}</strong><span>{subject.data.readings?.find((reading) => reading.primary)?.reading}</span><small>{subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.slug}</small></Link>)}</div>
  </section>)}</div></DetailSection>;
}

function UsagePatterns({ patterns }: { patterns: UsagePattern[] }) {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const active = patterns[Math.min(selected, patterns.length - 1)];
  const selectPattern = (index: number, focus = false) => {
    setSelected(index);
    if (focus) window.requestAnimationFrame(() => document.getElementById(`${id}-pattern-tab-${index}`)?.focus());
  };
  return <DetailSection title="Patterns of use"><div className={styles.usagePatterns}>
    <div className={styles.patternTabs} role="tablist" aria-label="Vocabulary usage patterns">{patterns.map((pattern, index) => <button
      key={`${pattern.name}-${index}`}
      id={`${id}-pattern-tab-${index}`}
      type="button"
      role="tab"
      aria-selected={index === selected}
      aria-controls={`${id}-pattern-panel`}
      tabIndex={index === selected ? 0 : -1}
      onClick={() => selectPattern(index)}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? patterns.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + patterns.length) % patterns.length;
        selectPattern(nextIndex, true);
      }}
    >{pattern.name}</button>)}</div>
    <div id={`${id}-pattern-panel`} className={styles.patternExamples} role="tabpanel" aria-labelledby={`${id}-pattern-tab-${selected}`}>{active.examples.map((example, index) => <blockquote key={`${example.ja}-${index}`}><p lang="ja">{example.ja}</p><footer>{example.en}</footer></blockquote>)}</div>
  </div></DetailSection>;
}

export function ContextSentences({ sentences }: { sentences: ContextSentence[] }) {
  const voice = useJapaneseVoice();
  const downloading = voice.activity === "downloading";
  const downloadState: ButtonState = downloading ? "loading" : voice.error && !voice.downloaded ? "error" : "idle";
  const action = voice.checked && voice.downloaded
    ? null
    : <Button className={styles.voiceDownload} type="button" size="small" state={downloadState} disabled={!voice.checked || !voice.supported} onClick={() => void voice.download()}>
      {downloadState === "idle" ? <Download size={15} aria-hidden /> : null}
      {!voice.checked ? "Checking voice…" : !voice.supported ? "Voice unavailable" : downloading ? `Downloading${voice.progress ? ` ${voice.progress}%` : "…"}` : voice.error ? "Retry voice download" : `Download voice · ${JAPANESE_VOICE_DOWNLOAD_LABEL}`}
    </Button>;

  return <DetailSection title="Context sentences" action={action}>
    {!voice.supported && voice.checked ? <p className={styles.voiceError} role="alert">This browser cannot run the local Japanese voice.</p> : null}
    {voice.error ? <p className={styles.voiceError} role="alert">{voice.error}</p> : null}
    <div className={styles.contextList}>{sentences.map((sentence, index) => {
      const active = voice.activeSentence === sentence.ja;
      const busy = voice.activity !== "idle";
      const canStop = active && (voice.activity === "synthesizing" || voice.activity === "playing");
      const label = canStop
        ? `${voice.activity === "playing" ? "Stop" : "Cancel"} Japanese context sentence ${index + 1}`
        : `Play Japanese context sentence ${index + 1}: ${sentence.ja}`;
      return <blockquote key={`${sentence.ja}-${sentence.en}`}>
        <div className={styles.contextSentenceMain}>
          <p lang="ja">{sentence.ja}</p>
          <button
            className={styles.contextPlayButton}
            type="button"
            aria-label={label}
            aria-busy={active && voice.activity === "synthesizing"}
            data-state={active ? voice.activity : "idle"}
            disabled={!voice.downloaded || (busy && !active)}
            title={voice.downloaded ? label : "Download the Japanese voice first"}
            onClick={() => canStop ? voice.stop() : void voice.play(sentence.ja)}
          >
            {active && voice.activity === "synthesizing" ? <LoaderCircle className={styles.voiceSpinner} size={18} aria-hidden /> : active && voice.activity === "playing" ? <Square size={16} aria-hidden /> : <Volume2 size={19} aria-hidden />}
          </button>
        </div>
        <footer>{sentence.en}</footer>
      </blockquote>;
    })}</div>
  </DetailSection>;
}

function DetailSection({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className={styles.detailSection}><div className={styles.detailTitle}><span className={styles.detailTitleLabel}>{icon}<h2>{title}</h2></span>{action}</div><Card className={styles.detailPanel}>{children}</Card></section>;
}

function Mnemonic({ paragraphs }: { paragraphs: string[] }) {
  return <div className={styles.mnemonic}>{paragraphs.map((paragraph, index) => <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>)}</div>;
}

function RadicalMnemonicIllustration({ documentUrl, meaning }: { documentUrl: string; meaning: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  if (state === "failed") return null;
  const src = `/api/wanikani/mnemonic-image?documentUrl=${encodeURIComponent(documentUrl)}`;

  return <figure className={styles.mnemonicIllustration} data-state={state}>
    {state === "loading" ? <Skeleton className={styles.mnemonicIllustrationSkeleton} height="100%" /> : null}
    <Image className={styles.mnemonicIllustrationImage} src={src} alt={`Mnemonic illustration for ${meaning}`} width={720} height={720} sizes="(max-width: 42rem) calc(100vw - 4rem), 36rem" unoptimized onLoad={() => setState("loaded")} onError={() => setState("failed")} />
  </figure>;
}

function passthroughImageLoader({ src }: { src: string }) {
  return src;
}

function HighlightedJapanese({ value, query }: { value: string; query: string }) {
  if (!query || !value.includes(query)) return value;
  const parts = value.split(query);
  return <>{parts.map((part, index) => <span key={`${part}-${index}`}>{part}{index < parts.length - 1 ? <mark>{query}</mark> : null}</span>)}</>;
}

function AnimeContext({ examples, query, loading, failed }: { examples: ImmersionExample[]; query: string; loading: boolean; failed: boolean }) {
  const [visibleCount, setVisibleCount] = useState(10);
  if (loading) return <DetailSection title="Anime context"><Skeleton height="10rem" /></DetailSection>;
  if (failed || !examples.length) return <DetailSection title="Anime context"><p className={styles.contextUnavailable}>No matching ImmersionKit scene was found for this subject and source selection.</p></DetailSection>;
  const visibleExamples = examples.slice(0, visibleCount);
  return <DetailSection title="Anime context"><div className={styles.immersionList}>{visibleExamples.map((example, index) => {
    const source = example.title || "this scene";
    return <figure className={styles.immersionExample} key={`${example.title}-${example.sentence}-${index}`}>
      {example.imageUrl ? <Image src={example.imageUrl} alt={`Scene from ${example.title}`} width={480} height={360} sizes="(max-width: 42rem) 7rem, 7.5rem" loader={passthroughImageLoader} unoptimized /> : null}
      <figcaption>
        <div className={styles.immersionHeader}>
          <strong>{example.title}</strong>
          <SubjectAudioButton audioKey={`anime:${index}:${example.audio ?? "unavailable"}`} src={example.audio} label={`anime clip from ${source}`} variant="scene" />
        </div>
        <p lang="ja"><HighlightedJapanese value={example.sentence} query={query} /></p>
        <span>{example.translation}</span>
      </figcaption>
    </figure>;
  })}</div>{visibleCount < examples.length ? <Button className={styles.immersionMore} type="button" tone="ghost" onClick={() => setVisibleCount((count) => Math.min(count + 10, examples.length))}>Show more scenes</Button> : null}</DetailSection>;
}

function RelationSection({ title, ids, subjects, returnTo, replaceRelated = false }: { title: string; ids?: number[]; subjects: Map<number, Subject>; returnTo: string; replaceRelated?: boolean }) {
  if (!ids?.length) return null;
  return <DetailSection title={title}><div className={styles.relations}>{ids.map((id) => { const subject = subjects.get(id); if (!subject) return null; const tone = subject.object === "kana_vocabulary" ? "vocabulary" : subject.object; return <Link href={`/subjects/${id}?returnTo=${encodeURIComponent(returnTo)}`} replace={replaceRelated} key={id} data-type={tone}><SubjectCharacter subject={subject} imageSize="2rem" /><small>{subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.slug}</small></Link>; })}</div></DetailSection>;
}

interface SubjectDetailPanelsProps {
  record: Subject;
  assignment?: Assignment;
  reviewStatistic?: ReviewStatistic;
  material?: StudyMaterial;
  materialLoading: boolean;
  materialsKey: readonly unknown[];
  relatedSubjects: Subject[];
  pitchAccents: PitchAccentEntry[];
  usagePatterns: UsagePattern[];
  immersionExamples: ImmersionExample[];
  immersionLoading: boolean;
  immersionFailed: boolean;
  settings: WebSettings["subjectDetails"];
  returnTo: string;
  initialTab?: SubjectDetailInitialTab;
  activeTab?: SubjectDetailTab;
  onActiveTabChange?: (tab: SubjectDetailTab) => void;
  idPrefix?: string;
  embedded?: boolean;
  replaceRelated?: boolean;
  sequentialNavigation?: {
    previous?: () => void;
    next: () => void;
  };
}

export function SubjectDetailPanels({
  record,
  assignment,
  reviewStatistic,
  material,
  materialLoading,
  materialsKey,
  relatedSubjects,
  pitchAccents,
  usagePatterns,
  immersionExamples,
  immersionLoading,
  immersionFailed,
  settings,
  returnTo,
  initialTab = "meaning",
  activeTab: controlledActiveTab,
  onActiveTabChange,
  idPrefix = "subject",
  embedded = false,
  replaceRelated = false,
  sequentialNavigation,
}: SubjectDetailPanelsProps) {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<SubjectDetailTab>(initialTab);
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab;
  const selectTab = useCallback((tab: SubjectDetailTab) => {
    if (controlledActiveTab === undefined) setUncontrolledActiveTab(tab);
    onActiveTabChange?.(tab);
  }, [controlledActiveTab, onActiveTabChange]);
  const relationById = new Map(relatedSubjects.map((item) => [item.id, item]));
  const amalgamationSubjects = (record.data.amalgamation_subject_ids ?? []).map((relationId) => relationById.get(relationId)).filter((item): item is Subject => Boolean(item));
  const meaning = record.data.meanings.find((item) => item.primary)?.meaning ?? record.data.meanings[0]?.meaning ?? record.data.slug;
  const primaryMeaning = record.data.meanings.find((item) => item.primary)?.meaning ?? meaning;
  const alternativeMeanings = record.data.meanings.filter((item) => !item.primary).map((item) => item.meaning);
  const meaningMnemonic = plainMnemonic(record.data.meaning_mnemonic);
  const readingMnemonic = plainMnemonic(record.data.reading_mnemonic);
  const characters = record.data.characters || meaning;
  const isVocabulary = record.object === "vocabulary" || record.object === "kana_vocabulary";
  const tone = record.object === "kana_vocabulary" ? "vocabulary" : record.object;
  const hasContextContent = Boolean(
    isVocabulary && (
      (settings.showContextSentences && record.data.context_sentences?.length)
      || (settings.showImmersionExamples && record.data.characters)
      || (settings.showPatternsOfUse && usagePatterns.length)
    ),
  );
  const tabs = useMemo<Array<{ id: SubjectDetailTab; label: string }>>(() => [
    { id: "meaning", label: "Meaning" },
    ...(record.data.readings?.length ? [{ id: "reading" as const, label: "Reading" }] : []),
    ...(record.object === "kanji" && settings.showStrokeOrder ? [{ id: "stroke" as const, label: "Stroke" }] : []),
    ...(hasContextContent ? [{ id: "context" as const, label: "Context" }] : []),
  ], [hasContextContent, record.data.readings?.length, record.object, settings.showStrokeOrder]);
  const resolvedActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0].id;
  const activeTabIndex = tabs.findIndex((tab) => tab.id === resolvedActiveTab);
  const tabPosition = (tab: SubjectDetailTab) => {
    const index = tabs.findIndex((item) => item.id === tab);
    return index < activeTabIndex ? "before" : index > activeTabIndex ? "after" : "active";
  };
  const tabPagerStyle = (tab: SubjectDetailTab) => ({ "--pager-position": `${(tabs.findIndex((item) => item.id === tab) - activeTabIndex) * 100}%` }) as CSSProperties;
  const tabId = (tab: SubjectDetailTab) => `${idPrefix}-tab-${tab}`;
  const panelId = (tab: SubjectDetailTab) => `${idPrefix}-panel-${tab}`;

  const navigateSequentially = useCallback((direction: -1 | 1, focusTab: boolean) => {
    const nextIndex = activeTabIndex + direction;
    if (nextIndex >= 0 && nextIndex < tabs.length) {
      const nextTab = tabs[nextIndex];
      selectTab(nextTab.id);
      window.requestAnimationFrame(() => {
        const tab = document.getElementById(`${idPrefix}-tab-${nextTab.id}`);
        if (focusTab) tab?.focus();
        else tab?.scrollIntoView({ block: "start" });
      });
      return;
    }
    if (direction < 0) sequentialNavigation?.previous?.();
    else sequentialNavigation?.next();
  }, [activeTabIndex, idPrefix, selectTab, sequentialNavigation, tabs]);

  useEffect(() => {
    if (!sequentialNavigation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, audio, video, [role="slider"], [role="tablist"] [role="tab"], [contenteditable]:not([contenteditable="false"])')) return;
      event.preventDefault();
      navigateSequentially(event.key === "ArrowLeft" ? -1 : 1, false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigateSequentially, sequentialNavigation]);

  return <SubjectAudioProvider><div className={`${styles.subjectDetailPanels}${embedded ? ` ${styles.embeddedSubjectDetails}` : ""}`} data-subject-detail-type={tone}>
    <nav className={`${styles.detailTabs}${embedded ? ` ${styles.embeddedDetailTabs}` : ""}`} data-count={tabs.length} role="tablist" aria-label="Subject details">
      {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={tabId(tab.id)} aria-selected={resolvedActiveTab === tab.id} aria-controls={panelId(tab.id)} tabIndex={resolvedActiveTab === tab.id ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (sequentialNavigation && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          navigateSequentially(event.key === "ArrowLeft" ? -1 : 1, true);
          return;
        }
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];
        selectTab(nextTab.id);
        window.requestAnimationFrame(() => document.getElementById(tabId(nextTab.id))?.focus());
      }}>{tab.label}</button>)}
    </nav>

    <div className={`${styles.detailContent}${embedded ? ` ${styles.embeddedDetailContent}` : ""}`}>
      <DetailPager className={styles.detailPanels} activeIndex={activeTabIndex} count={tabs.length} onNavigate={(index) => selectTab(tabs[index].id)}>
        <section id={panelId("meaning")} role="tabpanel" aria-labelledby={tabId("meaning")} aria-hidden={resolvedActiveTab !== "meaning"} inert={resolvedActiveTab !== "meaning" ? true : undefined} data-tab-position={tabPosition("meaning")} className={styles.detailPanelStack} style={tabPagerStyle("meaning")}>
          <DetailSection title="Name" icon={<BookOpen size={19} aria-hidden />}><dl className={styles.nameDetails}><div><dt>Primary</dt><dd>{primaryMeaning}</dd></div>{alternativeMeanings.length ? <div><dt>Alternative</dt><dd>{alternativeMeanings.join(", ")}</dd></div> : null}{material?.data.meaning_synonyms.length ? <div><dt>User synonyms</dt><dd>{material.data.meaning_synonyms.join(", ")}</dd></div> : null}{record.data.parts_of_speech?.length ? <div><dt>Part of speech</dt><dd>{record.data.parts_of_speech.map((part) => part.replaceAll("_", " ")).join(", ")}</dd></div> : null}</dl></DetailSection>
          {meaningMnemonic.length ? <DetailSection title="Mnemonic"><Mnemonic paragraphs={meaningMnemonic} />{record.object === "radical" ? <RadicalMnemonicIllustration key={record.data.document_url} documentUrl={record.data.document_url} meaning={primaryMeaning} /> : null}{record.data.meaning_hint ? <p className={styles.subjectHint}>{record.data.meaning_hint}</p> : null}</DetailSection> : null}
          <StudyMaterialEditor key={`${record.id}:${material?.id ?? "new"}`} subjectId={record.id} material={material} queryKey={materialsKey} loading={materialLoading} />
          <RelationSection title="Components" ids={record.data.component_subject_ids} subjects={relationById} returnTo={returnTo} replaceRelated={replaceRelated} />
          <RelationSection title="Visually similar" ids={record.data.visually_similar_subject_ids} subjects={relationById} returnTo={returnTo} replaceRelated={replaceRelated} />
          {record.object === "radical" ? <RelationSection title="Found in kanji" ids={record.data.amalgamation_subject_ids?.slice(0, 24)} subjects={relationById} returnTo={returnTo} replaceRelated={replaceRelated} /> : null}
          {record.object === "kanji" ? <RelationSection title="Found in vocabulary" ids={record.data.amalgamation_subject_ids?.slice(0, 24)} subjects={relationById} returnTo={returnTo} replaceRelated={replaceRelated} /> : null}
          <DetailSection title="Your progression"><dl className={styles.progressionDetails}><div><dt>Stage</dt><dd>{assignment ? <><SrsStageIcon stage={assignment.data.srs_stage} size={22} />{srsStageLabel(assignment.data.srs_stage)}</> : "Locked"}</dd></div><div><dt>Next review</dt><dd>{assignment?.data.available_at ? new Date(assignment.data.available_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "No review scheduled"}</dd></div>{reviewStatistic ? <><div><dt>Meaning streak</dt><dd>{reviewStatistic.data.meaning_current_streak}</dd></div><div><dt>Reading streak</dt><dd>{reviewStatistic.data.reading_current_streak}</dd></div><div><dt>Accuracy</dt><dd>{reviewStatistic.data.percentage_correct}%</dd></div></> : null}</dl></DetailSection>
        </section>

        {record.data.readings?.length ? <section id={panelId("reading")} role="tabpanel" aria-labelledby={tabId("reading")} aria-hidden={resolvedActiveTab !== "reading"} inert={resolvedActiveTab !== "reading" ? true : undefined} data-tab-position={tabPosition("reading")} className={styles.detailPanelStack} style={tabPagerStyle("reading")}>
          <DetailSection title="Readings" icon={<Layers3 size={19} aria-hidden />}><ReadingGroups readings={record.data.readings} pitchAccents={settings.showPitchAccent ? pitchAccents : []} /></DetailSection>
          {readingMnemonic.length ? <DetailSection title="Reading mnemonic"><Mnemonic paragraphs={readingMnemonic} />{record.data.reading_hint ? <p className={styles.subjectHint}>{record.data.reading_hint}</p> : null}</DetailSection> : null}
          {record.object === "kanji" && settings.showKanjiReadingExamples && amalgamationSubjects.length ? <KanjiReadingExamples kanji={record} vocabulary={amalgamationSubjects} returnTo={returnTo} replaceRelated={replaceRelated} /> : null}
          {record.data.pronunciation_audios?.length ? <DetailSection title="Pronunciation" icon={<Headphones size={19} aria-hidden />}><div className={styles.audioList}>{uniqueAudio(record).map((audio, index) => <PronunciationPlayer key={audio.metadata.source_id ?? index} audio={audio} index={index} />)}</div></DetailSection> : null}
        </section> : null}

        {record.object === "kanji" && settings.showStrokeOrder ? <section id={panelId("stroke")} role="tabpanel" aria-labelledby={tabId("stroke")} aria-hidden={resolvedActiveTab !== "stroke"} inert={resolvedActiveTab !== "stroke" ? true : undefined} data-tab-position={tabPosition("stroke")} className={styles.detailPanelStack} style={tabPagerStyle("stroke")}>
          <DetailSection title="Stroke order"><StrokeOrder character={characters} /></DetailSection>
        </section> : null}

        {hasContextContent ? <section id={panelId("context")} role="tabpanel" aria-labelledby={tabId("context")} aria-hidden={resolvedActiveTab !== "context"} inert={resolvedActiveTab !== "context" ? true : undefined} data-tab-position={tabPosition("context")} className={styles.detailPanelStack} style={tabPagerStyle("context")}>
          {settings.showPatternsOfUse && usagePatterns.length ? <UsagePatterns patterns={usagePatterns} /> : null}
          {settings.showContextSentences && record.data.context_sentences?.length ? <ContextSentences sentences={record.data.context_sentences} /> : null}
          {settings.showImmersionExamples && isVocabulary ? <AnimeContext examples={immersionExamples} query={characters} loading={immersionLoading} failed={immersionFailed} /> : null}
        </section> : null}
      </DetailPager>
    </div>
  </div></SubjectAudioProvider>;
}

type StudyMaterialDraft = {
  meaningNote: string;
  readingNote: string;
  synonyms: string[];
};

function mergeSynonyms(current: string[], candidates: string[]) {
  const next = [...current];
  const known = new Set(current.map((value) => value.toLocaleLowerCase()));
  for (const candidate of candidates) {
    const synonym = candidate.trim();
    const key = synonym.toLocaleLowerCase();
    if (!synonym || known.has(key)) continue;
    next.push(synonym);
    known.add(key);
  }
  return next;
}

export function StudyMaterialEditor({ subjectId, material, queryKey, loading }: { subjectId: number; material?: StudyMaterial; queryKey: readonly unknown[]; loading: boolean }) {
  const queryClient = useQueryClient();
  const synonymInputRef = useRef<HTMLInputElement>(null);
  const [meaningNote, setMeaningNote] = useState(material?.data.meaning_note ?? "");
  const [readingNote, setReadingNote] = useState(material?.data.reading_note ?? "");
  const [synonyms, setSynonyms] = useState(material?.data.meaning_synonyms ?? []);
  const [synonymDraft, setSynonymDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const mutation = useMutation({
    mutationFn: (draft: StudyMaterialDraft) => {
      const body = { study_material: { ...(material ? {} : { subject_id: subjectId }), meaning_note: draft.meaningNote || null, reading_note: draft.readingNote || null, meaning_synonyms: draft.synonyms } };
      return wkRequest<StudyMaterial>(material ? `study_materials/${material.id}` : "study_materials", { method: material ? "PUT" : "POST", body });
    },
    onMutate: () => setButtonState("loading"),
    onSuccess: (saved) => {
      queryClient.setQueryData<StudyMaterial[]>(queryKey, (current = []) => {
        const exists = current.some((item) => item.data.subject_id === saved.data.subject_id);
        if (!exists) return [...current, saved];
        return current.map((item) => item.data.subject_id === saved.data.subject_id ? saved : item);
      });
      setMeaningNote(saved.data.meaning_note ?? "");
      setReadingNote(saved.data.reading_note ?? "");
      setSynonyms(saved.data.meaning_synonyms);
      setSynonymDraft("");
      setButtonState("success");
      setEditing(false);
    },
    onError: () => setButtonState("error"),
  });

  const resetDraft = () => {
    setMeaningNote(material?.data.meaning_note ?? "");
    setReadingNote(material?.data.reading_note ?? "");
    setSynonyms(material?.data.meaning_synonyms ?? []);
    setSynonymDraft("");
    setButtonState("idle");
  };
  const startEditing = () => {
    resetDraft();
    setEditing(true);
  };
  const cancelEditing = () => {
    resetDraft();
    setEditing(false);
  };
  const commitSynonymDraft = () => {
    if (!synonymDraft.trim()) return;
    setSynonyms((current) => mergeSynonyms(current, [synonymDraft]));
    setSynonymDraft("");
  };
  const updateSynonymDraft = (value: string) => {
    const entries = value.split(",");
    if (entries.length === 1) {
      setSynonymDraft(value);
      return;
    }
    setSynonyms((current) => mergeSynonyms(current, entries.slice(0, -1)));
    setSynonymDraft(entries.at(-1)?.trimStart() ?? "");
  };
  const action = loading ? null : editing
    ? <Button type="button" tone="ghost" size="small" disabled={buttonState === "loading"} onClick={cancelEditing}><X size={16} aria-hidden />Cancel</Button>
    : <Button type="button" tone="ghost" size="small" onClick={startEditing}><Pencil size={16} aria-hidden />Edit</Button>;

  return <DetailSection title="Notes" action={action}>
    {loading ? <Skeleton height="6rem" /> : editing ? <form className={styles.notesForm} data-state={buttonState} aria-busy={buttonState === "loading"} onSubmit={(event) => {
      event.preventDefault();
      const nextSynonyms = mergeSynonyms(synonyms, [synonymDraft]);
      setSynonyms(nextSynonyms);
      setSynonymDraft("");
      mutation.mutate({ meaningNote, readingNote, synonyms: nextSynonyms });
    }}>
      <div className={styles.synonymField}>
        <label htmlFor="meaning-synonyms">Meaning synonyms</label>
        <div className={styles.synonymInput} data-state={buttonState} onClick={() => synonymInputRef.current?.focus()}>
          <div className={styles.synonymChips} aria-live="polite">
            {synonyms.map((synonym, index) => <span className={styles.synonymChip} key={`${synonym.toLocaleLowerCase()}-${index}`}>{synonym}<button type="button" disabled={buttonState === "loading"} aria-label={`Remove synonym ${synonym}`} onClick={() => setSynonyms((current) => current.filter((value) => value !== synonym))}><X size={14} aria-hidden /></button></span>)}
          </div>
          <input ref={synonymInputRef} id="meaning-synonyms" value={synonymDraft} placeholder={synonyms.length ? "Add another" : "Add a synonym"} aria-describedby="meaning-synonyms-help" onChange={(event) => updateSynonymDraft(event.target.value)} onBlur={commitSynonymDraft} onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "," || event.key === "Enter") {
              event.preventDefault();
              commitSynonymDraft();
              return;
            }
            if (event.key === "Backspace" && !synonymDraft) setSynonyms((current) => current.slice(0, -1));
          }} />
        </div>
        <span id="meaning-synonyms-help" className={styles.synonymHelper}>Press comma or Enter after each synonym.</span>
      </div>
      <TextAreaField label="Meaning note" rows={4} value={meaningNote} onChange={(event) => setMeaningNote(event.target.value)} />
      <TextAreaField label="Reading note" rows={4} value={readingNote} onChange={(event) => setReadingNote(event.target.value)} />
      {buttonState === "error" ? <p className={styles.notesError} role="alert">Notes weren’t saved. Check your connection and try again.</p> : null}
      <div className={styles.notesActions}><Button type="submit" tone="primary" state={buttonState}><Save size={16} aria-hidden />{buttonState === "error" ? "Try again" : "Save notes"}</Button></div>
    </form> : <dl className={styles.notesReadOnly}>
      <div><dt>Meaning synonyms</dt><dd>{synonyms.length ? <span className={styles.readOnlySynonyms}>{synonyms.map((synonym, index) => <span className={styles.synonymChip} key={`${synonym.toLocaleLowerCase()}-${index}`}>{synonym}</span>)}</span> : <span className={styles.emptyNote}>None added</span>}</dd></div>
      <div><dt>Meaning note</dt><dd>{meaningNote ? <p>{meaningNote}</p> : <span className={styles.emptyNote}>None added</span>}</dd></div>
      <div><dt>Reading note</dt><dd>{readingNote ? <p>{readingNote}</p> : <span className={styles.emptyNote}>None added</span>}</dd></div>
    </dl>}
  </DetailSection>;
}
