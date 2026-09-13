"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { EMOJI_GROUPS, SUGGESTED_EMOJIS, searchEmojis, type NotebookEmoji } from "./emoji-catalog";
import styles from "./emoji-picker.module.css";

const PAGE_SIZE = 120;

export default function NotebookEmojiPicker({ value, onSelect }: { value: string; onSelect: (emoji: string) => void }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const search = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const results = searchEmojis(query, group === "" ? undefined : Number(group));
  const filtering = Boolean(query.trim() || group);

  useEffect(() => { search.current?.focus({ preventScroll: true }); }, []);

  const resetResults = () => {
    setVisibleCount(PAGE_SIZE);
    if (body.current) body.current.scrollTop = 0;
  };

  return <>
    <div className={styles.filters}>
      <label className={styles.search}>
        <Search size={17} aria-hidden />
        <input ref={search} type="search" aria-label="Search emojis" placeholder="Search all emojis…" value={query} onChange={(event) => { setQuery(event.target.value); resetResults(); }} autoComplete="off" spellCheck={false} />
      </label>
      <div className={styles.categoryRow}>
        <select aria-label="Emoji category" value={group} onChange={(event) => { setGroup(event.target.value); resetResults(); }}>
          <option value="">All categories</option>
          {EMOJI_GROUPS.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
        <span role="status" aria-live="polite">{results.length.toLocaleString()} {results.length === 1 ? "emoji" : "emojis"}</span>
      </div>
    </div>
    <div ref={body} className={styles.body}>
      {!filtering ? <section aria-label="Suggested emojis" className={styles.section}>
        <h3>Suggested</h3>
        <EmojiGrid emojis={SUGGESTED_EMOJIS} value={value} onSelect={onSelect} />
      </section> : null}
      <section aria-label="Emoji results" className={styles.section}>
        <h3>{filtering ? "Results" : "All emojis"}</h3>
        {results.length ? <>
          <EmojiGrid emojis={results.slice(0, visibleCount)} value={value} onSelect={onSelect} />
          {results.length > visibleCount ? <button type="button" className={styles.showMore} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show more emojis</button> : null}
        </> : <p className={styles.empty}>No emojis found. Try a different word or category.</p>}
      </section>
    </div>
    <footer className={styles.footer}>
      <button type="button" onClick={() => onSelect("")} disabled={!value}>Reset icon</button>
      <span>Search by name, keyword, or emoji</span>
    </footer>
  </>;
}

function EmojiGrid({ emojis, value, onSelect }: { emojis: NotebookEmoji[]; value: string; onSelect: (emoji: string) => void }) {
  const [activeEmoji, setActiveEmoji] = useState("");
  const activeIndex = Math.max(0, emojis.findIndex((item) => item.emoji === activeEmoji));

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const current = buttons.findIndex((button) => button === document.activeElement);
    if (current < 0) return;
    const columns = getComputedStyle(event.currentTarget).gridTemplateColumns.split(" ").length;
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : current + (event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -columns : columns);
    event.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  };

  return <div className={styles.emojiGrid} onKeyDown={navigate}>
    {emojis.map((item, index) => <button key={item.emoji} type="button" aria-label={item.label} title={item.label} aria-pressed={value === item.emoji} tabIndex={index === activeIndex ? 0 : -1} onFocus={() => setActiveEmoji(item.emoji)} onClick={() => onSelect(item.emoji)}><span aria-hidden="true">{item.emoji}</span></button>)}
  </div>;
}
