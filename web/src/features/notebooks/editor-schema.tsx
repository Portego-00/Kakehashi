"use client";

import { createContext, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, defaultProps } from "@blocknote/core";
import { createReactBlockSpec, createReactInlineContentSpec } from "@blocknote/react";
import { ArrowUpRight, ChevronRight, FileText, Link2, Pencil, Volume2 } from "lucide-react";
import type { Subject } from "@/types/wanikani";
import type { NotebookPage, NotebookSentence } from "./model";
import styles from "./editor.module.css";
import referenceStyles from "./references.module.css";
import NotebookSubjectReference from "./NotebookSubjectReference";
import NotebookHandwriting from "./NotebookHandwriting";
import type { NotebookSubjectCatalogProps } from "./NotebookSubjectCatalogStatus";

export { subjectLabel, subjectMeaning, subjectReading } from "./NotebookSubjectReference";

export type NotebookPageLink = Pick<NotebookPage, "id" | "title" | "icon">;
export type NotebookSentenceInput = Pick<NotebookSentence, "japanese" | "kana" | "english" | "subjectIds"> & { id?: string; revision?: number };

interface StudyContextValue extends NotebookSubjectCatalogProps {
  subjects: Map<number, Subject>;
  sentences: Map<string, NotebookSentence>;
  pages: Map<string, NotebookPageLink>;
  readOnly: boolean;
  onOpenSubject: (subjectId: number) => void;
  onOpenPage: (pageId: string) => void;
  onEditSentence: (sentenceId: string) => void;
}

const StudyContext = createContext<StudyContextValue | null>(null);

export function useNotebookSubjectCatalog(): NotebookSubjectCatalogProps {
  const context = useContext(StudyContext);
  return { subjectsLoading: context?.subjectsLoading, subjectsError: context?.subjectsError, onRetrySubjects: context?.onRetrySubjects };
}

export function NotebookStudyProvider({ children, subjects, sentences, pages, ...actions }: {
  children: ReactNode;
  subjects: Subject[];
  sentences: NotebookSentence[];
  pages: NotebookPageLink[];
} & Omit<StudyContextValue, "subjects" | "sentences" | "pages">) {
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const sentenceMap = useMemo(() => new Map(sentences.map((sentence) => [sentence.id, sentence])), [sentences]);
  const pageMap = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  return <StudyContext value={{ ...actions, subjects: subjectMap, sentences: sentenceMap, pages: pageMap }}>{children}</StudyContext>;
}

function WordReference({ subjectId, label, inline = false }: { subjectId: number; label: string; inline?: boolean }) {
  const context = useContext(StudyContext);
  const subject = context?.subjects.get(subjectId);
  return <NotebookSubjectReference subject={subject} subjectId={subjectId} label={label} inline={inline} subjectsLoading={context?.subjectsLoading} subjectsError={context?.subjectsError} onRetrySubjects={context?.onRetrySubjects} />;
}

export function SentenceReference({ sentenceId }: { sentenceId: string }) {
  const context = useContext(StudyContext);
  const translationId = useId();
  const [translationExpanded, setTranslationExpanded] = useState(false);
  const sentence = context?.sentences.get(sentenceId);
  if (!sentence) return <div className={referenceStyles.missingReference} contentEditable={false}><Link2 size={16} aria-hidden /> This linked sentence is unavailable.</div>;
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
  const play = () => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence.japanese);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    const voice = window.speechSynthesis.getVoices().find((voice) => voice.lang.startsWith("ja"));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };
  return <div className={referenceStyles.sentenceBlock} contentEditable={false}>
    <div className={referenceStyles.sentenceMain}>
      <p className={referenceStyles.sentenceJapanese} lang="ja">{sentence.japanese}</p>
      <div className={referenceStyles.sentenceActions}>
        {canSpeak ? <button type="button" className={referenceStyles.iconButton} aria-label="Read sentence aloud" title="Read aloud" onClick={play}><Volume2 size={16} aria-hidden /></button> : null}
        {!context?.readOnly ? <button type="button" className={referenceStyles.iconButton} aria-label="Edit linked sentence" title="Edit sentence" onClick={() => context?.onEditSentence(sentenceId)}><Pencil size={15} aria-hidden /></button> : null}
      </div>
    </div>
    {sentence.english || sentence.subjectIds.length ? <div className={referenceStyles.sentenceFooter}>
      {sentence.subjectIds.length > 0 ? <div className={referenceStyles.sentenceWords} aria-label="Linked vocabulary">{sentence.subjectIds.map((id) => <WordReference key={id} subjectId={id} label="" inline />)}</div> : null}
      {sentence.english ? <button
        type="button"
        className={referenceStyles.translationToggle}
        aria-expanded={translationExpanded}
        aria-controls={translationId}
        onClick={() => setTranslationExpanded((expanded) => !expanded)}
      ><ChevronRight size={12} aria-hidden />Translation</button> : null}
    </div> : null}
    {sentence.english ? <div
      id={translationId}
      className={referenceStyles.translation}
      data-expanded={translationExpanded}
      aria-hidden={!translationExpanded}
      inert={!translationExpanded}
    ><div className={referenceStyles.translationContent}><p>{sentence.english}</p></div></div> : null}
  </div>;
}

