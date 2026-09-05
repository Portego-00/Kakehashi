"use client";

import { Fragment, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowRight, BookOpen, Check, ChevronDown, ChevronUp, ExternalLink, Headphones, LoaderCircle, Plus, RotateCcw, Search, SkipForward, Volume2, X } from "lucide-react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { LoadingState } from "@/components/ui/States";
import { AnkiAnswerContent, type AnkiAnswerContentProps } from "@/features/core-study/AnkiAnswerContent";
import { VocabularyFrequencyBadge } from "@/features/core-study/VocabularyFrequencyBadge";
import { checkAnswer as checkReviewAnswer, type QuestionKind as ReviewQuestionKind } from "@/features/core-study/answer-checker";
import { canonicalAnswer, usesSelfAssessment } from "@/features/core-study/study-preferences";
import { installCustomJitaiFonts, resolveJitaiFontFamily } from "@/features/settings/jitai";
import type { WebSettings, WebStudyPreferences } from "@/features/settings/settings";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import type { SubjectDetailInitialTab } from "@/features/subjects/components/SubjectDetail";
import { fetchSubjectEnrichments } from "@/features/subjects/enrichments";
import { wkCollection, wkRequest } from "@/lib/wanikani/client";
import type { Assignment, StudyMaterial, Subject } from "@/types/wanikani";
import { advanceStudySession, answerStudyQuestion, getSessionSummary, getStudyItemProgress, resolveStudyAnswerStatus } from "../engine";
import { playAnswerFeedback } from "../feedback-audio";
import { composeKanaInput, questionUsesKanaComposition } from "../kana-composition";
import { clearStudySession, saveStudySession } from "../storage";
import type { StudyAnswer, StudyAnswerStatus, StudyQuestion, StudySession } from "../types";
import type { StudyStorageScope } from "../storage";
import { pickPreferredPronunciationAudios } from "../../../../../src/utils/pronunciationAudio";
import { AudioVocabPrompt, type AudioVocabPlayer } from "./audio-vocab-prompt";
import styles from "../study.module.css";

const StudySubjectDetails = dynamic(
  () => import("./study-subject-details").then((module) => module.StudySubjectDetails),
  { loading: StudySubjectDetailsLoading },
);

function StudySubjectDetailsLoading() {
  return <section id="study-item-details" className={styles.itemDetails} aria-labelledby="study-item-details-title" aria-busy="true"><header className={styles.itemDetailsHeader}><div><h3 id="study-item-details-title">Subject details</h3><p>Loading subject sections…</p></div></header></section>;
}

function playAudio(url?: string) {
  if (!url || typeof Audio === "undefined") return;
  const audio = new Audio(url);
  void audio.play();
}

async function fetchStudyMaterialsBySubjectIds(subjectIds: readonly number[]) {
  const chunks: number[][] = [];
  for (let index = 0; index < subjectIds.length; index += 500) chunks.push(subjectIds.slice(index, index + 500));
  return (await Promise.all(chunks.map((ids) => wkCollection<StudyMaterial>(`study_materials?subject_ids=${ids.join(",")}`)))).flat();
}

async function playAudioSequence(
  urls: readonly string[],
  signal: AbortSignal,
) {
  if (typeof Audio === "undefined") return;
  for (const url of urls) {
    if (signal.aborted) return;
    const audio = new Audio(url);
    await new Promise<void>((resolve) => {
      const finish = () => {
        audio.removeEventListener("ended", finish);
        audio.removeEventListener("error", finish);
        signal.removeEventListener("abort", stop);
        resolve();
      };
      const stop = () => {
        audio.pause();
        audio.currentTime = 0;
        finish();
      };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      signal.addEventListener("abort", stop, { once: true });
      void audio.play().catch(finish);
    });
  }
}

