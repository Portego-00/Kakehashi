"use client";

import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { en } from "@blocknote/core/locales";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useComponentsContext, useCreateBlockNote, type DefaultReactSuggestionItem, type FloatingUIOptions, type SuggestionMenuProps } from "@blocknote/react";
import { flip, offset, shift, size } from "@floating-ui/react-dom";
import { BookOpen, FileText, Lightbulb, Link2, MessageSquareText, Plus, Search, Trash2, X } from "lucide-react";
import type { Subject } from "@/types/wanikani";
import type { NotebookBlock, NotebookSentence } from "./model";
import { notebookSchema, NotebookStudyProvider, subjectLabel, subjectMeaning, subjectReading, useNotebookSubjectCatalog, type NotebookPageLink, type NotebookSentenceInput } from "./editor-schema";
import { findNotebookSubjects, isSafeNotebookLink } from "./editor-utils";
import NotebookSentenceForm from "./NotebookSentenceForm";
import NotebookSubjectPicker from "./NotebookSubjectPicker";
import NotebookSubjectCatalogStatus, { type NotebookSubjectCatalogProps } from "./NotebookSubjectCatalogStatus";
import "@blocknote/mantine/style.css";
import styles from "./editor.module.css";

export interface NotebookEditorProps extends NotebookSubjectCatalogProps {
  value: NotebookBlock[];
  onChange: (blocks: NotebookBlock[]) => void;
  sentences: NotebookSentence[];
  pages: NotebookPageLink[];
  subjects: Subject[];
  onSaveSentence: (input: NotebookSentenceInput) => Promise<NotebookSentence>;
  onDeleteSentence?: (sentenceId: string) => Promise<void>;
  onOpenSubject: (subjectId: number) => void;
  onOpenPage: (pageId: string) => void;
  readOnly?: boolean;
  theme?: "light" | "dark";
  insertRequest?: { id: string; type: "vocabulary" | "sentence"; subjectId?: number; sentenceId?: string };
}

type Picker = { type: "word"; inline?: boolean } | { type: "page" } | { type: "sentence"; sentenceId?: string };
type SubjectSuggestionItem = DefaultReactSuggestionItem & { catalogPending?: true };

// Floating UI knows the viewport edges, but the app's sticky navigation also
// occupies that viewport. Apply the same boundary to placement and sizing.
function menuPadding() {
  const header = document.querySelector('nav[aria-label="Main navigation"]')?.closest("header")?.getBoundingClientRect();
  const mobileNav = document.querySelector('nav[aria-label="Mobile navigation"]')?.getBoundingClientRect();
  return { top: Math.max(0, header?.bottom ?? 0) + 8, right: 12, bottom: (mobileNav?.height ?? 0) + 12, left: 12 };
}

const suggestionPosition: FloatingUIOptions = {
  useFloatingOptions: {
    strategy: "fixed",
    middleware: [
      offset(8),
      flip(() => ({ padding: menuPadding() })),
      shift(() => ({ padding: menuPadding(), crossAxis: true })),
      size(() => ({ padding: menuPadding(), apply({ availableHeight, elements }) {
        const height = `${Math.max(0, Math.min(360, availableHeight))}px`;
        elements.floating.style.maxHeight = height;
        elements.floating.style.setProperty("--notebook-menu-height", height);
      } })),
    ],
  },
  elementProps: { style: { maxHeight: 360, zIndex: 80 } },
};

function clearBlockSelection(editor: typeof notebookSchema.BlockNoteEditor) {
  if (!editor.domElement?.querySelector(".ProseMirror-selectednode")) return false;
  const current = editor.getTextCursorPosition().block;
  const blocks: typeof editor.document = [];
  const visit = (entries: typeof editor.document) => entries.forEach((block) => { blocks.push(block); visit(block.children); });
  visit(editor.document);
  const index = blocks.findIndex((block) => block.id === current.id);
  const next = blocks.slice(index + 1).find((block) => block.content !== undefined);
  const previous = blocks.slice(0, index).reverse().find((block) => block.content !== undefined);
  // Move the actual editor selection without changing the saved document.
  if (next || previous) editor.setTextCursorPosition((next || previous)!, next ? "start" : "end");
  else editor.blur();
  return true;
}

