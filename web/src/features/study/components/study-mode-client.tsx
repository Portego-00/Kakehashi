"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, ArrowLeft, LoaderCircle, RotateCcw } from "lucide-react";
import { LoadingState } from "@/components/ui/States";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useSubjectLists } from "@/features/subjects/use-subject-lists";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import { createStudySession, generateQuestions, getStudyItemProgress } from "../engine";
import { streamAnimeContext } from "../immersion";
import { getStudyMode } from "../catalog";
import { getModeDefaultFilters, hydrateModeFilters, isQuizMode } from "../mode-config";
import { loadStudyConfig, loadStudySession, loadSubjectLists, saveStudyConfig, saveStudySession, configKey, sessionKey } from "../storage";
import type { StudyFilters, StudyModeId, StudySession } from "../types";
import { useStudyDataset } from "../use-study-dataset";
import { QuizSession } from "./quiz-session";
import { StudyConfig } from "./study-config";
import { CrosswordGame, CustomLessons, KanaWordle, SimilarKanjiMatching, SubjectLists, TextAnalysis, WritingPractice } from "./special-modes";
import styles from "../study.module.css";

const noopSubscribe = () => () => {};

function Setup({ mode, scope, maxLevel, subjects, assignments, lists, seedSubjectIds, startImmediately, defaultAnimeSources, animeSyncUsernames, starting, onStart }: { mode: StudyModeId; scope: string | number; maxLevel: number; subjects: Parameters<typeof StudyConfig>[0]["subjects"]; assignments: NonNullable<Parameters<typeof StudyConfig>[0]["assignments"]>; lists: Parameters<typeof StudyConfig>[0]["lists"]; seedSubjectIds: number[]; startImmediately: boolean; defaultAnimeSources: string[]; animeSyncUsernames: { myanimelist: string; anilist: string }; starting: boolean; onStart: (filters: StudyFilters) => void }) {
  const rawConfig = useSyncExternalStore(noopSubscribe, () => window.localStorage.getItem(configKey(scope, mode)), () => null);
  const initial = useMemo(() => {
    const hydrated = hydrateModeFilters(mode, rawConfig ? loadStudyConfig(scope, mode) : null, maxLevel);
    const available = new Set(subjects.map((subject) => subject.id));
    const selectedSubjectIds = (seedSubjectIds.length ? seedSubjectIds : hydrated.selectedSubjectIds).filter((id) => available.has(id));
    const animeSources = mode === "listening" && rawConfig === null ? defaultAnimeSources : hydrated.animeSources;
    return { ...hydrated, animeSources, selectedSubjectIds };
  }, [defaultAnimeSources, maxLevel, mode, rawConfig, scope, seedSubjectIds, subjects]);
  const [filters, setFilters] = useState<StudyFilters>(initial);
  const startedImmediatelyRef = useRef(false);
  const update = (next: StudyFilters) => { setFilters(next); saveStudyConfig(scope, mode, next); };
  useEffect(() => {
    if (!startImmediately || !seedSubjectIds.length || !filters.selectedSubjectIds.length || startedImmediatelyRef.current) return;
    startedImmediatelyRef.current = true;
    onStart(filters);
  }, [filters, onStart, seedSubjectIds.length, startImmediately]);
  if (startImmediately && filters.selectedSubjectIds.length) {
    return <LoadingState label="Starting your list" detail={`Preparing ${filters.selectedSubjectIds.length} saved ${filters.selectedSubjectIds.length === 1 ? "subject" : "subjects"}.`} />;
  }
  return <StudyConfig mode={mode} filters={filters} subjects={subjects} assignments={assignments} lists={lists} animeSyncUsernames={animeSyncUsernames} starting={starting} onChange={update} onStart={() => onStart(filters)} />;
}

function ListeningPreparation() {
  return <section className={styles.listeningPreparation} role="status" aria-label="Finding anime clips" aria-live="polite">
    <div className={styles.filmLoader} aria-hidden="true"><div><span>聞</span><span>話</span><span>日</span><span>本</span></div></div>
    <strong>Finding anime clips…</strong>
    <p>The first scene will open as soon as it is ready.</p>
  </section>;
}

