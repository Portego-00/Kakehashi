"use client";
import type { KeyboardEvent } from "react";
import type { WebStudyPreferences } from "../settings";
import { SettingsIcon, SettingsIllustration } from "./settings-artwork";
import type { SettingsIllustrationName } from "../../../../../src/ui/settings/artwork";
import { isReviewModeSketch } from "../../../../../src/ui/settings/review-mode-sketch";
import styles from "../settings.module.css";
type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
  art: SettingsIllustrationName;
};
export function SettingsChoices<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  function key(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (index + direction + options.length) % options.length;
    onChange(options[next].value);
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        "button",
      );
    buttons?.[next]?.focus({ preventScroll: true });
  }
  return (
    <div
      className={`${styles.choiceField} ${compact ? styles.compactChoices : ""}`}
      data-settings-search={label}
      data-search-keywords={options.map((option) => `${option.label} ${option.description ?? ""}`).join(" ")}
    >
      <h3>{label}</h3>
      <div
        className={styles.choiceCards}
        role="radiogroup"
        aria-label={label}
        data-review-modes={
          options.every((option) => isReviewModeSketch(option.art)) || undefined
        }
        data-choice-count={options.length}
      >
        {options.map((o, i) => (
          <button
            type="button"
            role="radio"
            aria-label={o.label}
            aria-checked={value === o.value}
            tabIndex={value === o.value ? 0 : -1}
            className={styles.choiceCard}
            key={o.value}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => key(e, i)}
          >
            <SettingsIllustration name={o.art} className={styles.choiceArt} />
            <span>
              <strong>{o.label}</strong>
              {o.description ? <small>{o.description}</small> : null}
            </span>
            {value === o.value ? (
              <SettingsIcon
                name="check"
                size={18}
                className={styles.choiceCheck}
              />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
export function ReviewAnswerModeCards({
  study,
  onChange,
}: {
  study: WebStudyPreferences;
  onChange: (patch: Partial<WebStudyPreferences>) => void;
}) {
  const mode =
    study.ankiMode !== "off"
      ? "anki"
      : study.reviewMultipleChoiceEnabled
        ? "choice"
        : "type";
  return (
    <div className={styles.answerModeWorkspace}>
      <SettingsChoices
        label="Answer mode"
        value={mode}
        options={[
          {
            value: "type",
            label: "Type answers",
            description: "Recall and type",
            art: "type",
          },
          {
            value: "choice",
            label: "Multiple choice",
            description: "Pick the answer",
            art: "choice",
          },
          {
            value: "anki",
            label: "Anki cards",
            description: "Reveal and grade",
            art: "cards",
          },
        ]}
        onChange={(next) =>
          onChange(
            next === "anki"
              ? { ankiMode: study.ankiMode === "off" ? "both" : study.ankiMode }
              : {
                  ankiMode: "off",
                  ankiGroupQuestions: false,
                  reviewMultipleChoiceEnabled: next === "choice",
                },
          )
        }
      />
      {mode === "anki" ? (
        <>
          <SettingsChoices
            label="Anki applies to"
            compact
            value={study.ankiMode}
            options={[
              { value: "both", label: "Both", art: "both" },
              { value: "meaning", label: "Meanings", art: "meaning" },
              { value: "reading", label: "Readings", art: "reading" },
            ]}
            onChange={(next) =>
              onChange({
                ankiMode: next,
                ankiGroupQuestions:
                  next === "both" ? study.ankiGroupQuestions : false,
              })
            }
          />
          {study.ankiMode !== "both" ? (
            <SettingsChoices
              label="Other questions use"
              compact
              value={study.reviewMultipleChoiceEnabled ? "choice" : "type"}
              options={[
                { value: "type", label: "Type answers", art: "type" },
                { value: "choice", label: "Multiple choice", art: "choice" },
              ]}
              onChange={(next) =>
                onChange({ reviewMultipleChoiceEnabled: next === "choice" })
              }
            />
          ) : null}
          <p className={styles.modeExplanation}>
            Anki questions keep their reveal-and-grade behaviour. Other
            questions use your selected input mode.
          </p>
        </>
      ) : null}
    </div>
  );
}