function insertStudyBlock(editor: typeof notebookSchema.BlockNoteEditor, block: typeof notebookSchema.PartialBlock) {
  editor.focus();
  const cursor = editor.getTextCursorPosition();
  // Toolbar actions also work after selecting a non-editable word or sentence.
  // The slash-menu helper assumes that the current block contains editable text.
  if (cursor.block.content === undefined) {
    const inserted = editor.insertBlocks([block, { type: "paragraph" }], cursor.block, "after");
    editor.setTextCursorPosition(inserted[1], "start");
  } else insertOrUpdateBlockForSlashMenu(editor, block);
}

function SubjectSuggestionMenu(props: SuggestionMenuProps<SubjectSuggestionItem>) {
  const catalog = useNotebookSubjectCatalog();
  const Menu = useComponentsContext()?.SuggestionMenu;
  if ((!props.items.length || props.items[0]?.catalogPending) && (catalog.subjectsLoading || catalog.subjectsError)) return <div id="bn-suggestion-menu" className={`bn-suggestion-menu ${styles.subjectSuggestionState}`} role="dialog" aria-label="Subject search">
    <NotebookSubjectCatalogStatus {...catalog} compact rows={2} />
    {props.items[0] ? <button type="button" id="bn-suggestion-menu-item-0" className={styles.subjectSuggestionAction} onClick={() => props.onItemClick?.(props.items[0])}><Search size={14} aria-hidden />Open subject picker</button> : null}
  </div>;
  if (!Menu) return null;
  return <Menu.Root id="bn-suggestion-menu" className="bn-suggestion-menu">
    {props.items.map((item, index) => <Menu.Item key={`${item.title}-${index}`} id={`bn-suggestion-menu-item-${index}`} className="bn-suggestion-menu-item" item={item} isSelected={props.selectedIndex === index} onClick={() => props.onItemClick?.(item)} />)}
    {!props.items.length && props.loadingState === "loaded" ? <Menu.EmptyItem className="bn-suggestion-menu-item">No subjects found.</Menu.EmptyItem> : null}
    {props.loadingState !== "loaded" ? <Menu.Loader className="bn-suggestion-menu-loader" /> : null}
  </Menu.Root>;
}