function speakJapanese(value?: string, onStopped?: () => void) {
  if (!value || typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = "ja-JP";
  if (onStopped) {
    utterance.onend = onStopped;
    utterance.onerror = onStopped;
  }
  window.speechSynthesis.speak(utterance);
  return utterance;
}

function passthroughImageLoader({ src }: { src: string }) {
  return src;
}

function HighlightedListeningSentence({ sentence, target }: { sentence: string; target?: string | null }) {
  const normalizedTarget = target?.trim();
  if (!normalizedTarget) return sentence;
  const parts = sentence.split(normalizedTarget);
  if (parts.length === 1) return sentence;
  return parts.map((part, index) => (
    <Fragment key={`${index}-${part}`}>
      {part}
      {index < parts.length - 1 ? <mark className={styles.sentenceAnswerHighlight}>{normalizedTarget}</mark> : null}
    </Fragment>
  ));
}

type PromptTone = "meaning" | "reading" | "other";
const studyShortcutInteractiveSelector = "input, textarea, select, button, a, [contenteditable]:not([contenteditable=\"false\"])";

function subjectTypeLabel(question: StudyQuestion) {
  if (question.subjectType === "radical") return "Radical";
  if (question.subjectType === "kanji") return "Kanji";
  return "Vocabulary";
}

export function promptTypePresentation(question: StudyQuestion): { label: string; tone: PromptTone } {
  if (["meaning", "kana-to-meaning", "listening", "listening-meaning", "audio-vocab"].includes(question.kind)) return { label: "Meaning", tone: "meaning" };
  if (["reading", "meaning-to-reading"].includes(question.kind)) return { label: "Reading", tone: "reading" };
  if (["kana-to-kanji", "similar-kanji"].includes(question.kind)) return { label: "Kanji", tone: "other" };
  if (question.kind === "listening-characters") return { label: "Vocabulary", tone: question.subjectType === "kana_vocabulary" ? "reading" : "other" };
  return { label: "Answer", tone: questionUsesKanaComposition(question) ? "reading" : "other" };
}

export function itemDetailsTabForQuestion(question: StudyQuestion): SubjectDetailInitialTab {
  if (["reading", "meaning-to-reading"].includes(question.kind)) return "reading";
  if (question.kind === "context") return "context";
  return "meaning";
}

function isListeningQuestion(question?: StudyQuestion) {
  return question?.kind === "listening" || question?.kind === "listening-characters" || question?.kind === "listening-meaning";
}

function questionUsesAnswerStopPreferences(question: StudyQuestion, mode: StudySession["mode"]) {
  // Older saved listening sessions explicitly disabled stops. Listening now
  // follows the shared correct/wrong preferences just like normal reviews.
  return mode === "listening" || question.stopAfterAnswer !== false;
}

export function reviewKindForStudyQuestion(question: StudyQuestion): ReviewQuestionKind | null {
  if (["meaning", "kana-to-meaning", "listening", "listening-meaning", "audio-vocab"].includes(question.kind)) return "meaning";
  if (["reading", "meaning-to-reading"].includes(question.kind)) return "reading";
  return null;
}

function answerStatus(answer?: StudyAnswer): StudyAnswerStatus | null {
  if (!answer) return null;
  return answer.status ?? (answer.correct ? "correct" : "incorrect");
}

interface ResultResponse {
  question: StudyQuestion;
  answer: StudyAnswer;
}

interface ResultSubjectGroup {
  subjectId: number;
  subject?: Subject;
  responses: ResultResponse[];
}

function resultSubjectGroups(session: StudySession, subjects: Subject[]): ResultSubjectGroup[] {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const groups = new Map<number, ResultSubjectGroup>();
  session.questions.forEach((question) => {
    const answer = session.answers.find((candidate) => candidate.questionId === question.id);
    if (!answer) return;
    const group = groups.get(question.subjectId) ?? { subjectId: question.subjectId, subject: subjectById.get(question.subjectId), responses: [] };
    group.responses.push({ question, answer });
    groups.set(question.subjectId, group);
  });
  return [...groups.values()];
}

function resultSubjectPresentation(group: ResultSubjectGroup) {
  const first = group.responses[0]?.question;
  const primaryMeaning = group.subject?.data.meanings.find((meaning) => meaning.primary)?.meaning ?? group.subject?.data.meanings[0]?.meaning ?? first?.meaning ?? first?.acceptedAnswers[0] ?? "Subject";
  const characters = group.subject?.data.characters ?? first?.characters ?? group.subject?.data.slug ?? first?.prompt ?? String(group.subjectId);
  const type = first ? subjectTypeLabel(first) : "Subject";
  return { characters, primaryMeaning, type };
}

function SessionResults({ scope, session, subjects, showListeningTranslation, onExit }: { scope: StudyStorageScope; session: StudySession; subjects: Subject[]; showListeningTranslation: boolean; onExit: () => void }) {
  const sentencePlaybackRef = useRef<object | null>(null);
  useEffect(() => () => {
    if (!sentencePlaybackRef.current) return;
    sentencePlaybackRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);
  const playResultSentence = (text?: string) => {
    const playback = {};
    sentencePlaybackRef.current = playback;
    const utterance = speakJapanese(text, () => {
      if (sentencePlaybackRef.current === playback) sentencePlaybackRef.current = null;
    });
    if (!utterance) sentencePlaybackRef.current = null;
  };
  const summary = getSessionSummary(session);
  const groups = resultSubjectGroups(session, subjects);
  return (
    <section className={styles.results} aria-labelledby="results-title">
      <header className={styles.resultOverview}>
        <div className={styles.resultMark} data-perfect={summary.accuracy === 100}><Check size={28} aria-hidden="true" /></div>
        <div className={styles.resultIntro}><h2 id="results-title">Session results</h2><p>{summary.accuracy >= 90 ? "Strong recall. Keep the interval wide." : summary.accuracy >= 70 ? "Good work. A short pass on the misses will help." : "This set is worth another focused pass."}</p></div>
      </header>

      <dl className={styles.resultStats}><div><dt>Accuracy</dt><dd>{summary.accuracy}%</dd></div><div><dt>Correct responses</dt><dd>{summary.correct} / {session.answers.length}</dd></div><div><dt>Subjects</dt><dd>{groups.length}</dd></div></dl>

      <section className={styles.resultReview} aria-labelledby="response-review-title">
        <header className={styles.resultReviewHeader}><h3 id="response-review-title">Response review</h3><p>{session.answers.length} response{session.answers.length === 1 ? "" : "s"} across {groups.length} subject{groups.length === 1 ? "" : "s"}</p></header>
        <ol className={styles.resultSubjectList}>
          {groups.map((group) => {
            const presentation = resultSubjectPresentation(group);
            const media = group.responses.find(({ question }) => question.imageUrl || question.audioUrl || question.sentence || question.audioVocabSentence)?.question;
            const sentenceAudio = media?.audioVocabSentence ?? (media?.sentenceAudioEnabled ? media.sentence?.ja : undefined);
            const sentenceAudioText = media?.audioVocabSentence && (media.reading || media.characters) ? `${media.reading || media.characters}。${sentenceAudio}` : sentenceAudio;
            const correct = group.responses.every(({ answer }) => answer.correct);
            const listening = group.responses.some(({ question }) => isListeningQuestion(question));
            return <li key={group.subjectId}><article className={styles.resultSubject} data-correct={correct}>
              <header className={styles.resultSubjectHeader}>
                <div className={styles.resultSubjectIdentity}>{group.subject ? <SubjectCharacter subject={group.subject} fallbackText={presentation.characters} className={styles.resultSubjectCharacters} data-type={group.responses[0]?.question.subjectType} imageSize="2.5rem" /> : <span className={styles.resultSubjectCharacters} data-type={group.responses[0]?.question.subjectType} lang="ja">{presentation.characters}</span>}<div><h4>{presentation.primaryMeaning}</h4><p>{group.subject ? `Level ${group.subject.data.level} · ` : ""}{presentation.type}</p></div></div>
                <div className={styles.resultSubjectActions}>{media?.audioUrl ? <button type="button" className={styles.resultReplayButton} onClick={() => playAudio(media.audioUrl)} aria-label={`Replay audio for ${presentation.characters}`}><Volume2 size={16} aria-hidden /> Replay</button> : sentenceAudio ? <button type="button" className={styles.resultReplayButton} onClick={() => playResultSentence(sentenceAudioText)} aria-label={`Play sentence for ${presentation.characters}`}><Volume2 size={16} aria-hidden /> Play sentence</button> : null}<Link className={styles.resultSubjectLink} href={`/subjects/${group.subjectId}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${presentation.characters} subject details`}>View subject <ExternalLink size={14} aria-hidden /></Link></div>
              </header>

              {media?.imageUrl || media?.sentence ? <div className={styles.resultMedia}>{media.imageUrl ? <Image className={styles.resultScene} src={media.imageUrl} alt={`Scene from ${media.sourceTitle ?? "the listening example"}`} width={320} height={180} sizes="(max-width: 42rem) 90vw, 18rem" loader={passthroughImageLoader} unoptimized /> : null}{media.sentence ? <div className={styles.resultSentence}><p lang="ja">{media.sentence.ja}</p>{(!listening || showListeningTranslation) && media.sentence.en ? <p>{media.sentence.en}</p> : null}{media.sourceTitle ? <span>{media.sourceTitle}</span> : null}</div> : null}</div> : null}

              <div className={styles.resultResponseTableWrap}><table className={styles.resultResponseTable} aria-label={`${presentation.characters} responses`}><thead><tr><th>Prompt</th><th>Your answer</th><th>Expected</th><th>Result</th></tr></thead><tbody>{group.responses.map(({ question, answer }) => {
                const status = answerStatus(answer);
                return <tr key={question.id} data-correct={answer.correct}><th scope="row">{promptTypePresentation(question).label}</th><td lang={questionUsesKanaComposition(question) ? "ja" : undefined}>{answer.value || "—"}</td><td lang={questionUsesKanaComposition(question) ? "ja" : undefined}>{question.displayAnswer}</td><td><span className={styles.resultResponseStatus} data-correct={answer.correct} data-close={status === "close" || undefined}>{answer.correct ? <Check size={15} aria-hidden /> : <X size={15} aria-hidden />}{status === "close" ? "Accepted" : answer.correct ? "Correct" : "Incorrect"}</span></td></tr>;
              })}</tbody></table></div>
            </article></li>;
          })}
        </ol>
      </section>

      <div className={styles.resultActions}><button className={styles.primaryButton} data-result-action type="button" onClick={() => { clearStudySession(scope, session.mode); onExit(); }}>Back to setup</button></div>
    </section>
  );
}

interface QuizSessionProps {
  scope: StudyStorageScope;
  initialSession: StudySession;
  subjects?: Subject[];
  assignments?: Assignment[];
  studyMaterials?: StudyMaterial[];
  reviewPreferences?: WebStudyPreferences;
  subjectDetailSettings?: WebSettings["subjectDetails"];
  immersionSources?: string[];
  showDetailsAtAnswerStops?: boolean;
  pauseOnWrong?: boolean;
  pauseOnClose?: boolean;
  pauseOnCorrect?: boolean;
  acceptUserSynonymsAsAnswers?: boolean;
  acceptAnyKanjiOnyomiReading?: boolean;
  autoplayVocabularyAudio?: boolean;
  vocabularyAudioVoice?: WebSettings["study"]["vocabularyAudioVoice"];
  answerFeedbackSoundEnabled?: boolean;
  showListeningTranslation?: boolean;
  keyboardShortcuts?: boolean;
  loadingMore?: boolean;
  expectedSubjectCount?: number;
  onExit: () => void;
}

function ExtraStudyAnkiAnswer({ subject, ...props }: Omit<AnkiAnswerContentProps, "pitchAccents"> & { subject?: Subject }) {
  const readings = subject?.data.readings?.map((reading) => reading.reading) ?? [];
  const needsPitchAccent = Boolean(
    subject?.data.characters
    && props.revealed
    && (props.groupQuestions || props.questionKind === "reading")
    && (props.showPitchAccentNumbers || props.showPitchAccentGraph),
  );
  const enrichments = useQuery({
    queryKey: ["subject-enrichments", "extra-study-anki", subject?.id ?? 0, subject?.data.characters, readings.join(",")],
    queryFn: ({ signal }) => {
      if (!subject?.data.characters) throw new Error("Pitch accent requires a subject with characters.");
      return fetchSubjectEnrichments({ id: subject.id, level: subject.data.level, characters: subject.data.characters, readings }, signal);
    },
    enabled: needsPitchAccent,
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });
  return <AnkiAnswerContent {...props} pitchAccents={enrichments.data?.pitchAccents} />;
}

function AddMeaningSynonymButton({ subject, synonym, existingMaterial, disabled, onSaved }: { subject: Subject; synonym: string; existingMaterial?: StudyMaterial; disabled: boolean; onSaved: (material: StudyMaterial) => void }) {
  const mutation = useMutation({
    mutationFn: () => {
      const meaningSynonyms = [...new Set([...(existingMaterial?.data.meaning_synonyms ?? []), synonym])];
      return wkRequest<StudyMaterial>(existingMaterial ? `study_materials/${existingMaterial.id}` : "study_materials", {
        method: existingMaterial ? "PUT" : "POST",
        body: { study_material: { ...(existingMaterial ? {} : { subject_id: subject.id }), meaning_synonyms: meaningSynonyms } },
      });
    },
    onSuccess: onSaved,
  });
  return <div className={styles.addSynonymAction}>
    <button type="button" className={styles.secondaryButton} disabled={disabled || mutation.isPending} onClick={() => mutation.mutate()}><Plus size={17} aria-hidden />{mutation.isPending ? "Saving synonym…" : "Add as synonym"}</button>
    {mutation.error ? <p role="alert">The synonym could not be saved. Try again before continuing.</p> : null}
  </div>;
}

function QuizSessionWithStudyMaterials(props: QuizSessionProps) {
  const subjectIds = useMemo(() => Array.from(new Set(props.initialSession.questions.map((question) => question.subjectId))), [props.initialSession.questions]);
  const materialsQuery = useQuery({
    queryKey: ["extra-study", "answer-materials", props.scope, subjectIds.join(",")],
    queryFn: () => fetchStudyMaterialsBySubjectIds(subjectIds),
    enabled: subjectIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  if (materialsQuery.isLoading) {
    return <section className={styles.quizShell}><LoadingState label="Loading answer data" detail="Preparing your personal meaning synonyms." /></section>;
  }
  if (materialsQuery.error && !materialsQuery.data) {
    return <section className={styles.quizShell}><div className={styles.authNotice} role="alert"><AlertCircle size={25} /><h2>Answer data didn’t load</h2><p>Personal meaning synonyms could not be checked yet.</p><button className={styles.primaryButton} type="button" onClick={() => void materialsQuery.refetch()}>Try again</button></div></section>;
  }
  return <QuizSessionContent {...props} studyMaterials={materialsQuery.data ?? []} />;
}

export function QuizSession(props: QuizSessionProps) {
  const needsStudyMaterials = props.acceptUserSynonymsAsAnswers || ((props.initialSession.mode === "custom-review" || props.initialSession.mode === "audio-vocab") && (props.reviewPreferences?.ankiShowOtherAcceptedAnswersAndUserSynonyms || props.reviewPreferences?.showAddSynonymButton));
  if (!needsStudyMaterials || props.studyMaterials !== undefined) return <QuizSessionContent {...props} />;
  return <QuizSessionWithStudyMaterials {...props} />;
}

function QuizSessionContent({ scope, initialSession, subjects = [], assignments = [], studyMaterials = [], reviewPreferences, subjectDetailSettings, immersionSources = [], showDetailsAtAnswerStops = false, pauseOnWrong = true, pauseOnClose = false, pauseOnCorrect = false, acceptUserSynonymsAsAnswers = false, acceptAnyKanjiOnyomiReading = false, autoplayVocabularyAudio = false, vocabularyAudioVoice = "female", answerFeedbackSoundEnabled = true, showListeningTranslation = true, keyboardShortcuts = true, loadingMore = false, expectedSubjectCount, onExit }: QuizSessionProps) {
  const [localSession, setSession] = useState(initialSession);
  const [savedStudyMaterials, setSavedStudyMaterials] = useState<StudyMaterial[]>([]);
  const session = useMemo(() => {
    if (localSession.id !== initialSession.id) return initialSession;
    const knownIds = new Set(localSession.questions.map((item) => item.id));
    const incoming = initialSession.questions.filter((item) => !knownIds.has(item.id));
    return incoming.length ? { ...localSession, questions: [...localSession.questions, ...incoming], complete: false } : localSession;
  }, [initialSession, localSession]);
  useEffect(() => {
    if (session.complete) clearStudySession(scope, session.mode);
  }, [scope, session.complete, session.mode]);
  const [value, setValue] = useState("");
  const [answerWarning, setAnswerWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoPlayedQuestionRef = useRef<string | null>(null);
  const audioVocabPlayerRef = useRef<AudioVocabPlayer>(null);
  const vocabularyAudioAbortRef = useRef<AbortController | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const advancingQuestionRef = useRef(false);
  const detailsShouldOpenRef = useRef(false);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [translationRevealed, setTranslationRevealed] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<boolean | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [advancingQuestion, setAdvancingQuestion] = useState(false);
  const [ankiRevealed, setAnkiRevealed] = useState(false);
  const [contextTranslationOpen, setContextTranslationOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<SubjectDetailInitialTab>(() => {
    const initialQuestion = initialSession.questions[initialSession.currentIndex];
    return initialQuestion ? itemDetailsTabForQuestion(initialQuestion) : "meaning";
  });
  const question = session.questions[session.currentIndex];
  const answer = question ? session.answers.find((item) => item.questionId === question.id) : undefined;
  const currentAnswerStatus = answerStatus(answer);
  const closeAnswerNeedsResolution = Boolean(answer && currentAnswerStatus === "close" && pauseOnClose);
  const { current: displayedCurrent, total: displayedTotal } = getStudyItemProgress(session.questions, session.currentIndex);
  const visibleTotal = loadingMore && expectedSubjectCount ? Math.max(displayedTotal, expectedSubjectCount) : displayedTotal;
  const progress = visibleTotal ? Math.round((displayedCurrent / visibleTotal) * 100) : 0;
  const promptType = question ? promptTypePresentation(question) : null;
  const kanaComposition = question ? questionUsesKanaComposition(question) : false;
  const currentSubject = question ? subjects.find((subject) => subject.id === question.subjectId) : undefined;
  const currentAssignment = currentSubject ? assignments.find((assignment) => assignment.data.subject_id === currentSubject.id) : undefined;
  // Prompt extras mirror the mobile review question screen across quiz modes.
  // Audio vocab uses the same answer settings as custom review.
  const customReviewPreferences = session.mode === "custom-review" || session.mode === "audio-vocab" ? reviewPreferences : undefined;
  const reviewKind = question ? reviewKindForStudyQuestion(question) : null;
  const ankiEnabled = Boolean(customReviewPreferences && reviewKind && usesSelfAssessment(reviewKind, customReviewPreferences));
  const studyMaterialBySubjectId = useMemo(() => new Map([...studyMaterials, ...savedStudyMaterials].map((material) => [material.data.subject_id, material])), [savedStudyMaterials, studyMaterials]);
  const ankiQuestions = (() => {
    if (!question || !ankiEnabled) return [];
    const unanswered = session.questions.filter((candidate) => (
      candidate.subjectId === question.subjectId
      && reviewKindForStudyQuestion(candidate) !== null
      && !session.answers.some((candidateAnswer) => candidateAnswer.questionId === candidate.id)
    ));
    if (customReviewPreferences?.ankiMode !== "both" || !customReviewPreferences.ankiGroupQuestions) return [question];
    const byKind = new Map(unanswered.map((candidate) => [reviewKindForStudyQuestion(candidate), candidate]));
    const meaning = byKind.get("meaning");
    const reading = byKind.get("reading");
    return meaning && reading ? [meaning, reading] : [question];
  })();
  const groupedAnkiQuestions = ankiQuestions.length > 1;
  const ankiMeaningAnswer = currentSubject ? canonicalAnswer(currentSubject, "meaning") : question?.displayAnswer ?? "—";
  const ankiReadingAnswer = currentSubject?.data.readings?.length ? canonicalAnswer(currentSubject, "reading") : undefined;
  const otherMeaningAnswers = currentSubject ? [
    ...currentSubject.data.meanings.filter((meaning) => meaning.accepted_answer && meaning.meaning !== ankiMeaningAnswer).map((meaning) => meaning.meaning),
    ...currentSubject.data.auxiliary_meanings.filter((meaning) => meaning.type === "whitelist" && meaning.meaning !== ankiMeaningAnswer).map((meaning) => meaning.meaning),
  ] : [];
  const otherReadingAnswers = currentSubject?.data.readings?.filter((reading) => reading.accepted_answer && reading.reading !== ankiReadingAnswer).map((reading) => reading.reading) ?? [];
  const singleKanjiReadings = useMemo(() => {
    const readings: Record<string, string[]> = {};
    for (const subject of subjects) {
      const characters = subject.data.characters?.normalize("NFKC").trim() ?? "";
      if (subject.object !== "kanji" || Array.from(characters).length !== 1) continue;
      readings[characters] = Array.from(new Set((subject.data.readings ?? []).map((reading) => reading.reading).filter(Boolean)));
    }
    return readings;
  }, [subjects]);
  const listeningQuestion = isListeningQuestion(question);
  const previousListeningCharactersAnswered = Boolean(
    question?.kind === "listening-meaning"
    && session.questions.slice(0, session.currentIndex).some((candidate) => (
      candidate.subjectId === question.subjectId
      && candidate.kind === "listening-characters"
      && session.answers.some((candidateAnswer) => candidateAnswer.questionId === candidate.id)
    )),
  );
  const listeningSentenceRevealed = Boolean(answer || previousListeningCharactersAnswered);
  const previousCompletedSubject = useMemo(() => {
    if (!listeningQuestion || !question) return undefined;
    const previousQuestion = session.questions.slice(0, session.currentIndex).reverse().find((candidate) => candidate.subjectId !== question.subjectId);
    if (!previousQuestion) return undefined;
    const previousQuestions = session.questions.filter((candidate) => candidate.subjectId === previousQuestion.subjectId);
    const previousAnswers = previousQuestions.map((candidate) => session.answers.find((item) => item.questionId === candidate.id));
    if (!previousQuestions.length || previousAnswers.some((item) => !item)) return undefined;
    const subject = subjects.find((candidate) => candidate.id === previousQuestion.subjectId);
    return {
      id: previousQuestion.subjectId,
      characters: previousQuestion.characters ?? subject?.data.characters ?? subject?.data.slug ?? String(previousQuestion.subjectId),
      correct: previousAnswers.every((item) => item?.correct),
    };
  }, [listeningQuestion, question, session.answers, session.currentIndex, session.questions, subjects]);
  const questionCanPause = Boolean(question && (
    question.stopAfterAnswer === true
    || (questionUsesAnswerStopPreferences(question, session.mode) && (pauseOnCorrect || pauseOnClose || pauseOnWrong))
  ));
  const pauseForCurrentAnswer = currentAnswerStatus === "close" ? pauseOnClose : currentAnswerStatus === "correct" ? pauseOnCorrect : pauseOnWrong;
  const answerPaused = Boolean(answer && question && (
    question.stopAfterAnswer === true
    || (questionUsesAnswerStopPreferences(question, session.mode) && pauseForCurrentAnswer)
  ));
  const answerOutcomePaused = Boolean(answer && pauseForCurrentAnswer);
  const detailsAvailable = Boolean(currentSubject && (answerPaused || (ankiEnabled && ankiRevealed)));
  const detailsOpenByDefault = showDetailsAtAnswerStops && answerOutcomePaused;
  const detailsVisible = detailsAvailable && (detailsOverride ?? detailsOpenByDefault);
  const detailsShouldOpen = detailsVisible && !advancingQuestion;
  const detailsOpen = detailsShouldOpen && detailsExpanded;
  const sentenceBreakdownAvailable = Boolean(answer && question?.enableSentenceBreakdown && question.sentence?.tokens?.length);
  const answerStopVisible = Boolean(answerWarning || (answer && !question?.choices) || detailsAvailable || sentenceBreakdownAvailable);
  const answerStopAccessible = answerStopVisible && !advancingQuestion;
  const waitingForNextQuestion = loadingMore && session.currentIndex >= session.questions.length - 1;
  const toggleDetails = useCallback(() => {
    if (advancingQuestionRef.current) return;
    setDetailsOverride((current) => {
      const nextOverride = !(current ?? detailsOpenByDefault);
      detailsShouldOpenRef.current = detailsAvailable && nextOverride;
      return nextOverride;
    });
  }, [detailsAvailable, detailsOpenByDefault]);

  useEffect(() => {
    if (!customReviewPreferences) return;
    void installCustomJitaiFonts(customReviewPreferences.jitaiCustomFonts).catch(() => undefined);
  }, [customReviewPreferences]);

  const stopVocabularyAudio = useCallback(() => {
    vocabularyAudioAbortRef.current?.abort();
    vocabularyAudioAbortRef.current = null;
  }, []);

  const playVocabularyAudio = useCallback((urls: readonly string[]) => {
    stopVocabularyAudio();
    if (!urls.length) return;
    const controller = new AbortController();
    vocabularyAudioAbortRef.current = controller;
    void playAudioSequence(urls, controller.signal).finally(() => {
      if (vocabularyAudioAbortRef.current !== controller) return;
      vocabularyAudioAbortRef.current = null;
    });
  }, [stopVocabularyAudio]);

  function commit(candidate: string) {
    if (!question || answer || !candidate.trim()) return;
    const reviewKind = !question.choices ? reviewKindForStudyQuestion(question) : null;
    let semanticStatus: StudyAnswerStatus | undefined;
    if (currentSubject && reviewKind) {
      const material = acceptUserSynonymsAsAnswers ? studyMaterialBySubjectId.get(currentSubject.id) : undefined;
      const result = checkReviewAnswer(
        currentSubject,
        reviewKind,
        candidate,
        material,
        reviewKind === "reading" ? { singleKanjiReadings, acceptAnyKanjiOnyomiReading } : undefined,
      );
      if (result.status === "blocked") {
        setAnswerWarning(result.message);
        setValue("");
        window.requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      semanticStatus = result.status;
    }
    setAnswerWarning(null);
    const next = answerStudyQuestion(session, candidate, new Date(), semanticStatus);
    const submittedAnswer = next.answers.find((item) => item.questionId === question.id);
    if (submittedAnswer && answerFeedbackSoundEnabled && !(submittedAnswer.status === "close" && pauseOnClose)) playAnswerFeedback(submittedAnswer.correct);
    if (submittedAnswer?.correct && autoplayVocabularyAudio && reviewKind === "reading" && currentSubject && (currentSubject.object === "vocabulary" || currentSubject.object === "kana_vocabulary")) {
      const audios = pickPreferredPronunciationAudios(currentSubject.data.pronunciation_audios, currentSubject.data.readings, vocabularyAudioVoice, { preferredContentType: "audio/mpeg" });
      playVocabularyAudio(audios.map((audio) => audio.url));
    }
    setSession(next);
    saveStudySession(scope, next);
  }

  const resolveCloseAnswer = useCallback((status: Exclude<StudyAnswerStatus, "close">) => {
    if (!question || !answer || currentAnswerStatus !== "close" || !pauseOnClose || advancingQuestionRef.current) return;
    const updated = resolveStudyAnswerStatus(session, question.id, status);
    if (updated === session) return;
    if (answerFeedbackSoundEnabled) playAnswerFeedback(status === "correct");
    setSession(updated);
    saveStudySession(scope, updated);
  }, [answer, answerFeedbackSoundEnabled, currentAnswerStatus, pauseOnClose, question, scope, session]);

  function revealAnkiAnswer() {
    if (!ankiEnabled || ankiRevealed) return;
    setAnkiRevealed(true);
    if (autoplayVocabularyAudio && currentSubject && ankiQuestions.some((candidate) => reviewKindForStudyQuestion(candidate) === "reading")) {
      const audios = pickPreferredPronunciationAudios(currentSubject.data.pronunciation_audios, currentSubject.data.readings, vocabularyAudioVoice, { preferredContentType: "audio/mpeg" });
      playVocabularyAudio(audios.map((audio) => audio.url));
    }
  }

  function gradeAnkiAnswer(correct: boolean) {
    if (!question || !ankiEnabled || !ankiRevealed || answer) return;
    const answeredAt = new Date().toISOString();
    const gradedQuestions = ankiQuestions.length ? ankiQuestions : [question];
    const gradedAnswers: StudyAnswer[] = gradedQuestions.map((candidate) => ({
      questionId: candidate.id,
      value: correct ? "Marked correct" : "Marked wrong",
      correct,
      status: correct ? "correct" : "incorrect",
      answeredAt,
    }));
    const nextSession = { ...session, answers: [...session.answers, ...gradedAnswers], updatedAt: answeredAt };
    if (answerFeedbackSoundEnabled) playAnswerFeedback(correct);
    setSession(nextSession);
    saveStudySession(scope, nextSession);
  }

  function skipQuestion() {
    if (!question || answer || !customReviewPreferences?.allowSkippingReviews) return;
    const prefix = session.questions.slice(0, session.currentIndex);
    const remaining = session.questions.slice(session.currentIndex + 1);
    const unanswered = (candidate: StudyQuestion) => !session.answers.some((candidateAnswer) => candidateAnswer.questionId === candidate.id);
    if (!remaining.some((candidate) => candidate.subjectId !== question.subjectId && unanswered(candidate))) return;
    const currentSubjectQuestions = [question, ...remaining.filter((candidate) => candidate.subjectId === question.subjectId && unanswered(candidate))];
    const otherQuestions = remaining.filter((candidate) => candidate.subjectId !== question.subjectId || !unanswered(candidate));
    const nextSession = { ...session, questions: [...prefix, ...otherQuestions, ...currentSubjectQuestions], updatedAt: new Date().toISOString() };
    setSession(nextSession);
    setValue("");
    setAnswerWarning(null);
    setAnkiRevealed(false);
    setContextTranslationOpen(false);
    setDetailsOverride(null);
    saveStudySession(scope, nextSession);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function acceptSavedSynonym(savedMaterial: StudyMaterial) {
    if (!question) return;
    const updatedAt = new Date().toISOString();
    const answers = session.answers.map((candidate) => candidate.questionId === question.id ? { ...candidate, correct: true, status: "correct" as const } : candidate);
    const nextSession = { ...session, answers, updatedAt };
    setSavedStudyMaterials((materials) => [...materials.filter((candidate) => candidate.data.subject_id !== savedMaterial.data.subject_id), savedMaterial]);
    if (answerFeedbackSoundEnabled) playAnswerFeedback(true);
    setSession(nextSession);
    saveStudySession(scope, nextSession);
  }

  const next = useCallback(() => {
    if (!answer || closeAnswerNeedsResolution || waitingForNextQuestion || advancingQuestionRef.current) return;
    const advanceNow = () => {
      let updated = advanceStudySession(session);
      while (!updated.complete) {
        const upcoming = updated.questions[updated.currentIndex];
        if (!upcoming || !updated.answers.some((candidate) => candidate.questionId === upcoming.id)) break;
        updated = advanceStudySession(updated);
      }
      detailsShouldOpenRef.current = false;
      setSession(updated);
      setValue("");
      setAnswerWarning(null);
      setSelectedToken(null);
      setTranslationRevealed(false);
      setContextTranslationOpen(false);
      setAnkiRevealed(false);
      setDetailsOverride(null);
      advancingQuestionRef.current = false;
      setAdvancingQuestion(false);
      advanceTimerRef.current = null;
      const upcomingQuestion = updated.questions[updated.currentIndex];
      setDetailsTab(upcomingQuestion ? itemDetailsTabForQuestion(upcomingQuestion) : "meaning");
      saveStudySession(scope, updated);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    if (detailsVisible && !reducedMotion) {
      advancingQuestionRef.current = true;
      detailsShouldOpenRef.current = false;
      setAdvancingQuestion(true);
      setDetailsExpanded(false);
      advanceTimerRef.current = window.setTimeout(advanceNow, 280);
      return;
    }
    advanceNow();
  }, [answer, closeAnswerNeedsResolution, detailsVisible, scope, session, waitingForNextQuestion]);

  useEffect(() => () => {
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
  }, []);

  useEffect(() => stopVocabularyAudio, [question?.id, stopVocabularyAudio]);

  const canShowSubjectDetails = useMemo(
    () => Boolean(customReviewPreferences && customReviewPreferences.ankiMode !== "off") || session.questions.some((candidate) => candidate.stopAfterAnswer === true || (questionUsesAnswerStopPreferences(candidate, session.mode) && (pauseOnCorrect || pauseOnWrong))),
    [customReviewPreferences, pauseOnCorrect, pauseOnWrong, session.mode, session.questions],
  );

  useEffect(() => {
    if (!canShowSubjectDetails) return;
    void import("./study-subject-details");
  }, [canShowSubjectDetails]);

  useEffect(() => {
    if (question?.kind !== "audio-vocab" && question?.autoPlayAudio && autoPlayedQuestionRef.current !== question.id) {
      autoPlayedQuestionRef.current = question.id;
      playAudio(question.audioUrl);
    }
    if (question?.autoPlaySentenceAudio) speakJapanese(question.sentence?.ja);
  }, [question?.kind, question?.audioUrl, question?.autoPlayAudio, question?.autoPlaySentenceAudio, question?.id, question?.sentence?.ja]);

  useEffect(() => {
    if (!answer || answerPaused) return;
    const timer = window.setTimeout(next, 900);
    return () => window.clearTimeout(timer);
  }, [answer, answerPaused, next]);

  useEffect(() => {
    detailsShouldOpenRef.current = detailsShouldOpen;
    const frame = window.requestAnimationFrame(() => {
      setDetailsExpanded(detailsShouldOpenRef.current && !advancingQuestionRef.current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailsShouldOpen]);

  useEffect(() => {
    if (!detailsExpanded) return;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      document.getElementById("study-item-details-toggle")?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailsExpanded, question?.id]);

  const hasQuestionAudio = Boolean(question?.audioUrl || question?.audioVocabSentence);
  const onStudyKeyDown = useEffectEvent((event: KeyboardEvent) => {
      const shortcutFromAnsweredInput = ["d", "r"].includes(event.key.toLocaleLowerCase()) && event.target === inputRef.current && inputRef.current?.readOnly === true;
      if (event.defaultPrevented || (!shortcutFromAnsweredInput && event.target instanceof Element && event.target.closest(studyShortcutInteractiveSelector))) return;
      if (event.key.toLocaleLowerCase() === "r" && hasQuestionAudio) {
        event.preventDefault();
        if (question?.kind === "audio-vocab") void audioVocabPlayerRef.current?.play();
        else playAudio(question?.audioUrl);
        return;
      }
      if (!answer && ankiEnabled) {
        if (event.key === "Enter" && !ankiRevealed) {
          event.preventDefault();
          revealAnkiAnswer();
        } else if (ankiRevealed && (event.key === "1" || event.key === "2")) {
          event.preventDefault();
          gradeAnkiAnswer(event.key === "2");
        }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (closeAnswerNeedsResolution) resolveCloseAnswer("correct");
        else if (answer) next();
        else commit(value);
      }
      if (!answer && question?.choices && /^[1-4]$/.test(event.key)) {
        const choice = question.choices[Number(event.key) - 1];
        if (choice) commit(choice);
      }
      if (event.key.toLocaleLowerCase() === "d" && detailsAvailable && !advancingQuestionRef.current) {
        event.preventDefault();
        toggleDetails();
      }
  });

  useEffect(() => {
    if (!keyboardShortcuts) return;
    const onKeyDown = (event: KeyboardEvent) => onStudyKeyDown(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyboardShortcuts]);

  if (session.complete || !question) {
    return <SessionResults scope={scope} session={session} subjects={subjects} showListeningTranslation={showListeningTranslation} onExit={onExit} />;
  }

  const reviewCharacterScale = customReviewPreferences?.reviewCharacterFontScale ?? 1;
  const reviewInputScale = customReviewPreferences?.reviewInputFontScale ?? 1;
  const reviewCharacterSize = customReviewPreferences ? `clamp(${2.75 * reviewCharacterScale}rem, ${9 * reviewCharacterScale}vw, ${6.5 * reviewCharacterScale}rem)` : undefined;
  const jitaiFamily = customReviewPreferences ? resolveJitaiFontFamily(customReviewPreferences, question.id) : undefined;
  const contextSentences = currentSubject?.data.context_sentences?.filter((sentence) => sentence.ja.trim()).slice(0, 3) ?? [];
  const showContextHint = question.kind !== "audio-vocab" && Boolean(reviewPreferences?.showVocabContextSentencesInReviews && reviewKind && (currentSubject?.object === "vocabulary" || currentSubject?.object === "kana_vocabulary") && contextSentences.length);
  const showReviewMetadata = Boolean(reviewPreferences?.showReviewItemLevelAndSrsStage && currentSubject);
  const showVocabularyFrequency = Boolean(reviewPreferences?.showVocabularyFrequency && currentSubject);
  const showReviewPromptExtras = question.kind !== "audio-vocab" && (showVocabularyFrequency || showReviewMetadata);
  const searchQuery = currentSubject?.data.characters || currentSubject?.data.slug || question.prompt;
  const canSkipQuestion = Boolean(customReviewPreferences?.allowSkippingReviews && !answer && session.questions.slice(session.currentIndex + 1).some((candidate) => candidate.subjectId !== question.subjectId && !session.answers.some((candidateAnswer) => candidateAnswer.questionId === candidate.id)));
  const currentStudyMaterial = currentSubject ? studyMaterialBySubjectId.get(currentSubject.id) : undefined;
  const synonymCandidate = value.trim().toLocaleLowerCase();
  const canAddSynonym = Boolean(
    customReviewPreferences?.showAddSynonymButton
    && answerPaused
    && currentAnswerStatus === "incorrect"
    && reviewKind === "meaning"
    && currentSubject
    && synonymCandidate
    && !(currentStudyMaterial?.data.meaning_synonyms ?? []).some((synonym) => synonym.toLocaleLowerCase() === synonymCandidate),
  );

  return (
    <section className={styles.quizShell} data-type={question.subjectType} data-listening={listeningQuestion || undefined} data-scene={Boolean(question.imageUrl) || undefined} data-details-open={detailsOpen || undefined} data-advancing={advancingQuestion || undefined} aria-labelledby="question-prompt">
      <div className={styles.quizTopbar}>
        <span className={styles.numeric}>{displayedCurrent} / {visibleTotal}</span>
        <div className={styles.progressTrack} role="progressbar" aria-valuenow={displayedCurrent} aria-valuemin={1} aria-valuemax={visibleTotal}><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
        <div className={styles.quizTopbarActions}>
          {reviewPreferences?.reviewSearchButtonEnabled ? <Link className={styles.iconButton} href={`/search?q=${encodeURIComponent(searchQuery)}`} target="_blank" rel="noopener noreferrer" aria-label="Search this item"><Search size={17} /></Link> : null}
          {canSkipQuestion ? <button type="button" className={styles.iconButton} onClick={skipQuestion} aria-label="Skip review"><SkipForward size={17} /></button> : null}
          <button type="button" className={styles.iconButton} onClick={onExit} aria-label="Pause and exit session"><X size={19} /></button>
        </div>
      </div>

      {previousCompletedSubject ? <Link className={styles.previousSubjectLink} href={`/subjects/${previousCompletedSubject.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Previous subject: ${previousCompletedSubject.characters}`}><span lang="ja">{previousCompletedSubject.characters}</span><span className={styles.previousSubjectStatus} data-correct={previousCompletedSubject.correct} aria-hidden="true">{previousCompletedSubject.correct ? <Check size={13} /> : <X size={13} />}</span></Link> : null}

      <div className={styles.questionCard} data-type={question.subjectType}>
        {question.imageUrl ? <div className={styles.sceneFrame}><Image className={styles.contextImage} src={question.imageUrl} alt={`Scene from ${question.sourceTitle ?? "the listening example"}`} width={560} height={315} sizes="(max-width: 42rem) 90vw, 28rem" loader={passthroughImageLoader} unoptimized /></div> : null}
        {listeningQuestion && question.sentence ? <><div className={styles.sentencePromptSlot}><p className={styles.sentencePrompt} data-visible={!listeningSentenceRevealed} aria-hidden={listeningSentenceRevealed} lang="ja">{question.sentence.masked}</p><p className={styles.sentencePrompt} data-visible={listeningSentenceRevealed} aria-hidden={!listeningSentenceRevealed} lang="ja">{listeningSentenceRevealed ? <HighlightedListeningSentence sentence={question.sentence.ja} target={question.characters ?? currentSubject?.data.characters} /> : question.sentence.ja}</p></div>{showListeningTranslation ? <div className={styles.translationReveal}><p className={styles.sentenceTranslation} data-visible={translationRevealed} aria-hidden={!translationRevealed}>{question.sentence.en}</p><button className={styles.textButton} type="button" onClick={() => setTranslationRevealed((current) => !current)}>{translationRevealed ? "Hide translation" : "Show translation"}</button></div> : null}</> : null}
        {question.kind === "audio-vocab" ? <AudioVocabPrompt key={question.id} ref={audioVocabPlayerRef} question={question} /> : question.audioUrl ? <button id="question-prompt" className={styles.audioButton} type="button" onClick={() => playAudio(question.audioUrl)} aria-label={`Replay listening clip${question.sourceTitle ? ` from ${question.sourceTitle}` : ""}`}><Volume2 size={29} /><span>{question.sourceTitle ? `Play ${question.sourceTitle} clip` : "Play pronunciation"}</span><kbd>R</kbd></button> : <h2 id="question-prompt" data-question-kind={question.kind} data-character-scale={customReviewPreferences ? reviewCharacterScale : undefined} lang={question.kind === "meaning-to-reading" ? "en" : currentSubject?.object === "radical" && !currentSubject.data.characters ? undefined : "ja"} style={{ fontFamily: jitaiFamily, fontSize: reviewCharacterSize }}>{currentSubject?.object === "radical" && !currentSubject.data.characters ? <SubjectCharacter subject={currentSubject} fallbackText={question.prompt} eager /> : question.prompt}</h2>}
        {showReviewPromptExtras && currentSubject ? <div className={styles.reviewPromptExtras}>
          {showVocabularyFrequency ? <VocabularyFrequencyBadge className={styles.reviewPromptFrequency} subject={currentSubject} enabled /> : null}
          {showReviewMetadata ? <div className={styles.reviewPromptMetadata} aria-label="Question status"><span>Level {currentSubject.data.level}</span>{currentAssignment ? <span><SrsStageIcon stage={currentAssignment.data.srs_stage} size={16} />{srsStageLabel(currentAssignment.data.srs_stage)}</span> : null}</div> : null}
        </div> : null}
        {showContextHint ? <div className={styles.reviewContextHint}>
          <div>{contextSentences.map((sentence, index) => <div key={`${sentence.ja}-${index}`}><p lang="ja">• {sentence.ja}</p>{contextTranslationOpen && sentence.en.trim() ? <p>• {sentence.en}</p> : null}</div>)}</div>
          {contextSentences.some((sentence) => sentence.en.trim()) ? <button className={styles.textButton} type="button" aria-expanded={contextTranslationOpen} onClick={() => setContextTranslationOpen((open) => !open)}>{contextTranslationOpen ? "Hide translations" : "Show translations"}</button> : null}
        </div> : null}
        {question.sentenceAudioEnabled ? <button className={styles.textButton} type="button" onClick={() => speakJapanese(question.sentence?.ja)}><Volume2 size={16} /> Play sentence</button> : null}
        {!listeningQuestion && question.sentence && (!question.hideTranslationUntilTap || translationRevealed || answer) ? <p className={styles.sentenceTranslation}>{question.sentence.en}</p> : !listeningQuestion && question.sentence ? <button className={styles.textButton} type="button" onClick={() => setTranslationRevealed(true)}>Show translation</button> : null}
      </div>

      <div className={styles.answerArea}>
        {question.choices ? <><div className={styles.promptTypeStrip} data-tone={promptType?.tone}><span>{subjectTypeLabel(question)}</span><strong>{promptType?.label}</strong></div><div className={styles.choiceGrid} role="group" aria-label="Answer choices">{question.choices.map((choice, index) => {
          const selected = answer?.value === choice;
          const correctChoice = answer && question.acceptedAnswers.includes(choice);
          const result = selected ? answer?.correct ? "correct" : "incorrect" : correctChoice ? "correct-answer" : undefined;
          return <button type="button" key={choice} className={styles.choiceButton} data-selected={selected} data-correct={correctChoice} data-result={result} disabled={Boolean(answer)} onClick={() => commit(choice)}><kbd>{index + 1}</kbd><span lang={question.kind === "listening-meaning" || question.kind === "listening" ? "en" : "ja"}>{choice}</span><span className={styles.choiceResult} data-choice-result data-visible={Boolean(result)} aria-hidden={!result}><span data-active={result === "correct"}><Check size={18} />Correct</span><span data-active={result === "incorrect"}><X size={18} />Incorrect</span><span data-active={result === "correct-answer"}><Check size={18} />Correct answer</span></span></button>;
        })}</div></> : ankiEnabled && customReviewPreferences ? <>
          <div className={styles.promptTypeStrip} data-tone={promptType?.tone}><span>{subjectTypeLabel(question)}</span><strong>{groupedAnkiQuestions ? "Meaning + Reading" : promptType?.label}</strong></div>
          {!answer ? <ExtraStudyAnkiAnswer
            subject={currentSubject}
            revealed={ankiRevealed}
            hideAnswerCompletely={customReviewPreferences.ankiHideAnswerCompletely}
            questionKind={reviewKind ?? "meaning"}
            groupQuestions={groupedAnkiQuestions}
            meaningAnswer={ankiMeaningAnswer}
            readingAnswer={ankiReadingAnswer}
            otherMeaningAnswers={otherMeaningAnswers}
            otherReadingAnswers={otherReadingAnswers}
            userSynonyms={currentSubject ? studyMaterialBySubjectId.get(currentSubject.id)?.data.meaning_synonyms : undefined}
            partsOfSpeech={currentSubject?.data.parts_of_speech}
            showOtherAcceptedAnswersAndUserSynonyms={customReviewPreferences.ankiShowOtherAcceptedAnswersAndUserSynonyms}
            showWaniKaniGrammarTags={customReviewPreferences.ankiShowWaniKaniGrammarTags}
            showPitchAccentNumbers={customReviewPreferences.ankiShowPitchAccentNumbers}
            showPitchAccentGraph={customReviewPreferences.ankiShowPitchAccentGraph}
            showReplayAudioButton={customReviewPreferences.ankiShowReplayAudioButton && (question.kind === "audio-vocab" ? hasQuestionAudio : Boolean(currentSubject?.data.pronunciation_audios?.length))}
            buttonlessMode={customReviewPreferences.ankiButtonlessMode}
            onReveal={revealAnkiAnswer}
            onReplayAudio={() => {
              if (question.kind === "audio-vocab") {
                void audioVocabPlayerRef.current?.play();
                return;
              }
              if (!currentSubject) return;
              const audios = pickPreferredPronunciationAudios(currentSubject.data.pronunciation_audios, currentSubject.data.readings, vocabularyAudioVoice, { preferredContentType: "audio/mpeg" });
              playVocabularyAudio(audios.map((audio) => audio.url));
            }}
            onGradeIncorrect={() => gradeAnkiAnswer(false)}
            onGradeCorrect={() => gradeAnkiAnswer(true)}
            onShowDetails={currentSubject ? toggleDetails : undefined}
            onSkip={canSkipQuestion ? skipQuestion : undefined}
          /> : null}
        </> : <form className={styles.answerForm} data-result={answer ? currentAnswerStatus === "close" ? "warning" : answer.correct ? "correct" : "incorrect" : answerWarning ? "warning" : undefined} onSubmit={(event) => { event.preventDefault(); if (closeAnswerNeedsResolution) resolveCloseAnswer("correct"); else if (answer) next(); else commit(value); }}>
          <label className={styles.promptTypeStrip} data-tone={promptType?.tone} htmlFor="study-answer"><span>{subjectTypeLabel(question)}</span><strong>{promptType?.label}</strong>{kanaComposition ? <small>Romaji → かな</small> : null}</label>
          <div className={styles.answerInputRow} data-result={answer ? currentAnswerStatus === "close" ? "warning" : answer.correct ? "correct" : "incorrect" : answerWarning ? "warning" : undefined}>
            <input ref={inputRef} id="study-answer" autoFocus autoComplete="off" spellCheck={false} lang={kanaComposition ? "ja" : undefined} style={{ fontSize: customReviewPreferences ? `${reviewInputScale}rem` : undefined }} value={value} onChange={(event) => { setAnswerWarning(null); setValue(kanaComposition ? composeKanaInput(event.target.value) : event.target.value); }} readOnly={Boolean(answer)} aria-label={`${subjectTypeLabel(question)} ${promptType?.label ?? "answer"}`} aria-invalid={answer ? currentAnswerStatus === "incorrect" : answerWarning ? true : undefined} aria-describedby={answer || answerWarning ? "study-answer-status" : undefined} />
            <button type={closeAnswerNeedsResolution ? "button" : "submit"} className={styles.primaryButton} disabled={advancingQuestion || closeAnswerNeedsResolution || (!answer && !value.trim())}>{closeAnswerNeedsResolution ? <RotateCcw size={18} /> : answer ? <ArrowRight size={18} /> : <Check size={18} />}{closeAnswerNeedsResolution ? "Choose result" : answer ? "Next" : "Check"}</button>
          </div>
        </form>}

        <div className={styles.answerStopReveal} data-answer-stop data-visible={answerStopAccessible} aria-hidden={!answerStopAccessible} inert={!answerStopAccessible ? true : undefined}>
          <div className={styles.answerStopContent}>
            {answerWarning && !answer ? <div id="study-answer-status" className={styles.answerStatus} role="status" aria-live="polite"><span className={styles.answerVerdict} data-warning="true"><RotateCcw size={18} aria-hidden /><strong>Try another answer</strong></span><span>{answerWarning}</span></div> : answer && !question.choices ? <div id="study-answer-status" className={styles.answerStatus} role="status" aria-live="polite"><span className={styles.answerVerdict} data-correct={answer.correct} data-warning={currentAnswerStatus === "close" || undefined}>{answer.correct ? <Check size={18} /> : <X size={18} />}<strong>{currentAnswerStatus === "close" ? "Accepted with a typo" : answer.correct ? "Correct" : "Incorrect"}</strong></span>{currentAnswerStatus === "close" ? <span>Correct, with a small typo.</span> : !answer.correct ? <span className={styles.correctAnswer}><small>Correct answer</small><strong lang={kanaComposition ? "ja" : undefined}>{question.displayAnswer}</strong></span> : null}</div> : null}

            {closeAnswerNeedsResolution ? <div className={styles.closeAnswerActions} aria-label="Close answer result">
              <button type="button" className={styles.dangerButton} disabled={advancingQuestion} onClick={() => resolveCloseAnswer("incorrect")}><X size={17} aria-hidden /> Mark Incorrect</button>
              <button type="button" className={styles.primaryButton} disabled={advancingQuestion} onClick={() => resolveCloseAnswer("correct")}><Check size={17} aria-hidden /> Mark Correct</button>
            </div> : null}

            {canAddSynonym && currentSubject ? <AddMeaningSynonymButton subject={currentSubject} synonym={synonymCandidate} existingMaterial={currentStudyMaterial} disabled={advancingQuestion} onSaved={acceptSavedSynonym} /> : null}

            {detailsAvailable && currentSubject ? <div className={styles.itemDetailsRegion} data-open={detailsOpen}>
              <div className={styles.itemDetailsDisclosure}>
                <button id="study-item-details-toggle" type="button" className={styles.itemDetailsButton} aria-expanded={detailsOpen} aria-controls="study-item-details" disabled={advancingQuestion} onClick={toggleDetails}><BookOpen size={17} aria-hidden /><span>{detailsOpen ? "Hide subject details" : "Show subject details"}</span>{keyboardShortcuts ? <kbd>D</kbd> : null}{detailsOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}</button>
              </div>
              <div className={styles.itemDetailsReveal} data-open={detailsOpen} aria-hidden={!detailsOpen} inert={!detailsOpen ? true : undefined}><div><StudySubjectDetails key={`${question.id}:${question.kind}`} record={currentSubject} subjects={subjects} assignment={currentAssignment} settings={subjectDetailSettings} immersionSources={immersionSources} initialTab={detailsTab} idPrefix={`study-${question.id}`} returnTo={`/study/${session.mode}`} /></div></div>
            </div> : null}

            {sentenceBreakdownAvailable ? <div className={styles.sentenceBreakdown}><div lang="ja">{question.sentence?.tokens?.map((token, index) => token.type === "plain" ? <span key={index}>{token.text}</span> : <button type="button" key={index} data-token-type={token.type} data-active={selectedToken === index} onClick={() => setSelectedToken(index)}>{token.text}</button>)}</div>{selectedToken !== null && question.sentence?.tokens?.[selectedToken] ? <p><strong>{question.sentence.tokens[selectedToken].text}</strong> · {question.sentence.tokens[selectedToken].type}{question.sentence.tokens[selectedToken].reading ? ` · ${question.sentence.tokens[selectedToken].reading}` : ""}{question.sentence.tokens[selectedToken].meaning ? ` · ${question.sentence.tokens[selectedToken].meaning}` : ""}</p> : <p>Select an underlined grammar or vocabulary token for details.</p>}</div> : null}
          </div>
        </div>

        {(question.choices || ankiEnabled) && questionCanPause ? <div className={styles.choiceActions} data-choice-actions data-visible={answerPaused} aria-hidden={!answerPaused} inert={!answerPaused ? true : undefined}><button className={styles.primaryButton} onClick={next} disabled={!answerPaused || waitingForNextQuestion || advancingQuestion} tabIndex={answerPaused ? 0 : -1}>{waitingForNextQuestion ? <><LoaderCircle className={styles.spinner} size={17} /> Finding next clip</> : <>Next <ArrowRight size={17} /></>}</button></div> : null}
        {keyboardShortcuts ? ankiEnabled ? <p className={styles.keyboardHint}>{answer ? <>Press <kbd>Enter</kbd> to continue</> : ankiRevealed ? <>Press <kbd>1</kbd> for wrong · <kbd>2</kbd> for correct</> : <>Press <kbd>Enter</kbd> to reveal</>}{hasQuestionAudio ? <> · <kbd>R</kbd> replays audio</> : null}{detailsAvailable ? <> · <kbd>D</kbd> toggles details</> : null}</p> : question.choices ? <p className={styles.keyboardHint}>{answer ? <>Press <kbd>Enter</kbd> to continue</> : <>Press <kbd>1</kbd>–<kbd>{Math.min(question.choices.length, 4)}</kbd> to answer</>}{hasQuestionAudio ? <> · <kbd>R</kbd> replays audio</> : null}{detailsAvailable ? <> · <kbd>D</kbd> toggles details</> : null}</p> : hasQuestionAudio ? <p className={styles.keyboardHint}><Headphones size={15} /> Press <kbd>R</kbd> to replay{detailsAvailable ? <> · <kbd>D</kbd> toggles details</> : null}</p> : <p className={styles.keyboardHint}>Press <kbd>Enter</kbd> to {closeAnswerNeedsResolution ? "mark correct" : answer ? "continue" : "check"}{detailsAvailable ? <> · <kbd>D</kbd> toggles details</> : null}</p> : null}
      </div>
    </section>
  );
}