function PageReference({ pageId }: { pageId: string }) {
  const context = useContext(StudyContext);
  const page = context?.pages.get(pageId);
  if (!page) return <span className={referenceStyles.pageBlock} contentEditable={false} aria-disabled="true"><FileText size={18} aria-hidden /><span>Page unavailable</span></span>;
  return <button type="button" className={referenceStyles.pageBlock} contentEditable={false} onClick={() => context?.onOpenPage(pageId)}>
    {page?.icon ? <span aria-hidden>{page.icon}</span> : <FileText size={18} aria-hidden />}
    <span>{page?.title || (page ? "Untitled" : "Page unavailable")}</span>
    <ArrowUpRight size={15} aria-hidden />
  </button>;
}

const vocabularyBlock = createReactBlockSpec({
  type: "vocabulary",
  propSchema: { subjectId: { default: 0 }, label: { default: "" } },
  content: "none",
}, {
  render: ({ block }) => <WordReference {...block.props} />,
  toExternalHTML: ({ block }) => <a href={`/subjects/${block.props.subjectId}`} target="_blank" rel="noopener noreferrer">{block.props.label}</a>,
})();

const sentenceBlock = createReactBlockSpec({
  type: "sentence",
  propSchema: { sentenceId: { default: "" } },
  content: "none",
}, {
  render: ({ block }) => <SentenceReference sentenceId={block.props.sentenceId} />,
  toExternalHTML: ({ block }) => <SentenceReference sentenceId={block.props.sentenceId} />,
})();

const pageLinkBlock = createReactBlockSpec({
  type: "pageLink",
  propSchema: { pageId: { default: "" } },
  content: "none",
}, {
  render: ({ block }) => <PageReference pageId={block.props.pageId} />,
  toExternalHTML: ({ block }) => <a href={`/notebooks/${block.props.pageId}`}>Notebook page</a>,
})();

const handwritingReactBlock = createReactBlockSpec({
  type: "handwriting",
  propSchema: { drawingId: { default: "" }, width: { default: 768 }, height: { default: 1024 }, inkFormat: { default: "pencilkit-v1", values: ["pencilkit-v1", "strokes-v1"] as const }, paperColor: { default: "" }, previewFormat: { default: "", values: ["", "themed-v1"] as const } },
  content: "none",
}, {
  render: ({ block, editor }) => <NotebookHandwriting {...block.props} onPaperColorChange={editor.isEditable ? (paperColor) => { if (editor.isEditable) editor.updateBlock(block, { props: { paperColor } }); } : undefined} />,
})();

const handwritingBlock = {
  ...handwritingReactBlock,
  implementation: {
    ...handwritingReactBlock.implementation,
    // The React spec wrapper normally copies saved props to HTML attributes.
    // Return plain external HTML so exports contain neither an asset URL nor ID.
    toExternalHTML: () => {
      const element = document.createElement("p");
      element.textContent = "Handwriting (view in your notebook)";
      return { dom: element };
    },
  },
};

const vocabularyInline = createReactInlineContentSpec({
  type: "vocabularyMention",
  propSchema: { subjectId: { default: 0 }, label: { default: "" } },
  content: "none",
}, {
  render: ({ inlineContent }) => <WordReference {...inlineContent.props} inline />,
  toExternalHTML: ({ inlineContent }) => <a href={`/subjects/${inlineContent.props.subjectId}`} target="_blank" rel="noopener noreferrer">{inlineContent.props.label}</a>,
});

const calloutBlock = createReactBlockSpec({
  type: "callout",
  propSchema: { textColor: defaultProps.textColor, backgroundColor: defaultProps.backgroundColor, icon: { default: "💡" } },
  content: "inline",
}, {
  render: ({ block, contentRef }) => <div className={styles.callout}><span contentEditable={false} aria-hidden>{block.props.icon}</span><div className={styles.calloutContent} ref={contentRef} /></div>,
  toExternalHTML: ({ contentRef }) => <aside ref={contentRef} />,
})();

// Omit general media uploads; handwriting references are saved by the native canvas.
export const notebookSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    toggleListItem: defaultBlockSpecs.toggleListItem,
    quote: defaultBlockSpecs.quote,
    divider: defaultBlockSpecs.divider,
    codeBlock: defaultBlockSpecs.codeBlock,
    table: defaultBlockSpecs.table,
    vocabulary: vocabularyBlock,
    sentence: sentenceBlock,
    pageLink: pageLinkBlock,
    callout: calloutBlock,
    handwriting: handwritingBlock,
  },
  inlineContentSpecs: { ...defaultInlineContentSpecs, vocabularyMention: vocabularyInline },
});
