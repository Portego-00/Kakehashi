import { ArrowRight } from "lucide-react";
import { sanitizeText } from "./model";
import styles from "./bunpro.module.css";

// Verb forms listed by Kaijugation's Grammar Index, plus the conjunction
// practice linked directly from Bunpro's Verb + て lesson.
// Sources: https://kaijugation.bunpro.jp/study and https://bunpro.jp/grammar_points/verb-%E3%81%A6
const supportedSlugs = new Set([
  "う-Verbs", "る-Verbs", "する", "くる", "るverb-ない", "うverb--ない",
  "る-verb-past", "う-verb-past", "る-verb-neg-past", "う-verb-neg-past",
  "verb-て", "verbて-request", "ている1", "よう-おう", "たい",
  "Verb[potential]", "命令形", "ば", "たら", "causative", "Verb[passive]",
  "causative-passive", "てください", "ましょう",
]);

export function KaijugationPractice({ kind, id, attributes }: { kind: "grammar" | "vocab"; id: string; attributes: Record<string, unknown> }) {
  const slug = sanitizeText(attributes.slug);
  if (kind !== "grammar" || !supportedSlugs.has(slug) || !/^[1-9]\d*$/.test(id)) return null;
  const title = sanitizeText(attributes.furigana || attributes.title);
  return <aside className={styles.kaijugationPractice} aria-label="Conjugation practice">
    <div><h3>Practice {title} in <span>Kaijugation</span></h3><p>The only conjugation game with collateral damage!</p></div>
    <a href={`https://kaijugation.bunpro.jp/create/${id}/${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer" aria-label={`Practice ${title} in Kaijugation (opens in a new tab)`}><ArrowRight size={22} aria-hidden="true" /> Play!</a>
  </aside>;
}