export default function NotebookEditor({ value, onChange, sentences, pages, subjects, subjectsLoading = false, subjectsError = null, onRetrySubjects, onSaveSentence, onDeleteSentence, onOpenSubject, onOpenPage, readOnly = false, theme = "light", insertRequest }: NotebookEditorProps) {
  const [picker, setPicker] = useState<Picker | null>(null);
  const [notice, setNotice] = useState("");
  const handledRequest = useRef("");
  const editor = useCreateBlockNote({
    schema: notebookSchema,
    initialContent: value.length ? value as typeof notebookSchema.PartialBlock[] : [{ type: "paragraph" }],
    dictionary: { ...en, placeholders: { ...en.placeholders, default: "Write, or type ‘/’ for blocks and study tools…" } },
    links: { isValidLink: isSafeNotebookLink, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } },
    domAttributes: { editor: { "aria-label": "Notebook page content", spellcheck: "false" } },
    pasteHandler: ({ event, defaultPasteHandler }) => {
      if (event.clipboardData?.files.length) {
        setNotice("Notebooks support text and links. Attachments are not stored.");
        if (!event.clipboardData.getData("text/plain")) return true;
      }
      return defaultPasteHandler();
    },
  });

  // The workspace keys this component by page and external revision. Saving and
  // live sentence changes never replace the document or interrupt Japanese IME.
  useEffect(() => {
    editor.portalElement?.classList.add(styles.editorPortal);
    return () => editor.portalElement?.classList.remove(styles.editorPortal);
  }, [editor]);

  useEffect(() => {
    const dismissSelection = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || editor.domElement?.contains(target) || editor.portalElement?.contains(target) || target.closest('dialog, [role="dialog"], [role="toolbar"]')) return;
      if (clearBlockSelection(editor)) editor.blur();
    };
    document.addEventListener("pointerdown", dismissSelection, true);
    return () => document.removeEventListener("pointerdown", dismissSelection, true);
  }, [editor]);

  const insertWord = useCallback((subject: Subject, inline = false) => {
    editor.focus();
    const props = { subjectId: subject.id, label: subjectLabel(subject) };
    if (inline) {
      const cursor = editor.getTextCursorPosition();
      if (cursor.block.content === undefined) {
        const paragraph = editor.insertBlocks([{ type: "paragraph" }], cursor.block, "after")[0];
        editor.setTextCursorPosition(paragraph, "start");
      }
      editor.insertInlineContent([{ type: "vocabularyMention", props }, " "]);
    } else insertStudyBlock(editor, { type: "vocabulary", props });
    setPicker(null);
  }, [editor]);

  const insertSentence = useCallback((sentence: NotebookSentence) => {
    editor.focus();
    insertStudyBlock(editor, { type: "sentence", props: { sentenceId: sentence.id } });
    setPicker(null);
  }, [editor]);

  const subjectSuggestions = useCallback(async (query: string): Promise<SubjectSuggestionItem[]> => {
    const matches = findNotebookSubjects(subjects, query, 15).map((subject) => ({
      title: subjectLabel(subject), subtext: [subjectReading(subject), subjectMeaning(subject)].filter(Boolean).join(" · "), icon: <BookOpen size={16} />, onItemClick: () => insertWord(subject, true),
    }));
    if (matches.length || (!subjectsLoading && !subjectsError)) return matches;
    // A real action keeps BlockNote from treating an unfinished catalog load as
    // repeated empty queries and closing the menu while the user is typing.
    return [{ title: "Open subject picker", catalogPending: true, onItemClick: () => setPicker({ type: "word", inline: true }) }];
  }, [subjects, subjectsLoading, subjectsError, insertWord]);

  useEffect(() => {
    if (!insertRequest || handledRequest.current === insertRequest.id || readOnly) return;
    if (insertRequest.type === "sentence" && insertRequest.sentenceId) {
      handledRequest.current = insertRequest.id;
      insertStudyBlock(editor, { type: "sentence", props: { sentenceId: insertRequest.sentenceId } });
    } else if (insertRequest.type === "vocabulary") {
      const subject = subjects.find((subject) => subject.id === insertRequest.subjectId);
      if (subject) {
        handledRequest.current = insertRequest.id;
        insertStudyBlock(editor, { type: "vocabulary", props: { subjectId: subject.id, label: subjectLabel(subject) } });
      }
    }
  }, [editor, insertRequest, readOnly, subjects]);

  const slashItems = useMemo<DefaultReactSuggestionItem[]>(() => [
    { title: "Word", aliases: ["word", "vocabulary", "kanji", "radical", "subject"], group: "Study", subtext: "Link a radical, kanji, or vocabulary", icon: <BookOpen size={18} />, onItemClick: () => setPicker({ type: "word" }) },
    { title: "Sentence", aliases: ["sentence", "example", "context"], group: "Study", subtext: "Add a shared example sentence", icon: <MessageSquareText size={18} />, onItemClick: () => setPicker({ type: "sentence" }) },
    { title: "Page link", aliases: ["page", "link", "note"], group: "Study", subtext: "Connect another page in your notebook", icon: <FileText size={18} />, onItemClick: () => setPicker({ type: "page" }) },
    { title: "Callout", aliases: ["callout", "tip", "grammar"], group: "Study", subtext: "Highlight a grammar rule or useful reminder", icon: <Lightbulb size={18} />, onItemClick: () => { insertStudyBlock(editor, { type: "callout" }); } },
    ...getDefaultReactSlashMenuItems(editor),
  ], [editor]);

  const selectedSentence = picker?.type === "sentence" && picker.sentenceId ? sentences.find((sentence) => sentence.id === picker.sentenceId) : undefined;

  return <NotebookStudyProvider subjects={subjects} subjectsLoading={subjectsLoading} subjectsError={subjectsError} onRetrySubjects={onRetrySubjects} sentences={sentences} pages={pages} readOnly={readOnly} onOpenSubject={onOpenSubject} onOpenPage={onOpenPage} onEditSentence={(sentenceId) => setPicker({ type: "sentence", sentenceId })}>
    <div className={styles.editor} onKeyDownCapture={(event) => {
      // Open previews and BlockNote menus handle Escape before block selection.
      const popupOpen = event.currentTarget.querySelector('[aria-haspopup="dialog"][aria-expanded="true"]') || editor.portalElement?.querySelector('[role="listbox"], [role="menu"], [role="dialog"]');
      if (event.key === "Escape" && !event.defaultPrevented && !popupOpen && clearBlockSelection(editor)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }} onDropCapture={(event) => {
      if (event.dataTransfer.files.length) {
        event.preventDefault();
        event.stopPropagation();
        setNotice("Notebooks support text and links. Attachments are not stored.");
      }
    }}>
      {!readOnly ? <div className={styles.studyToolbar} role="toolbar" aria-label="Notebook study tools">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setPicker({ type: "word" })}><BookOpen size={15} aria-hidden /> Word</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setPicker({ type: "sentence" })}><MessageSquareText size={15} aria-hidden /> Sentence</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setPicker({ type: "page" })}><Link2 size={15} aria-hidden /> Page link</button>
        <span className={styles.toolbarHint}>Type / for blocks · @ for words</span>
      </div> : null}
      {notice ? <div className={styles.notice} role="status"><span>{notice}</span><button className={styles.iconButton} type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={14} aria-hidden /></button></div> : null}
      <BlockNoteView editor={editor} theme={theme} editable={!readOnly} slashMenu={false} filePanel={false} onChange={() => {
        const document = editor.document as NotebookBlock[];
        onChange(document);
      }}>
        <SuggestionMenuController triggerCharacter="/" floatingUIOptions={suggestionPosition} getItems={async (query) => filterSuggestionItems(slashItems, query)} />
        <SuggestionMenuController triggerCharacter="@" floatingUIOptions={suggestionPosition} suggestionMenuComponent={SubjectSuggestionMenu} minQueryLength={1} getItems={subjectSuggestions} />
      </BlockNoteView>
    </div>
    {picker ? <StudyPicker key={`${picker.type}-${picker.type === "sentence" ? picker.sentenceId || "new" : ""}`} picker={picker} sentences={sentences} pages={pages} subjects={subjects} subjectsLoading={subjectsLoading} subjectsError={subjectsError} onRetrySubjects={onRetrySubjects} sentence={selectedSentence} onClose={() => setPicker(null)} onWord={insertWord} onSentence={insertSentence} onPage={(pageId) => {
      editor.focus();
      insertStudyBlock(editor, { type: "pageLink", props: { pageId } });
      setPicker(null);
    }} onSaveSentence={onSaveSentence} onDeleteSentence={readOnly ? undefined : onDeleteSentence} /> : null}
  </NotebookStudyProvider>;
}

