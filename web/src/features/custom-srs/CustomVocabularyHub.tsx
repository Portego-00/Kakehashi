"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, CircleAlert, Cloud, HardDrive, Library, Plus, RotateCw } from "lucide-react";
import Link from "next/link";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { LoadingState } from "@/components/ui/States";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";
import { customLessonWords, customPackProgress, customReviewWords } from "./model";
import type { CustomSrsState, CustomVocabularyPack } from "./types";
import { useCustomSrs } from "./use-custom-srs";
import styles from "./custom-vocabulary-hub.module.css";

const SCRIPT_LABELS: Record<CustomVocabularyPack["script"], string> = {
  hiragana: "Hiragana",
  katakana: "Katakana",
  mixed: "Mixed kana",
  kanji: "Kanji",
};

const STAGE_GROUPS = [
  { label: "Apprentice", stage: 1, key: "apprentice" },
  { label: "Guru", stage: 5, key: "guru" },
  { label: "Master", stage: 7, key: "master" },
  { label: "Enlightened", stage: 8, key: "enlightened" },
  { label: "Burned", stage: 9, key: "burned" },
] as const;

const PACK_FLIGHT_WIDTH = 168;
const PACK_FLIGHT_HEIGHT = 44;

type PackFlightRect = Pick<DOMRect, "height" | "left" | "top" | "width">;

type PackFlight = {
  id: number;
  title: string;
  characters: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

type PackFlightOrigin = {
  rect: PackFlightRect;
  scrollX: number;
  scrollY: number;
  viewportHeight: number;
  viewportWidth: number;
};

function flightPoint(rect: PackFlightRect) {
  return {
    x: rect.left + rect.width / 2 - PACK_FLIGHT_WIDTH / 2,
    y: rect.top + rect.height / 2 - PACK_FLIGHT_HEIGHT / 2,
  };
}

function capturePackFlightOrigin(origin: HTMLButtonElement): PackFlightOrigin {
  const rect = origin.getBoundingClientRect();
  return {
    rect: { height: rect.height, left: rect.left, top: rect.top, width: rect.width },
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  };
}

function currentPackFlightOrigin(origin: HTMLButtonElement, initial: PackFlightOrigin): PackFlightRect | null {
  const viewportChanged = Math.abs(window.scrollX - initial.scrollX) > 1
    || Math.abs(window.scrollY - initial.scrollY) > 1
    || window.innerHeight !== initial.viewportHeight
    || window.innerWidth !== initial.viewportWidth;
  if (viewportChanged) return null;

  const rect = origin.isConnected ? origin.getBoundingClientRect() : initial.rect;
  return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
}

function PackFlightLayer({ flight, onComplete }: { flight: PackFlight | null; onComplete: (id: number) => void }) {
  if (!flight || typeof document === "undefined") return null;
  const deltaX = flight.end.x - flight.start.x;
  const lift = Math.min(112, Math.max(48, Math.abs(flight.end.y - flight.start.y) * 0.18));
  const apexY = Math.min(flight.start.y, flight.end.y) - lift;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <motion.div
        key={flight.id}
        className={styles.packFlight}
        data-pack-flight=""
        aria-hidden="true"
        initial={{ opacity: 0, rotate: -2, scale: 0.9, x: flight.start.x, y: flight.start.y }}
        animate={{
          opacity: [0, 1, 1, 0],
          rotate: [-2, -4, 2, 0],
          scale: [0.9, 1, 0.64, 0.2],
          x: [flight.start.x, flight.start.x + deltaX * 0.18, flight.start.x + deltaX * 0.7, flight.end.x],
          y: [flight.start.y, apexY, flight.end.y - 18, flight.end.y],
        }}
        transition={{ duration: 0.72, ease: [0.2, 0, 0, 1], times: [0, 0.16, 0.78, 1] }}
        onAnimationComplete={() => onComplete(flight.id)}
      >
        <span className={styles.packFlightCharacter} lang="ja">{flight.characters}</span>
        <strong>{flight.title}</strong>
      </motion.div>
    </MotionConfig>,
    document.body,
  );
}

function readableError(error: unknown) {
  if (!error) return "";
  return error instanceof Error ? error.message : typeof error === "string" ? error : "Custom vocabulary progress could not be loaded.";
}

function PackWordStatus({ state, wordId, enrolled }: { state: CustomSrsState; wordId: string; enrolled: boolean }) {
  if (!enrolled) return null;
  const stage = state.assignments[wordId]?.stage ?? 0;
  if (stage === 0) return <span className={styles.wordStatus}>Lesson</span>;
  return (
    <span className={styles.wordStatus} title={srsStageLabel(stage)}>
      <SrsStageIcon stage={stage} size={15} />
      <span>{srsStageLabel(stage)}</span>
    </span>
  );
}

