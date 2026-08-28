"use client";

import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useDeferredValue, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { AnimePicker } from "@/features/anime/AnimePicker";
import { hasSelectedAnime } from "@/features/anime/types";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { searchSubjects } from "@/features/subjects/search";
import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import { activeStrokeLeniencyPreset, CROSSWORD_SIZE_PRESETS, fixedSubjectTypes, STROKE_LENIENCY_PRESETS } from "../mode-config";
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
  { value: 0, label: "Locked" },
  { value: 1, label: "Apprentice 1" },
  { value: 2, label: "Apprentice 2" },
  { value: 3, label: "Apprentice 3" },
  { value: 4, label: "Apprentice 4" },
  { value: 5, label: "Guru 1" },
  { value: 6, label: "Guru 2" },
  { value: 7, label: "Master" },
  { value: 8, label: "Enlightened" },
  { value: 9, label: "Burned" },
] as const;
const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  radical: "Radical",
  kanji: "Kanji",
  vocabulary: "Vocabulary",
  kana_vocabulary: "Kana vocabulary",
};

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

type CustomPickerMode = Extract<StudyModeId, "custom-review" | "custom-lessons">;

function CustomSubjectPicker({ mode, subjects, assignments, lists, filters, userLevel, starting, onChange, onStart }: { mode: CustomPickerMode; subjects: Subject[]; assignments: Assignment[]; lists: SubjectList[]; filters: StudyFilters; userLevel: number; starting: boolean; onChange: (filters: StudyFilters) => void; onStart: () => void }) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const pickerTitleId = useId();
  const filterPanelId = useId();
  const resultHeadingId = useId();
  const isLessons = mode === "custom-lessons";
  const catalogMaxLevel = isLessons ? 60 : userLevel;
  const selectedSet = useMemo(() => new Set(filters.selectedSubjectIds), [filters.selectedSubjectIds]);
  const runnableSubjectIds = useMemo(() => new Set(subjects.filter((subject) => !subject.data.hidden_at).map((subject) => subject.id)), [subjects]);
  const selectedCount = useMemo(() => [...selectedSet].filter((subjectId) => runnableSubjectIds.has(subjectId)).length, [runnableSubjectIds, selectedSet]);
  const availableListIds = useMemo(() => new Set(lists.map((list) => list.id)), [lists]);
  const validSelectedListIds = useMemo(() => filters.selectedListIds.filter((listId) => availableListIds.has(listId)), [availableListIds, filters.selectedListIds]);
  const selectedListSubjectIds = useMemo(() => {
    if (!validSelectedListIds.length) return null;
    const selectedListIds = new Set(validSelectedListIds);
    return new Set(lists.filter((list) => selectedListIds.has(list.id)).flatMap((list) => list.subjectIds));
  }, [lists, validSelectedListIds]);
  const effectiveMinLevel = filters.useCustomLevelRange ? filters.minLevel : 1;
  const effectiveMaxLevel = filters.useCustomLevelRange ? filters.maxLevel : catalogMaxLevel;
  const matching = useMemo(() => {
    if (!filters.subjectTypes.length || !filters.selectedSrsStages.length) return [];
    return searchSubjects(subjects, assignments, {
      query: deferredQuery,
      types: filters.subjectTypes,
      minLevel: effectiveMinLevel,
      maxLevel: effectiveMaxLevel,
      srs: [],
    }).filter(({ subject, assignment }) => {
      const stageMatches = filters.selectedSrsStages.includes(assignment?.data.srs_stage ?? 0);
      const listMatches = !selectedListSubjectIds || selectedListSubjectIds.has(subject.id);
      return stageMatches && listMatches;
    });
  }, [assignments, deferredQuery, effectiveMaxLevel, effectiveMinLevel, filters.selectedSrsStages, filters.subjectTypes, selectedListSubjectIds, subjects]);
  const shown = matching.slice(0, 200);
  const allMatchingSelected = matching.length > 0 && matching.every(({ subject }) => selectedSet.has(subject.id));
  const activeFilterCount = Number(filters.subjectTypes.length !== SUBJECT_TYPES.length)
    + Number(filters.selectedSrsStages.length !== SRS_STAGES.length)
    + Number(filters.useCustomLevelRange)
    + validSelectedListIds.length;
  const hasActiveSearchOrFilters = Boolean(deferredQuery.trim() || activeFilterCount > 0);
  const matchingToggleLabel = allMatchingSelected
    ? (hasActiveSearchOrFilters ? "Deselect filtered" : "Deselect all")
    : (hasActiveSearchOrFilters ? "Select filtered" : "Select all");
  const compactMatchingToggleLabel = allMatchingSelected ? "Deselect" : (hasActiveSearchOrFilters ? "Select" : "Select all");
  const set = <K extends keyof StudyFilters>(key: K, value: StudyFilters[K]) => onChange({ ...filters, [key]: value });

  const toggleList = (listId: string) => {
    const addingList = !validSelectedListIds.includes(listId);
    const selectedListIds = toggleValue(validSelectedListIds, listId);
    if (isLessons) {
      onChange({ ...filters, selectedListIds });
      return;
    }
    const selectedSubjectIds = new Set(filters.selectedSubjectIds);
    if (addingList) lists.find((list) => list.id === listId)?.subjectIds.forEach((subjectId) => selectedSubjectIds.add(subjectId));
    onChange({ ...filters, selectedListIds, selectedSubjectIds: [...selectedSubjectIds] });
  };
  const toggleMatching = () => {
    const next = new Set(filters.selectedSubjectIds);
    matching.forEach(({ subject }) => {
      if (allMatchingSelected) next.delete(subject.id);
      else next.add(subject.id);
    });
    set("selectedSubjectIds", [...next]);
  };
  const resetFilters = () => {
    onChange({
      ...filters,
      subjectTypes: SUBJECT_TYPES.map((option) => option.value),
      selectedSrsStages: SRS_STAGES.map((option) => option.value),
      useCustomLevelRange: false,
      minLevel: 1,
      maxLevel: catalogMaxLevel,
      selectedListIds: [],
    });
  };

  return (
    <section className={styles.reviewPicker} aria-labelledby={pickerTitleId} data-picker-mode={mode}>
      <header className={styles.reviewPickerHeader}>
        <div>
          <h2 id={pickerTitleId}>Choose subjects</h2>
          <p role="status" aria-live="polite" aria-atomic="true">
            <strong>{selectedCount.toLocaleString()}</strong> selected · {matching.length.toLocaleString()} matching
          </p>
        </div>
        <button className={styles.primaryButton} type="button" disabled={starting || selectedCount === 0} onClick={onStart}>
          {starting ? "Preparing…" : isLessons ? "Start lessons" : "Start review"}
        </button>
      </header>

      <div className={styles.reviewPickerControls}>
        <div className={styles.searchField}>
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor={`${mode}-subject-search`}>Search subjects</label>
          <input id={`${mode}-subject-search`} ref={searchRef} name={`${mode}-subject-search`} autoComplete="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search characters, meanings, or readings" />
          {query ? (
            <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button
          ref={filterToggleRef}
          type="button"
          className={styles.reviewFilterToggle}
          data-active={activeFilterCount > 0}
          aria-expanded={showFilters}
          aria-controls={filterPanelId}
          aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
          onClick={() => setShowFilters((current) => !current)}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span>Filters</span>
          {activeFilterCount > 0 ? <strong aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</strong> : null}
        </button>
      </div>

      {showFilters ? (
        <section id={filterPanelId} className={styles.reviewFilterPanel} aria-label="Subject filters">
          <div className={styles.reviewFilterHeader}>
            <div>
              <h3>Filters</h3>
              <p>{isLessons ? "Narrow the subjects available for these lessons." : "Narrow the subjects available for this review."}</p>
            </div>
            {activeFilterCount > 0 ? (
              <button type="button" className={styles.textButton} onClick={() => { resetFilters(); filterToggleRef.current?.focus(); }}>
                Reset filters
              </button>
            ) : null}
          </div>
          <div className={styles.reviewFilterGrid}>
            <fieldset className={styles.reviewFilterGroup}>
              <legend>Subject types</legend>
              <div className={styles.reviewFilterOptions}>
                {SUBJECT_TYPES.map((option) => (
                  <label key={option.value} className={styles.checkOption} data-active={filters.subjectTypes.includes(option.value)}>
                    <input type="checkbox" checked={filters.subjectTypes.includes(option.value)} onChange={() => set("subjectTypes", toggleValue(filters.subjectTypes, option.value))} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.reviewFilterGroup}>
              <legend>Levels</legend>
              <div className={styles.reviewFilterOptions}>
                <button type="button" className={styles.optionButton} data-active={!filters.useCustomLevelRange} aria-pressed={!filters.useCustomLevelRange} onClick={() => set("useCustomLevelRange", false)}>
                  All levels
                </button>
                <button type="button" className={styles.optionButton} data-active={filters.useCustomLevelRange} aria-pressed={filters.useCustomLevelRange} onClick={() => set("useCustomLevelRange", true)}>
                  Custom range
                </button>
              </div>
              {filters.useCustomLevelRange ? (
                <div className={styles.levelFields}>
                  <label>
                    From <input name={`${mode}-min-level`} autoComplete="off" type="number" min={1} max={filters.maxLevel} value={filters.minLevel} onChange={(event) => set("minLevel", Math.max(1, Math.min(filters.maxLevel, Number(event.target.value))))} />
                  </label>
                  <span aria-hidden="true">—</span>
                  <label>
                    To <input name={`${mode}-max-level`} autoComplete="off" type="number" min={filters.minLevel} max={catalogMaxLevel} value={filters.maxLevel} onChange={(event) => set("maxLevel", Math.max(filters.minLevel, Math.min(catalogMaxLevel, Number(event.target.value))))} />
                  </label>
                </div>
              ) : <p className={styles.levelSummary}>Levels 1–{catalogMaxLevel}</p>}
            </fieldset>
            <fieldset className={styles.reviewFilterGroup} data-wide="true">
              <legend>SRS stages</legend>
              <div className={styles.reviewFilterOptions}>
                {SRS_STAGES.map((option) => (
                  <label key={option.value} className={styles.checkOption} data-active={filters.selectedSrsStages.includes(option.value)}>
                    <input type="checkbox" checked={filters.selectedSrsStages.includes(option.value)} onChange={() => set("selectedSrsStages", toggleValue(filters.selectedSrsStages, option.value))} />
                    {option.value > 0 ? <SrsStageIcon stage={option.value} size={18} /> : null}
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {lists.length ? (
              <fieldset className={styles.reviewFilterGroup} data-wide="true">
                <legend>Subject lists</legend>
                <p>{isLessons ? "Selected lists narrow the catalog. Your selection stays intact." : "Selecting a list adds its subjects to your selection."}</p>
                <div className={styles.reviewFilterOptions}>
                  {lists.map((list) => (
                    <button type="button" className={styles.optionButton} data-active={validSelectedListIds.includes(list.id)} aria-pressed={validSelectedListIds.includes(list.id)} key={list.id} onClick={() => toggleList(list.id)}>
                      <span className={styles.reviewListName}>{list.name}</span> <span>{list.subjectIds.length}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className={styles.reviewBulkBar}>
        <p id={resultHeadingId} className={styles.reviewResultCount}>
          {matching.length.toLocaleString()} {hasActiveSearchOrFilters ? "matching" : "available"} {matching.length === 1 ? "subject" : "subjects"}
        </p>
        <div className={styles.reviewBulkActions}>
          <button type="button" className={styles.textButton} aria-label={matchingToggleLabel} disabled={!matching.length} onClick={toggleMatching}>
            <span className={styles.reviewBulkActionLong}>{matchingToggleLabel}</span>
            <span className={styles.reviewBulkActionShort} aria-hidden="true">{compactMatchingToggleLabel}</span>
          </button>
          <button type="button" className={styles.textButton} aria-label="Clear selection" disabled={!filters.selectedSubjectIds.length} onClick={() => set("selectedSubjectIds", [])}>
            <span className={styles.reviewBulkActionLong}>Clear selection</span>
            <span className={styles.reviewBulkActionShort} aria-hidden="true">Clear</span>
          </button>
        </div>
      </div>

      {shown.length ? (
        <ul className={styles.reviewSubjectList} aria-labelledby={resultHeadingId}>
          {shown.map(({ subject, assignment }) => {
            const active = selectedSet.has(subject.id);
            const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
            const stage = assignment?.data.srs_stage ?? 0;
            const characterCount = Array.from(subject.data.characters ?? "◈").length;
            const accessibleIdentity = subject.data.characters ? `${subject.data.characters}, ${meaning}` : meaning;
            return (
              <li key={subject.id}>
                <button
                  type="button"
                  className={styles.reviewSubjectRow}
                  data-active={active}
                  data-type={subject.object}
                  aria-pressed={active}
                  aria-label={`Choose ${accessibleIdentity}, ${SUBJECT_TYPE_LABELS[subject.object]}, level ${subject.data.level}, ${stage ? srsStageLabel(stage) : "Locked"}`}
                  onClick={() => set("selectedSubjectIds", toggleValue(filters.selectedSubjectIds, subject.id))}
                >
                  <SubjectCharacter subject={subject} fallbackText="◈" imageSize="2rem" className={styles.reviewSubjectCharacter} imageTone={isLessons ? "subject" : "light"} data-character-count={Math.min(characterCount, 12)} />
                  <span className={styles.reviewSubjectCopy}>
                    <strong>{meaning}</strong>
                    <span className={styles.reviewSubjectMeta}>
                      {SUBJECT_TYPE_LABELS[subject.object]} · Level {subject.data.level}
                      <span className={styles.reviewSubjectInlineSrs}> · {stage ? srsStageLabel(stage) : "Locked"}</span>
                    </span>
                  </span>
                  <span className={styles.reviewSubjectSrs}>
                    {stage > 0 ? <SrsStageIcon stage={stage} size={18} /> : null}
                    <span>{stage ? srsStageLabel(stage) : "Locked"}</span>
                  </span>
                  <span className={styles.reviewSelectionIndicator} data-active={active} aria-hidden="true">
                    {active ? <Check size={17} strokeWidth={3} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.reviewPickerEmpty}>
          <strong>No subjects match</strong>
          <p>Change the search or filters to widen the list.</p>
        </div>
      )}
      {matching.length > 200 ? <p className={styles.reviewPickerHint}>Showing the first 200 matches. Bulk selection still includes all {matching.length.toLocaleString()}.</p> : null}
    </section>
  );
}

const LIST_ENABLED_MODES = new Set<StudyModeId>(["random-test", "vocab-reading", "hiragana-meaning", "similar-kanji", "kana-to-kanji", "listening", "context-sentences", "kanji-writing", "crossword", "kana-wordle", "custom-review", "custom-lessons"]);

function SettingGroup({ title, detail, children, layout = "row", accessibleTitle }: { title: string; detail?: string; children: ReactNode; layout?: "row" | "stacked"; accessibleTitle?: string }) {
  const titleId = useId();

  return (
    <section className={styles.settingGroup} data-layout={layout} role="group" aria-label={accessibleTitle} aria-labelledby={accessibleTitle ? undefined : titleId}>
      <div className={styles.settingCopy}>
        <h3 id={titleId}>{title}</h3>
        {detail ? <p>{detail}</p> : null}
      </div>
      <div className={styles.settingControl}>{children}</div>
    </section>
  );
}

export function StudyConfig({ mode, filters, subjects, assignments = [], lists, userLevel = filters.maxLevel, animeSyncUsernames, starting = false, onChange, onStart }: { mode: StudyModeId; filters: StudyFilters; subjects: Subject[]; assignments?: Assignment[]; lists: SubjectList[]; userLevel?: number; animeSyncUsernames?: { myanimelist?: string; anilist?: string }; starting?: boolean; onChange: (filters: StudyFilters) => void; onStart: () => void }) {
  const fixedTypes = fixedSubjectTypes(mode);
  const needsSelection = mode === "custom-review" || mode === "custom-lessons";
  const needsQuestionKind = mode === "random-test";
  const usesCount = mode !== "recent-lessons" && mode !== "crossword" && mode !== "kana-wordle" && mode !== "custom-review" && mode !== "custom-lessons";
  const countLabel = mode === "kanji-writing" ? "kanji" : mode === "similar-kanji" ? "rounds" : "questions";
  const countMaximum = mode === "listening" ? 20 : mode === "context-sentences" || mode === "kanji-writing" ? 50 : 100;
  const usesStandardFilters = mode !== "recent-lessons";
  const hasRequiredAnime = mode !== "listening" || hasSelectedAnime(filters.animeSources);
  const hasCoreFilters = mode === "recent-lessons" || needsSelection || (filters.srsGroups.length > 0 && filters.subjectTypes.length > 0);
  const canStart = !starting && hasCoreFilters && hasRequiredAnime && (!needsSelection || filters.selectedSubjectIds.length > 0) && (!needsQuestionKind || filters.questionKinds.length > 0);
  const set = <K extends keyof StudyFilters>(key: K, value: StudyFilters[K]) => onChange({ ...filters, [key]: value });

  if (mode === "custom-review" || mode === "custom-lessons") {
    return <CustomSubjectPicker mode={mode} subjects={subjects} assignments={assignments} lists={lists} filters={filters} userLevel={userLevel} starting={starting} onChange={onChange} onStart={onStart} />;
  }

  return (
    <div className={styles.configLayout}>
      <form
        className={styles.configPanel}
        onSubmit={(event) => {
          event.preventDefault();
          if (canStart) onStart();
        }}
      >
        <div className={styles.configTitleRow}>
          <div className={styles.configTitleHeading}>
            <SlidersHorizontal size={19} aria-hidden="true" />
            <h2>Session setup</h2>
          </div>
          {usesCount ? (
            <output className={styles.countOutput} aria-label={`${filters.count} ${countLabel}`}>
              <strong>{filters.count}</strong>
              <span>{countLabel}</span>
            </output>
          ) : null}
        </div>

        {mode === "random-test" ? (
          <SettingGroup title="Question types" detail="Choose which recall directions to include.">
            <div className={styles.optionRow}>
              {(["meaning", "reading"] as const).map((kind) => (
                <label key={kind} className={styles.checkOption} data-active={filters.questionKinds.includes(kind)}>
                  <input type="checkbox" checked={filters.questionKinds.includes(kind)} onChange={() => set("questionKinds", toggleValue(filters.questionKinds, kind))} />
                  <span>{kind[0].toUpperCase() + kind.slice(1)}</span>
                </label>
              ))}
            </div>
          </SettingGroup>
        ) : null}
        {usesCount ? (
          <SettingGroup title="Session length" detail={`Set how many ${countLabel} to prepare.`} accessibleTitle="Session length settings">
            <label className={styles.rangeLabel}>
              <span className="sr-only">Session length</span>
              <input type="range" min={5} max={countMaximum} step={5} value={Math.min(filters.count, countMaximum)} onChange={(event) => set("count", Number(event.target.value))} />
            </label>
          </SettingGroup>
        ) : null}

        {mode === "recent-lessons" ? (
          <SettingGroup title="Recent lesson window" detail="Limit practice to newly unlocked items.">
            <div className={styles.optionRow}>
              {(
                [
                  ["apprentice", "All Apprentice"],
                  ["24h", "24 hours"],
                  ["7d", "7 days"],
                  ["30d", "30 days"],
                ] as const
              ).map(([value, label]) => (
                <button type="button" className={styles.optionButton} data-active={filters.recentWindow === value} key={value} onClick={() => set("recentWindow", value)}>
                  {label}
                </button>
              ))}
            </div>
          </SettingGroup>
        ) : null}

        {mode === "listening" || mode === "context-sentences" ? (
          <SettingGroup title="Answer mode" detail="Choose how you want to respond.">
            <div className={styles.optionRow}>
              {(
                [
                  ["multiple-choice", "Multiple choice"],
                  ["typed", "Type answer"],
                ] as const
              ).map(([value, label]) => (
                <button type="button" className={styles.optionButton} data-active={filters.answerMode === value} key={value} onClick={() => set("answerMode", value)}>
                  {label}
                </button>
              ))}
            </div>
          </SettingGroup>
        ) : null}

        {mode === "listening" ? (
          <>
            <SettingGroup title="Anime sources" detail="Use examples from the shows you choose." layout="stacked">
              <AnimePicker selectedSources={filters.animeSources} onChange={(sources) => set("animeSources", sources)} syncUsernames={animeSyncUsernames} />
            </SettingGroup>
            <SettingGroup title="Playback" detail="Start the clip as soon as a question opens.">
              <label className={styles.checkOption} data-active={filters.listeningAutoPlayAudio}>
                <input type="checkbox" checked={filters.listeningAutoPlayAudio} onChange={() => set("listeningAutoPlayAudio", !filters.listeningAutoPlayAudio)} />
                <span>Auto-play audio</span>
              </label>
            </SettingGroup>
          </>
        ) : null}

        {mode === "context-sentences" ? (
          <SettingGroup title="Question behavior" detail="Control audio, translations, and answer flow." layout="stacked">
            <div className={styles.optionRow}>
              <label className={styles.checkOption} data-active={filters.contextSentenceAudio}>
                <input type="checkbox" checked={filters.contextSentenceAudio} onChange={() => set("contextSentenceAudio", !filters.contextSentenceAudio)} />
                <span>Sentence audio (TTS)</span>
              </label>
              <label className={styles.checkOption} data-active={filters.contextSentenceAudio && filters.contextAutoPlaySentenceAudio}>
                <input type="checkbox" checked={filters.contextAutoPlaySentenceAudio} disabled={!filters.contextSentenceAudio} onChange={() => set("contextAutoPlaySentenceAudio", !filters.contextAutoPlaySentenceAudio)} />
                <span>Auto-play sentence audio</span>
              </label>
              <label className={styles.checkOption} data-active={filters.contextHideTranslation}>
                <input type="checkbox" checked={filters.contextHideTranslation} onChange={() => set("contextHideTranslation", !filters.contextHideTranslation)} />
                <span>Hide translation until tap</span>
              </label>
              <label className={styles.checkOption} data-active={filters.contextSentenceBreakdown}>
                <input type="checkbox" checked={filters.contextSentenceBreakdown} onChange={() => set("contextSentenceBreakdown", !filters.contextSentenceBreakdown)} />
                <span>JPDB-style sentence breakdown</span>
              </label>
              <label className={styles.checkOption} data-active={filters.contextStopAfterAnswer}>
                <input type="checkbox" checked={filters.contextStopAfterAnswer} onChange={() => set("contextStopAfterAnswer", !filters.contextStopAfterAnswer)} />
                <span>Stop after answer</span>
              </label>
            </div>
          </SettingGroup>
        ) : null}

        {mode === "kanji-writing" ? (
          <>
            <SettingGroup title="Practice mode" detail="Choose guided strokes or free recall.">
              <div className={styles.optionRow}>
                <button type="button" className={styles.optionButton} data-active={filters.writingMode === "guided"} onClick={() => set("writingMode", "guided")}>
                  Guided stroke order
                </button>
                <button type="button" className={styles.optionButton} data-active={filters.writingMode === "freehand"} onClick={() => set("writingMode", "freehand")}>
                  Freehand recall
                </button>
              </div>
            </SettingGroup>
            <SettingGroup title="Stroke strictness" detail="Tolerance for stroke accuracy.">
              <div className={styles.optionRow}>
                {STROKE_LENIENCY_PRESETS.map((preset) => {
                  const active = activeStrokeLeniencyPreset(filters.strokeLeniency).value === preset.value;
                  return (
                    <button
                      type="button"
                      className={styles.optionButton}
                      data-active={active}
                      aria-pressed={active}
                      key={preset.value}
                      onClick={() => set("strokeLeniency", preset.value)}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </SettingGroup>
          </>
        ) : null}

        {mode === "kana-wordle" ? (
          <>
            <SettingGroup title="Word length" detail="Set the kana length for each puzzle.">
              <div className={styles.optionRow}>
                {[3, 4, 5, 6, 7].map((length) => (
                  <button type="button" className={styles.optionButton} data-active={filters.wordLength === length} key={length} onClick={() => set("wordLength", length)}>
                    {length} kana
                  </button>
                ))}
              </div>
            </SettingGroup>
            <SettingGroup title={`Maximum attempts: ${filters.wordleMaxAttempts}`} detail="Choose how many guesses are available.">
              <label className={styles.rangeLabel}>
                <span className="sr-only">Maximum attempts</span>
                <input type="range" min={4} max={8} step={1} value={filters.wordleMaxAttempts} onChange={(event) => set("wordleMaxAttempts", Number(event.target.value))} />
              </label>
            </SettingGroup>
          </>
        ) : null}

        {mode === "similar-kanji" ? (
          <>
            <SettingGroup title="Similarity source" detail="Choose which visual-matching dataset to use.">
              <div className={styles.optionRow}>
                <button type="button" className={styles.optionButton} data-active={filters.similarKanjiSource === "niai"} onClick={() => set("similarKanjiSource", "niai")}>
                  Niai
                </button>
                <button type="button" className={styles.optionButton} data-active={filters.similarKanjiSource === "wanikani"} onClick={() => set("similarKanjiSource", "wanikani")}>
                  WaniKani
                </button>
              </div>
            </SettingGroup>
            <SettingGroup title={`Kanji per round: ${filters.similarKanjiGroupSize}`} detail="Set the size of each comparison group.">
              <label className={styles.rangeLabel}>
                <span className="sr-only">Kanji per round</span>
                <input type="range" min={2} max={6} step={1} value={filters.similarKanjiGroupSize} onChange={(event) => set("similarKanjiGroupSize", Number(event.target.value))} />
              </label>
            </SettingGroup>
            <SettingGroup title="Question pool" detail="Exclude similar kanji you have not learned.">
              <label className={styles.checkOption} data-active={filters.similarKanjiOnlyLearned}>
                <input type="checkbox" checked={filters.similarKanjiOnlyLearned} onChange={() => set("similarKanjiOnlyLearned", !filters.similarKanjiOnlyLearned)} />
                <span>Only use learned similar kanji</span>
              </label>
            </SettingGroup>
          </>
        ) : null}

        {mode === "crossword" ? (
          <>
            <SettingGroup title="Crossword size" detail="Choose the board dimensions and starting word count.">
              <div className={styles.optionRow}>
                {Object.entries(CROSSWORD_SIZE_PRESETS).map(([size, preset]) => (
                  <button
                    type="button"
                    className={styles.optionButton}
                    data-active={filters.crosswordSize === size}
                    key={size}
                    onClick={() =>
                      onChange({
                        ...filters,
                        crosswordSize: size as StudyFilters["crosswordSize"],
                        crosswordMaxWords: preset.defaultMaxWords,
                      })
                    }
                  >
                    <strong>{preset.label}</strong>{" "}
                    <span>
                      {preset.gridSize}×{preset.gridSize}
                    </span>
                  </button>
                ))}
              </div>
            </SettingGroup>
            <SettingGroup title={`Number of words: ${filters.crosswordMaxWords}`} detail="Adjust the density of the selected board.">
              <label className={styles.rangeLabel}>
                <span className="sr-only">Number of words</span>
                <input type="range" min={CROSSWORD_SIZE_PRESETS[filters.crosswordSize].minWords} max={CROSSWORD_SIZE_PRESETS[filters.crosswordSize].maxWords} step={1} value={filters.crosswordMaxWords} onChange={(event) => set("crosswordMaxWords", Number(event.target.value))} />
              </label>
            </SettingGroup>
            <SettingGroup title="Estimated JLPT" detail="Include vocabulary from one or more levels.">
              <div className={styles.optionRow}>
                {JLPT_LEVELS.map((level) => (
                  <label key={level} className={styles.checkOption} data-active={filters.crosswordJlptLevels.includes(level)}>
                    <input type="checkbox" checked={filters.crosswordJlptLevels.includes(level)} onChange={() => set("crosswordJlptLevels", toggleValue(filters.crosswordJlptLevels, level))} />
                    <span>{level}</span>
                  </label>
                ))}
              </div>
            </SettingGroup>
            <SettingGroup title="Vocabulary" detail="Limit the board to words written only in hiragana.">
              <label className={styles.checkOption} data-active={filters.crosswordHiraganaOnly}>
                <input type="checkbox" checked={filters.crosswordHiraganaOnly} onChange={() => set("crosswordHiraganaOnly", !filters.crosswordHiraganaOnly)} />
                <span>Hiragana-only words</span>
              </label>
            </SettingGroup>
            <SettingGroup title="Clue language" detail="Choose what each crossword clue reveals.">
              <div className={styles.optionRow}>
                {(
                  [
                    ["english", "English"],
                    ["kanji", "Kanji"],
                    ["english_kanji", "English + Kanji"],
                  ] as const
                ).map(([value, label]) => (
                  <button type="button" className={styles.optionButton} data-active={filters.crosswordClueMode === value} key={value} onClick={() => set("crosswordClueMode", value)}>
                    {label}
                  </button>
                ))}
              </div>
            </SettingGroup>
            <SettingGroup title="Solutions" detail="Control answer reveals and feedback.">
              <div className={styles.optionRow}>
                <label className={styles.checkOption} data-active={filters.crosswordShowKanjiSolutions}>
                  <input type="checkbox" checked={filters.crosswordShowKanjiSolutions} onChange={() => set("crosswordShowKanjiSolutions", !filters.crosswordShowKanjiSolutions)} />
                  <span>Show kanji before readings in solutions</span>
                </label>
                <label className={styles.checkOption} data-active={filters.crosswordPlayAudioOnCorrect}>
                  <input type="checkbox" checked={filters.crosswordPlayAudioOnCorrect} onChange={() => set("crosswordPlayAudioOnCorrect", !filters.crosswordPlayAudioOnCorrect)} />
                  <span>Play audio on correct answers</span>
                </label>
              </div>
            </SettingGroup>
          </>
        ) : null}

        {!fixedTypes && usesStandardFilters ? (
          <SettingGroup title="Subject types" detail="Choose which kinds of WaniKani items can appear.">
            <div className={styles.optionRow}>
              {subjectTypeOptions(mode).map((option) => (
                <label key={option.value} className={styles.checkOption} data-active={filters.subjectTypes.includes(option.value)}>
                  <input type="checkbox" checked={filters.subjectTypes.includes(option.value)} onChange={() => set("subjectTypes", toggleValue(filters.subjectTypes, option.value))} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </SettingGroup>
        ) : null}

        {usesStandardFilters && !needsSelection ? (
          <SettingGroup title="SRS stages" detail="Include items from the stages you want to practise.">
            <div className={styles.optionRow}>
              {SRS_GROUPS.map((option) => (
                <label key={option.value} className={styles.checkOption} data-active={filters.srsGroups.includes(option.value)}>
                  <input type="checkbox" checked={filters.srsGroups.includes(option.value)} onChange={() => set("srsGroups", toggleValue(filters.srsGroups, option.value))} />
                  <SrsStageIcon level={option.label} size={19} />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </SettingGroup>
        ) : null}
        {needsSelection ? (
          <SettingGroup title="SRS stages" detail="Filter the subjects available for selection." layout="stacked">
            <div className={styles.optionRow}>
              {SRS_STAGES.map((option) => (
                <label key={option.value} className={styles.checkOption} data-active={filters.selectedSrsStages.includes(option.value)}>
                  <input type="checkbox" checked={filters.selectedSrsStages.includes(option.value)} onChange={() => set("selectedSrsStages", toggleValue(filters.selectedSrsStages, option.value))} />
                  {option.value > 0 ? <SrsStageIcon stage={option.value} size={19} /> : null}
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </SettingGroup>
        ) : null}

        {usesStandardFilters ? (
          <SettingGroup title="Levels" detail="Use your current range or set a narrower one.">
            <div className={styles.levelControl}>
              <label className={styles.checkOption} data-active={filters.useCustomLevelRange}>
                <input type="checkbox" checked={filters.useCustomLevelRange} onChange={() => set("useCustomLevelRange", !filters.useCustomLevelRange)} />
                <span>Use custom level range</span>
              </label>
              {filters.useCustomLevelRange ? (
                <div className={styles.levelFields}>
                  <label>
                    From <input type="number" min={1} max={filters.maxLevel} value={filters.minLevel} onChange={(event) => set("minLevel", Math.max(1, Math.min(filters.maxLevel, Number(event.target.value))))} />
                  </label>
                  <span aria-hidden="true">—</span>
                  <label>
                    To <input type="number" min={filters.minLevel} max={60} value={filters.maxLevel} onChange={(event) => set("maxLevel", Math.max(filters.minLevel, Math.min(60, Number(event.target.value))))} />
                  </label>
                </div>
              ) : (
                <p className={styles.levelSummary}>Levels 1–{filters.maxLevel}</p>
              )}
            </div>
          </SettingGroup>
        ) : null}

        {LIST_ENABLED_MODES.has(mode) && lists.length ? (
          <SettingGroup title="Use subject lists" detail="Narrow the session to items from a saved list." layout="stacked">
            <div className={styles.optionRow}>
              {lists.map((list) => (
                <button
                  type="button"
                  className={styles.optionButton}
                  data-active={filters.selectedListIds.includes(list.id)}
                  key={list.id}
                  onClick={() => {
                    const selectedListIds = toggleValue(filters.selectedListIds, list.id);
                    const selectedLists = lists.filter((candidate) => selectedListIds.includes(candidate.id));
                    onChange({
                      ...filters,
                      selectedListIds,
                      selectedSubjectIds: [...new Set(selectedLists.flatMap((candidate) => candidate.subjectIds))],
                    });
                  }}
                >
                  {list.name} <span>{list.subjectIds.length}</span>
                </button>
              ))}
              {filters.selectedListIds.length > 0 && !needsSelection ? (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() =>
                    onChange({
                      ...filters,
                      selectedListIds: [],
                      selectedSubjectIds: [],
                    })
                  }
                >
                  Clear list filter
                </button>
              ) : null}
            </div>
          </SettingGroup>
        ) : null}

        <div className={styles.configSubmit}>
          <button className={styles.primaryButton} type="submit" disabled={!canStart}>
            {starting ? "Preparing…" : "Start session"}
          </button>
          <p className={styles.formMessage} role="status">
            {canStart || starting ? "" : needsSelection ? "Choose at least one eligible subject." : !hasRequiredAnime ? "Choose at least one anime source." : "Choose at least one subject type, question type, and SRS stage."}
          </p>
        </div>
      </form>
    </div>
  );
}
