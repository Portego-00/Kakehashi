import {
  createStudyDateFilter,
  localStudyDate,
  parseStudyDate,
  studyDateRange,
  type StudyDateFilter,
} from "../../../../../src/utils/studyDateFilter";
import styles from "../study.module.css";

export function StudyDateFilterControl({ value, onChange }: {
  value?: StudyDateFilter | null;
  onChange: (value: StudyDateFilter | null) => void;
}) {
  const range = studyDateRange(value ?? createStudyDateFilter("started_at"));
  const today = localStudyDate(new Date());

  return <fieldset className={styles.reviewFilterGroup} data-wide="true">
    <legend>Date</legend>
    <div className={styles.reviewFilterOptions}>
      {([
        { field: null, label: "Any date" },
        { field: "started_at", label: "Lesson completed" },
        { field: "unlocked_at", label: "Unlocked" },
      ] as const).map(({ field, label }) => <button
        key={label}
        type="button"
        className={styles.optionButton}
        data-active={(value?.field ?? null) === field}
        aria-pressed={(value?.field ?? null) === field}
        onClick={() => onChange(field ? { ...range, field } : null)}
      >{label}</button>)}
    </div>
    {value ? <div className={styles.studyDateFields}>
      <label>Start<input
        aria-label="Start date"
        type="date"
        value={range.from}
        max={today}
        onInput={(event) => {
          const from = event.currentTarget.value;
          if (parseStudyDate(from) && from <= today) {
            onChange({ ...range, from, to: from > range.to ? from : range.to });
          }
        }}
      /></label>
      <label>End<input
        aria-label="End date"
        type="date"
        value={range.to}
        max={today}
        onInput={(event) => {
          const to = event.currentTarget.value;
          if (parseStudyDate(to) && to <= today) {
            onChange({ ...range, to, from: to < range.from ? to : range.from });
          }
        }}
      /></label>
    </div> : null}
  </fieldset>;
}
