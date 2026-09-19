import { Skeleton } from "@/components/ui/States";
import picker from "./lesson-picker.module.css";
import study from "./core-study.module.css";
import styles from "./lesson-loading.module.css";

export function LessonLoading({ picking = false }: { picking?: boolean }) {
  return <div role="status" aria-busy="true" aria-label={picking ? "Loading lesson picker" : "Loading lessons"}>
    <span className="sr-only">{picking ? "Loading available lessons" : "Loading your lesson batch"}</span>
    {picking ? <div className={picker.picker} aria-hidden="true">
      <header className={picker.header}>
        <div className={picker.heading}><h1>Pick lessons</h1><Skeleton width="4rem" height="1.5rem" /></div>
        <div className={picker.toolbar}><div className={`${picker.search} ${styles.lines}`}><Skeleton width="7rem" height="1rem" /><Skeleton height="2.75rem" /></div><Skeleton width="10rem" height="2.75rem" /></div>
        <div className={picker.heading}><Skeleton width="12rem" height="1.25rem" /><Skeleton width="5rem" height="2.75rem" /></div>
      </header>
      {[0, 1].map((level) => <section key={level} className={picker.level}>
        <div className={picker.heading}><Skeleton width="6rem" height="1.75rem" /><Skeleton width="7rem" height="2.75rem" /></div>
        <div className={picker.group}><Skeleton width="6rem" height="1rem" /><div className={`${picker.items} ${styles.cards}`}>
          {Array.from({ length: 5 }, (_, index) => <div key={index} className={styles.card}><Skeleton width="3.5rem" height="2.75rem" /><Skeleton width="75%" height="1rem" /><Skeleton width="50%" height=".9rem" /></div>)}
        </div></div>
      </section>)}
      <footer className={picker.footer}><Skeleton width="10rem" height="1rem" /><Skeleton width="9rem" height="2.75rem" /></footer>
    </div> : <div className={study.studyShell} aria-hidden="true">
      <div className={study.lesson}>
        <header className={`${study.lessonSubjectHero} ${styles.hero}`}>
          <div className={study.lessonHeroBar}><Skeleton width="7rem" height="1.5rem" /><Skeleton width="4rem" height="2.5rem" /></div>
          <div className={styles.heroCopy}><Skeleton width="5rem" height="5rem" /><Skeleton width="12rem" height="2rem" /><Skeleton width="7rem" height="1.25rem" /></div>
        </header>
        <div className={`${study.lessonSubjectDetails} ${styles.details}`}>
          <div className={styles.tabs}>{[0, 1, 2, 3].map((tab) => <Skeleton key={tab} width="20%" height="2.75rem" />)}</div>
          {[0, 1].map((section) => <section key={section} className={styles.lines}><Skeleton width="8rem" height="1.5rem" /><Skeleton width="65%" height="1rem" /><Skeleton height="1rem" /><Skeleton width="85%" height="1rem" /></section>)}
        </div>
        <div className={study.lessonFooter}><Skeleton width="5rem" height="2.75rem" /><div className={styles.batch}>{[0, 1, 2].map((item) => <Skeleton key={item} width="2.5rem" height="2.5rem" />)}</div><Skeleton width="5rem" height="2.75rem" /></div>
      </div>
    </div>}
  </div>;
}
