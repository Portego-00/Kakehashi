"use dom";

import { Asset } from "expo-asset";
import japaneseFontAsset from "../../../assets/fonts/SourceHanSansJP-Regular.otf";
import { Play, Pause, MoreVertical, Lightbulb } from "lucide-react";
import React, { useState } from "react";
import { BunproText } from "./bunpro-dom-text";
import { pickCanonicalAnswer, sanitizeText } from "../../../web/src/features/bunpro/model";
import type { BunproJsonApiResource } from "../../types/bunpro";

type Attributes = Record<string, unknown>;
const object = (value: unknown): Attributes => value && typeof value === "object" && !Array.isArray(value) ? value as Attributes : {};
const records = (value: unknown) => Array.isArray(value) ? value.map(object) : [];
const texts = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(item => Array.isArray(item) ? item.filter((value): value is string => typeof value === "string") : typeof item === "string" ? [item] : []) : [];

export default function BunproDetailsDOM({ attributes, included, kind, resourceId, tab, theme, playingId, onPlay, onOpenLink, dom: _dom }: {
  attributes: Attributes; included: BunproJsonApiResource[]; kind: "grammar" | "vocab"; resourceId: string;
  tab: "Details" | "Examples"; theme: { background: string; text: string; muted: string; border: string; surface: string };
  playingId: string | null; onPlay: (id: string, urls: string[]) => Promise<void>; onOpenLink: (url: string) => Promise<void>;
  dom?: import("expo/dom").DOMProps;
}) {
  const [polite, setPolite] = useState(false);
  const [showSentence, setShowSentence] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [frequency, setFrequency] = useState("dictionary");
  const examples = included.filter(item => item.type === "study_question" || item.type.endsWith("_study_question")).sort((a, b) => Number(a.attributes.sentence_order ?? 999) - Number(b.attributes.sentence_order ?? 999));
  const writeup = included.find(item => item.type === "writeup")?.attributes.body;
  const grammarId = kind === "grammar" ? resourceId : undefined;
  const title = sanitizeText(attributes.title);
  const sources = ["dictionary", "general", "anime", "novels", "netflix"].filter(source => typeof attributes[`frequency_${source}`] === "number");
  const source = sources.includes(frequency) ? frequency : sources[0];
  const dictionary = object(attributes.jmdict_data);
  const senses = records(dictionary.sense).map(sense => ({ info: sense.info, antonym: sense.antonym, related: sense.related, english: records(sense.gloss).filter(gloss => gloss.lang === "eng").map(gloss => sanitizeText(gloss.text)).filter(Boolean) })).filter(sense => sense.english.length);
  const forms = [...records(dictionary.kanji), ...records(dictionary.kana)];
  const urls = (value: Attributes) => [value.female_audio_url, value.male_audio_url].filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url));
  const block = (heading: string, children: React.ReactNode) => <section><h3>{heading}</h3>{children}</section>;
  return <article className="bunpro-details-body" style={{ color: theme.text, background: theme.background, "--muted": theme.muted, "--border": theme.border, "--surface": theme.surface } as React.CSSProperties} onClickCapture={event => {
    const anchor = (event.target as Element).closest("a");
    if (anchor?.href) { event.preventDefault(); void onOpenLink(anchor.href); }
  }}>
    <style>{`@font-face{font-family:BunproJapanese;src:url("${Asset.fromModule(japaneseFontAsset).uri}") format("opentype");font-display:swap}`}{css}</style>
    {tab === "Details" ? <>
      {kind === "vocab" ? block("Dictionary Definition", <>
        {forms.some(form => form.common) ? <span className="common">Common</span> : null}
        <p className="muted">{texts(attributes.jmdict_pos).join(", ")}</p>
        {senses.length ? <ol>{senses.map((sense, index) => <li key={index}>{sense.english.join(", ")}{texts(sense.info).map(info => <p className="muted" key={info}>{info}</p>)}{texts(sense.antonym).length ? <p>Antonyms: {texts(sense.antonym).join("、")}</p> : null}{texts(sense.related).length ? <p>Related: {texts(sense.related).join("、")}</p> : null}</li>)}</ol> : <BunproText value={attributes.meaning} />}
        {forms.length ? <><p className="muted">All Forms</p><p lang="ja">{forms.map(form => sanitizeText(form.text)).join("、")}</p></> : null}
      </>) : null}
      {attributes.casual_structure || attributes.polite_structure ? block("Structure", <>
        {attributes.casual_structure && attributes.polite_structure ? <div className="controls"><button aria-pressed={!polite} onClick={() => setPolite(false)}>Standard</button><button aria-pressed={polite} onClick={() => setPolite(true)}>Polite</button></div> : null}
        <BunproText value={polite ? attributes.polite_structure : attributes.casual_structure || attributes.polite_structure} grammarId={grammarId} />
      </>) : null}
      {block("Details", <dl>{[["Part of Speech", attributes.part_of_speech_translation || attributes.part_of_speech || texts(attributes.jmdict_pos).join(", ")], ["Word Type", attributes.word_type_translation || attributes.word_type], ["Register", attributes.register_translation || attributes.register]].filter(([, value]) => value).map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd><BunproText value={value} /></dd></div>)}
        {kind === "vocab" && (attributes.kana || attributes.pitch_accent_stress) ? <div><dt>Pitch accent</dt><dd className="pitch"><button aria-label={playingId === "pronunciation" ? "Stop pronunciation" : "Play pronunciation"} disabled={!urls(attributes).length} onClick={() => void onPlay("pronunciation", urls(attributes))}>{playingId === "pronunciation" ? <Pause size={14} /> : <Play size={14} />}</button><span lang="ja">{(sanitizeText(attributes.kana).match(/.[ゃゅょぁぃぅぇぉャュョァィゥェォ]?/gu) ?? []).map((mora, i) => <span key={i} data-high={String(attributes.pitch_accent_stress)[i] === "H"} data-drop={String(attributes.pitch_accent_stress)[i] === "H" && String(attributes.pitch_accent_stress)[i + 1] === "L"}>{mora}</span>)}</span></dd></div> : null}
        {sources.length ? <div><dt><label>Frequency <select aria-label="Frequency source" value={source} onChange={event => setFrequency(event.target.value)}>{sources.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></dt><dd>Top {Number(attributes[`frequency_${source}`]).toLocaleString("en-US")}</dd></div> : null}
      </dl>)}
      {attributes.nuance_translation || attributes.nuance || attributes.caution ? block("Nuance", <><BunproText value={attributes.nuance_translation} grammarId={grammarId} /><BunproText value={attributes.nuance} grammarId={grammarId} /><BunproText value={attributes.caution} grammarId={grammarId} /></>) : null}
      {typeof writeup === "string" ? block(`About ${title}`, writeup.split(/(<ul[^>]*class=['"][^'"]*writeup-examples--holder[^'"]*['"][^>]*>[\s\S]*?<\/ul>)/gi).map((part, i) => /writeup-examples--holder/.test(part)
        ? <div key={i}>{[...part.matchAll(/data-study-question=['"](\d+)['"]/gi)].map(match => examples.find(item => item.id === match[1])).filter((item): item is BunproJsonApiResource => Boolean(item)).map(item => <Example key={item.id} item={item} title={title} grammarId={grammarId} playingId={playingId} onPlay={onPlay} showSentence showTranslation />)}</div>
        : <BunproText key={i} value={part} grammarId={grammarId} />)) : null}
      {kind === "vocab" && examples.length ? block("Examples", examples.map(item => <Example key={item.id} item={item} title={title} playingId={playingId} onPlay={onPlay} showSentence showTranslation />)) : null}
      {attributes.rare_kanji_warning ? <BunproText value={attributes.rare_kanji_warning} /> : null}
      {typeof attributes.discourse_link === "string" ? <p><a href={attributes.discourse_link}>Bunpro discussion ↗</a></p> : null}
    </> : <>
      <div className="controls"><button aria-pressed={showSentence} onClick={() => setShowSentence(!showSentence)}>Sentence</button><button aria-pressed={showTranslation} onClick={() => setShowTranslation(!showTranslation)}>Translation</button></div>
      {examples.length ? examples.map(item => <Example key={item.id} item={item} title={title} grammarId={grammarId} playingId={playingId} onPlay={onPlay} showSentence={showSentence} showTranslation={showTranslation} />) : <p>No example sentences available.</p>}
    </>}
  </article>;
}

function Example({ item, title, grammarId, playingId, onPlay, showSentence, showTranslation }: { item: BunproJsonApiResource; title: string; grammarId?: string; playingId: string | null; onPlay: (id: string, urls: string[]) => Promise<void>; showSentence: boolean; showTranslation: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const attributes = item.attributes;
  const answer = (pickCanonicalAnswer(attributes) || title).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const sentence = String(attributes.content ?? "").replace(/(?:_{2,}|＿{2,})/g, `<strong>${answer}</strong>`);
  const urls = [attributes.female_audio_url, attributes.male_audio_url].filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url));
  return <article className="example"><button className="play" aria-label={playingId === item.id ? "Pause example audio" : "Play example audio"} disabled={!urls.length} onClick={() => void onPlay(item.id, urls)}>{playingId === item.id ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}</button>
    <div className="example-text"><div lang="ja" hidden={!showSentence}><BunproText value={sentence} grammarId={grammarId} /></div><div className="muted" hidden={!showTranslation || hidden}><BunproText value={attributes.translation} /></div>{attributes.extra_info ? <p className="muted"><Lightbulb size={16} /> <BunproText value={attributes.extra_info} /></p> : null}</div>
    <div className="options"><button aria-label="Example options" aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreVertical size={20} /></button>{menu ? <button className="menu" onClick={() => { setHidden(!hidden); setMenu(false); }}>{hidden ? "Show translation" : "Hide translation"}</button> : null}</div>
  </article>;
}

const css = `
html,body,#root{margin:0;background:transparent}*{box-sizing:border-box}.bunpro-details-body{width:100%;font:16px/1.7 BunproJapanese,-apple-system,system-ui,sans-serif;padding:20px 24px;overflow-wrap:anywhere}
section{margin:0 0 28px}h3{font-size:20px;line-height:1.3;margin:0 0 16px}p{margin:8px 0 12px}ul,ol{padding-left:24px}li{margin:8px 0}table{border-collapse:collapse;max-width:100%;display:block;overflow-x:auto}td,th{padding:8px;border:1px solid var(--border)}a,[data-bunpro-accent]{color:#cc5b5d}a{text-decoration:underline}strong{font-weight:600}.muted,dt{color:var(--muted)}button,select{font:inherit;background:var(--surface);color:inherit;border:1px solid var(--border);border-radius:8px;padding:8px 12px;min-height:44px;cursor:pointer}button:disabled{opacity:.45}button[aria-pressed=true]{border-color:#cc5b5d;background:#cc5b5d;color:white}.controls{display:flex;gap:8px;margin:0 0 20px;flex-wrap:wrap}.common{padding:3px 8px;background:#017b37;color:white;border-radius:6px}dl{margin:0}dl>div{display:flex;align-items:center;gap:20px;padding:10px 0;border-bottom:1px solid var(--border)}dt{flex:0 0 40%}dd{margin:0;flex:1}.pitch>span{white-space:nowrap}.pitch span[data-high=true]{border-top:2px solid #cc5b5d}.pitch span[data-drop=true]{border-right:2px solid #cc5b5d}.pitch button{margin-right:8px}.example{display:flex;align-items:start;gap:12px;padding:18px 0;border-bottom:1px solid var(--border)}.example-text{flex:1;min-width:0}.example-text>[lang=ja]{font-size:20px;line-height:2.1}.play{padding:0;min-width:40px}.options{position:relative}.options>button{border:none;min-width:32px;padding:0}.options .menu{position:absolute;right:0;top:44px;width:170px;padding:8px;border:1px solid var(--border);z-index:2;box-shadow:0 2px 8px #0002}ruby{ruby-position:over}rt{font-size:.55em}ruby rt.bp-js-hide-furi{visibility:hidden}ruby:hover rt.bp-js-hide-furi{visibility:visible}[data-bunpro-caution]{color:#bc6728}[data-bunpro-caution-section]{padding:12px;background:#bc672814;border-left:3px solid #bc6728}blockquote{margin:12px 0;padding-left:16px;border-left:3px solid var(--border)}[hidden]{display:none!important}
`;
