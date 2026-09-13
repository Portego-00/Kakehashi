"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Orbit } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ButtonLink } from "@/components/ui/Button";
import type { WebSettings } from "@/features/settings/settings";
import { SubjectDetailPanels, type SubjectDetailTab } from "@/features/subjects/components/SubjectDetail";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { fetchSubjectEnrichments } from "@/features/subjects/enrichments";
import { fetchImmersionExamples } from "@/features/study/immersion";
import { wkCollection } from "@/lib/wanikani/client";
import type { Assignment, StudyMaterial, Subject } from "@/types/wanikani";
import styles from "./core-study.module.css";

interface LessonTeachingProps {
  subjects: Subject[];
  assignments: Assignment[];
  materials: StudyMaterial[];
  materialsLoading: boolean;
  materialsKey: readonly unknown[];
  settings: WebSettings;
  currentIndex: number;
  activeTab: SubjectDetailTab;
  onCurrentIndexChange: (index: number) => void;
  onActiveTabChange: (tab: SubjectDetailTab) => void;
  onStartReview: () => void;
}

function subjectTone(subject: Subject) {
  return subject.object === "kana_vocabulary" ? "vocabulary" : subject.object;
}

function subjectColor(subject: Subject) {
  return subject.object === "radical" ? "var(--color-radical)" : subject.object === "kanji" ? "var(--color-kanji)" : "var(--color-vocabulary)";
}

function primaryMeaning(subject: Subject) {
  return subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
}

function subjectTypeLabel(subject: Subject) {
  if (subject.object === "kana_vocabulary") return "Kana vocabulary";
  return `${subject.object[0].toLocaleUpperCase()}${subject.object.slice(1)}`;
}

