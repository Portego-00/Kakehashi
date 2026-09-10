import type { DOMProps } from "expo/dom";
import type { NotebookBlock, NotebookSentence } from "./model";
import type { NotebookDrawingPayload, NotebookDrawingReference, NotebookPaperAppearance } from "../../../web/src/features/notebooks/handwriting";
import type { InlineInkDocument } from "../../../web/src/features/notebooks/inline-ink";
import type { NativeInlineHandwritingProps } from "./native-inline-contract";

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

export interface NotebookEditorProps extends NativeInlineHandwritingProps {
  pageId: string;
  title?: string;
  icon?: string;
  value: NotebookBlock[];
  sentences: NotebookSentence[];
  pages: { id: string; title: string; icon?: string }[];
  subjects: NotebookEditorSubject[];
  theme: "light" | "dark";
  themeBackground?: string;
  readOnly?: boolean;
  onChange: (blocks: NotebookBlock[]) => Promise<void>;
  onTitleChange?: (title: string) => Promise<void>;
  onOpenSubject: (subjectId: number) => Promise<void>;
  onOpenPage: (pageId: string) => Promise<void>;
  onSaveSentence: (input: NotebookSentenceInput) => Promise<NotebookSentence>;
  onReady?: () => Promise<void>;
  handwritingAvailable?: boolean;
  onEditHandwriting?: (drawingId?: string) => Promise<NotebookDrawingReference | null>;
  onLoadHandwritingPreview?: (drawingId: string, appearance?: NotebookPaperAppearance) => Promise<string>;
  onHandwritingCommitted?: (drawingId: string) => Promise<void>;
  inlineHandwritingAvailable?: boolean;
  onLoadInlineHandwriting?: (blockId: string, drawingId: string) => Promise<InlineInkDocument | null>;
  onPersistInlineHandwriting?: (blockId: string, drawingId: string, document: InlineInkDocument) => Promise<void>;
  onSaveInlineHandwriting?: (blockId: string, drawingId: string, payload: NotebookDrawingPayload) => Promise<NotebookDrawingReference>;
  onInlineHandwritingCommitted?: (blockId: string, drawingId: string) => Promise<void>;
  onError?: (message: string) => Promise<void>;
  dom?: DOMProps;
}
