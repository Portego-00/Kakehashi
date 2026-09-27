"use client";

import { cloneElement, useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/session";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { loadWebSettings, saveWebSettings, REVIEW_CHARACTER_FONT_SCALES, type WebStudyPreferences } from "@/features/settings/settings";
import type { ReviewSettingsButtonProps } from "./ReviewSettingsButton";
import styles from "./review-settings.module.css";

const orders = [
  ["random", "Random"], ["ascendingSrsStage", "Lower SRS first"], ["descendingSrsStage", "Higher SRS first"],
  ["currentLevelFirst", "Current level first"], ["lowestLevelFirst", "Lowest level first"],
  ["newestAvailableFirst", "Newest available first"], ["oldestAvailableFirst", "Oldest available first"], ["longestRelativeWait", "Most overdue first"],
] as const;

function Field({ label, children }: { label: string; children: ReactElement<{ "aria-label"?: string }> }) {
  return <label className={styles.field}><span>{label}</span>{cloneElement(children, { "aria-label": label })}</label>;
}

type BooleanPreference = { [K in keyof WebStudyPreferences]: WebStudyPreferences[K] extends boolean ? K : never }[keyof WebStudyPreferences];

export function ReviewSettingsDialog({ order = "reviewOrder", ankiSupported = true, onStudyChange, onClose }: ReviewSettingsButtonProps & { onClose: () => void }) {
  const { user } = useSession();
  const username = user?.data.username ?? "anonymous";
  const { theme, setTheme } = useTheme();
  const [study, setStudy] = useState(() => loadWebSettings(window.localStorage, username).study);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    return () => { if (typeof element.close === "function") element.close(); };
  }, []);

  function close() {
    if (typeof dialog.current?.close === "function") dialog.current.close();
    onClose();
  }

  function update<K extends keyof WebStudyPreferences>(key: K, value: WebStudyPreferences[K]) {
    const settings = loadWebSettings(window.localStorage, username);
    const next = { ...settings.study, [key]: value };
    if (key === "ankiMode" && value !== "both") next.ankiGroupQuestions = false;
    try {
      saveWebSettings(window.localStorage, username, { ...settings, study: next });
      setStudy(next);
      setError("");
    } catch {
      setError("Settings could not be saved. Please try again.");
      return;
    }
    onStudyChange?.(next, settings.study);
  }
  const toggle = (key: BooleanPreference, label: string, disabled = false) => <Field key={key} label={label}><input type="checkbox" checked={study[key]} disabled={disabled} onChange={(event) => update(key, event.target.checked)} /></Field>;
  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-label="Review settings" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className={styles.content}>
      <header className={styles.header}><h2>Review settings</h2><Button type="button" tone="ghost" aria-label="Close review settings" onClick={close} autoFocus><X size={20} aria-hidden /></Button></header>
      <div className={styles.body}>
        <p className={styles.hint}>Changes save automatically. Your current question and answers stay in place; ordering changes apply to the remaining questions.</p>
        <fieldset><legend>Appearance</legend>
          <Field label="Theme"><select value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)}>{["system", "light", "dark", "midnight", "sepia"].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></Field>
          <Field label="Question text size"><select value={study.reviewCharacterFontScale} onChange={(event) => update("reviewCharacterFontScale", Number(event.target.value))}>{REVIEW_CHARACTER_FONT_SCALES.map((value) => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select></Field>
          {toggle("showReviewItemLevelAndSrsStage", "Show level and SRS stage")}
          {toggle("showVocabularyFrequency", "Show vocabulary frequency")}
          {toggle("showVocabContextSentencesInReviews", "Show context sentences")}
          {toggle("jitaiEnabled", "Jitai font randomization")}
        </fieldset>
        {ankiSupported ? <fieldset><legend>Anki mode</legend>
          <Field label="Anki mode"><select value={study.ankiMode} onChange={(event) => update("ankiMode", event.target.value as WebStudyPreferences["ankiMode"])}><option value="off">Off</option><option value="both">Meanings and readings</option><option value="meaning">Meanings only</option><option value="reading">Readings only</option></select></Field>
          {study.ankiMode !== "off" ? <>{toggle("ankiGroupQuestions", "Group meaning and reading", study.ankiMode !== "both")}{toggle("ankiButtonlessMode", "Buttonless Anki mode")}{toggle("ankiShowOtherAcceptedAnswersAndUserSynonyms", "Show other accepted answers")}{toggle("ankiShowWaniKaniGrammarTags", "Show parts of speech")}{toggle("ankiShowPitchAccentNumbers", "Show pitch accent numbers")}{toggle("ankiShowPitchAccentGraph", "Show pitch accent graph")}{toggle("ankiShowReplayAudioButton", "Show replay audio button")}</> : null}
        </fieldset> : null}
        <fieldset><legend>Ordering</legend>
          {order !== "lessonQuestionOrder" ? <>
            <Field label="Review subject order"><select value={study[order]} onChange={(event) => update(order, event.target.value as WebStudyPreferences["reviewOrder"])}>{orders.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            {toggle("reviewTypeOrderEnabled", "Group by item type")}
            {study.reviewTypeOrderEnabled ? study.reviewTypeOrder.map((type, index) => <Field key={index} label={`${["First", "Second", "Third"][index]} item type`}><select value={type} onChange={(event) => { const next = [...study.reviewTypeOrder]; const position = next.indexOf(event.target.value as typeof type); [next[index], next[position]] = [next[position], next[index]]; update("reviewTypeOrder", next); }}>{["radical", "kanji", "vocabulary"].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></Field>) : null}
            {toggle("prioritizeCriticalItems", "Prioritize critical items")}
            {toggle("reviewQuestionOrderEnabled", "Force meaning/reading order")}
          </> : null}
          {order === "lessonQuestionOrder" || study.reviewQuestionOrderEnabled ? <Field label="Question order"><select value={order === "lessonQuestionOrder" ? study.lessonQuestionOrder : study.reviewQuestionOrder} onChange={(event) => update(order === "lessonQuestionOrder" ? order : "reviewQuestionOrder", event.target.value as WebStudyPreferences["reviewQuestionOrder"])}><option value="meaning-first">Meaning first</option><option value="reading-first">Reading first</option>{order === "lessonQuestionOrder" ? <option value="mixed">Mixed</option> : null}</select></Field> : null}
          {toggle("backToBackQuestions", "Back-to-back questions", study.ankiMode === "both" && study.ankiGroupQuestions)}
          {study.backToBackQuestions ? toggle("backToBackImmediateRetryIncorrect", "Immediate retry on wrong") : null}
        </fieldset>
        <fieldset><legend>Answers and audio</legend>
          {toggle("pauseOnWrong", "Pause on wrong answer")}{toggle("pauseOnClose", "Pause on close answer", study.pauseOnCorrect)}{toggle("pauseOnCorrect", "Pause on correct answer")}
          {toggle("showAnswerStopSubjectDetails", "Show details on answer pause")}{toggle("answerFeedbackSoundEnabled", "Answer feedback sounds")}
          {toggle("keyboardShortcuts", "Keyboard shortcuts")}{toggle("allowSkippingReviews", "Allow skipping reviews")}
          {toggle("acceptUserSynonymsAsAnswers", "Accept user synonyms")}{toggle("acceptAnyKanjiOnyomiReading", "Accept any kanji on’yomi reading")}
          {toggle("reviewSearchButtonEnabled", "Show search button")}{toggle("autoplayAudio", "Autoplay vocabulary audio")}
          <Field label="Voice actor"><select value={study.vocabularyAudioVoice} onChange={(event) => update("vocabularyAudioVoice", event.target.value as WebStudyPreferences["vocabularyAudioVoice"])}><option value="female">Female · Kyoko</option><option value="male">Male · Kenichi</option><option value="random">Random</option><option value="both">Both</option></select></Field>
          {toggle("showListeningTranslation", "Show listening translation")}
        </fieldset>
        {error ? <p role="alert">{error}</p> : null}
      </div>
      <footer className={styles.footer}><Button type="button" tone="primary" onClick={close}>Done</Button></footer>
    </div>
  </dialog>, document.body);
}
