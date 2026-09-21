"use client";
import type { BunproLearnContentItem } from "../../../../src/types/bunpro";
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { bunpro } from "./client";
import { BunproText } from "./BunproText";
import { sanitizeText, type BunproReviewableDetailsResponse } from "./model";
import { BunproExample, ExampleAudioProvider } from "./BunproExample";
import { DictionaryDefinition, VocabPronunciation, ReviewProgress } from "./BunproDetailPanels";
import { BunproCoverage } from "./BunproCoverage";
import { BunproLoading } from "./BunproLoading";
import styles from "./bunpro.module.css";

export function BunproDetails({ kind, slug, content, review, deckId }: { kind: "grammar" | "vocab"; slug: string; content?: BunproLearnContentItem; review?: Record<string, unknown>; deckId?: number }) {
  const id = useId();
  const [tab, setTab] = useState("Details");
  const [polite, setPolite] = useState(false);
  const [showSentence, setShowSentence] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const details = useQuery({ queryKey: ["bunpro", "details", kind, slug], queryFn: ({ signal }) => bunpro<BunproReviewableDetailsResponse<Record<string, unknown>>>(new URLSearchParams({ action: "details", kind, slug }).toString(), { signal }), enabled: !content && Boolean(slug), staleTime: 300_000 });
  if (!content && details.isPending) return <BunproLoading kind="details" />;
  if (!content && details.error) return <div className={styles.details} role="alert"><p>{details.error.message}</p><Button onClick={() => details.refetch()}>Retry details</Button></div>;
  const data = content ?? details.data!;
  const attributes = data.data.attributes;
  const examples = (data.included ?? []).filter((item) => item.type === "study_question").sort((a, b) => Number(a.attributes.sentence_order ?? 999) - Number(b.attributes.sentence_order ?? 999));
  const writeup = data.included?.find((item) => item.type === "writeup")?.attributes;
  const title = sanitizeText(attributes.title);
  const progress = review ?? data.included?.find((item) => item.type === "review")?.attributes;
  const coverageIds = Array.isArray(attributes.coverage_vocab_ids) ? new Set(attributes.coverage_vocab_ids.map(Number)) : null;
  const vocabulary = data.included?.filter((item) => item.type === "reviewable_base_attribute_mixed" && item.attributes.type_snake === "vocab" && (!coverageIds || coverageIds.has(Number(item.attributes.id ?? item.id)))) ?? [];
  const Heading = content ? "h1" : "h2";
  return <section className={styles.details} aria-label="Bunpro item details">
    <header className={styles.detailHeader}><div><Heading lang="ja"><BunproText value={attributes.title} /></Heading><p lang="ja"><BunproText value={attributes.furigana || attributes.kana} /></p><div><BunproText value={attributes.meaning} /></div></div><span>{kind === "grammar" ? "Grammar" : "Vocabulary"} · {sanitizeText(attributes.level || attributes.jlpt_level)}</span></header>
    <div className={styles.tabs} role="tablist" aria-label="Bunpro details">{["Details", "Examples"].map((label) => <button key={label} id={`${id}-tab-${label}`} type="button" role="tab" aria-selected={tab === label} aria-controls={`${id}-panel`} tabIndex={tab === label ? 0 : -1} onClick={() => setTab(label)} onKeyDown={(event) => { const tabs = ["Details", "Examples"]; if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = tabs[(tabs.indexOf(tab) + 1) % 2]; setTab(next); document.getElementById(`${id}-tab-${next}`)?.focus(); } }}>{label}</button>)}</div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} className={styles.detailContent} data-details-tab={tab === "Details"}><ExampleAudioProvider key={tab}>
      {tab === "Details" ? <>
        <ReviewProgress review={progress} kind={kind} />
        {kind === "vocab" ? <DictionaryDefinition attributes={attributes} /> : null}
        {attributes.casual_structure || attributes.polite_structure ? <section className={styles.structure}><div className={styles.row}><h3>Structure</h3>{attributes.casual_structure && attributes.polite_structure ? <div className={styles.structureToggle}><button type="button" aria-pressed={!polite} onClick={() => setPolite(false)}>Standard</button><button type="button" aria-pressed={polite} onClick={() => setPolite(true)}>Polite</button></div> : null}</div><div><BunproText value={polite ? attributes.polite_structure : attributes.casual_structure || attributes.polite_structure} /></div></section> : null}
        <section className={styles.factPanel}><h3>Details</h3><dl className={styles.facts}>{[["Part of speech", attributes.part_of_speech_translation || attributes.part_of_speech || (Array.isArray(attributes.jmdict_pos) ? attributes.jmdict_pos.join(", ") : "")], ["Register", attributes.register_translation || attributes.register], ["Word type", attributes.word_type_translation || attributes.word_type]].filter(([, value]) => value).map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd><BunproText value={value} /></dd></div>)}{kind === "vocab" ? <VocabPronunciation attributes={attributes} /> : null}</dl></section>
        {attributes.nuance_translation || attributes.nuance || attributes.caution ? <section className={styles.about}><h3>Nuance</h3><div><BunproText value={attributes.nuance_translation} /></div><div><BunproText value={attributes.nuance} /></div><div><BunproText value={attributes.caution} /></div></section> : null}
        {writeup?.body ? <section className={styles.about}><h3>About {title}</h3><div><Writeup value={writeup.body} examples={examples} title={title} /></div></section> : null}
        {kind === "vocab" && examples.length ? <section className={styles.about}><h3>Examples</h3>{examples.map((item) => <BunproExample key={item.id} attributes={item.attributes} title={title} />)}</section> : null}
        {vocabulary.length ? <BunproCoverage key={`${kind}:${slug}`} vocabulary={vocabulary} deckId={deckId} /> : null}
        {attributes.rare_kanji_warning ? <p><BunproText value={attributes.rare_kanji_warning} /></p> : null}
      </> : null}
      {tab === "Examples" ? <><div className={styles.exampleControls}><button type="button" aria-pressed={showSentence} onClick={() => setShowSentence(!showSentence)}>Sentence</button><button type="button" aria-pressed={showTranslation} onClick={() => setShowTranslation(!showTranslation)}>Translation</button></div>{examples.length ? examples.map((item) => <BunproExample key={item.id} attributes={item.attributes} title={title} showSentence={showSentence} showTranslation={showTranslation} />) : <p>No example sentences available.</p>}</> : null}

    </ExampleAudioProvider></div>
  </section>;
}
function Writeup({ value, examples, title }: { value: unknown; examples: { id: string; attributes: Record<string, unknown> }[]; title: string }) {
  if (typeof value !== "string") return null;
  const blocks = value.split(/(<ul[^>]*class=['"][^'"]*writeup-examples--holder[^'"]*['"][^>]*>[\s\S]*?<\/ul>)/gi);
  return <>{blocks.map((block, index) => {
    if (!/writeup-examples--holder/.test(block)) return <BunproText key={index} value={block} />;
    const ids = [...block.matchAll(/data-study-question=['"](\d+)['"]/gi)].map((match) => match[1]);
    return <div key={index}>{ids.flatMap((id) => { const example = examples.find((item) => item.id === id); return example ? [<BunproExample key={id} attributes={example.attributes} title={title} />] : []; })}</div>;
  })}</>;
}
