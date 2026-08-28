"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, type ComponentType } from "react";
import { ArrowRight, BookOpen, Brush, Dices, ListChecks, Repeat2, X } from "lucide-react";
import type { Subject } from "@/types/wanikani";
import type { StudyModeId } from "@/features/study/types";
import styles from "../subjects.module.css";

type StudyChoice = {
  id: string;
  mode: StudyModeId;
  title: string;
  description: string;
  icon: ComponentType<{ size?: string | number; "aria-hidden"?: boolean }>;
  count: number;
  disabledReason?: string;
};

function studyHref(mode: StudyModeId, subjectIds: number[]) {
  return `/study/${mode}?subjectIds=${subjectIds.join(",")}&start=1`;
}

export function ListStudyDialog({
  open,
  listName,
  subjectIds,
  subjects,
  onClose,
}: {
  open: boolean;
  listName: string;
  subjectIds: number[];
  subjects: Subject[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstActionRef = useRef<HTMLAnchorElement>(null);
  const selectedSubjects = useMemo(() => {
    const selected = new Set(subjectIds);
    return subjects.filter((subject) => selected.has(subject.id));
  }, [subjectIds, subjects]);
  const kanjiCount = selectedSubjects.filter((subject) => subject.object === "kanji").length;
  const choices: StudyChoice[] = [
    {
      id: "review",
      mode: "custom-review",
      title: "Standard review",
      description: "Meaning and reading questions for every subject in the list.",
      icon: ListChecks,
      count: subjectIds.length,
    },
    {
      id: "kanji-match",
      mode: "similar-kanji",
      title: "Kanji match",
      description: "Connect the list’s kanji to their meanings.",
      icon: Repeat2,
      count: kanjiCount,
      disabledReason: kanjiCount < 2 ? "Add at least 2 kanji to use this mode." : undefined,
    },
    {
      id: "lessons",
      mode: "custom-lessons",
      title: "Custom lessons",
      description: "Revisit the lesson content for each subject in order.",
      icon: BookOpen,
      count: subjectIds.length,
    },
    {
      id: "random-test",
      mode: "random-test",
      title: "Random test",
      description: "Mix meaning and reading prompts from this list.",
      icon: Dices,
      count: subjectIds.length,
    },
    {
      id: "kanji-writing",
      mode: "kanji-writing",
      title: "Kanji writing",
      description: "Practice writing the kanji saved in this list.",
      icon: Brush,
      count: kanjiCount,
      disabledReason: kanjiCount < 1 ? "Add at least 1 kanji to use this mode." : undefined,
    },
  ];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      firstActionRef.current?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return <dialog
    ref={dialogRef}
    className={styles.listStudyDialog}
    aria-labelledby="list-study-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <header className={styles.listStudyHeader}>
      <div>
        <h2 id="list-study-title">Choose study mode</h2>
        <p>{subjectIds.length} {subjectIds.length === 1 ? "subject" : "subjects"} in {listName}</p>
      </div>
      <button type="button" aria-label="Close study mode picker" onClick={onClose}><X size={19} aria-hidden /></button>
    </header>
    <div className={styles.listStudyChoices}>
      {choices.map((choice, index) => {
        const Icon = choice.icon;
        const content = <>
          <span className={styles.listStudyIcon} data-mode={choice.id}><Icon size={20} aria-hidden /></span>
          <span className={styles.listStudyCopy}>
            <span><strong>{choice.title}</strong><small>{choice.count}</small></span>
            <span>{choice.description}</span>
            {choice.disabledReason ? <em>{choice.disabledReason}</em> : null}
          </span>
          <ArrowRight className={styles.listStudyArrow} size={18} aria-hidden />
        </>;
        return choice.disabledReason
          ? <button key={choice.id} type="button" className={styles.listStudyChoice} disabled>{content}</button>
          : <Link
              key={choice.id}
              ref={index === 0 ? firstActionRef : undefined}
              className={styles.listStudyChoice}
              href={studyHref(choice.mode, subjectIds)}
              onClick={onClose}
            >
              {content}
            </Link>;
      })}
    </div>
    <p className={styles.listStudyNote}>Your session starts immediately. You can return to the mode setup after finishing.</p>
  </dialog>;
}
