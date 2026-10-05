"use client";
import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { Lightbulb, MoreVertical, Pause, Play } from "lucide-react";
import { BunproText } from "./BunproText";
import { pickCanonicalAnswer, sanitizeText } from "./model";
import { bunproAudioUrls, useBunproAudio } from "./use-bunpro-audio";
import styles from "./bunpro.module.css";

const ExampleAudioContext = createContext<(ReturnType<typeof useBunproAudio> & { selected: string; select: (id: string) => void }) | null>(null);
export function ExampleAudioProvider({ children }: { children: ReactNode }) {
  const audio = useBunproAudio();
  const [selected, select] = useState("");
  return <ExampleAudioContext value={{ ...audio, selected, select }}>{children}</ExampleAudioContext>;
}
export function BunproExample({ attributes, title, grammarId, showSentence = true, showTranslation = true }: { attributes: Record<string, unknown>; title: string; grammarId?: string; showSentence?: boolean; showTranslation?: boolean }) {
  const id = useId();
  const audio = useContext(ExampleAudioContext)!;
  const [translationHidden, setTranslationHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const urls = bunproAudioUrls(attributes, "female");
  const playing = audio.selected === id && audio.playing;
  // Escape the answer before placing it into provider HTML; BunproText then applies its allowlist.
  const answer = (pickCanonicalAnswer(attributes) || title).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const sentence = String(attributes.content ?? "").replace(/(?:_{2,}|＿{2,})/g, `<strong>${answer}</strong>`);
  function toggleAudio() {
    if (playing) audio.stop();
    else { audio.select(id); void audio.play(urls); }
  }
  return <article className={styles.example} data-readonly={attributes.question_type === "readonly"}>
    <button type="button" className={styles.examplePlay} aria-label={playing ? "Pause example audio" : "Play example audio"} disabled={!urls.length} onClick={toggleAudio}>{playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}</button>
    <div className={styles.exampleText}><div lang="ja" hidden={!showSentence}><BunproText value={sentence} grammarId={grammarId} /></div><div hidden={!showTranslation || translationHidden}><BunproText value={attributes.translation} /></div>{sanitizeText(attributes.extra_info) ? <p className={styles.exampleNote}><Lightbulb size={16} aria-hidden="true" /><span><BunproText value={attributes.extra_info} /></span></p> : null}{audio.selected === id && audio.error ? <p role="status">Audio could not play. Press play to try again.</p> : null}</div>
    <div className={styles.exampleOptions} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { setMenuOpen(false); event.currentTarget.querySelector('button')?.focus(); } }}>
      <button type="button" aria-label="Example options" aria-expanded={menuOpen} aria-controls={`${id}-options`} onClick={() => setMenuOpen(!menuOpen)}><MoreVertical size={20} /></button>
      {menuOpen ? <div id={`${id}-options`} className={styles.exampleMenu}><button type="button" onClick={() => { setTranslationHidden(!translationHidden); setMenuOpen(false); }}>{translationHidden ? "Show translation" : "Hide translation"}</button></div> : null}
    </div>
  </article>;
}