function StudyPicker({ picker, subjects, subjectsLoading = false, subjectsError, onRetrySubjects, sentences, pages, sentence, onClose, onWord, onSentence, onPage, onSaveSentence, onDeleteSentence }: {
  picker: Picker;
  subjects: Subject[];
  sentences: NotebookSentence[];
  pages: NotebookPageLink[];
  sentence?: NotebookSentence;
  onClose: () => void;
  onWord: (subject: Subject, inline?: boolean) => void;
  onSentence: (sentence: NotebookSentence) => void;
  onPage: (pageId: string) => void;
  onSaveSentence: (input: NotebookSentenceInput) => Promise<NotebookSentence>;
  onDeleteSentence?: (sentenceId: string) => Promise<void>;
} & NotebookSubjectCatalogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"existing" | "new">(sentence ? "new" : "existing");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [libraryNotice, setLibraryNotice] = useState("");
  const deferredQuery = useDeferredValue(query);
  const queryText = deferredQuery.trim().toLocaleLowerCase();
  const wordResults = useMemo(() => findNotebookSubjects(subjects, deferredQuery, 40), [subjects, deferredQuery]);
  const sentenceResults = useMemo(() => sentences.filter((candidate) => !queryText || [candidate.japanese, candidate.kana, candidate.english].some((text) => text.toLocaleLowerCase().includes(queryText))).slice(0, 40), [sentences, queryText]);
  const builtInResults = useMemo(() => {
    if (!queryText || picker.type !== "sentence") return [];
    const results: Array<{ subject: Subject; japanese: string; english: string }> = [];
    const seen = new Set(sentences.map((entry) => entry.japanese));
    const matchingWords = new Set(wordResults.map((subject) => subject.id));
    for (const subject of subjects) {
      for (const context of subject.data.context_sentences || []) {
        if (seen.has(context.ja) || !(matchingWords.has(subject.id) || context.ja.includes(queryText) || context.en.toLocaleLowerCase().includes(queryText))) continue;
        seen.add(context.ja);
        results.push({ subject, japanese: context.ja, english: context.en });
        if (results.length >= 30) return results;
      }
    }
    return results;
  }, [subjects, sentences, queryText, picker.type, wordResults]);
  const pageResults = pages.filter((page) => !queryText || page.title.toLocaleLowerCase().includes(queryText));

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    return () => { if (element.open && typeof element.close === "function") element.close(); };
  }, []);

  const saveBuiltIn = async (candidate: { subject: Subject; japanese: string; english: string }) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await onSaveSentence({ japanese: candidate.japanese, english: candidate.english, kana: "", subjectIds: [candidate.subject.id] });
      onSentence(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This sentence could not be added. Please try again.");
      setSaving(false);
    }
  };

  const deleteSentence = async (sentenceId: string) => {
    if (!onDeleteSentence || saving) return;
    setSaving(true);
    setDeleting(true);
    setError("");
    setLibraryNotice("");
    try {
      await onDeleteSentence(sentenceId);
      setDeleteCandidateId(null);
      setLibraryNotice("Sentence deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This sentence could not be deleted. Please try again.");
    } finally {
      setSaving(false);
      setDeleting(false);
    }
  };

  const title = picker.type === "word" ? "Link a subject" : picker.type === "page" ? "Link a notebook page" : sentence ? "Edit linked sentence" : "Add a sentence";
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <header className={styles.dialogHeader}><h2 id={titleId}>{title}</h2><button type="button" className={styles.iconButton} disabled={saving} aria-label="Close" onClick={onClose}><X size={20} aria-hidden /></button></header>
    {picker.type === "sentence" && !sentence ? <div className={styles.tabs} role="tablist" aria-label="Sentence source">
      <button id={`${titleId}-existing`} type="button" role="tab" disabled={saving} aria-controls={`${titleId}-panel`} aria-selected={tab === "existing"} onClick={() => setTab("existing")}>Existing sentences</button>
      <button id={`${titleId}-new`} type="button" role="tab" disabled={saving} aria-controls={`${titleId}-panel`} aria-selected={tab === "new"} onClick={() => setTab("new")}><Plus size={15} aria-hidden /> Write a sentence</button>
    </div> : null}
    {picker.type === "word" ? <NotebookSubjectPicker subjects={subjects} subjectsLoading={subjectsLoading} subjectsError={subjectsError} onRetrySubjects={onRetrySubjects} initialInline={picker.inline} onSelect={onWord} /> : picker.type === "sentence" && tab === "new" ? <div id={`${titleId}-panel`} role={sentence ? undefined : "tabpanel"} aria-labelledby={sentence ? undefined : `${titleId}-new`}><NotebookSentenceForm sentence={sentence} subjects={subjects} subjectsLoading={subjectsLoading} subjectsError={subjectsError} onRetrySubjects={onRetrySubjects} onCancel={onClose} onSavingChange={setSaving} onSave={async (input) => {
      const saved = await onSaveSentence(input);
      if (sentence) onClose(); else onSentence(saved);
    }} /></div> : <div id={`${titleId}-panel`} role={picker.type === "sentence" ? "tabpanel" : undefined} aria-labelledby={picker.type === "sentence" ? `${titleId}-existing` : undefined}>
      <div className={styles.pickerSearch}><div className={styles.searchField}><Search size={17} aria-hidden /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={picker.type === "page" ? "Search pages…" : "Search sentences or vocabulary…"} aria-label={picker.type === "page" ? "Search pages" : "Search sentences"} autoComplete="off" /></div></div>
      <div className={styles.pickerResults} aria-busy={saving}>
        {picker.type === "page" ? pageResults.length ? pageResults.map((page) => <button key={page.id} className={styles.resultRow} type="button" onClick={() => onPage(page.id)}><span className={styles.pageIcon} aria-hidden>{page.icon || <FileText size={18} />}</span><span>{page.title || "Untitled"}</span></button>) : <p className={styles.emptyResults}>No pages found.</p> : null}
        {picker.type === "sentence" ? <>
          {sentenceResults.map((candidate) => <div key={candidate.id} className={styles.sentenceLibraryRow}>
            <button className={styles.sentenceResult} type="button" disabled={saving} onClick={() => onSentence(candidate)}><span lang="ja">{candidate.japanese}</span><span>{candidate.english}</span><span className={styles.resultSource}><Link2 size={12} aria-hidden /> Your linked sentence</span></button>
            {onDeleteSentence ? <button type="button" className={styles.libraryDelete} disabled={saving} aria-label={`Delete sentence: ${candidate.japanese}`} onClick={() => { setDeleteCandidateId(candidate.id); setError(""); setLibraryNotice(""); }}><Trash2 size={14} aria-hidden />Delete</button> : null}
            {deleteCandidateId === candidate.id ? <div className={styles.libraryDeleteConfirmation} role="group" aria-label="Delete sentence confirmation">
              <p>Delete this sentence from your library and all word cards? This cannot be undone.</p>
              <div><button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => { setDeleteCandidateId(null); setError(""); }}>Cancel</button><button type="button" className={`${styles.secondaryButton} ${styles.libraryDelete}`} disabled={saving} onClick={() => void deleteSentence(candidate.id)}>{deleting ? "Deleting…" : "Delete permanently"}</button></div>
            </div> : null}
          </div>)}
          {builtInResults.map((candidate) => <button key={`${candidate.subject.id}-${candidate.japanese}`} className={styles.sentenceResult} type="button" disabled={saving} onClick={() => { void saveBuiltIn(candidate); }}><span lang="ja">{candidate.japanese}</span><span>{candidate.english}</span><span className={styles.resultSource}>From <span lang="ja">{subjectLabel(candidate.subject)}</span> · Add a personal copy</span></button>)}
          {queryText ? <NotebookSubjectCatalogStatus subjectsLoading={subjectsLoading} subjectsError={subjectsError} onRetrySubjects={onRetrySubjects} loadingLabel="Loading vocabulary examples…" errorLabel="Vocabulary examples could not be loaded." rows={sentenceResults.length || builtInResults.length ? 0 : 3} /> : null}
          {!sentenceResults.length && !builtInResults.length && !(queryText && (subjectsLoading || subjectsError)) ? <div className={styles.emptyResults}><MessageSquareText size={24} aria-hidden /><p>{queryText ? "No sentences found." : "Your shared sentences will appear here."}</p><p>{queryText ? "Try a word or write your own example." : "Search vocabulary to find its examples, or write a sentence."}</p><button type="button" className={styles.secondaryButton} onClick={() => setTab("new")}><Plus size={15} aria-hidden /> Write a sentence</button></div> : null}
        </> : null}
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {libraryNotice ? <p className={styles.pickerFootnote} role="status">{libraryNotice}</p> : null}
      {picker.type === "sentence" ? <p className={styles.pickerFootnote}>{deleting ? "Deleting sentence…" : saving ? "Adding sentence…" : "Linked sentences stay in sync across your pages and word cards."}</p> : null}
    </div>}
  </dialog>;
}
