"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AlertCircle, ArrowLeft, LoaderCircle, RotateCcw } from "lucide-react";
import { LoadingState } from "@/components/ui/States";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { createListRepository, subscribeSubjectLists, type ListStorage } from "@/features/subjects/lists";
import { createStudySession, generateQuestions, getStudyItemProgress } from "../engine";
import { addAnimeContext } from "../immersion";
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
const subjectListStorage: ListStorage = {
  getItem: (key) => typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: (key, value) => { if (typeof window !== "undefined") window.localStorage.setItem(key, value); },
};

function Setup({ mode, scope, maxLevel, subjects, assignments, lists, seedSubjectIds, defaultAnimeSources, animeSyncUsernames, starting, onStart }: { mode: StudyModeId; scope: string | number; maxLevel: number; subjects: Parameters<typeof StudyConfig>[0]["subjects"]; assignments: NonNullable<Parameters<typeof StudyConfig>[0]["assignments"]>; lists: Parameters<typeof StudyConfig>[0]["lists"]; seedSubjectIds: number[]; defaultAnimeSources: string[]; animeSyncUsernames: { myanimelist: string; anilist: string }; starting: boolean; onStart: (filters: StudyFilters) => void }) {
  const rawConfig = useSyncExternalStore(noopSubscribe, () => window.localStorage.getItem(configKey(scope, mode)), () => null);
  const initial = useMemo(() => {
    const hydrated = hydrateModeFilters(mode, rawConfig ? loadStudyConfig(scope, mode) : null, maxLevel);
    const available = new Set(subjects.map((subject) => subject.id));
    const selectedSubjectIds = (seedSubjectIds.length ? seedSubjectIds : hydrated.selectedSubjectIds).filter((id) => available.has(id));
    const animeSources = mode === "listening" && rawConfig === null ? defaultAnimeSources : hydrated.animeSources;
    return { ...hydrated, animeSources, selectedSubjectIds };
  }, [defaultAnimeSources, maxLevel, mode, rawConfig, scope, seedSubjectIds, subjects]);
  const [filters, setFilters] = useState<StudyFilters>(initial);
  const update = (next: StudyFilters) => { setFilters(next); saveStudyConfig(scope, mode, next); };
  return <StudyConfig mode={mode} filters={filters} subjects={subjects} assignments={assignments} lists={lists} animeSyncUsernames={animeSyncUsernames} starting={starting} onChange={update} onStart={() => onStart(filters)} />;
}

