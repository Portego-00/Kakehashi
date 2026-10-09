import { Check, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef } from "react";
import type { ReviewAnswerChoice } from "../../../../src/utils/review-multiple-choice";
import styles from "./review-answer-choices.module.css";

export function ReviewAnswerChoices({ choices, selectedAnswer, disabled, isReading, onSelect, keyboardShortcuts, onContinue, continueKey = "Enter" }: {
  choices: readonly ReviewAnswerChoice[];
  selectedAnswer?: string;
  disabled: boolean;
  isReading: boolean;
  keyboardShortcuts: boolean;
  onSelect: (choice: ReviewAnswerChoice) => void;
  onContinue?: () => void;
  continueKey?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (!keyboardShortcuts || event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || document.querySelector('dialog[open], [role="dialog"], [role="menu"]')) return;
    if (event.target instanceof Element) {
      if (event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (event.target.closest('button, a, audio, video') && !root.current?.contains(event.target)) return;
    }
    if (!disabled && /^[1-4]$/.test(event.key)) {
      const choice = choices[Number(event.key) - 1];
      if (choice) { event.preventDefault(); event.stopPropagation(); onSelect(choice); }
    } else if (onContinue && selectedAnswer !== undefined && event.key.toLowerCase() === continueKey.toLowerCase()) {
      event.preventDefault(); event.stopPropagation(); onContinue();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKey(event);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, []);
  return <div ref={root} className={styles.choices} role="group" aria-label="Answer choices">
    {choices.map((choice, index) => {
      const selected = selectedAnswer === choice.text;
      const correct = selectedAnswer !== undefined && choice.isCorrect;
      const incorrect = selected && !choice.isCorrect;
      return <button key={choice.text} type="button" data-review-choice
        className={styles.choice} data-selected={selected} data-correct={correct || undefined} data-incorrect={incorrect || undefined}
        aria-pressed={selected} aria-label={`${index + 1}. ${choice.text}${correct ? ". Correct answer" : incorrect ? ". Incorrect answer" : ""}`}
        disabled={disabled} onClick={() => onSelect(choice)}>
        {keyboardShortcuts ? <kbd>{index + 1}</kbd> : <span className={styles.number}>{index + 1}</span>}
        <span lang={isReading ? "ja" : undefined}>{choice.text}</span>
        <span className={styles.result} aria-hidden>{correct ? <Check size={19} /> : incorrect ? <X size={19} /> : null}</span>
      </button>;
    })}
  </div>;
}
