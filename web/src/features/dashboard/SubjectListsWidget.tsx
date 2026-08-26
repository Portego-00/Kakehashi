"use client";

import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import type { SubjectList } from "@/features/subjects/lists";
import type { Subject } from "@/types/wanikani";
import styles from "./dashboard.module.css";

const SUBJECTS_PER_LIST_PREVIEW = 4;

function subjectPreviewLabel(subject?: Subject) {
  const characters = subject?.data.characters?.trim();
  if (characters) return characters;
  const meaning = subject?.data.meanings.find((item) => item.primary)?.meaning ?? subject?.data.meanings[0]?.meaning;
  return meaning ? meaning.slice(0, 2).toLocaleUpperCase() : "•";
}

function subjectPreviewType(subject?: Subject) {
  return subject?.object === "kana_vocabulary" ? "vocabulary" : subject?.object;
}

export function SubjectListsWidget({
  lists,
  subjects,
  syncing,
  syncError,
}: {
  lists: SubjectList[];
  subjects: Subject[];
  syncing: boolean;
  syncError: string;
}) {
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const totalSubjects = lists.reduce((sum, list) => sum + list.subjectIds.length, 0);

  return <section className={`${styles.section} ${styles.subjectListsWidget}`}>
    <div className={styles.widgetHeader}>
      <div><h2>Subject lists</h2><p>{syncError ? "Saved locally; account sync is temporarily unavailable" : "Synced with your Kakehashi mobile app"}</p></div>
      <ButtonLink aria-label="Manage subject lists" className={styles.subjectListsAction} href="/lists" title="Manage subject lists" tone="ghost" size="small"><ArrowRight size={18} aria-hidden /></ButtonLink>
    </div>
    {syncing && !lists.length ? <Skeleton height="4rem" /> : <>
      <dl className={styles.summaryList}>
        <div><dt>Lists</dt><dd>{lists.length}</dd></div>
        <div><dt>Saved subjects</dt><dd>{totalSubjects}</dd></div>
      </dl>
      {lists.length ? <div className={styles.subjectListsPreviewViewport} aria-hidden="true">
        <ul className={styles.subjectListsPreviewList}>
          {lists.map((list) => {
            const previewIds = list.subjectIds.slice(0, SUBJECTS_PER_LIST_PREVIEW);
            const remaining = Math.max(0, list.subjectIds.length - previewIds.length);
            return <li className={styles.subjectListsPreviewRow} key={list.id}>
              <span className={styles.subjectListsPreviewCopy}>
                <strong>{list.name}</strong>
                <small>{list.subjectIds.length} {list.subjectIds.length === 1 ? "subject" : "subjects"}</small>
              </span>
              <span className={styles.subjectListsPreviewChips}>
                {previewIds.map((subjectId, index) => {
                  const subject = subjectById.get(subjectId);
                  const label = subjectPreviewLabel(subject);
                  return <span
                    className={styles.subjectListsPreviewChip}
                    data-long={Array.from(label).length > 2 || undefined}
                    data-subject-type={subjectPreviewType(subject)}
                    key={`${subjectId}-${index}`}
                    lang={subject?.data.characters ? "ja" : undefined}
                  >{label}</span>;
                })}
                {remaining ? <span className={styles.subjectListsPreviewMore}>+{remaining}</span> : null}
              </span>
            </li>;
          })}
        </ul>
      </div> : null}
    </>}
  </section>;
}
