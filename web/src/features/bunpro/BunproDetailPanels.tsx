"use client";
import { useState } from "react";
import { Play, Pause } from "lucide-react";
import { BunproText } from "./BunproText";
import { sanitizeText } from "./model";
import { bunproStage } from "./progression";
import { bunproAudioUrls, useBunproAudio } from "./use-bunpro-audio";
import styles from "./bunpro.module.css";

type Attributes = Record<string, unknown>;
function object(value: unknown): Attributes { return value && typeof value === "object" && !Array.isArray(value) ? value as Attributes : {}; }
function records(value: unknown): Attributes[] { return Array.isArray(value) ? value.map(object) : []; }
function texts(value: unknown): string[] { return Array.isArray(value) ? value.flatMap((v) => typeof v === "string" ? [v] : Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []) : []; }
export function DictionaryDefinition({ attributes }: { attributes: Attributes }) {
  const dictionary = object(attributes.jmdict_data);
  const senses = records(dictionary.sense).map((sense) => ({ info: sense.info, antonym: sense.antonym, related: sense.related, english: records(sense.gloss).filter((gloss) => gloss.lang === "eng").map((gloss) => sanitizeText(gloss.text)).filter(Boolean) })).filter((sense) => sense.english.length);
  const forms = [...records(dictionary.kanji), ...records(dictionary.kana)];
  return <section className={styles.structure}><h3>Dictionary Definition</h3>{forms.some((form) => form.common) ? <span className={styles.commonWord}>Common</span> : null}<p className={styles.detailMuted}>{texts(attributes.jmdict_pos).join(", ")}</p>{senses.length ? <ol className={styles.dictionarySenses}>{senses.map((sense, i) => <li key={i}>{sense.english.join(", ")}{texts(sense.info).map((info) => <p key={info} className={styles.detailMuted}>{info}</p>)}{texts(sense.antonym).length ? <p className={styles.detailMuted}>Antonyms: <span lang="ja">{texts(sense.antonym).join("、")}</span></p> : null}{texts(sense.related).length ? <p className={styles.detailMuted}>Related: <span lang="ja">{texts(sense.related).join("、")}</span></p> : null}</li>)}</ol> : <p><BunproText value={attributes.meaning} /></p>}{forms.length ? <div className={styles.dictionaryForms}><span className={styles.detailMuted}>All Forms</span><p lang="ja">{forms.map((form) => sanitizeText(form.text)).filter(Boolean).join("、")}</p></div> : null}</section>;
}
export function VocabPronunciation({ attributes }: { attributes: Attributes }) {
  const audio = useBunproAudio();
  const [frequency, setFrequency] = useState("dictionary");
  const sources = ["dictionary", "general", "anime", "novels", "netflix"].filter((source) => typeof attributes[`frequency_${source}`] === "number");
  const source = sources.includes(frequency) ? frequency : sources[0];
  const kana = sanitizeText(attributes.kana);
  const pitch = sanitizeText(attributes.pitch_accent_stress);
  const urls = bunproAudioUrls(attributes, "female");
  // Small kana belong to the preceding mora; pitch values are one per mora.
  const mora = kana.match(/.[ゃゅょぁぃぅぇぉャュョァィゥェォ]?/gu) ?? [];
  return <>{kana || pitch ? <div><dt>Pitch accent</dt><dd className={styles.pitchRow}><button type="button" className={styles.pronunciationPlay} disabled={!urls.length} aria-label={audio.playing ? "Stop pronunciation" : "Play pronunciation"} onClick={() => audio.playing ? audio.stop() : void audio.play(urls)}>{audio.playing ? <Pause size={14} /> : <Play size={14} />}</button><span lang="ja" aria-label={`${kana}, pitch ${pitch}`}>{mora.map((part, index) => <span key={index} className={styles.pitchMora} data-pitch={pitch[index]} data-drop={pitch[index] === "H" && pitch[index + 1] === "L"}>{part}</span>)}</span></dd>{audio.error ? <p role="status">{audio.error}</p> : null}</div> : null}{sources.length ? <div><dt><label>Frequency <select aria-label="Frequency source" value={source} onChange={(event) => setFrequency(event.target.value)}>{sources.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></dt><dd>Top {Number(attributes[`frequency_${source}`]).toLocaleString("en-US")}</dd></div> : null}</>;
}
function date(value: unknown) { const time = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(time) ? new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
export function ReviewProgress({ review, kind }: { review?: Attributes; kind: "grammar" | "vocab" }) {
  const [now] = useState(() => Date.now());
  const stage = bunproStage(review);
  const next = review?.next_review;
  const inputType = sanitizeText(review?.default_input_type);
  const types: Record<string, [string, string]> = { Cloze: ["Cloze (Manual)", "Fill in the missing part of the sentence."], Translate: ["Manual Translation", "Read in Japanese and type the translation."], Reading: ["Manual Reading", "Type the reading in kana."], Reveal: ["Reveal", "Reveal the answer and assess your recall."] };
  const type = types[inputType] ?? [inputType || (kind === "grammar" ? "Cloze (Manual)" : "Not set"), ""];
  return <aside className={styles.detailSidebar}><section><h3>Your Progress</h3>{review ? <><dl className={styles.progressFacts}>{[["Current stage", stage.label || "Not started"], ["Next review", typeof next === "string" && Date.parse(next) <= now ? "Now" : date(next)], ["First studied", date(review.started_studying_at)], ["Times studied", review.times_studied ?? "—"], ["Accuracy", typeof review.accuracy === "number" ? `${review.accuracy}%` : "—"], ["Ghost count", review.ghost_count ?? "—"]].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{String(value)}</dd></div>)}</dl><div className={styles.stageSegments} aria-label={stage.label}>{Array.from({ length: 10 }, (_, i) => <span key={i} data-filled={i < (stage.number ?? 0)} data-stage={i < 3 ? "beginner" : i < 5 ? "adept" : i < 7 ? "seasoned" : "expert"} />)}</div></> : <p>Not studied yet</p>}</section><section><h3>Review Type</h3><strong>{type[0]}</strong>{type[1] ? <p className={styles.detailMuted}>{type[1]}</p> : null}</section></aside>;
}
