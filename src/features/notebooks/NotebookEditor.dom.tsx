'use dom';

import { Component, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import { en } from '@blocknote/core/locales';
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote, type DefaultReactSuggestionItem, type FloatingUIOptions } from '@blocknote/react';
import { autoPlacement, offset, shift, size } from '@floating-ui/react-dom';
import { ArrowDown, ArrowUp, ArrowUpRight, Bold, BookOpen, Check, CheckSquare, ChevronDown, Code, Copy, FileText, Heading1, Heading2, Indent, Italic, Keyboard, Lightbulb, Link2, List, ListOrdered, MessageSquareText, Minus, Outdent, Plus, Quote, Redo2, Search, Table2, Trash2, Type, Underline, Undo2, Volume2, X } from 'lucide-react';
import { toHiragana } from 'wanakana';
import type { NotebookBlock, NotebookSentence } from './model';
import type { NotebookEditorProps, NotebookEditorSubject, NotebookSentenceInput } from './editor-contract';
import { MobileNotebookStudyContext, mobileNotebookSchema, SubjectCharacter, subjectLabel, subjectMeaning, subjectReading } from './mobile-editor-schema';
import { MobilePageIcon } from './mobile-page-icon';
import '@blocknote/mantine/style.css';
import './mobile-editor.css';

type Editor = typeof mobileNotebookSchema.BlockNoteEditor;
type PartialBlock = typeof mobileNotebookSchema.PartialBlock;
type Picker = { type: 'blocks' | 'format' | 'word' | 'page' | 'link' } | { type: 'sentence'; sentenceId?: string } | { type: 'preview'; subjectId: number };

const suggestionPosition: FloatingUIOptions = {
  useFloatingOptions: {
    strategy: 'fixed',
    middleware: [offset(8), autoPlacement({ allowedPlacements: ['top-start', 'bottom-start'], padding: { top: 8, bottom: 64, left: 12, right: 12 } }), shift({ padding: 12 }), size({ padding: { top: 8, bottom: 64, left: 12, right: 12 }, apply({ availableHeight, elements }) { elements.floating.style.maxHeight = `${Math.max(0, Math.min(280, availableHeight))}px`; } })],
  },
};

function isSafeLink(href: string) {
  if (!href || /[\u0000-\u0020\u007f\\]/.test(href)) return false;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  try { return ['https:', 'http:', 'mailto:'].includes(new URL(href).protocol); } catch { return false; }
}

function findSubjects(subjects: NotebookEditorSubject[], query: string, type = 'all') {
  const needle = query.trim().normalize('NFKC').toLocaleLowerCase();
  const kana = toHiragana(needle);
  return subjects.flatMap((subject) => {
    if (type !== 'all' && subject.object !== type && !(type === 'vocabulary' && subject.object === 'kana_vocabulary')) return [];
    const values = [subjectLabel(subject), ...subject.data.meanings.map((entry) => entry.meaning), ...(subject.data.auxiliary_meanings?.filter((entry) => entry.type === 'whitelist').map((entry) => entry.meaning) || []), ...(subject.data.readings?.map((entry) => entry.reading) || [])].map((value) => value.normalize('NFKC').toLocaleLowerCase());
    const exact = values.some((value) => value === needle || value === kana);
    return !needle || values.some((value) => value.includes(needle) || value.includes(kana)) ? [{ subject, score: exact ? 0 : 1 }] : [];
  }).sort((a, b) => a.score - b.score || (a.subject.data.level || 0) - (b.subject.data.level || 0)).slice(0, 50).map(({ subject }) => subject);
}

function insertBlock(editor: Editor, block: PartialBlock) {
  editor.focus();
  const cursor = editor.getTextCursorPosition();
  if (cursor.block.content === undefined) {
    const inserted = editor.insertBlocks([block, { type: 'paragraph' }], cursor.block, 'after');
    editor.setTextCursorPosition(inserted[1], 'start');
  } else insertOrUpdateBlockForSlashMenu(editor, block);
}