function PackWord({ state, word, enrolled }: { state: CustomSrsState; word: CustomVocabularyPack["words"][number]; enrolled: boolean }) {
  const meanings = word.meanings.join(", ");
  return <li>
    <Link className={styles.wordLink} href={`/custom-vocabulary/words/${encodeURIComponent(word.id)}`}>
      <strong className={styles.wordCharacter} data-subject-type="vocabulary" lang="ja">{word.characters}</strong>
      <span className={styles.wordMeaning}>{meanings}</span>
      <span className={styles.wordNavigation}>
        <PackWordStatus state={state} wordId={word.id} enrolled={enrolled} />
        <ChevronRight className={styles.wordCue} size={16} aria-hidden="true" />
      </span>
    </Link>
  </li>;
}

function PackProgress({
  pack,
  state,
  now,
  progressSource,
}: {
  pack: CustomVocabularyPack;
  state: CustomSrsState;
  now: Date;
  progressSource: string;
}) {
  const progress = customPackProgress(state, pack, now);
  const lessons = progress.lessons;
  const started = progress.total - progress.lessons;
  const due = progress.due;

  return (
    <div className={styles.packProgress}>
      <div className={styles.progressPrimary}>
        <Progress
          value={started}
          max={progress.total}
          label={`${progressSource}: ${started} of ${progress.total} started`}
          ariaLabel={`${pack.title} progress`}
        />
        <p className={styles.packQueue}>
          <span><strong>{lessons}</strong> {lessons === 1 ? "lesson" : "lessons"}</span>
          <span><strong>{due}</strong> due now</span>
        </p>
      </div>
      <dl className={styles.stageCounts} aria-label={`${pack.title} SRS stages`}>
        {STAGE_GROUPS.map((group) => (
          <div key={group.key}>
            <dt><SrsStageIcon stage={group.stage} size={18} /><span>{group.label}</span></dt>
            <dd>{progress[group.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function VocabularyPack({
  pack,
  state,
  now,
  progressSource,
  disabled,
  pending,
  onAdd,
}: {
  pack: CustomVocabularyPack;
  state: CustomSrsState;
  now: Date;
  progressSource: string;
  disabled: boolean;
  pending: boolean;
  onAdd: (pack: CustomVocabularyPack, origin: HTMLButtonElement) => Promise<void>;
}) {
  const enrolled = state.enrolledPackIds.includes(pack.id);
  const previewWords = pack.words.slice(0, 2);
  const remainingWords = pack.words.slice(previewWords.length);
  const wordCountLabel = `${pack.words.length} ${pack.words.length === 1 ? "word" : "words"}`;
  const packMeta = pack.levelRange
    ? `${SCRIPT_LABELS[pack.script]} · WaniKani levels ${pack.levelRange.min}–${pack.levelRange.max} · ${wordCountLabel}`
    : `${SCRIPT_LABELS[pack.script]} · ${wordCountLabel}`;

  return (
    <article className={styles.pack} aria-labelledby={`pack-${pack.id}`} data-enrolled={enrolled || undefined}>
      <header className={styles.packHeader}>
        <div className={styles.packIdentity}>
          <h4 id={`pack-${pack.id}`} tabIndex={-1}>{pack.title}</h4>
          <p className={styles.packMeta}>{packMeta}</p>
          <p className={styles.packDescription}>{pack.description}</p>
        </div>
        {enrolled ? (
          <span className={styles.addedMark}><Check size={16} aria-hidden="true" /> Added</span>
        ) : (
          <Button
            type="button"
            size="small"
            state={pending ? "loading" : "idle"}
            disabled={disabled}
            aria-label={`Add ${pack.title} pack`}
            onClick={(event) => void onAdd(pack, event.currentTarget)}
          >
            {pending ? null : <Plus size={16} aria-hidden="true" />} Add pack
          </Button>
        )}
      </header>

      {enrolled ? <PackProgress pack={pack} state={state} now={now} progressSource={progressSource} /> : null}

      <div className={styles.wordsHeading}>
        <h5>Words</h5>
        <span>{enrolled ? "Current stage" : "Preview"}</span>
      </div>
      <ul className={styles.wordList} aria-label={`${pack.title} word preview`}>
        {previewWords.map((word) => <PackWord key={word.id} state={state} word={word} enrolled={enrolled} />)}
      </ul>
      {remainingWords.length ? <details className={styles.wordDisclosure}>
        <summary>
          <span><span className={styles.disclosureShow}>Show {remainingWords.length} more words</span><span className={styles.disclosureHide}>Hide {remainingWords.length} words</span></span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <ul className={styles.wordList} aria-label={`${pack.title} remaining words`}>
          {remainingWords.map((word) => <PackWord key={word.id} state={state} word={word} enrolled={enrolled} />)}
        </ul>
      </details> : null}
    </article>
  );
}

export function CustomVocabularyHub() {
  const { user } = useSession();
  const scope = waniKaniUserId(user) || "anonymous";
  const customSrs = useCustomSrs(scope, CUSTOM_VOCABULARY_PACKS);
  const { state, enrollPack, isLoading, isRefreshing, isUnavailable, isSaving, error, storageMode, refresh } = customSrs;
  const [now, setNow] = useState(() => new Date());
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [packFlight, setPackFlight] = useState<PackFlight | null>(null);
  const [receivingSequence, setReceivingSequence] = useState<number | null>(null);
  const packShelfRef = useRef<HTMLDivElement>(null);
  const packStickyHeadingRef = useRef<HTMLDivElement>(null);
  const flightSequenceRef = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (receivingSequence === null) return;
    const timer = window.setTimeout(() => {
      setReceivingSequence((current) => current === receivingSequence ? null : current);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [receivingSequence]);

  const queue = useMemo(() => ({
    lessons: customLessonWords(state, CUSTOM_VOCABULARY_PACKS).length,
    reviews: customReviewWords(state, CUSTOM_VOCABULARY_PACKS, now).length,
  }), [now, state]);
  const persistence = storageMode === "cloud"
    ? { label: "Cloud progress", detail: "Synced with your Kakehashi account", Icon: Cloud }
    : { label: "Browser progress", detail: "Saved on this device", Icon: HardDrive };
  const PersistenceIcon = persistence.Icon;
  const hookError = readableError(error);
  const visibleError = mutationError || hookError;
  const kanaPacks = CUSTOM_VOCABULARY_PACKS.filter((pack) => pack.script !== "kanji");
  const kanjiPacks = CUSTOM_VOCABULARY_PACKS.filter((pack) => pack.script === "kanji");

  function renderPackGroup(id: string, title: string, packs: readonly CustomVocabularyPack[]) {
    if (!packs.length) return null;
    const wordCount = packs.reduce((total, pack) => total + pack.words.length, 0);
    return <section className={styles.packGroup} aria-labelledby={id}>
      <div className={styles.groupHeading}>
        <h3 id={id}>{title}</h3>
        <p>{packs.length} {packs.length === 1 ? "pack" : "packs"} · {wordCount} words</p>
      </div>
      <div className={styles.packList}>
        {packs.map((pack) => (
          <VocabularyPack
            key={pack.id}
            pack={pack}
            state={state}
            now={now}
            progressSource={persistence.label}
            disabled={isLoading || isUnavailable || isSaving || pendingPackId !== null}
            pending={pendingPackId === pack.id}
            onAdd={addPack}
          />
        ))}
      </div>
    </section>;
  }

  function collectPack(pack: CustomVocabularyPack, originRect: PackFlightRect | null) {
    const sequence = flightSequenceRef.current + 1;
    flightSequenceRef.current = sequence;
    setReceivingSequence(sequence);

    const shelfRect = packShelfRef.current?.getBoundingClientRect();
    const currentlyReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduceMotion || currentlyReduced || !originRect || !shelfRect) return;
    setPackFlight({
      id: sequence,
      title: pack.title,
      characters: pack.words[0]?.characters ?? "語",
      start: flightPoint(originRect),
      end: flightPoint(shelfRect),
    });
  }

  function focusPackHeading(packId: string) {
    const heading = document.getElementById(`pack-${packId}`);
    if (!heading) return;

    heading.focus();
    const stickyBottom = packStickyHeadingRef.current?.getBoundingClientRect().bottom ?? 0;
    const headingRect = heading.getBoundingClientRect();
    if (headingRect.top < stickyBottom + 8 || headingRect.bottom > window.innerHeight - 8) {
      heading.scrollIntoView?.({ block: "start" });
    }
  }

  async function addPack(pack: CustomVocabularyPack, origin: HTMLButtonElement) {
    const flightOrigin = capturePackFlightOrigin(origin);
    setPendingPackId(pack.id);
    setMutationError("");
    try {
      await enrollPack(pack);
      setAnnouncement(`${pack.title} added. ${pack.words.length} custom ${pack.words.length === 1 ? "lesson is" : "lessons are"} ready.`);
      focusPackHeading(pack.id);
      collectPack(pack, currentPackFlightOrigin(origin, flightOrigin));
    } catch (cause) {
      setMutationError(readableError(cause) || `Could not add ${pack.title}. Try again.`);
    } finally {
      setPendingPackId(null);
    }
  }

  return (
    <main className={`page ${styles.page}`}>
      <header className={`page-header ${styles.pageHeader}`}>
        <div>
          <h1>Custom vocabulary</h1>
          <p>Add common words beyond WaniKani, from everyday kana to vocabulary matched to the kanji you already know.</p>
        </div>
        <div className={styles.persistence} aria-label={`${persistence.label}. ${persistence.detail}.`}>
          <PersistenceIcon size={17} aria-hidden="true" />
          <span><strong>{persistence.label}</strong><small>{persistence.detail}</small></span>
        </div>
      </header>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

      {isLoading ? <div className={styles.syncState}><LoadingState compact label="Loading custom vocabulary progress" detail="Checking your saved packs and review queue." /></div> : null}
      {visibleError ? <div className={styles.errorNotice} role="alert"><CircleAlert size={17} aria-hidden="true" /><span>{visibleError}</span>{isUnavailable ? <Button size="small" tone="ghost" state={isRefreshing ? "loading" : "idle"} disabled={isRefreshing} onClick={() => void refresh()}>Try Again</Button> : null}</div> : null}

      <section className={styles.queue} aria-labelledby="custom-queue-heading">
        <div className={styles.queueIntro}>
          <span className={styles.queueSubjectMark} data-subject-type="vocabulary" lang="ja" aria-hidden="true">かな</span>
          <div className={styles.queueCopy}>
            <h2 id="custom-queue-heading">Custom study</h2>
            <p>{state.enrolledPackIds.length ? "Continue your added custom vocabulary." : "Add a pack to make its words available as lessons."}</p>
          </div>
        </div>
        <div className={styles.queueWorkspace}>
          <dl className={styles.queueCounts}>
            <div><dt>Lessons</dt><dd>{queue.lessons}</dd></div>
            <div><dt>Reviews due</dt><dd>{queue.reviews}</dd></div>
            <div><dt>Packs added</dt><dd>{state.enrolledPackIds.length}</dd></div>
          </dl>
          <div className={styles.queueActions}>
            <ButtonLink href="/custom-vocabulary/lessons" disabled={isLoading || isUnavailable || queue.lessons === 0}>
              <BookOpen size={17} aria-hidden="true" /> Start lessons <ArrowRight size={16} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/custom-vocabulary/reviews" tone="primary" disabled={isLoading || isUnavailable || queue.reviews === 0}>
              <RotateCw size={17} aria-hidden="true" /> Review due <ArrowRight size={16} aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className={styles.packs} aria-labelledby="custom-packs-heading">
        <div ref={packStickyHeadingRef} className={styles.sectionHeading}>
          <div>
            <h2 id="custom-packs-heading">Vocabulary packs</h2>
            <p>Common words checked against WaniKani’s complete vocabulary catalog.</p>
          </div>
          <div
            key={receivingSequence ?? "idle"}
            ref={packShelfRef}
            className={styles.packShelf}
            data-receiving={receivingSequence === null ? undefined : "true"}
            aria-label={`${state.enrolledPackIds.length} of ${CUSTOM_VOCABULARY_PACKS.length} vocabulary packs added`}
          >
            <Library size={17} aria-hidden="true" />
            <span>
              <strong>{state.enrolledPackIds.length}</strong>
              <span> of {CUSTOM_VOCABULARY_PACKS.length}</span>
              <span className={styles.packShelfAdded}> added</span>
            </span>
          </div>
        </div>
        {renderPackGroup("custom-kana-packs-heading", "Kana & everyday language", kanaPacks)}
        {renderPackGroup("custom-kanji-packs-heading", "Kanji by WaniKani level", kanjiPacks)}
      </section>

      <details className={styles.scheduling}>
        <summary>
          <span>How custom SRS timing works</span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className={styles.schedulingBody}>
          <div>
            <h2>Adaptive timing, familiar stages</h2>
            <p>Reviews are scheduled with adaptive FSRS while progress is shown as Apprentice, Guru, Master, Enlightened, and Burned. The stages feel familiar, but review timing is personalized and does not reproduce WaniKani’s exact schedule.</p>
          </div>
          <div className={styles.stageTrail} aria-label="Custom vocabulary SRS stages">
            {STAGE_GROUPS.map((group) => <span key={group.key}><SrsStageIcon stage={group.stage} size={18} />{group.label}</span>)}
          </div>
        </div>
      </details>

      <footer className={styles.sources}>
        <p>
          Vocabulary selection was validated with the EDRDG <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noreferrer">JMdict/EDICT project</a>,
          used under its <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noreferrer">CC BY-SA 4.0 licence</a>. Every written form is checked against the complete <a href="https://docs.api.wanikani.com/20170710/#get-all-subjects" target="_blank" rel="noreferrer">WaniKani subject catalog</a>, and level-banded packs use the highest component-kanji level. Mnemonics and examples are original to Kakehashi.
        </p>
      </footer>

      <PackFlightLayer
        flight={packFlight}
        onComplete={(id) => setPackFlight((current) => current?.id === id ? null : current)}
      />
    </main>
  );
}
