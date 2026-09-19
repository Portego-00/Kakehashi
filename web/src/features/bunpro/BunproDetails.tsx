"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { bunpro } from "./client";
import { BunproText } from "./BunproText";
import { pickCanonicalAnswer, sanitizeText, type BunproReviewableDetailsResponse } from "./model";
import styles from "./bunpro.module.css";

export function BunproDetails({ kind, slug }: { kind: "grammar" | "vocab"; slug: string }) {
  const [tab, setTab] = useState("Meaning");
  const [polite, setPolite] = useState(false);
  const details = useQuery({ queryKey: ["bunpro", "details", kind, slug], queryFn: ({ signal }) => bunpro<BunproReviewableDetailsResponse<Record<string, unknown>>>(new URLSearchParams({ action: "details", kind, slug }).toString(), { signal }), staleTime: 300_000 });
  if (details.isPending) return <div className={styles.details} role="status" aria-label="Loading Bunpro details"><div className={styles.skeleton} /><div className={styles.skeleton} /><div className={styles.skeleton} /></div>;
  if (details.error) return <div className={styles.details} role="alert"><p>{details.error.message}</p><Button onClick={() => details.refetch()}>Retry details</Button></div>;
  const attributes = details.data.data.attributes;
  const examples = (details.data.included ?? []).filter((item) => item.type === "study_question").sort((a, b) => Number(a.attributes.sentence_order ?? 999) - Number(b.attributes.sentence_order ?? 999));
  const writeup = details.data.included?.find((item) => item.type === "writeup")?.attributes;
  const title = sanitizeText(attributes.title);
  return <section className={styles.details} aria-label="Bunpro item details">
    <header className={styles.detailHeader}><div><h2 lang="ja"><BunproText value={attributes.title} /></h2><p lang="ja"><BunproText value={attributes.furigana || attributes.kana} /></p><div><BunproText value={attributes.meaning} /></div></div><span>{kind === "grammar" ? "Grammar" : "Vocabulary"} · {sanitizeText(attributes.level || attributes.jlpt_level)}</span></header>
    <div className={styles.tabs} role="tablist" aria-label="Bunpro details">{["Meaning", "Examples", "Resources"].map((label) => <button key={label} id={`bunpro-tab-${label}`} type="button" role="tab" aria-selected={tab === label} aria-controls="bunpro-details-panel" tabIndex={tab === label ? 0 : -1} onClick={() => setTab(label)} onKeyDown={(event) => { const tabs = ["Meaning", "Examples", "Resources"]; if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3]; setTab(next); document.getElementById(`bunpro-tab-${next}`)?.focus(); } }}>{label}</button>)}</div>
    <div id="bunpro-details-panel" role="tabpanel" aria-labelledby={`bunpro-tab-${tab}`} className={styles.detailContent}>
      {tab === "Meaning" ? <>
        {attributes.casual_structure || attributes.polite_structure ? <section><div className={styles.row}><h3>Structure</h3>{attributes.casual_structure && attributes.polite_structure ? <Button size="small" aria-pressed={polite} onClick={() => setPolite(!polite)}>{polite ? "Polite" : "Casual"}</Button> : null}</div><BunproText value={polite ? attributes.polite_structure : attributes.casual_structure || attributes.polite_structure} /></section> : null}
        <dl className={styles.facts}>{[["Part of speech", attributes.part_of_speech_translation || attributes.part_of_speech || (Array.isArray(attributes.jmdict_pos) ? attributes.jmdict_pos.join(", ") : "")], ["Register", attributes.register_translation || attributes.register], ["Word type", attributes.word_type_translation || attributes.word_type], ["Pitch accent", attributes.pitch_accent_stress]].filter(([, value]) => value).map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd><BunproText value={value} /></dd></div>)}</dl>
        {attributes.nuance_translation || attributes.nuance || attributes.caution ? <section><h3>Nuance</h3><BunproText value={attributes.nuance_translation} /><BunproText value={attributes.nuance} /><BunproText value={attributes.caution} /></section> : null}
        {writeup?.body ? <section><h3>About {title}</h3><Writeup value={writeup.body} examples={examples} title={title} /></section> : null}
        {attributes.rare_kanji_warning ? <p><BunproText value={attributes.rare_kanji_warning} /></p> : null}
      </> : null}
      {tab === "Examples" ? examples.length ? examples.map((item) => <article className={styles.example} key={item.id}><div lang="ja"><BunproText value={String(item.attributes.content ?? "").replace(/(?:_{2,}|＿{2,})/g, pickCanonicalAnswer(item.attributes) || title)} /></div><div><BunproText value={item.attributes.translation} /></div>{safeAudio(item.attributes.female_audio_url || item.attributes.male_audio_url) ? <audio controls preload="none" src={safeAudio(item.attributes.female_audio_url || item.attributes.male_audio_url)} aria-label="Example audio" /> : null}</article>) : <p>No example sentences available.</p> : null}
      {tab === "Resources" ? <><section><h3>Meanings</h3><BunproText value={attributes.meaning} />{attributes.accepted_answers ? <p>Accepted answers: <BunproText value={attributes.accepted_answers} /></p> : null}{glosses(attributes.jmdict_data).map((text) => <p key={text}>{text}</p>)}</section>{attributes.metadata ? <section><h3>Metadata</h3><BunproText value={attributes.metadata} /></section> : null}<a href={`https://bunpro.jp/${kind === "grammar" ? "grammar_points" : "vocabs"}/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer">Open in Bunpro</a></> : null}
    </div>
  </section>;
}
export function safeAudio(value: unknown): string | undefined { return typeof value === "string" && /^https:\/\//i.test(value) ? value : undefined; }
function glosses(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("sense" in value) || !Array.isArray(value.sense)) return [];
  return value.sense.flatMap((sense: { gloss?: { lang?: string; text?: string }[] }) => (sense.gloss ?? []).filter((gloss) => gloss.lang === "eng" && typeof gloss.text === "string").map((gloss) => gloss.text!));
}

function Writeup({ value, examples, title }: { value: unknown; examples: { id: string; attributes: Record<string, unknown> }[]; title: string }) {
  if (typeof value !== "string") return null;
  const blocks = value.split(/(<ul[^>]*class=['"][^'"]*writeup-examples--holder[^'"]*['"][^>]*>[\s\S]*?<\/ul>)/gi);
  return <>{blocks.map((block, index) => {
    if (!/writeup-examples--holder/.test(block)) return <BunproText key={index} value={block} />;
    const ids = [...block.matchAll(/data-study-question=['"](\d+)['"]/gi)].map((match) => match[1]);
    return <div key={index}>{examples.filter((example) => ids.includes(example.id)).map((example) => <article className={styles.example} key={example.id}><div lang="ja"><BunproText value={String(example.attributes.content ?? "").replace(/(?:_{2,}|＿{2,})/g, pickCanonicalAnswer(example.attributes) || title)} /></div><BunproText value={example.attributes.translation} /></article>)}</div>;
  })}</>;
}
