import type { JlptLevel } from "../../types";

export type ReadingFamily =
  | "reading-short"
  | "reading-mid"
  | "reading-long"
  | "reading-integrated"
  | "reading-thematic"
  | "information-retrieval";

export interface ReadingSource {
  label?: string;
  body: string;
}

export interface ReadingSeed {
  /** Stable editorial identity; never derive this from array position. */
  semanticId: string;
  /** Stable identity for a source that may support multiple scored questions. */
  passageId?: string;
  /** One-based position within a shared passage group. */
  passageQuestionIndex?: number;
  editorialStatus?: "machine-validated" | "sampled-ai-review";
  level: JlptLevel;
  family: ReadingFamily;
  /** Human-readable identity used to audit substantive, not merely textual, diversity. */
  semanticFocus: string;
  sources: readonly ReadingSource[];
  question: string;
  options: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** Exact fragments in the source material that support the keyed inference. */
  evidence: readonly string[];
  explanation: string;
}

export function readingBody(seed: Pick<ReadingSeed, "sources">) {
  return seed.sources
    .map((source) =>
      source.label ? `【${source.label}】\n${source.body}` : source.body,
    )
    .join("\n\n");
}

export function readingCharacterCount(seed: Pick<ReadingSeed, "sources">) {
  return seed.sources.reduce(
    (total, source) => total + source.body.replace(/\s/gu, "").length,
    0,
  );
}
