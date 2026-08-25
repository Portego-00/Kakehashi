"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import { CROSSWORD_SIZE_PRESETS, fixedSubjectTypes } from "../mode-config";
import type { SrsGroup, StudyFilters, StudyModeId, SubjectList } from "../types";
import styles from "../study.module.css";

const SUBJECT_TYPES: Array<{ value: SubjectType; label: string }> = [
  { value: "radical", label: "Radicals" },
  { value: "kanji", label: "Kanji" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "kana_vocabulary", label: "Kana vocabulary" },
];
const SRS_GROUPS: Array<{ value: SrsGroup; label: string }> = [
  { value: "apprentice", label: "Apprentice" },
  { value: "guru", label: "Guru" },
  { value: "master", label: "Master" },
  { value: "enlightened", label: "Enlightened" },
  { value: "burned", label: "Burned" },
];
const SRS_STAGES = [
  { value: 0, label: "Locked" }, { value: 1, label: "Apprentice 1" }, { value: 2, label: "Apprentice 2" },
  { value: 3, label: "Apprentice 3" }, { value: 4, label: "Apprentice 4" }, { value: 5, label: "Guru 1" },
  { value: 6, label: "Guru 2" }, { value: 7, label: "Master" }, { value: 8, label: "Enlightened" }, { value: 9, label: "Burned" },
] as const;
const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

function subjectTypeOptions(mode: StudyModeId) {
  if (mode === "vocab-reading") return SUBJECT_TYPES.filter((option) => option.value !== "radical");
  if (mode === "hiragana-meaning" || mode === "listening" || mode === "context-sentences" || mode === "kana-wordle") {
    return SUBJECT_TYPES.filter((option) => option.value === "vocabulary" || option.value === "kana_vocabulary");
  }
  return SUBJECT_TYPES;
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function SubjectPicker({ subjects, assignments, selected, lists, filters, onChange }: { subjects: Subject[]; assignments: Assignment[]; selected: number[]; lists: SubjectList[]; filters: StudyFilters; onChange: (ids: number[]) => void }) {
  const [query, setQuery] = useState("");
  const stageBySubjectId = useMemo(() => new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment.data.srs_stage])), [assignments]);
  const matching = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return subjects.filter((subject) => filters.subjectTypes.includes(subject.object) && filters.selectedSrsStages.includes(stageBySubjectId.get(subject.id) ?? 0) && subject.data.level >= filters.minLevel && subject.data.level <= filters.maxLevel)
      .filter((subject) => !normalized || subject.data.characters?.includes(query) || subject.data.meanings.some((meaning) => meaning.meaning.toLocaleLowerCase().includes(normalized)));
  }, [filters.maxLevel, filters.minLevel, filters.selectedSrsStages, filters.subjectTypes, query, stageBySubjectId, subjects]);
  const shown = matching.slice(0, 200);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <section className={styles.picker} aria-labelledby="pick-subjects-title">
      <div className={styles.configTitleRow}>
        <div><h2 id="pick-subjects-title">Choose subjects</h2><p>{selected.length ? `${selected.length} selected` : "Select subjects or use one of your lists."}</p></div>
        <div className={styles.optionRow}><button type="button" className={styles.textButton} disabled={!matching.length} onClick={() => onChange([...new Set([...selected, ...matching.map((subject) => subject.id)])])}>Select all matches</button>{selected.length ? <button type="button" className={styles.textButton} onClick={() => onChange([])}>Clear</button> : null}</div>
      </div>
      {lists.length ? (
        <div className={styles.optionRow} aria-label="Subject lists">
          {lists.map((list) => <button type="button" className={styles.optionButton} key={list.id} onClick={() => onChange([...new Set([...selected, ...list.subjectIds])])}>{list.name} <span>{list.subjectIds.length}</span></button>)}
        </div>
      ) : null}
      <label className={styles.searchField}><Search size={17} aria-hidden="true" /><span className="sr-only">Search subjects</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search characters or meanings" /></label>
      <div className={styles.subjectPickerGrid} role="group" aria-label="Available subjects">
        {shown.map((subject) => {
          const active = selectedSet.has(subject.id);
          const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning;
          return <button type="button" key={subject.id} className={styles.subjectPick} data-active={active} data-type={subject.object} aria-pressed={active} onClick={() => onChange(toggleValue(selected, subject.id))}><strong lang="ja">{subject.data.characters ?? "◈"}</strong><span>{meaning}</span><small>Level {subject.data.level}</small></button>;
        })}
      </div>
      {matching.length > 200 ? <p className={styles.pickerHint}>Showing 200 of {matching.length} matches. Select all still includes the full result.</p> : null}
    </section>
  );
}

