"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/States";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import { jlptQuestionSemanticKey } from "../editorial";
import {
  createJlptSession,
  expireJlptSection,
  pauseJlptSession,
  remainingSectionSeconds,
  resumeJlptSession,
} from "../engine";
import { loadJlptQuestionBank } from "../questions";
import {
  clearJlptSession,
  jlptSessionSnapshot,
  loadJlptQuestionHistory,
  loadJlptSemanticHistory,
  parseJlptSessionSnapshot,
  rememberJlptQuestionSelection,
  saveJlptSession,
  subscribeJlptSession,
} from "../storage";
import type {
  JlptLevel,
  JlptQuestion,
  JlptQuizMode,
  JlptSession,
  JlptSkill,
} from "../types";
import styles from "../jlpt.module.css";
import { JlptHub } from "./JlptHub";
import { JlptResults } from "./JlptResults";
import { JlptSessionView } from "./JlptSessionView";

type WorkspaceView = "hub" | "session" | "results";

function selectionHistory(
  scope: string | number,
  level: JlptLevel,
  bank: readonly JlptQuestion[],
) {
  const questionIds = loadJlptQuestionHistory(scope, level);
  const semanticKeys = loadJlptSemanticHistory(scope, level);
  for (const question of bank)
    if (questionIds.has(question.id))
      semanticKeys.add(jlptQuestionSemanticKey(question));
  return { questionIds, semanticKeys };
}

export function JLPTWorkspace() {
  const { user } = useSession();
  const webSettings = useWebSettings(user?.data.username ?? "anonymous");
  const scope = waniKaniUserId(user) || user?.data.username || "anonymous";
  const subscribeToSession = useCallback(
    (onChange: () => void) => subscribeJlptSession(scope, onChange),
    [scope],
  );
  const readSessionSnapshot = useCallback(
    () => jlptSessionSnapshot(scope),
    [scope],
  );
  const rawSavedSession = useSyncExternalStore(
    subscribeToSession,
    readSessionSnapshot,
    () => "",
  );
  const savedSession = useMemo(
    () => parseJlptSessionSnapshot(rawSavedSession),
    [rawSavedSession],
  );
  const [view, setView] = useState<WorkspaceView>("hub");
  const [selectedLevelOverride, setSelectedLevelOverride] =
    useState<JlptLevel | null>(null);
  const selectedLevel = selectedLevelOverride ?? savedSession?.level ?? "N5";
  const [immediateFeedback, setImmediateFeedback] = useState(true);
  const [session, setSession] = useState<JlptSession | null>(null);
  const [questions, setQuestions] = useState<readonly JlptQuestion[]>([]);
  const [startingMode, setStartingMode] = useState<JlptQuizMode | null>(null);
  const [error, setError] = useState("");

  const storeSession = useCallback(
    (next: JlptSession) => {
      setSession(next);
      saveJlptSession(scope, next);
      if (next.status === "complete") setView("results");
    },
    [scope],
  );

  const rememberAnsweredQuestion = useCallback(
    (question: JlptQuestion) => {
      rememberJlptQuestionSelection(scope, question.level, [question]);
    },
    [scope],
  );

  useEffect(() => {
    if (view !== "session" || session?.status !== "active") return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [session?.status, view]);

  const begin = async (mode: Exclude<JlptQuizMode, "weak">) => {
    if (
      savedSession &&
      savedSession.status !== "complete" &&
      !window.confirm(
        "Starting a new JLPT session will replace the saved attempt. Continue?",
      )
    )
      return;
    setStartingMode(mode);
    setError("");
    try {
      const bank = await loadJlptQuestionBank(selectedLevel);
      const history = selectionHistory(scope, selectedLevel, bank);
      const next = createJlptSession({
        level: selectedLevel,
        mode,
        questions: bank,
        immediateFeedback,
        excludedQuestionIds: history.questionIds,
        excludedSemanticKeys: history.semanticKeys,
      });
      setQuestions(bank);
      storeSession(next);
      setView("session");
    } catch {
      setError("This question bank could not be loaded. Please try again.");
    } finally {
      setStartingMode(null);
    }
  };

  const resumeSaved = async () => {
    if (!savedSession) return;
    setStartingMode(savedSession.mode);
    setError("");
    try {
      const bank = await loadJlptQuestionBank(savedSession.level);
      let next = savedSession;
      if (next.status === "paused") next = resumeJlptSession(next);
      else if (
        next.status === "active" &&
        next.mode === "mock" &&
        remainingSectionSeconds(next) === 0
      )
        next = expireJlptSection(next);
      setQuestions(bank);
      storeSession(next);
      setView(next.status === "complete" ? "results" : "session");
    } catch {
      setError(
        "The saved session could not be reopened. Your answers are still stored on this device.",
      );
    } finally {
      setStartingMode(null);
    }
  };

  const pauseAndExit = () => {
    if (!session) return;
    const next =
      session.status === "active" ? pauseJlptSession(session) : session;
    storeSession(next);
    setView("hub");
  };

  const discard = () => {
    if (
      !savedSession ||
      window.confirm("Discard this saved JLPT session and its answers?")
    ) {
      clearJlptSession(scope);
      setSession(null);
    }
  };

  const practiceWeakAreas = async (skills: JlptSkill[]) => {
    if (!session) return;
    setStartingMode("weak");
    setError("");
    try {
      const bank = questions.length
        ? questions
        : await loadJlptQuestionBank(session.level);
      const history = selectionHistory(scope, session.level, bank);
      const next = createJlptSession({
        level: session.level,
        mode: "weak",
        questions: bank,
        weakSkills: skills,
        immediateFeedback: true,
        excludedQuestionIds: history.questionIds,
        excludedSemanticKeys: history.semanticKeys,
      });
      setQuestions(bank);
      storeSession(next);
      setView("session");
    } catch {
      setError("Weak-area practice could not be prepared. Please try again.");
      setView("hub");
    } finally {
      setStartingMode(null);
    }
  };

  if (
    (view === "session" || view === "results") &&
    (!session || !questions.length)
  ) {
    return (
      <main className={styles.workspaceLoading}>
        <LoadingState
          label="Preparing your JLPT session"
          detail="Loading the generated beta question bank…"
        />
      </main>
    );
  }

  if (view === "session" && session) {
    return (
      <JlptSessionView
        session={session}
        questions={questions}
        onSessionChange={storeSession}
        onQuestionAnswered={rememberAnsweredQuestion}
        onPauseAndExit={pauseAndExit}
        answerFeedbackSoundEnabled={
          webSettings.study.answerFeedbackSoundEnabled
        }
      />
    );
  }

  if (view === "results" && session) {
    return (
      <JlptResults
        session={session}
        questions={questions}
        onPracticeWeakAreas={(skills) => void practiceWeakAreas(skills)}
        onReturn={() => setView("hub")}
      />
    );
  }

  return (
    <>
      {error ? (
        <div className={styles.workspaceError} role="alert">
          <CircleAlert size={18} aria-hidden />
          <span>{error}</span>
          <Button tone="ghost" size="small" onClick={() => setError("")}>
            Dismiss
          </Button>
        </div>
      ) : null}
      <JlptHub
        selectedLevel={selectedLevel}
        onSelectLevel={setSelectedLevelOverride}
        immediateFeedback={immediateFeedback}
        onImmediateFeedbackChange={setImmediateFeedback}
        onStart={(mode) => void begin(mode)}
        startingMode={startingMode}
        savedSession={savedSession}
        onResume={() => void resumeSaved()}
        onDiscard={discard}
      />
    </>
  );
}