export function LessonTeaching({
  subjects,
  assignments,
  materials,
  materialsLoading,
  materialsKey,
  settings,
  currentIndex,
  activeTab,
  onCurrentIndexChange,
  onActiveTabChange,
  onStartReview,
}: LessonTeachingProps) {
  const subject = subjects[currentIndex];
  const heroRef = useRef<HTMLElement>(null);
  const activeBatchItemRef = useRef<HTMLButtonElement>(null);
  const [preserveViewportAfterSubjectChange, setPreserveViewportAfterSubjectChange] = useState(false);
  const [focusTabAfterSubjectChange, setFocusTabAfterSubjectChange] = useState(false);
  const previousSubjectIdRef = useRef(subject?.id);
  const assignmentBySubjectId = useMemo(() => new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment])), [assignments]);
  const materialBySubjectId = useMemo(() => new Map(materials.map((material) => [material.data.subject_id, material])), [materials]);
  const relationIds = useMemo(() => {
    const data = subject?.data;
    return Array.from(new Set([...(data?.component_subject_ids ?? []), ...(data?.amalgamation_subject_ids ?? []), ...(data?.visually_similar_subject_ids ?? [])])).slice(0, 150);
  }, [subject]);
  const relations = useQuery({
    queryKey: ["wanikani", "subjects", `relations:${relationIds.join(",")}`],
    queryFn: () => wkCollection<Subject>(`subjects?ids=${relationIds.join(",")}`),
    enabled: relationIds.length > 0,
    staleTime: 24 * 60 * 60_000,
  });
  const characters = subject?.data.characters;
  const readings = useMemo(() => subject?.data.readings?.map((reading) => reading.reading) ?? [], [subject]);
  const isVocabulary = subject?.object === "vocabulary" || subject?.object === "kana_vocabulary";
  const detailSettings = settings.subjectDetails;
  const enrichments = useQuery({
    queryKey: ["subject-enrichments", subject?.id ?? 0, characters, readings.join(",")],
    queryFn: ({ signal }) => fetchSubjectEnrichments({ id: subject!.id, level: subject!.data.level, characters: characters!, readings }, signal),
    enabled: Boolean(subject && characters && ((detailSettings.showPitchAccent && subject.object !== "radical") || (detailSettings.showPatternsOfUse && isVocabulary))),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });
  const immersionSources = settings.study.immersionKitAnimeSources;
  const immersion = useQuery({
    queryKey: ["immersion", "subject-detail", characters, immersionSources.join(",")],
    queryFn: ({ signal }) => fetchImmersionExamples(characters!, immersionSources, signal),
    enabled: Boolean(subject && detailSettings.showImmersionExamples && characters && isVocabulary),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!subject || previousSubjectIdRef.current === subject.id) return;
    previousSubjectIdRef.current = subject.id;
    if (!preserveViewportAfterSubjectChange) {
      heroRef.current?.scrollIntoView({ block: "start" });
    }
    if (!focusTabAfterSubjectChange) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(`lesson-subject-${subject.id}-tab-meaning`)?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [focusTabAfterSubjectChange, preserveViewportAfterSubjectChange, subject]);

  useEffect(() => {
    activeBatchItemRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentIndex]);

  if (!subject) return null;

  const tone = subjectTone(subject);
  const meaning = primaryMeaning(subject);
  const primaryReading = subject.data.readings?.filter((reading) => reading.primary).map((reading) => reading.reading).join(" · ") || subject.data.readings?.[0]?.reading;
  const characterCount = Array.from(subject.data.characters || meaning).length;
  const lessonProgress = subjects.length ? (currentIndex + 1) / subjects.length : 0;
  const goToSubject = (index: number, preserveViewport = false, focusTab = false) => {
    setPreserveViewportAfterSubjectChange(preserveViewport);
    setFocusTabAfterSubjectChange(focusTab);
    onActiveTabChange("meaning");
    onCurrentIndexChange(index);
  };
  const startReview = () => {
    heroRef.current?.scrollIntoView({ block: "start" });
    onStartReview();
  };
  const goPrevious = currentIndex > 0 ? (focusTab: boolean) => goToSubject(currentIndex - 1, true, focusTab) : undefined;
  const goNext = (focusTab: boolean) => {
    if (currentIndex < subjects.length - 1) goToSubject(currentIndex + 1, true, focusTab);
    else startReview();
  };

  return <div className={styles.studyShell} data-subject-detail-type={tone}>
    <article className={styles.lesson} aria-labelledby="lesson-subject-title">
      <header ref={heroRef} className={styles.lessonSubjectHero} style={{ "--subject-color": subjectColor(subject) } as CSSProperties}>
        <div className={styles.lessonHeroBar}>
          <div className={styles.sessionProgress}><span>Lessons</span><strong>{currentIndex + 1} / {subjects.length}</strong></div>
          <div className={styles.lessonHeroActions}>
            <Link className={styles.lessonHeroAction} href={`/subjects/${subject.id}/constellation`} aria-label={`Explore ${meaning} constellation`}><Orbit size={20} aria-hidden /></Link>
            <ButtonLink className={styles.lessonHeroLeave} href="/dashboard" tone="ghost" size="small">Leave</ButtonLink>
          </div>
        </div>
        <div className={styles.progressTrack} role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={subjects.length} aria-valuenow={currentIndex + 1}>
          <span style={{ "--study-progress": lessonProgress } as CSSProperties} />
        </div>
        <div className={styles.lessonHeroCopy}>
          <SubjectCharacter subject={subject} imageSize="5rem" imageTone="subject" eager className={styles.lessonHeroCharacter} data-character-count={Math.min(characterCount, 12)} />
          <h1 id="lesson-subject-title">{meaning}</h1>
          {primaryReading ? <p lang="ja">{primaryReading}</p> : null}
        </div>
        <div className={styles.lessonHeroMeta}><span>{subjectTypeLabel(subject)}</span><span>Level {subject.data.level}</span></div>
      </header>

      <div className={styles.lessonSubjectDetails}>
        <SubjectDetailPanels
          key={subject.id}
          record={subject}
          assignment={assignmentBySubjectId.get(subject.id)}
          material={materialBySubjectId.get(subject.id)}
          materialLoading={materialsLoading}
          materialsKey={materialsKey}
          relatedSubjects={relations.data ?? []}
          pitchAccents={enrichments.data?.pitchAccents ?? []}
          usagePatterns={enrichments.data?.patterns ?? []}
          immersionExamples={immersion.data ?? []}
          immersionLoading={immersion.isLoading}
          immersionFailed={immersion.isError}
          settings={detailSettings}
          returnTo="/lessons"
          idPrefix={`lesson-subject-${subject.id}`}
          activeTab={activeTab}
          onActiveTabChange={onActiveTabChange}
          sequentialNavigation={{ previous: goPrevious, next: goNext }}
        />
      </div>

      <nav className={styles.lessonFooter} aria-label="Lesson navigation">
        <button type="button" className={styles.lessonFooterArrow} aria-label="Previous lesson" disabled={!goPrevious} onClick={() => goPrevious?.(false)}>
          <ChevronLeft size={20} aria-hidden /><span>Previous</span>
        </button>
        <div className={styles.lessonBatchItems} role="list" aria-label="Lessons in this batch">
          {subjects.map((batchSubject, index) => {
            const batchMeaning = primaryMeaning(batchSubject);
            const active = index === currentIndex;
            return <span key={batchSubject.id} role="listitem"><button
              type="button"
              className={styles.lessonBatchItem}
              style={{ "--lesson-item-color": subjectColor(batchSubject) } as CSSProperties}
              data-active={active || undefined}
              aria-current={active ? "step" : undefined}
              aria-label={`Lesson ${index + 1}: ${batchMeaning}`}
              title={batchMeaning}
              ref={active ? activeBatchItemRef : undefined}
              onClick={() => goToSubject(index)}
            ><SubjectCharacter subject={batchSubject} imageSize="1.35rem" imageTone="subject" /></button></span>;
          })}
        </div>
        <button type="button" className={styles.lessonFooterArrow} aria-label={currentIndex === subjects.length - 1 ? "Start lesson review" : "Next lesson"} onClick={() => goNext(false)}>
          <span>{currentIndex === subjects.length - 1 ? "Start review" : "Next"}</span><ChevronRight size={20} aria-hidden />
        </button>
      </nav>
    </article>
  </div>;
}
