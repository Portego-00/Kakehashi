"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useSyncExternalStore } from "react";
import { STUDY_MODES, type StudyModeGroup } from "../catalog";
import { sessionKey } from "../storage";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import styles from "../study.module.css";

const GROUPS: StudyModeGroup[] = ["Quick practice", "Language skills", "Games & tools", "Your library"];
const noopSubscribe = () => () => {};

function ResumeFlag({ mode, scope }: { mode: (typeof STUDY_MODES)[number]; scope: string | number }) {
  const saved = useSyncExternalStore(noopSubscribe, () => window.localStorage.getItem(sessionKey(scope, mode.id)), () => null);
  if (!mode.resumable || !saved) return null;
  try {
    if (JSON.parse(saved)?.complete) return null;
  } catch {
    return null;
  }
  return <span className={styles.resumeFlag}><RotateCcw size={13} /> Resume</span>;
}

export function StudyHub() {
  const { user } = useSession();
  const scope = waniKaniUserId(user) || "anonymous";
  return (
    <main className={`page ${styles.studyPage}`}>
      <header className={`page-header ${styles.hubHeader}`}>
        <div>
          <h1>Extra study</h1>
          <p>Short drills, focused practice, and language games built from your WaniKani subjects.</p>
        </div>
        <div className={styles.shortcutNote}><kbd>1–4</kbd> choose <kbd>Enter</kbd> continue</div>
      </header>

      <nav aria-label="Study modes" className={styles.catalog}>
        {GROUPS.map((group) => (
          <section key={group} className={styles.catalogGroup} aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`}>{group}</h2>
            <div className={styles.modeGrid}>
              {STUDY_MODES.filter((mode) => mode.group === group).map((mode) => {
                const Icon = mode.icon;
                return (
                  <Link key={mode.id} href={`/study/${mode.id}`} className={styles.modeCard} data-accent={mode.accent}>
                    <span className={styles.modeIcon} aria-hidden="true"><Icon size={21} strokeWidth={1.8} /></span>
                    <span className={styles.modeCopy}>
                      <strong>{mode.title}</strong>
                      <span>{mode.description}</span>
                    </span>
                    <ResumeFlag mode={mode} scope={scope} />
                    <ArrowRight className={styles.modeArrow} size={18} aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </main>
  );
}
