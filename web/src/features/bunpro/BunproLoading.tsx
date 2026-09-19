import styles from "./bunpro.module.css";

/** Keep the loading geometry close to the reading and quiz surfaces. */
export function BunproLoading({ kind }: { kind: "lessons" | "reviews" | "details" }) {
  const Wrapper = kind === "details" ? "div" : "main";
  const review = kind === "reviews";
  return <Wrapper className={`${styles.loadingSurface} ${review ? styles.reviewLoading : styles.lessonLoading}`} role="status" aria-label={`Loading Bunpro ${kind}`} aria-busy="true">
    <span className="sr-only">Loading Bunpro {kind}…</span>
    <div aria-hidden="true">
      <div className={styles.loadingTop}><span className={`${styles.skeleton} ${styles.loadingIcon}`} /><div><span className={`${styles.skeleton} ${styles.loadingShort}`} /><span className={`${styles.skeleton} ${styles.loadingMedium}`} /></div></div>
      <div className={styles.loadingHero}><span className={`${styles.skeleton} ${styles.loadingTitle}`} /><span className={`${styles.skeleton} ${styles.loadingSubtitle}`} />{review ? <span className={`${styles.skeleton} ${styles.loadingShort}`} /> : null}</div>
      {review ? <div className={styles.loadingAnswer}><span className={`${styles.skeleton} ${styles.loadingShort}`} /><div className={styles.loadingInput}><span className={styles.skeleton} /><span className={`${styles.skeleton} ${styles.loadingIcon}`} /></div><span className={`${styles.skeleton} ${styles.loadingMedium}`} /></div> : <><div className={styles.loadingTabs}><span className={styles.skeleton} /><span className={styles.skeleton} /></div><div className={styles.loadingPanels}><div className={styles.loadingPanel}><span className={`${styles.skeleton} ${styles.loadingMedium}`} />{[0, 1, 2, 3].map(i => <span key={i} className={styles.skeleton} />)}</div><div className={styles.loadingPanel}><span className={`${styles.skeleton} ${styles.loadingMedium}`} /><span className={`${styles.skeleton} ${styles.loadingShort}`} /><span className={`${styles.skeleton} ${styles.loadingMedium}`} /></div><div className={`${styles.loadingPanel} ${styles.loadingAbout}`}><span className={`${styles.skeleton} ${styles.loadingMedium}`} />{[0, 1, 2].map(i => <span key={i} className={styles.skeleton} />)}<div className={styles.loadingExample}><span className={`${styles.skeleton} ${styles.loadingIcon}`} /><span className={styles.skeleton} /></div></div></div></>}
    </div>
  </Wrapper>;
}
