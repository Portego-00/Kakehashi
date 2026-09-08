import type { DOMProps } from "expo/dom";
import type { NotebookBlock, NotebookSentence } from "./model";

/** Only the fields the embedded editor needs are sent across the native bridge. */
export interface NotebookEditorSubject {
  id: number;
  object: "radical" | "kanji" | "vocabulary" | "kana_vocabulary";
  data: {
    characters: string | null;
    slug?: string;
    level?: number;
    meanings: { meaning: string; primary?: boolean }[];
    auxiliary_meanings?: { meaning: string; type: "whitelist" | "blacklist" }[];
    readings?: { reading: string; primary?: boolean }[];
    character_images?: { url: string }[];
    pronunciation_audios?: { url: string }[];
    context_sentences?: { ja: string; en: string }[];
  };
}

export type NotebookSentenceInput = Pick<NotebookSentence, "japanese" | "kana" | "english" | "subjectIds"> & {
  id?: string;
  revision?: number;
};

export interface NotebookEditorProps {
  pageId: string;
  title?: string;
  icon?: string;
  value: NotebookBlock[];
  sentences: NotebookSentence[];
  pages: { id: string; title: string; icon?: string }[];
  subjects: NotebookEditorSubject[];
  theme: "light" | "dark";
  readOnly?: boolean;
  onChange: (blocks: NotebookBlock[]) => Promise<void>;
  onTitleChange?: (title: string) => Promise<void>;
  onOpenSubject: (subjectId: number) => Promise<void>;
  onOpenPage: (pageId: string) => Promise<void>;
  onSaveSentence: (input: NotebookSentenceInput) => Promise<NotebookSentence>;
  onReady?: () => Promise<void>;
  onError?: (message: string) => Promise<void>;
  dom?: DOMProps;
}