class EditorBoundary extends Component<{ children: ReactNode; onError?: NotebookEditorProps['onError'] }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error) { void this.props.onError?.(error.message); }
  render() { return this.state.error ? <div className="nb-load-error" role="alert"><BookOpen size={28} /><p>This page could not be opened.</p><p>Return to your notebooks and try again. Your saved page is unchanged.</p></div> : this.props.children; }
}

export default function NotebookEditor(props: NotebookEditorProps) {
  return <EditorBoundary key={props.pageId} onError={props.onError}><EditorContent {...props} /></EditorBoundary>;
}

function EditorContent(props: NotebookEditorProps) {
  const { value, sentences, pages, subjects, theme, readOnly = false, title, icon, onTitleChange } = props;
  const actions = useRef(props);
  actions.current = props;
  const [draftTitle, setDraftTitle] = useState(title || '');
  const [picker, setPicker] = useState<Picker | null>(null);
  const [notice, setNotice] = useState('');
  const [styles, setStyles] = useState<Record<string, unknown>>({});
  const titleInput = useRef<HTMLTextAreaElement>(null);
  const editor = useCreateBlockNote({
    schema: mobileNotebookSchema,
    initialContent: value.length ? value as PartialBlock[] : [{ type: 'paragraph' }],
    dictionary: { ...en, placeholders: { ...en.placeholders, default: 'Write something…' } },
    links: { isValidLink: isSafeLink, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
    domAttributes: { editor: { 'aria-label': 'Notebook page content', spellcheck: 'false', autocapitalize: 'sentences' } },
    pasteHandler: ({ event, defaultPasteHandler }) => {
      if (event.clipboardData?.files.length) {
        setNotice('Notebooks support text and links. Attachments are not stored.');
        if (!event.clipboardData.getData('text/plain')) return true;
      }
      return defaultPasteHandler();
    },
  });

  // Native autosave echoes must never replace the document or Japanese composition.
  // A different page (or explicit conflict reload) remounts the outer boundary.
  useEffect(() => {
    document.documentElement.dataset.notebookTheme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const updateViewport = () => {
      document.documentElement.style.setProperty('--nb-viewport-height', `${viewport?.height || window.innerHeight}px`);
      document.documentElement.style.setProperty('--nb-viewport-top', `${viewport?.offsetTop || 0}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    // Native may cover the WebView until this signal arrives; waiting for a
    // paint would depend on WebKit scheduling frames for an obscured view.
    void actions.current.onReady?.();
    return () => { viewport?.removeEventListener('resize', updateViewport); viewport?.removeEventListener('scroll', updateViewport); window.removeEventListener('resize', updateViewport); };
  }, []);

  useEffect(() => editor.onSelectionChange(() => setStyles(editor.getActiveStyles())), [editor]);
  useEffect(() => { const input = titleInput.current; if (input) { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; } }, [draftTitle]);

  const report = useCallback((caught: unknown) => setNotice(caught instanceof Error ? caught.message : 'This change could not be completed. Please try again.'), []);
  const insertWord = useCallback((subject: NotebookEditorSubject, inline = false) => {
    editor.focus();
    const wordProps = { subjectId: subject.id, label: subjectLabel(subject) };
    if (inline) {
      const current = editor.getTextCursorPosition().block;
      if (current.content === undefined) editor.setTextCursorPosition(editor.insertBlocks([{ type: 'paragraph' }], current, 'after')[0], 'start');
      editor.insertInlineContent([{ type: 'vocabularyMention', props: wordProps }, ' ']);
    } else insertBlock(editor, { type: 'vocabulary', props: wordProps });
    setPicker(null);
  }, [editor]);
  const slashItems = useMemo<DefaultReactSuggestionItem[]>(() => [
    { title: 'Word', aliases: ['vocabulary', 'kanji', 'radical'], group: 'Study', icon: <BookOpen size={18} />, onItemClick: () => setPicker({ type: 'word' }) },
    { title: 'Sentence', aliases: ['example', 'context'], group: 'Study', icon: <MessageSquareText size={18} />, onItemClick: () => setPicker({ type: 'sentence' }) },
    { title: 'Page link', aliases: ['page', 'note'], group: 'Study', icon: <FileText size={18} />, onItemClick: () => setPicker({ type: 'page' }) },
    { title: 'Callout', aliases: ['tip', 'grammar'], group: 'Study', icon: <Lightbulb size={18} />, onItemClick: () => insertBlock(editor, { type: 'callout' }) },
    ...getDefaultReactSlashMenuItems(editor),
  ], [editor]);
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const sentenceMap = useMemo(() => new Map(sentences.map((sentence) => [sentence.id, sentence])), [sentences]);
  const pageMap = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const toggleStyle = (style: 'bold' | 'italic' | 'underline') => { editor.focus(); editor.toggleStyles({ [style]: true }); setStyles(editor.getActiveStyles()); };

  return <MobileNotebookStudyContext value={{ subjects: subjectMap, sentences: sentenceMap, pages: pageMap, readOnly, onPreviewSubject: (subjectId) => setPicker({ type: 'preview', subjectId }), onOpenPage: (pageId) => { void actions.current.onOpenPage(pageId).catch(report); }, onEditSentence: (sentenceId) => setPicker({ type: 'sentence', sentenceId }) }}>
    <div className="nb-mobile" onDropCapture={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); event.stopPropagation(); setNotice('Notebooks support text and links. Attachments are not stored.'); } }}>
      {notice ? <div className="nb-notice" role="status"><span>{notice}</span><button type="button" className="nb-icon-button" aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={18} /></button></div> : null}
      <main className="nb-scroll">
        {title !== undefined ? <div className="nb-page-heading">{icon ? <span className="nb-page-icon" aria-hidden><MobilePageIcon icon={icon} size={42} /></span> : null}<textarea ref={titleInput} className="nb-title" aria-label="Page title" value={draftTitle} rows={1} placeholder="Untitled" maxLength={240} readOnly={readOnly || !onTitleChange} onChange={(event) => { const next = event.target.value.replace(/\n/g, ''); setDraftTitle(next); void actions.current.onTitleChange?.(next).catch(report); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); editor.focus(); editor.setTextCursorPosition(editor.document[0], 'start'); } }} /></div> : null}
        <BlockNoteView editor={editor} theme={theme} editable={!readOnly} formattingToolbar={false} sideMenu={false} slashMenu={false} filePanel={false} onChange={() => { void actions.current.onChange(editor.document as NotebookBlock[]).catch(report); }}>
          <SuggestionMenuController triggerCharacter="/" floatingUIOptions={suggestionPosition} getItems={async (query) => filterSuggestionItems(slashItems, query)} />
          <SuggestionMenuController triggerCharacter="@" floatingUIOptions={suggestionPosition} minQueryLength={1} getItems={async (query) => findSubjects(subjects, query).slice(0, 15).map((subject) => ({ title: subjectLabel(subject), subtext: [subjectReading(subject), subjectMeaning(subject)].filter(Boolean).join(' · '), icon: <BookOpen size={17} />, onItemClick: () => insertWord(subject, true) }))} />
        </BlockNoteView>
      </main>
      {!readOnly ? <div className="nb-toolbar" role="toolbar" aria-label="Page editing tools">
        <button type="button" className="nb-tool nb-add-tool" aria-label="Add a block" onMouseDown={(event) => event.preventDefault()} onClick={() => setPicker({ type: 'blocks' })}><Plus size={23} /></button>
        <div className="nb-toolbar-scroll">
          <button type="button" className="nb-tool" aria-label="Text style" onMouseDown={(event) => event.preventDefault()} onClick={() => setPicker({ type: 'format' })}><span className="nb-aa">Aa</span><ChevronDown size={12} /></button>
          <button type="button" className="nb-tool" aria-label="Bold" aria-pressed={Boolean(styles.bold)} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleStyle('bold')}><Bold size={20} /></button>
          <button type="button" className="nb-tool" aria-label="Italic" aria-pressed={Boolean(styles.italic)} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleStyle('italic')}><Italic size={20} /></button>
          <button type="button" className="nb-tool" aria-label="Underline" aria-pressed={Boolean(styles.underline)} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleStyle('underline')}><Underline size={20} /></button>
          <button type="button" className="nb-tool" aria-label="Add a to-do" onMouseDown={(event) => event.preventDefault()} onClick={() => insertBlock(editor, { type: 'checkListItem' })}><CheckSquare size={20} /></button>
          <button type="button" className="nb-tool" aria-label="Add a link" onMouseDown={(event) => event.preventDefault()} onClick={() => setPicker({ type: 'link' })}><Link2 size={20} /></button>
          <button type="button" className="nb-tool" aria-label="Undo" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.focus(); editor.undo(); }}><Undo2 size={20} /></button>
          <button type="button" className="nb-tool" aria-label="Redo" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.focus(); editor.redo(); }}><Redo2 size={20} /></button>
        </div>
        <button type="button" className="nb-tool nb-keyboard-tool" aria-label="Dismiss keyboard" onClick={() => { editor.blur(); titleInput.current?.blur(); }}><Keyboard size={21} /><ChevronDown size={11} /></button>
      </div> : null}
    </div>
    {picker ? <EditorPicker key={`${picker.type}-${picker.type === 'sentence' ? picker.sentenceId || 'new' : picker.type === 'preview' ? picker.subjectId : ''}`} picker={picker} editor={editor} subjects={subjects} sentences={sentences} pages={pages} onClose={() => setPicker(null)} onWord={insertWord} onSentence={(sentence) => { insertBlock(editor, { type: 'sentence', props: { sentenceId: sentence.id } }); setPicker(null); }} onSaveSentence={(input) => actions.current.onSaveSentence(input)} onOpenSubject={(id) => actions.current.onOpenSubject(id)} onPickerChange={setPicker} /> : null}
  </MobileNotebookStudyContext>;
}

function EditorPicker({ picker, editor, subjects, sentences, pages, onClose, onWord, onSentence, onSaveSentence, onOpenSubject, onPickerChange }: {
  picker: Picker; editor: Editor; subjects: NotebookEditorSubject[]; sentences: NotebookSentence[]; pages: NotebookEditorProps['pages']; onClose: () => void; onWord: (subject: NotebookEditorSubject, inline?: boolean) => void; onSentence: (sentence: NotebookSentence) => void; onSaveSentence: (input: NotebookSentenceInput) => Promise<NotebookSentence>; onOpenSubject: (id: number) => Promise<void>; onPickerChange: (picker: Picker) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [selectedSentence] = useState(() => picker.type === 'sentence' && picker.sentenceId ? sentences.find((entry) => entry.id === picker.sentenceId) : undefined);
  const [query, setQuery] = useState('');
  const [wordType, setWordType] = useState('all');
  const [inline, setInline] = useState(false);
  const [writeSentence, setWriteSentence] = useState(Boolean(selectedSentence));
  const [japanese, setJapanese] = useState(selectedSentence?.japanese || '');
  const [kana, setKana] = useState(selectedSentence?.kana || '');
  const [english, setEnglish] = useState(selectedSentence?.english || '');
  const [subjectIds, setSubjectIds] = useState(selectedSentence?.subjectIds || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [href, setHref] = useState(editor.getSelectedLinkUrl() || '');
  const [linkText, setLinkText] = useState(editor.getSelectedText());
  const audio = useRef<HTMLAudioElement | null>(null);
  const deferredQuery = useDeferredValue(query);
  const words = useMemo(() => findSubjects(subjects, deferredQuery, wordType), [subjects, deferredQuery, wordType]);
  const queryText = deferredQuery.trim().toLocaleLowerCase();
  const sentenceResults = useMemo(() => sentences.filter((entry) => !queryText || [entry.japanese, entry.kana, entry.english].some((text) => text.toLocaleLowerCase().includes(queryText))).slice(0, 40), [sentences, queryText]);
  const builtInResults = useMemo(() => {
    if (!queryText || picker.type !== 'sentence' || writeSentence) return [];
    const result: { subject: NotebookEditorSubject; japanese: string; english: string }[] = [];
    const seen = new Set(sentences.map((entry) => entry.japanese));
    const matchingIds = new Set(words.map((entry) => entry.id));
    for (const subject of subjects) for (const sentence of subject.data.context_sentences || []) {
      if (seen.has(sentence.ja) || !(matchingIds.has(subject.id) || sentence.ja.includes(queryText) || sentence.en.toLocaleLowerCase().includes(queryText))) continue;
      seen.add(sentence.ja); result.push({ subject, japanese: sentence.ja, english: sentence.en });
      if (result.length >= 25) return result;
    }
    return result;
  }, [subjects, sentences, words, queryText, picker.type, writeSentence]);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { element?.close(); audio.current?.pause(); }; }, []);
  const add = (block: PartialBlock) => { dialog.current?.close(); insertBlock(editor, block); onClose(); };
  const changeType = (block: PartialBlock) => {
    dialog.current?.close();
    editor.focus();
    const current = editor.getTextCursorPosition().block;
    if (current.content !== undefined && Array.isArray(current.content) && block.type !== 'table') editor.updateBlock(current, block);
    else insertBlock(editor, block);
    onClose();
  };
  const saveSentence = async (input: NotebookSentenceInput) => {
    if (saving) return;
    setSaving(true); setError('');
    try { const saved = await onSaveSentence(input); if (selectedSentence) onClose(); else { dialog.current?.close(); onSentence(saved); } }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The sentence could not be saved. Try again.'); setSaving(false); }
  };
  const blockOptions: { label: string; icon: ReactNode; block: PartialBlock }[] = [
    { label: 'Text', icon: <Type size={20} />, block: { type: 'paragraph' } },
    { label: 'Heading 1', icon: <Heading1 size={20} />, block: { type: 'heading', props: { level: 1 } } },
    { label: 'Heading 2', icon: <Heading2 size={20} />, block: { type: 'heading', props: { level: 2 } } },
    { label: 'To-do list', icon: <CheckSquare size={20} />, block: { type: 'checkListItem' } },
    { label: 'Bulleted list', icon: <List size={20} />, block: { type: 'bulletListItem' } },
    { label: 'Numbered list', icon: <ListOrdered size={20} />, block: { type: 'numberedListItem' } },
    { label: 'Toggle list', icon: <ChevronDown size={20} />, block: { type: 'toggleListItem' } },
    { label: 'Quote', icon: <Quote size={20} />, block: { type: 'quote' } },
    { label: 'Callout', icon: <Lightbulb size={20} />, block: { type: 'callout' } },
    { label: 'Divider', icon: <Minus size={20} />, block: { type: 'divider' } },
    { label: 'Code', icon: <Code size={20} />, block: { type: 'codeBlock' } },
    { label: 'Table', icon: <Table2 size={20} />, block: { type: 'table', content: { type: 'tableContent', rows: [{ cells: [[], []] }, { cells: [[], []] }] } } },
  ];
  const preview = picker.type === 'preview' ? subjects.find((entry) => entry.id === picker.subjectId) : undefined;
  const title = picker.type === 'blocks' ? 'Add a block' : picker.type === 'format' ? 'Text style' : picker.type === 'word' ? 'Link a word' : picker.type === 'page' ? 'Link a page' : picker.type === 'sentence' ? selectedSentence ? 'Edit sentence' : 'Add a sentence' : picker.type === 'link' ? 'Add a link' : preview ? subjectLabel(preview) : 'Word details';
  return <dialog ref={dialog} className="nb-sheet" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <header className="nb-sheet-header"><h2 id={titleId}>{title}</h2><button className="nb-icon-button" type="button" disabled={saving} aria-label="Close" onClick={onClose}><X size={21} /></button></header>
    <div className="nb-sheet-body">
      {picker.type === 'blocks' || picker.type === 'format' ? <>
        {picker.type === 'blocks' ? <div className="nb-study-options">{[{ type: 'word' as const, label: 'Word', icon: <BookOpen size={21} /> }, { type: 'sentence' as const, label: 'Sentence', icon: <MessageSquareText size={21} /> }, { type: 'page' as const, label: 'Page link', icon: <FileText size={21} /> }].map((item) => <button key={item.type} type="button" onClick={() => onPickerChange({ type: item.type })}>{item.icon}<span>{item.label}</span></button>)}</div> : null}
        <div className="nb-block-options">{blockOptions.map((item) => <button key={item.label} type="button" onClick={() => picker.type === 'format' ? changeType(item.block) : add(item.block)}>{item.icon}<span>{item.label}</span></button>)}</div>
        {picker.type === 'format' ? <div className="nb-block-options nb-block-actions">
          <button type="button" onClick={() => { dialog.current?.close(); editor.focus(); editor.moveBlocksUp(); onClose(); }}><ArrowUp size={20} />Move up</button>
          <button type="button" onClick={() => { dialog.current?.close(); editor.focus(); editor.moveBlocksDown(); onClose(); }}><ArrowDown size={20} />Move down</button>
          <button type="button" disabled={!editor.canNestBlock()} onClick={() => { dialog.current?.close(); editor.focus(); editor.nestBlock(); onClose(); }}><Indent size={20} />Indent</button>
          <button type="button" disabled={!editor.canUnnestBlock()} onClick={() => { dialog.current?.close(); editor.focus(); editor.unnestBlock(); onClose(); }}><Outdent size={20} />Unindent</button>
          <button type="button" onClick={() => { dialog.current?.close(); editor.focus(); const current = editor.getTextCursorPosition().block; const withoutIds = (block: typeof current): PartialBlock => { const { id: _id, children, ...rest } = block; return { ...rest, children: children.map(withoutIds) } as PartialBlock; }; editor.insertBlocks([withoutIds(current)], current, 'after'); onClose(); }}><Copy size={20} />Duplicate</button>
          <button type="button" className="nb-delete-block" onClick={() => { dialog.current?.close(); editor.focus(); editor.removeBlocks([editor.getTextCursorPosition().block]); onClose(); }}><Trash2 size={20} />Delete block</button>
        </div> : null}
      </> : null}
      {picker.type === 'word' ? <>
        <SearchField value={query} onChange={setQuery} label="Search vocabulary, kanji or radicals" />
        <div className="nb-tabs" role="tablist" aria-label="Subject type">{[['all', 'All'], ['vocabulary', 'Words'], ['kanji', 'Kanji'], ['radical', 'Radicals']].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={wordType === key} onClick={() => setWordType(key)}>{label}</button>)}</div>
        <label className="nb-inline-choice"><input type="checkbox" checked={inline} onChange={(event) => setInline(event.target.checked)} />Insert inline in the text</label>
        <div className="nb-results">{words.map((subject) => <SubjectRow key={subject.id} subject={subject} onClick={() => { dialog.current?.close(); onWord(subject, inline); }} />)}{!words.length ? <p className="nb-empty">No words found. Try Japanese, a reading, or a meaning.</p> : null}</div>
      </> : null}
      {picker.type === 'page' ? <><SearchField value={query} onChange={setQuery} label="Search pages" /><div className="nb-results">{pages.filter((page) => !queryText || page.title.toLocaleLowerCase().includes(queryText)).map((page) => <button type="button" className="nb-result" key={page.id} onClick={() => add({ type: 'pageLink', props: { pageId: page.id } })}><MobilePageIcon icon={page.icon} /><span>{page.title || 'Untitled'}</span></button>)}{!pages.length ? <p className="nb-empty">Create another page to link it here.</p> : null}</div></> : null}
      {picker.type === 'sentence' ? <>
        {!selectedSentence ? <div className="nb-tabs" role="tablist" aria-label="Sentence source"><button type="button" role="tab" aria-selected={!writeSentence} disabled={saving} onClick={() => setWriteSentence(false)}>Your sentences</button><button type="button" role="tab" aria-selected={writeSentence} disabled={saving} onClick={() => setWriteSentence(true)}>Write a sentence</button></div> : null}
        {writeSentence ? <form className="nb-form" onSubmit={(event) => { event.preventDefault(); void saveSentence({ ...(selectedSentence ? { id: selectedSentence.id, revision: selectedSentence.revision } : {}), japanese: japanese.trim(), kana: kana.trim(), english: english.trim(), subjectIds }); }}>
          <label>Japanese<textarea required maxLength={2000} rows={3} value={japanese} lang="ja" onChange={(event) => setJapanese(event.target.value)} placeholder="日本語の例文" disabled={saving} /></label>
          <label>Reading <span className="nb-optional">(optional)</span><input maxLength={2000} value={kana} lang="ja" onChange={(event) => setKana(event.target.value)} disabled={saving} /></label>
          <label>Translation <span className="nb-optional">(optional)</span><textarea maxLength={4000} rows={2} value={english} onChange={(event) => setEnglish(event.target.value)} disabled={saving} /></label>
          <fieldset className="nb-linked-words"><legend>Linked vocabulary</legend>{subjectIds.length ? <div className="nb-selected-words">{subjectIds.map((id) => <button key={id} type="button" disabled={saving} aria-label={`Remove ${subjects.find((entry) => entry.id === id) ? subjectLabel(subjects.find((entry) => entry.id === id)!) : id}`} onClick={() => setSubjectIds((current) => current.filter((value) => value !== id))}>{subjects.find((entry) => entry.id === id) ? subjectLabel(subjects.find((entry) => entry.id === id)!) : `Subject ${id}`}<X size={14} /></button>)}</div> : null}<SearchField value={query} onChange={setQuery} label="Search words to link" />{query.trim() ? <div className="nb-linked-word-results">{words.slice(0, 12).map((subject) => <SubjectRow key={subject.id} subject={subject} selected={subjectIds.includes(subject.id)} onClick={() => setSubjectIds((current) => current.includes(subject.id) ? current.filter((id) => id !== subject.id) : current.length < 64 ? [...current, subject.id] : current)} />)}</div> : null}</fieldset>
          {error ? <p className="nb-error" role="alert">{error}</p> : null}<button className="nb-primary-button" type="submit" disabled={saving || !japanese.trim()}>{saving ? 'Saving…' : selectedSentence ? 'Save sentence' : 'Add sentence'}</button>
        </form> : <><SearchField value={query} onChange={setQuery} label="Search sentences or vocabulary" /><div className="nb-results">{sentenceResults.map((sentence) => <button key={sentence.id} type="button" className="nb-sentence-result" disabled={saving} onClick={() => { dialog.current?.close(); onSentence(sentence); }}><span lang="ja">{sentence.japanese}</span>{sentence.english ? <span>{sentence.english}</span> : null}</button>)}{builtInResults.map((entry) => <button key={`${entry.subject.id}-${entry.japanese}`} type="button" className="nb-sentence-result" disabled={saving} onClick={() => { void saveSentence({ japanese: entry.japanese, kana: '', english: entry.english, subjectIds: [entry.subject.id] }); }}><span lang="ja">{entry.japanese}</span><span>{entry.english}</span><span className="nb-optional">From {subjectLabel(entry.subject)}</span></button>)}{!sentenceResults.length && !builtInResults.length ? <p className="nb-empty">{queryText ? 'No sentences found. Try a word or write an example.' : 'Your linked sentences will appear here. Search vocabulary for examples, or write your own.'}</p> : null}</div>{error ? <p className="nb-error" role="alert">{error}</p> : null}</>}
      </> : null}
      {picker.type === 'link' ? <form className="nb-form" onSubmit={(event) => { event.preventDefault(); const url = /^https?:\/\//i.test(href) || /^(mailto:|\/)/.test(href) ? href.trim() : `https://${href.trim()}`; if (!isSafeLink(url)) { setError('Enter a valid website or email link.'); return; } dialog.current?.close(); editor.focus(); editor.createLink(url, linkText || url); onClose(); }}><label>Link<input type="text" inputMode="url" value={href} onChange={(event) => setHref(event.target.value)} placeholder="https://" required autoCapitalize="none" autoCorrect="off" /></label><label>Text<input value={linkText} onChange={(event) => setLinkText(event.target.value)} placeholder="Link text" /></label>{error ? <p className="nb-error" role="alert">{error}</p> : null}<button type="submit" className="nb-primary-button">Add link</button></form> : null}
      {picker.type === 'preview' ? preview ? <div className="nb-subject-preview"><div className="nb-preview-character" data-kind={preview.object}><SubjectCharacter subject={preview} label={subjectLabel(preview)} />{preview.data.pronunciation_audios?.[0]?.url ? <button type="button" className="nb-icon-button" aria-label="Play pronunciation" onClick={() => { const url = preview.data.pronunciation_audios![0].url; audio.current?.pause(); audio.current = new Audio(url); void audio.current.play().catch(() => setError('Audio could not be played. Try again.')); }}><Volume2 size={22} /></button> : null}</div><dl>{subjectReading(preview) ? <div><dt>Reading</dt><dd lang="ja">{subjectReading(preview)}</dd></div> : null}<div><dt>Meaning</dt><dd>{subjectMeaning(preview)}</dd></div><div><dt>Level</dt><dd>{preview.data.level || '—'}</dd></div></dl>{error ? <p className="nb-error" role="alert">{error}</p> : null}<button className="nb-primary-button" type="button" onClick={() => { void onOpenSubject(preview.id).then(onClose).catch((caught) => setError(caught instanceof Error ? caught.message : 'This word could not be opened.')); }}>Open word details <ArrowUpRight size={18} /></button></div> : <div className="nb-empty"><p>This word is not in the downloaded library.</p><button type="button" className="nb-primary-button" onClick={() => { void onOpenSubject(picker.subjectId).then(onClose).catch(() => setError('This word could not be opened.')); }}>Open word details</button>{error ? <p className="nb-error" role="alert">{error}</p> : null}</div> : null}
    </div>
  </dialog>;
}

function SearchField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <div className="nb-search"><Search size={18} aria-hidden /><input type="search" aria-label={label} placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" /></div>;
}
function SubjectRow({ subject, onClick, selected }: { subject: NotebookEditorSubject; onClick: () => void; selected?: boolean }) {
  return <button type="button" className="nb-result nb-subject-result" data-kind={subject.object} onClick={onClick} aria-pressed={selected}><span className="nb-result-character"><SubjectCharacter subject={subject} label={subjectLabel(subject)} /></span><span className="nb-result-description"><span>{subjectMeaning(subject)}</span>{subjectReading(subject) ? <span lang="ja">{subjectReading(subject)}</span> : null}</span>{selected ? <Check size={18} /> : <span className="nb-result-level">{subject.data.level ? `Lv ${subject.data.level}` : ''}</span>}</button>;
}