const LIST_ENABLED_MODES = new Set<StudyModeId>(["random-test", "vocab-reading", "hiragana-meaning", "similar-kanji", "kana-to-kanji", "listening", "context-sentences", "kanji-writing", "crossword", "kana-wordle", "custom-review", "custom-lessons"]);

export function StudyConfig({ mode, filters, subjects, assignments = [], lists, starting = false, onChange, onStart }: { mode: StudyModeId; filters: StudyFilters; subjects: Subject[]; assignments?: Assignment[]; lists: SubjectList[]; starting?: boolean; onChange: (filters: StudyFilters) => void; onStart: () => void }) {
  const fixedTypes = fixedSubjectTypes(mode);
  const needsSelection = mode === "custom-review" || mode === "custom-lessons";
  const needsQuestionKind = mode === "random-test";
  const usesCount = mode !== "recent-lessons" && mode !== "crossword" && mode !== "kana-wordle" && mode !== "custom-review" && mode !== "custom-lessons";
  const countLabel = mode === "kanji-writing" ? "kanji" : mode === "similar-kanji" ? "rounds" : "questions";
  const countMaximum = mode === "listening" ? 20 : mode === "context-sentences" || mode === "kanji-writing" ? 50 : 100;
  const usesStandardFilters = mode !== "recent-lessons";
  const hasRequiredAnime = mode !== "listening" || filters.animeSources.length > 0;
  const hasCoreFilters = mode === "recent-lessons" || needsSelection || (filters.srsGroups.length > 0 && filters.subjectTypes.length > 0);
  const canStart = !starting && hasCoreFilters && hasRequiredAnime && (!needsSelection || filters.selectedSubjectIds.length > 0) && (!needsQuestionKind || filters.questionKinds.length > 0);
  const set = <K extends keyof StudyFilters>(key: K, value: StudyFilters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className={styles.configLayout}>
      <form className={styles.configPanel} onSubmit={(event) => { event.preventDefault(); if (canStart) onStart(); }}>
        <div className={styles.configTitleRow}><h2>Session setup</h2>{usesCount ? <output className={styles.countOutput} aria-label={`${filters.count} ${countLabel}`}><strong>{filters.count}</strong><span>{countLabel}</span></output> : null}</div>
        {mode === "random-test" ? <fieldset><legend>Question types</legend><div className={styles.optionRow}>{(["meaning", "reading"] as const).map((kind) => <label key={kind} className={styles.checkOption} data-active={filters.questionKinds.includes(kind)}><input type="checkbox" checked={filters.questionKinds.includes(kind)} onChange={() => set("questionKinds", toggleValue(filters.questionKinds, kind))} /><span>{kind[0].toUpperCase() + kind.slice(1)}</span></label>)}</div></fieldset> : null}
        {usesCount ? <label className={styles.rangeLabel}><span>Session length</span><input type="range" min={5} max={countMaximum} step={5} value={Math.min(filters.count, countMaximum)} onChange={(event) => set("count", Number(event.target.value))} /></label> : null}

        {mode === "recent-lessons" ? <fieldset><legend>Recent lesson window</legend><div className={styles.optionRow}>{([['apprentice', 'All Apprentice'], ['24h', '24 hours'], ['7d', '7 days'], ['30d', '30 days']] as const).map(([value, label]) => <button type="button" className={styles.optionButton} data-active={filters.recentWindow === value} key={value} onClick={() => set("recentWindow", value)}>{label}</button>)}</div></fieldset> : null}

        {(mode === "listening" || mode === "context-sentences") ? <fieldset><legend>Answer mode</legend><div className={styles.optionRow}>{([['multiple-choice', 'Multiple choice'], ['typed', 'Type answer']] as const).map(([value, label]) => <button type="button" className={styles.optionButton} data-active={filters.answerMode === value} key={value} onClick={() => set("answerMode", value)}>{label}</button>)}</div></fieldset> : null}

        {mode === "listening" ? <><label className={styles.largeSearch}>Anime sources<input value={filters.animeSources.join(", ")} onChange={(event) => set("animeSources", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="death_note, your_name" /><span>Choose at least one ImmersionKit source.</span></label><label className={styles.checkOption} data-active={filters.listeningAutoPlayAudio}><input type="checkbox" checked={filters.listeningAutoPlayAudio} onChange={() => set("listeningAutoPlayAudio", !filters.listeningAutoPlayAudio)} /><span>Auto-play audio</span></label></> : null}

        {mode === "context-sentences" ? <fieldset><legend>Question behavior</legend><div className={styles.optionRow}><label className={styles.checkOption} data-active={filters.contextSentenceAudio}><input type="checkbox" checked={filters.contextSentenceAudio} onChange={() => set("contextSentenceAudio", !filters.contextSentenceAudio)} /><span>Sentence audio (TTS)</span></label><label className={styles.checkOption} data-active={filters.contextSentenceAudio && filters.contextAutoPlaySentenceAudio}><input type="checkbox" checked={filters.contextAutoPlaySentenceAudio} disabled={!filters.contextSentenceAudio} onChange={() => set("contextAutoPlaySentenceAudio", !filters.contextAutoPlaySentenceAudio)} /><span>Auto-play sentence audio</span></label><label className={styles.checkOption} data-active={filters.contextHideTranslation}><input type="checkbox" checked={filters.contextHideTranslation} onChange={() => set("contextHideTranslation", !filters.contextHideTranslation)} /><span>Hide translation until tap</span></label><label className={styles.checkOption} data-active={filters.contextSentenceBreakdown}><input type="checkbox" checked={filters.contextSentenceBreakdown} onChange={() => set("contextSentenceBreakdown", !filters.contextSentenceBreakdown)} /><span>JPDB-style sentence breakdown</span></label><label className={styles.checkOption} data-active={filters.contextStopAfterAnswer}><input type="checkbox" checked={filters.contextStopAfterAnswer} onChange={() => set("contextStopAfterAnswer", !filters.contextStopAfterAnswer)} /><span>Stop after answer</span></label></div></fieldset> : null}

        {mode === "kanji-writing" ? <fieldset><legend>Practice mode</legend><div className={styles.optionRow}><button type="button" className={styles.optionButton} data-active={filters.writingMode === "guided"} onClick={() => set("writingMode", "guided")}>Guided stroke order</button><button type="button" className={styles.optionButton} data-active={filters.writingMode === "freehand"} onClick={() => set("writingMode", "freehand")}>Freehand recall</button></div></fieldset> : null}

        {mode === "kana-wordle" ? <><fieldset><legend>Word length</legend><div className={styles.optionRow}>{[3, 4, 5, 6, 7].map((length) => <button type="button" className={styles.optionButton} data-active={filters.wordLength === length} key={length} onClick={() => set("wordLength", length)}>{length} kana</button>)}</div></fieldset><label className={styles.rangeLabel}><span>Maximum attempts: {filters.wordleMaxAttempts}</span><input type="range" min={4} max={8} step={1} value={filters.wordleMaxAttempts} onChange={(event) => set("wordleMaxAttempts", Number(event.target.value))} /></label></> : null}

        {mode === "similar-kanji" ? <><fieldset><legend>Similarity source</legend><div className={styles.optionRow}><button type="button" className={styles.optionButton} data-active={filters.similarKanjiSource === "niai"} onClick={() => set("similarKanjiSource", "niai")}>Niai</button><button type="button" className={styles.optionButton} data-active={filters.similarKanjiSource === "wanikani"} onClick={() => set("similarKanjiSource", "wanikani")}>WaniKani</button></div></fieldset><label className={styles.rangeLabel}><span>Kanji per round: {filters.similarKanjiGroupSize}</span><input type="range" min={2} max={6} step={1} value={filters.similarKanjiGroupSize} onChange={(event) => set("similarKanjiGroupSize", Number(event.target.value))} /></label><label className={styles.checkOption} data-active={filters.similarKanjiOnlyLearned}><input type="checkbox" checked={filters.similarKanjiOnlyLearned} onChange={() => set("similarKanjiOnlyLearned", !filters.similarKanjiOnlyLearned)} /><span>Only use learned similar kanji</span></label></> : null}

        {mode === "crossword" ? <><fieldset><legend>Crossword size</legend><div className={styles.optionRow}>{Object.entries(CROSSWORD_SIZE_PRESETS).map(([size, preset]) => <button type="button" className={styles.optionButton} data-active={filters.crosswordSize === size} key={size} onClick={() => onChange({ ...filters, crosswordSize: size as StudyFilters["crosswordSize"], crosswordMaxWords: preset.defaultMaxWords })}><strong>{preset.label}</strong> <span>{preset.gridSize}×{preset.gridSize}</span></button>)}</div></fieldset><label className={styles.rangeLabel}><span>Number of words: {filters.crosswordMaxWords}</span><input type="range" min={CROSSWORD_SIZE_PRESETS[filters.crosswordSize].minWords} max={CROSSWORD_SIZE_PRESETS[filters.crosswordSize].maxWords} step={1} value={filters.crosswordMaxWords} onChange={(event) => set("crosswordMaxWords", Number(event.target.value))} /></label><fieldset><legend>Estimated JLPT</legend><div className={styles.optionRow}>{JLPT_LEVELS.map((level) => <label key={level} className={styles.checkOption} data-active={filters.crosswordJlptLevels.includes(level)}><input type="checkbox" checked={filters.crosswordJlptLevels.includes(level)} onChange={() => set("crosswordJlptLevels", toggleValue(filters.crosswordJlptLevels, level))} /><span>{level}</span></label>)}</div></fieldset><label className={styles.checkOption} data-active={filters.crosswordHiraganaOnly}><input type="checkbox" checked={filters.crosswordHiraganaOnly} onChange={() => set("crosswordHiraganaOnly", !filters.crosswordHiraganaOnly)} /><span>Hiragana-only words</span></label><fieldset><legend>Clue language</legend><div className={styles.optionRow}>{([['english', 'English'], ['kanji', 'Kanji'], ['english_kanji', 'English + Kanji']] as const).map(([value, label]) => <button type="button" className={styles.optionButton} data-active={filters.crosswordClueMode === value} key={value} onClick={() => set("crosswordClueMode", value)}>{label}</button>)}</div></fieldset><div className={styles.optionRow}><label className={styles.checkOption} data-active={filters.crosswordShowKanjiSolutions}><input type="checkbox" checked={filters.crosswordShowKanjiSolutions} onChange={() => set("crosswordShowKanjiSolutions", !filters.crosswordShowKanjiSolutions)} /><span>Show kanji before readings in solutions</span></label><label className={styles.checkOption} data-active={filters.crosswordPlayAudioOnCorrect}><input type="checkbox" checked={filters.crosswordPlayAudioOnCorrect} onChange={() => set("crosswordPlayAudioOnCorrect", !filters.crosswordPlayAudioOnCorrect)} /><span>Play audio on correct answers</span></label></div></> : null}

        {!fixedTypes && usesStandardFilters ? <fieldset><legend>Subject types</legend><div className={styles.optionRow}>{subjectTypeOptions(mode).map((option) => <label key={option.value} className={styles.checkOption} data-active={filters.subjectTypes.includes(option.value)}><input type="checkbox" checked={filters.subjectTypes.includes(option.value)} onChange={() => set("subjectTypes", toggleValue(filters.subjectTypes, option.value))} /><span>{option.label}</span></label>)}</div></fieldset> : null}

        {usesStandardFilters && !needsSelection ? <fieldset><legend>SRS stages</legend><div className={styles.optionRow}>{SRS_GROUPS.map((option) => <label key={option.value} className={styles.checkOption} data-active={filters.srsGroups.includes(option.value)}><input type="checkbox" checked={filters.srsGroups.includes(option.value)} onChange={() => set("srsGroups", toggleValue(filters.srsGroups, option.value))} /><SrsStageIcon level={option.label} size={19} /><span>{option.label}</span></label>)}</div></fieldset> : null}
        {needsSelection ? <fieldset><legend>SRS stages</legend><div className={styles.optionRow}>{SRS_STAGES.map((option) => <label key={option.value} className={styles.checkOption} data-active={filters.selectedSrsStages.includes(option.value)}><input type="checkbox" checked={filters.selectedSrsStages.includes(option.value)} onChange={() => set("selectedSrsStages", toggleValue(filters.selectedSrsStages, option.value))} />{option.value > 0 ? <SrsStageIcon stage={option.value} size={19} /> : null}<span>{option.label}</span></label>)}</div></fieldset> : null}

        {usesStandardFilters ? <fieldset><legend>Levels</legend><label className={styles.checkOption} data-active={filters.useCustomLevelRange}><input type="checkbox" checked={filters.useCustomLevelRange} onChange={() => set("useCustomLevelRange", !filters.useCustomLevelRange)} /><span>Use custom level range</span></label>{filters.useCustomLevelRange ? <div className={styles.levelFields}><label>From <input type="number" min={1} max={filters.maxLevel} value={filters.minLevel} onChange={(event) => set("minLevel", Math.max(1, Math.min(filters.maxLevel, Number(event.target.value))))} /></label><span aria-hidden="true">—</span><label>To <input type="number" min={filters.minLevel} max={60} value={filters.maxLevel} onChange={(event) => set("maxLevel", Math.max(filters.minLevel, Math.min(60, Number(event.target.value))))} /></label></div> : <p>Levels 1–{filters.maxLevel}</p>}</fieldset> : null}

        {LIST_ENABLED_MODES.has(mode) && lists.length ? <fieldset><legend>Use subject lists</legend><div className={styles.optionRow}>{lists.map((list) => <button type="button" className={styles.optionButton} data-active={filters.selectedListIds.includes(list.id)} key={list.id} onClick={() => { const selectedListIds = toggleValue(filters.selectedListIds, list.id); const selectedLists = lists.filter((candidate) => selectedListIds.includes(candidate.id)); onChange({ ...filters, selectedListIds, selectedSubjectIds: [...new Set(selectedLists.flatMap((candidate) => candidate.subjectIds))] }); }}>{list.name} <span>{list.subjectIds.length}</span></button>)}{filters.selectedListIds.length > 0 && !needsSelection ? <button type="button" className={styles.textButton} onClick={() => onChange({ ...filters, selectedListIds: [], selectedSubjectIds: [] })}>Clear list filter</button> : null}</div></fieldset> : null}

        <button className={styles.primaryButton} type="submit" disabled={!canStart}>{starting ? "Preparing…" : "Start session"}</button>
        <p className={styles.formMessage} role="status">{canStart || starting ? "" : needsSelection ? "Choose at least one eligible subject." : !hasRequiredAnime ? "Choose at least one anime source." : "Choose at least one subject type, question type, and SRS stage."}</p>
      </form>
      {needsSelection ? <SubjectPicker subjects={subjects} assignments={assignments} selected={filters.selectedSubjectIds} lists={lists} filters={filters} onChange={(ids) => set("selectedSubjectIds", ids)} /> : null}
    </div>
  );
}
