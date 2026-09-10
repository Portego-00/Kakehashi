import { createContext, useContext } from "react";
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, defaultProps } from "@blocknote/core";
import { createReactBlockSpec, createReactInlineContentSpec } from "@blocknote/react";
import { ArrowUpRight, Link2, Pencil } from "lucide-react";
import { MobilePageIcon } from "./mobile-page-icon";
import type { NotebookEditorSubject, NotebookEditorProps } from "./editor-contract";
import type { NotebookSentence } from "./model";
import { MobileHandwriting } from "./mobile-handwriting";
import { NativeHandwriting } from "./native-handwriting";
import type { NotebookPaperColor } from "../../../web/src/features/notebooks/paper-appearance";
import type { NotebookDrawingPayload } from "../../../web/src/features/notebooks/handwriting";
import type { NativeInlineHandwritingProps } from "./native-inline-contract";

export const subjectLabel = (subject: NotebookEditorSubject) => subject.data.characters || subject.data.slug || subject.data.meanings[0]?.meaning || `Subject ${subject.id}`;
export const subjectMeaning = (subject: NotebookEditorSubject) => (subject.data.meanings.find((entry) => entry.primary) || subject.data.meanings[0])?.meaning || "";
export const subjectReading = (subject: NotebookEditorSubject) => (subject.data.readings?.find((entry) => entry.primary) || subject.data.readings?.[0])?.reading || "";

interface StudyContextValue {
  subjects: Map<number, NotebookEditorSubject>;
  sentences: Map<string, NotebookSentence>;
  pages: Map<string, NotebookEditorProps["pages"][number]>;
  readOnly: boolean;
  theme?: "light" | "dark";
  themeBackground?: string;
  onPaperColorChange?: (blockId: string, paperColor: NotebookPaperColor) => Promise<void>;
  onPreviewSubject: (subjectId: number) => void;
  onOpenPage: (pageId: string) => void;
  onEditSentence: (sentenceId: string) => void;
  loadHandwritingPreview?: NotebookEditorProps["onLoadHandwritingPreview"];
  onEditHandwriting?: (blockId: string, drawingId: string) => void;
  loadInlineHandwriting?: NotebookEditorProps["onLoadInlineHandwriting"];
  persistInlineHandwriting?: NotebookEditorProps["onPersistInlineHandwriting"];
  saveInlineHandwriting?: (blockId: string, drawingId: string, payload: NotebookDrawingPayload) => Promise<void>;
  nativeHandwriting?: NativeInlineHandwritingProps;
  saveNativeHandwriting?: (blockId: string, drawingId: string) => Promise<void>;
  nativeAutoStartBlockId?: string | null;
  onNativePreparing?: () => void;
  onNativePrepared?: () => void;
  onNativeFullscreenChange?: (blockId: string, fullscreen: boolean) => void;
}

export const MobileNotebookStudyContext = createContext<StudyContextValue | null>(null);

export function SubjectCharacter({ subject, label }: { subject?: NotebookEditorSubject; label: string }) {
  const image = !subject?.data.characters ? subject?.data.character_images?.[0]?.url : undefined;
  return image ? <img className="nb-subject-image" src={image} alt={label} /> : <span lang="ja">{label}</span>;
}

function WordReference({ subjectId, label, inline = false }: { subjectId: number; label: string; inline?: boolean }) {
  const context = useContext(MobileNotebookStudyContext);
  const subject = context?.subjects.get(subjectId);
  const display = subject ? subjectLabel(subject) : label || `Subject ${subjectId}`;
  return <button type="button" className={inline ? "nb-word-mention" : "nb-word-block"} data-kind={subject?.object || "vocabulary"} contentEditable={false} onClick={() => context?.onPreviewSubject(subjectId)} aria-label={`View ${display}`}>
    <SubjectCharacter subject={subject} label={display} />
    {!inline && subject ? <span className="nb-word-meaning">{subjectMeaning(subject)}</span> : null}
    {!inline ? <ArrowUpRight size={16} aria-hidden /> : null}
  </button>;
}

function SentenceReference({ sentenceId }: { sentenceId: string }) {
  const context = useContext(MobileNotebookStudyContext);
  const sentence = context?.sentences.get(sentenceId);
  if (!sentence) return <div className="nb-missing" contentEditable={false}><Link2 size={16} aria-hidden /> Linked sentence unavailable.</div>;
  return <div className="nb-sentence" contentEditable={false}>
    <div className="nb-sentence-main"><p lang="ja">{sentence.japanese}</p>{!context?.readOnly ? <button type="button" className="nb-icon-button" aria-label="Edit linked sentence" onClick={() => context?.onEditSentence(sentenceId)}><Pencil size={17} aria-hidden /></button> : null}</div>
    {sentence.kana ? <p className="nb-sentence-reading" lang="ja">{sentence.kana}</p> : null}
    {sentence.subjectIds.length ? <div className="nb-sentence-words" aria-label="Linked vocabulary">{sentence.subjectIds.map((id) => <WordReference key={id} subjectId={id} label="" inline />)}</div> : null}
    {sentence.english ? <details className="nb-translation"><summary>Translation</summary><p>{sentence.english}</p></details> : null}
  </div>;
}