export function StudyModeClient({ mode, seedSubjectIds = [] }: { mode: StudyModeId; seedSubjectIds?: number[] }) {
  const definition = getStudyMode(mode);
  const { status, user, dataset, loading, fetching, error, retry } = useStudyDataset();
  const webSettings = useWebSettings(user?.data.username ?? "anonymous");
  const [activeFilters, setActiveFilters] = useState<StudyFilters | null>(null);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const scope = user?.id ?? "pending";
  const rawSession = useSyncExternalStore(noopSubscribe, () => window.localStorage.getItem(sessionKey(scope, mode)), () => null);
  const savedSession = useMemo(() => rawSession && isQuizMode(mode) ? loadStudySession(scope, mode) : null, [mode, rawSession, scope]);
  const savedSessionItemProgress = savedSession ? getStudyItemProgress(savedSession.questions, savedSession.currentIndex) : null;
  const userLevel = user?.data.level ?? 60;
  const username = user?.data.username ?? "anonymous";
  const listRepository = useMemo(() => createListRepository(subjectListStorage, username), [username]);
  const subscribeToLists = useCallback((onChange: () => void) => subscribeSubjectLists(username, onChange), [username]);
  const getListsSnapshot = useCallback(() => listRepository.snapshot(), [listRepository]);
  const rawLists = useSyncExternalStore(subscribeToLists, getListsSnapshot, () => "");
  const lists = useMemo(() => {
    void rawLists;
    return listRepository.load();
  }, [listRepository, rawLists]);

  useEffect(() => {
    if (scope === "pending" || listRepository.load().length) return;
    const legacyLists = loadSubjectLists(scope);
    if (legacyLists.length) listRepository.replace(legacyLists);
  }, [listRepository, scope]);

  const start = async (filters: StudyFilters) => {
    if (!dataset) return;
    const effectiveFilters = {
      ...filters,
      minLevel: filters.useCustomLevelRange ? filters.minLevel : 1,
      maxLevel: filters.useCustomLevelRange ? filters.maxLevel : userLevel,
      ...(mode === "custom-review" ? { questionKinds: ["meaning", "reading"] as Array<"meaning" | "reading"> } : null),
    };
    setStartError(null);
    setPreparing(true);
    saveStudyConfig(scope, mode, filters);
    if (mode === "similar-kanji") {
      setActiveFilters(effectiveFilters); setPreparing(false); return;
    }
    if (isQuizMode(mode)) {
      const generationFilters = mode === "listening" ? { ...effectiveFilters, count: Math.min(60, effectiveFilters.count * 3) } : effectiveFilters;
      let questions = generateQuestions(mode, dataset, generationFilters);
      if (mode === "listening") questions = (await addAnimeContext(questions, effectiveFilters)).slice(0, effectiveFilters.count * 2);
      if (!questions.length) { setStartError(mode === "listening" ? "No matching anime examples with audio were found. Try another anime source or widen the SRS and level filters." : "No matching questions were found. Try more SRS stages, subject types, levels, or a different recent window."); setPreparing(false); return; }
      const session = createStudySession(mode, questions);
      saveStudySession(scope, session); setActiveSession(session); setPreparing(false); return;
    }
    setActiveFilters(effectiveFilters); setPreparing(false);
  };
  const exit = () => { setActiveSession(null); setActiveFilters(null); };

  if (status === "anonymous") return <main className={`page ${styles.studyPage}`}><section className={styles.authNotice}><AlertCircle size={25} /><h1>Connect WaniKani to study</h1><p>Your session is not connected. Sign in from the dashboard, then return here.</p><Link className={styles.primaryButton} href="/">Go to sign in</Link></section></main>;
  if (loading) return <main className={`page ${styles.studyPage}`}><LoadingState label="Loading subjects and SRS stages" detail="Preparing your WaniKani item library for this study mode." /></main>;
  if (error || !dataset) return <main className={`page ${styles.studyPage}`}><section className={styles.authNotice}><AlertCircle size={25} /><h1>Study data didn’t load</h1><p>{error instanceof Error ? error.message : "The WaniKani request could not be completed."}</p><button className={styles.primaryButton} onClick={() => void retry()}>Try again</button></section></main>;

  let content: React.ReactNode;
  if (activeSession) content = <QuizSession scope={scope} initialSession={activeSession} subjects={dataset.subjects} showDetailsAtAnswerStops={webSettings.study.showAnswerStopSubjectDetails} keyboardShortcuts={webSettings.study.keyboardShortcuts} onExit={exit} onRestartMistakes={(ids) => void start({ ...(loadStudyConfig(scope, mode) ? hydrateModeFilters(mode, loadStudyConfig(scope, mode), userLevel) : getModeDefaultFilters(mode, userLevel)), selectedSubjectIds: ids, count: Math.max(5, ids.length) })} />;
  else if (activeFilters && mode === "kanji-writing") content = <WritingPractice dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (activeFilters && mode === "crossword") content = <CrosswordGame dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (activeFilters && mode === "kana-wordle") content = <KanaWordle dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (activeFilters && mode === "similar-kanji") content = <SimilarKanjiMatching dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (activeFilters && mode === "custom-lessons") content = <CustomLessons dataset={dataset} filters={activeFilters} scope={scope} onExit={exit} />;
  else if (mode === "text-analysis") content = <TextAnalysis subjects={dataset.subjects} scope={scope} />;
  else if (mode === "subject-lists") content = <SubjectLists subjects={dataset.subjects} scope={scope} username={username} />;
  else content = <><div className={styles.resumeRow}>{savedSession && savedSessionItemProgress && !savedSession.complete ? <button className={styles.resumeButton} onClick={() => setActiveSession(savedSession)}><RotateCcw size={17} /><span><strong>Resume saved session</strong><small>Item {savedSessionItemProgress.current} of {savedSessionItemProgress.total}</small></span></button> : null}{fetching ? <span className={styles.refreshing}><LoaderCircle className={styles.spinner} size={14} /> Refreshing data</span> : null}</div>{startError ? <p className={styles.startError} role="alert">{startError}</p> : null}<Setup mode={mode} scope={scope} maxLevel={userLevel} subjects={dataset.subjects} assignments={dataset.assignments} lists={lists} seedSubjectIds={mode === "custom-review" ? seedSubjectIds : []} defaultAnimeSources={webSettings.study.immersionKitAnimeSources} animeSyncUsernames={{ myanimelist: webSettings.integrations?.myAnimeListUsername ?? "", anilist: webSettings.integrations?.aniListUsername ?? "" }} starting={preparing} onStart={(filters) => void start(filters)} /></>;

  const sessionActive = Boolean(activeSession || activeFilters);

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
