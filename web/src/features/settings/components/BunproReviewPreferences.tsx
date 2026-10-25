"use client";
import { REVIEW_ORDER_OPTIONS } from "./review-order-options";
import { Card } from "@/components/ui/Card";
import { REVIEW_CHARACTER_FONT_SCALES, REVIEW_BATCH_SIZE_VALUES, type WebStudyPreferences } from "../settings";
import { SettingsChoices } from "./review-answer-mode-cards";
import { SettingsToggleRow } from "./SettingsToggleRow";
import { SettingsDescription } from "./SettingsDescription";
import { ReviewPromptColorSetting } from "./ReviewPromptColorSetting";
import { SettingsDisclosure } from "./settings-disclosure";
import { SettingsRowIcon, type SettingRowId } from "./settings-row-icon";
import { StudyShortcutSettings } from "./StudyShortcutSettings";
import styles from "../settings.module.css";

type BooleanPreference = { [K in keyof WebStudyPreferences]: WebStudyPreferences[K] extends boolean ? K : never }[keyof WebStudyPreferences];
export function BunproReviewPreferences({ study, onChange }: { study: WebStudyPreferences; onChange: (patch: Partial<WebStudyPreferences>) => void }) {
  const toggle = (key: BooleanPreference, label: string, description: string, setting: SettingRowId, disabled = false) =>
    <SettingsToggleRow label={label} description={description} setting={setting} checked={key === "pauseOnClose" ? study.pauseOnCorrect || study.pauseOnClose : study[key]} disabled={disabled} onChange={(value) => onChange({ [key]: value })} />;
  return <div className={styles.bunproPreferences}>
    <h3>Review preferences<SettingsDescription label="Bunpro review preferences">Furigana and prompt text color are specific to Bunpro. Other preferences are shared with WaniKani reviews. Changing them here also updates the Reviews section. Bunpro supports typing and Anki cards.</SettingsDescription></h3>
    <SettingsChoices label="Bunpro answer mode" value={study.ankiMode === "off" ? "type" : "anki"}
      options={[{ value: "type", label: "Type answers", art: "type", description: "Recall and type" }, { value: "anki", label: "Anki cards", art: "cards", description: "Reveal and grade" }]}
      onChange={(mode) => onChange(mode === "anki" ? { ankiMode: study.ankiMode === "off" ? "both" : study.ankiMode } : { ankiMode: "off", ankiGroupQuestions: false })} />
    {study.ankiMode !== "off" ? <SettingsChoices label="Bunpro Anki applies to" compact value={study.ankiMode}
      options={[{ value: "both", label: "Both", art: "both" }, { value: "meaning", label: "Meanings", art: "meaning" }, { value: "reading", label: "Readings", art: "reading" }]}
      onChange={(value) => onChange({ ankiMode: value, ankiGroupQuestions: value === "both" && study.ankiGroupQuestions })} /> : null}
    <Card padding="none" className={styles.preferenceCard}>
      {toggle("showDetailsOnWrongAnswer", "Show details on wrong answer", "Open grammar or vocabulary details after an incorrect answer and wait for you to continue.", "details-auto")}
      {toggle("answerFeedbackSoundEnabled", "Answer feedback sounds", "Play feedback after correct and incorrect answers.", "feedback-sound")}
      {toggle("keyboardShortcuts", "Keyboard shortcuts", "Use your review shortcuts for checking, revealing, grading and showing details.", "shortcuts")}
      {toggle("bunproHideFurigana", "Hide Bunpro furigana", "Hover or focus to show a reading. Click or tap to keep it visible for the question.", "furigana")}
    </Card>
    <div className={styles.disclosureStack}>
      <SettingsDisclosure title="Prompt & answer behavior" description="Pauses, audio, hints and the information shown during Bunpro reviews" icon="answer">
        <ReviewPromptColorSetting provider="bunpro" value={study.bunproReviewPromptTextColor} onChange={(value) => onChange({ bunproReviewPromptTextColor: value })} />
        {toggle("pauseOnWrong", "Pause on wrong answer", "Wait after an incorrect answer before continuing.", "pause-wrong")}
        {toggle("pauseOnClose", "Pause on close answer", "Wait after an accepted fuzzy match. Always enabled when Pause on correct answer is on.", "pause-close", study.pauseOnCorrect)}
        {toggle("pauseOnCorrect", "Pause on correct answer", "Wait after a correct answer before continuing.", "pause-correct")}
        {toggle("showAnswerStopSubjectDetails", "Show details on answer pause", "Open details when the selected answer outcome pauses.", "details-auto")}
        {toggle("autoplayAudio", "Autoplay vocabulary audio", "Play Bunpro pronunciation when an answer is revealed or checked.", "autoplay-vocabulary")}
        {toggle("showReviewItemLevelAndSrsStage", "Show item level & SRS stage", "Display JLPT level and the current SRS stage with the question.", "subject-meta")}
        {toggle("allowSkippingReviews", "Allow skipping reviews", "Move a question to the end without recording a wrong answer.", "skip")}
        {toggle("backToBackQuestions", "Back-to-back questions", "Keep a subject’s meaning and reading together.", "back-to-back", study.ankiMode === "both" && study.ankiGroupQuestions)}
        {study.backToBackQuestions && !(study.ankiMode === "both" && study.ankiGroupQuestions) ? toggle("backToBackImmediateRetryIncorrect", "Immediate retry on wrong", "Re-ask failed questions immediately in back-to-back mode.", "retry") : null}
        {toggle("reviewSearchButtonEnabled", "Review search button", "Open the current item in Search in another tab.", "review-search")}
        {toggle("reviewAnimatePreviousQuestion", "Animate previous question", "Move the previous answer toward the top-left of the session.", "question-motion")}
        <label data-settings-search="Bunpro review character size" className={styles.selectRow} htmlFor="settings-bunpro-review-character-size"><span className={styles.preferenceLabel}><SettingsRowIcon setting="character-size" /><span><strong>Review character size</strong><SettingsDescription label="Bunpro review character size">Scale the Japanese sentence without changing the other text.</SettingsDescription></span></span><select aria-label="Bunpro review character size" value={study.reviewCharacterFontScale} onChange={(event) => onChange({ reviewCharacterFontScale: Number(event.target.value) })} id="settings-bunpro-review-character-size">{REVIEW_CHARACTER_FONT_SCALES.map((value) => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select></label>
      </SettingsDisclosure>
      <SettingsDisclosure title="Review order & session size" description="Order, batch limits and wrap-up" icon="order">
        <label data-settings-search="Bunpro review subject order" className={styles.selectRow} htmlFor="settings-bunpro-review-subject-order"><span className={styles.preferenceLabel}><SettingsRowIcon setting="subject-order" /><span><strong>Review subject order</strong><SettingsDescription label="Bunpro review subject order">Apply the shared review ordering to the Bunpro queue.</SettingsDescription></span></span><select aria-label="Bunpro review subject order" value={study.reviewOrder} onChange={(event) => onChange({ reviewOrder: event.target.value as WebStudyPreferences["reviewOrder"] })} id="settings-bunpro-review-subject-order">{REVIEW_ORDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {toggle("reviewQuestionOrderEnabled", "Force meaning/reading order", "Ask your preferred question type first when both are available.", "question-order")}
        {study.reviewQuestionOrderEnabled ? <label data-settings-search="Bunpro review question order" className={styles.selectRow} htmlFor="settings-bunpro-review-question-order"><span className={styles.preferenceLabel}><SettingsRowIcon setting="question-order" /><strong>Review question order</strong></span><select aria-label="Bunpro review question order" value={study.reviewQuestionOrder === "reading-first" ? "reading-first" : "meaning-first"} onChange={(event) => onChange({ reviewQuestionOrder: event.target.value as WebStudyPreferences["reviewQuestionOrder"] })} id="settings-bunpro-review-question-order"><option value="meaning-first">Meaning first</option><option value="reading-first">Reading first</option></select></label> : null}
        {toggle("reviewBatchSizeEnabled", "Limit review batch size", "Limit the number of subjects loaded in each Bunpro session.", "review-cap")}
        {study.reviewBatchSizeEnabled ? <label data-settings-search="Bunpro review batch size" className={styles.selectRow} htmlFor="settings-bunpro-review-batch-size"><span className={styles.preferenceLabel}><SettingsRowIcon setting="review-count" /><strong>Review batch size</strong></span><select aria-label="Bunpro review batch size" value={study.reviewBatchSize} onChange={(event) => onChange({ reviewBatchSize: Number(event.target.value) })} id="settings-bunpro-review-batch-size">{REVIEW_BATCH_SIZE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
        <label data-settings-search="Bunpro wrap-up size" className={styles.selectRow} htmlFor="settings-bunpro-wrap-up-size"><span className={styles.preferenceLabel}><SettingsRowIcon setting="wrap-up" /><strong>Wrap-up size</strong></span><select aria-label="Bunpro wrap-up size" value={study.reviewWrapUpSize} onChange={(event) => onChange({ reviewWrapUpSize: Number(event.target.value) })} id="settings-bunpro-wrap-up-size">{[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label data-settings-search="Bunpro SRS progression" className={styles.selectRow} htmlFor="settings-bunpro-srs-progression"><span className={styles.preferenceLabel}><SettingsRowIcon setting="srs-progress" /><strong>SRS progression</strong></span><select aria-label="Bunpro SRS progression" value={study.srsProgressionCardDisplayMode} onChange={(event) => onChange({ srsProgressionCardDisplayMode: event.target.value as WebStudyPreferences["srsProgressionCardDisplayMode"] })} id="settings-bunpro-srs-progression"><option value="normal">Normal</option><option value="compact">Compact</option><option value="hidden">Hidden</option></select></label>
      </SettingsDisclosure>
      {study.ankiMode !== "off" ? <SettingsDisclosure title="Anki card details" description="Reveal, grade and choose the information on Bunpro cards" icon="cards">
        {toggle("ankiHideAnswerCompletely", "Hide answer completely", "Hide the answer and its length until reveal.", "hide-answer")}
        {toggle("ankiGroupQuestions", "Group meaning and reading", "Choose Both above to reveal and grade both sides on one card.", "group-anki", study.ankiMode !== "both")}
        {toggle("ankiButtonlessMode", "Buttonless Anki mode", "After reveal, tap or swipe the card to grade, show details or skip.", "anki-gesture")}
        {toggle("ankiShowOtherAcceptedAnswersAndUserSynonyms", "Show other accepted answers", "Include alternative accepted answers after reveal.", "alternate-answers")}
        {toggle("ankiShowWaniKaniGrammarTags", "Show parts of speech", "Show vocabulary grammar tags when available.", "parts-of-speech")}
        {toggle("ankiShowPitchAccentNumbers", "Show pitch accent numbers", "Show pitch numbers on vocabulary readings when available.", "pitch-numbers")}
        {toggle("ankiShowPitchAccentGraph", "Show pitch accent graph", "Show the pitch contour on vocabulary readings when available.", "pitch-graph")}
        {toggle("ankiShowReplayAudioButton", "Show replay audio button", "Add replay beside the revealed answer when pronunciation is available.", "replay-audio")}
        <StudyShortcutSettings value={study.studyShortcuts} onChange={(value) => onChange({ studyShortcuts: value })} />
      </SettingsDisclosure> : null}
    </div>
  </div>;
}