export function StudyModeClient({ mode, seedSubjectIds = [], startImmediately = false }: { mode: StudyModeId; seedSubjectIds?: number[]; startImmediately?: boolean }) {
  const definition = getStudyMode(mode);
  const { status, user, dataset, loading, fetching, error, retry } = useStudyDataset();
  const webSettings = useWebSettings(user?.data.username ?? "anonymous");
  const [activeFilters, setActiveFilters] = useState<StudyFilters | null>(null);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [listeningLoadingMore, setListeningLoadingMore] = useState(false);
  const [listeningTargetCount, setListeningTargetCount] = useState<number | null>(null);
  const [consumedImmediateStart, setConsumedImmediateStart] = useState<string | null>(null);
  const listeningAbortRef = useRef<AbortController | null>(null);
  const scope = waniKaniUserId(user) || "pending";
  const rawSession = useSyncExternalStore(noopSubscribe, () => window.localStorage.getItem(sessionKey(scope, mode)), () => null);
  const savedSession = useMemo(() => rawSession && isQuizMode(mode) ? loadStudySession(scope, mode) : null, [mode, rawSession, scope]);
  const savedSessionItemProgress = savedSession ? getStudyItemProgress(savedSession.questions, savedSession.currentIndex) : null;
  const userLevel = user?.data.level ?? 60;
  const username = user?.data.username ?? "anonymous";
  const { repository: listRepository, lists } = useSubjectLists(username);

  useEffect(() => {
    if (scope === "pending" || listRepository.load().length) return;
    const legacyLists = loadSubjectLists(scope);
    if (legacyLists.length) listRepository.replace(legacyLists);
  }, [listRepository, scope]);

  useEffect(() => () => listeningAbortRef.current?.abort(), []);

  const start = async (filters: StudyFilters) => {
    if (!dataset) return;
    listeningAbortRef.current?.abort();
    setListeningLoadingMore(false);
    const effectiveFilters = {
      ...filters,
      minLevel: filters.useCustomLevelRange ? filters.minLevel : 1,
      maxLevel: filters.useCustomLevelRange ? filters.maxLevel : userLevel,
      ...(mode === "custom-review" ? { questionKinds: ["meaning", "reading"] as Array<"meaning" | "reading"> } : null),
    };
    setStartError(null);
    setPreparing(true);
    setListeningTargetCount(mode === "listening" ? effectiveFilters.count : null);
    saveStudyConfig(scope, mode, filters);
    if (mode === "similar-kanji") {
      setActiveFilters(effectiveFilters); setPreparing(false); return;
    }
    if (isQuizMode(mode)) {
      const generationFilters = mode === "listening" ? { ...effectiveFilters, count: Math.min(60, effectiveFilters.count * 3) } : effectiveFilters;
      const questions = generateQuestions(mode, dataset, generationFilters);
      if (mode === "listening") {
        const controller = new AbortController();
        listeningAbortRef.current = controller;
        const stream = streamAnimeContext(questions, effectiveFilters, { limit: effectiveFilters.count * 2, signal: controller.signal });
        try {
          const first = await stream.next();
          if (controller.signal.aborted) return;
          if (first.done || !first.value.length) {
            setStartError("No matching anime examples with audio and images were found. Try another anime source or widen the SRS and level filters.");
            setPreparing(false);
            return;
          }
          const session = createStudySession(mode, first.value);
          saveStudySession(scope, session);
          setActiveSession(session);
          setPreparing(false);
          setListeningLoadingMore(true);
          void (async () => {
            try {
              for await (const batch of stream) {
                if (controller.signal.aborted) return;
                setActiveSession((current) => {
                  if (!current || current.id !== session.id) return current;
                  const knownIds = new Set(current.questions.map((question) => question.id));
                  const incoming = batch.filter((question) => !knownIds.has(question.id));
                  return incoming.length ? { ...current, questions: [...current.questions, ...incoming], updatedAt: new Date().toISOString() } : current;
                });
              }
            } finally {
              if (!controller.signal.aborted) setListeningLoadingMore(false);
            }
          })();
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
          setStartError(error instanceof Error ? error.message : "Anime clips could not be prepared.");
          setPreparing(false);
          return;
        }
      }
      if (!questions.length) { setStartError("No matching questions were found. Try more SRS stages, subject types, levels, or a different recent window."); setPreparing(false); return; }
      const session = createStudySession(mode, questions);
      saveStudySession(scope, session); setActiveSession(session); setPreparing(false); return;
    }
    setActiveFilters(effectiveFilters); setPreparing(false);
  };
  const exit = () => { listeningAbortRef.current?.abort(); setListeningLoadingMore(false); setListeningTargetCount(null); setActiveSession(null); setActiveFilters(null); };

  if (status === "anonymous") return <main className={`page ${styles.studyPage}`}><section className={styles.authNotice}><AlertCircle size={25} /><h1>Connect WaniKani to study</h1><p>Your session is not connected. Sign in from the dashboard, then return here.</p><Link className={styles.primaryButton} href="/">Go to sign in</Link></section></main>;
  if (loading) return <main className={`page ${styles.studyPage}`}><LoadingState label="Loading subjects and SRS stages" detail="Preparing your WaniKani item library for this study mode." /></main>;
  if (error || !dataset) return <main className={`page ${styles.studyPage}`}><section className={styles.authNotice}><AlertCircle size={25} /><h1>Study data didn’t load</h1><p>{error instanceof Error ? error.message : "The WaniKani request could not be completed."}</p><button className={styles.primaryButton} onClick={() => void retry()}>Try again</button></section></main>;

  const validSeedIds = new Set(dataset.subjects.map((subject) => subject.id));
  const immediateStartSignature = `${mode}:${seedSubjectIds.join(",")}`;
  const startingListSession = startImmediately
    && !startError
    && consumedImmediateStart !== immediateStartSignature
    && seedSubjectIds.some((id) => validSeedIds.has(id));
  let content: React.ReactNode;
  const preparingListening = mode === "listening" && preparing && !activeSession;
  if (activeSession) content = <QuizSession key={activeSession.id} scope={scope} initialSession={activeSession} subjects={dataset.subjects} showDetailsAtAnswerStops={webSettings.study.showAnswerStopSubjectDetails} showListeningTranslation={webSettings.study.showListeningTranslation} keyboardShortcuts={webSettings.study.keyboardShortcuts} loadingMore={mode === "listening" && listeningLoadingMore} expectedSubjectCount={mode === "listening" ? listeningTargetCount ?? undefined : undefined} onExit={exit} onRestartMistakes={(ids) => void start({ ...(loadStudyConfig(scope, mode) ? hydrateModeFilters(mode, loadStudyConfig(scope, mode), userLevel) : getModeDefaultFilters(mode, userLevel)), selectedSubjectIds: ids, count: Math.max(5, ids.length) })} />;
  else if (preparingListening) content = <ListeningPreparation />;
  else if (activeFilters && mode === "kanji-writing") content = <WritingPractice dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (activeFilters && mode === "crossword") content = <CrosswordGame dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (activeFilters && mode === "kana-wordle") content = <KanaWordle dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (activeFilters && mode === "similar-kanji") content = <SimilarKanjiMatching dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (activeFilters && mode === "custom-lessons") content = <CustomLessons dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (mode === "text-analysis") content = <TextAnalysis subjects={dataset.subjects} scope={scope} />;
  else if (mode === "subject-lists") content = <SubjectLists subjects={dataset.subjects} scope={scope} username={username} />;
  else content = <><div className={styles.resumeRow}>{savedSession && savedSessionItemProgress && !savedSession.complete ? <button className={styles.resumeButton} onClick={() => setActiveSession(savedSession)}><RotateCcw size={17} /><span><strong>Resume saved session</strong><small>Item {savedSessionItemProgress.current} of {savedSessionItemProgress.total}</small></span></button> : null}{fetching ? <span className={styles.refreshing}><LoaderCircle className={styles.spinner} size={14} /> Refreshing data</span> : null}</div>{startError ? <p className={styles.startError} role="alert">{startError}</p> : null}<Setup mode={mode} scope={scope} maxLevel={userLevel} subjects={dataset.subjects} assignments={dataset.assignments} lists={lists} seedSubjectIds={seedSubjectIds} startImmediately={startingListSession} defaultAnimeSources={webSettings.study.immersionKitAnimeSources} animeSyncUsernames={{ myanimelist: webSettings.integrations?.myAnimeListUsername ?? "", anilist: webSettings.integrations?.aniListUsername ?? "" }} starting={preparing} onStart={(filters) => { if (startingListSession) setConsumedImmediateStart(immediateStartSignature); void start(filters); }} /></>;

  const sessionActive = Boolean(activeSession || activeFilters || preparingListening || startingListSession);

  return (
    <main className={`${sessionActive ? styles.studySessionPage : `page ${styles.studyPage}`} ${styles.fetchReady}`} data-study-session={sessionActive ? "active" : undefined}>
      {!sessionActive ? <header className={styles.modeHeader} data-accent={definition.accent}>
        <Link href="/study" className={styles.backLink}><ArrowLeft size={17} /> All study modes</Link>
        <div><div><h1>{definition.title}</h1><p>{definition.description}</p></div></div>
      </header> : null}
      {content}
    </main>
  );
}
