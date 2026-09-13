import type { CharacterImage } from "@/types/wanikani";
import radicalFacts from "./radicals.generated.json";

export interface DemoRadicalFact {
  id: number;
  object: "radical";
  slug: string;
  characters: string | null;
  meanings: string[];
  level: number;
  sourceUrl: string;
  characterImages?: CharacterImage[];
  /** Public component relationships, limited to the demo's level 1–21 kanji. */
  amalgamationSubjectIds: number[];
}

export const DEMO_RADICAL_FACTS = radicalFacts as DemoRadicalFact[];
