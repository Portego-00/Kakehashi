export const CUSTOM_CONTEXT_SENTENCE_VERSION = 1 as const;

export type CustomContextSentenceDisplayMode = "kanji" | "kana";

export interface CustomContextSentence {
  version: typeof CUSTOM_CONTEXT_SENTENCE_VERSION;
  id: string;
  subjectId: number;
  japanese: string;
  kana: string;
  english: string;
  displayMode: CustomContextSentenceDisplayMode;
  createdAt: string;
  updatedAt: string;
}

export type CreateCustomContextSentenceInput = Pick<
  CustomContextSentence,
  "subjectId" | "japanese" | "kana" | "english" | "displayMode"
>;

export type UpdateCustomContextSentenceInput = Partial<
  Pick<
    CustomContextSentence,
    "subjectId" | "japanese" | "kana" | "english" | "displayMode"
  >
>;

export type UpsertCustomContextSentenceInput =
  CreateCustomContextSentenceInput & {
    id?: string;
  };