function PageReference({ pageId }: { pageId: string }) {
  const context = useContext(MobileNotebookStudyContext);
  const page = context?.pages.get(pageId);
  return <button type="button" className="nb-page-link" contentEditable={false} disabled={!page} onClick={() => context?.onOpenPage(pageId)}>
    <MobilePageIcon icon={page?.icon} />
    <span>{page ? page.title || "Untitled" : "Page unavailable"}</span><ArrowUpRight size={16} aria-hidden />
  </button>;
}

function HandwritingReference({ blockId, drawingId, width, height, inkFormat, paperColor, previewFormat }: { blockId: string; drawingId: string; width: number; height: number; inkFormat: string; paperColor: string; previewFormat: string }) {
  const context = useContext(MobileNotebookStudyContext);
  if (!context?.readOnly && context?.nativeHandwriting?.nativeHandwritingAvailable && context.saveNativeHandwriting) {
    return <NativeHandwriting key={blockId} blockId={blockId} drawingId={drawingId} inkFormat={inkFormat === "strokes-v1" ? "strokes-v1" : "pencilkit-v1"} width={width} height={height} paperColor={paperColor} previewFormat={previewFormat} theme={context.theme ?? "light"} themeBackground={context.themeBackground} onPaperColorChange={context.onPaperColorChange} {...context.nativeHandwriting} autoStart={context.nativeAutoStartBlockId === blockId} onPreparing={context.onNativePreparing} onPrepared={context.onNativePrepared} onFullscreenChange={context.onNativeFullscreenChange} loadPreview={context.loadHandwritingPreview} saveAndClose={context.saveNativeHandwriting} />;
  }
  if (!drawingId) return <div className="nb-missing" contentEditable={false}>Empty handwriting area</div>;
  return <MobileHandwriting drawingId={drawingId} width={width} height={height} paperColor={paperColor} previewFormat={previewFormat} theme={context?.theme ?? "light"} themeBackground={context?.themeBackground} loadPreview={context?.loadHandwritingPreview} onEdit={inkFormat !== "strokes-v1" && !context?.readOnly && context?.onEditHandwriting ? () => context.onEditHandwriting?.(blockId, drawingId) : undefined} />;
}

// These persisted type names, props, and content modes match the web editor.
// Presentation is local so native taps do not depend on Next.js links or hover.
export const mobileNotebookSchema = BlockNoteSchema.create({
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
    handwriting: createReactBlockSpec({ type: "handwriting", propSchema: { drawingId: { default: "" }, inkFormat: { default: "pencilkit-v1", values: ["pencilkit-v1", "strokes-v1"] as const }, width: { default: 768 }, height: { default: 1024 }, paperColor: { default: "auto" }, previewFormat: { default: "", values: ["", "themed-v1"] as const } }, content: "none" }, {
      render: ({ block }) => <HandwritingReference blockId={block.id} {...block.props} />,
      toExternalHTML: () => <p>Handwritten notebook content — open the notebook to view.</p>,
    })(),
    vocabulary: createReactBlockSpec({ type: "vocabulary", propSchema: { subjectId: { default: 0 }, label: { default: "" } }, content: "none" }, {
      render: ({ block }) => <WordReference {...block.props} />,
      toExternalHTML: ({ block }) => <a href={`/subjects/${block.props.subjectId}`}>{block.props.label}</a>,
    })(),
    sentence: createReactBlockSpec({ type: "sentence", propSchema: { sentenceId: { default: "" } }, content: "none" }, {
      render: ({ block }) => <SentenceReference sentenceId={block.props.sentenceId} />,
      toExternalHTML: ({ block }) => <SentenceReference sentenceId={block.props.sentenceId} />,
    })(),
    pageLink: createReactBlockSpec({ type: "pageLink", propSchema: { pageId: { default: "" } }, content: "none" }, {
      render: ({ block }) => <PageReference pageId={block.props.pageId} />,
      toExternalHTML: ({ block }) => <a href={`/notebooks/${block.props.pageId}`}>Notebook page</a>,
    })(),
    callout: createReactBlockSpec({ type: "callout", propSchema: { textColor: defaultProps.textColor, backgroundColor: defaultProps.backgroundColor, icon: { default: "💡" } }, content: "inline" }, {
      render: ({ block, contentRef }) => <div className="nb-callout"><span contentEditable={false} aria-hidden><MobilePageIcon icon={block.props.icon} /></span><div ref={contentRef} /></div>,
      toExternalHTML: ({ contentRef }) => <aside ref={contentRef} />,
    })(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    vocabularyMention: createReactInlineContentSpec({ type: "vocabularyMention", propSchema: { subjectId: { default: 0 }, label: { default: "" } }, content: "none" }, {
      render: ({ inlineContent }) => <WordReference {...inlineContent.props} inline />,
      toExternalHTML: ({ inlineContent }) => <a href={`/subjects/${inlineContent.props.subjectId}`}>{inlineContent.props.label}</a>,
    }),
  },
});
