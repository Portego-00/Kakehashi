import { describe, expect, it } from 'vitest';
import { BlockNoteEditor } from '@blocknote/core';
import { mobileNotebookSchema } from '../../../../src/features/notebooks/mobile-editor-schema';
import { notebookSchema } from './editor-schema';
import { createExampleNotebook } from './example-notebook';
import { sanitizeNotebookBlocks, validateNotebookState } from './model';

describe('mobile BlockNote persistence', () => {
  it('uses the exact web block and inline schemas', () => {
    expect(mobileNotebookSchema.blockSchema).toEqual(notebookSchema.blockSchema);
    expect(mobileNotebookSchema.inlineContentSchema).toEqual(notebookSchema.inlineContentSchema);
  });

  it('opens every web example and preserves all content through a mobile edit/save roundtrip', () => {
    const state = createExampleNotebook(new Date('2026-09-07T12:00:00.000Z'));
    const result = { version: 1 as const, pages: state.pages.map((page) => {
      const editor = BlockNoteEditor.create({ schema: mobileNotebookSchema, initialContent: page.content as typeof mobileNotebookSchema.PartialBlock[] });
      const canonical = sanitizeNotebookBlocks(editor.document);
      const reopened = BlockNoteEditor.create({ schema: mobileNotebookSchema, initialContent: canonical as typeof mobileNotebookSchema.PartialBlock[] });
      expect(sanitizeNotebookBlocks(reopened.document)).toEqual(canonical);
      expect(canonical.map((block) => block.id)).toEqual(page.content.map((block) => block.id));
      editor.unmount();
      reopened.unmount();
      return { ...page, content: canonical };
    }), sentences: state.sentences };
    expect(validateNotebookState(result)).toEqual(result);
  });

  it('preserves handwriting references through web edits, duplication, reordering, and a mobile reopen', () => {
    const drawing = { drawingId: '8b7f489d-1f66-4667-800a-f83ed02dd170', width: 768, height: 1024 };
    const mobile = BlockNoteEditor.create({ schema: mobileNotebookSchema, initialContent: [
      { id: 'title', type: 'paragraph', content: 'Kanji practice' },
      { id: 'ink', type: 'handwriting', props: drawing },
    ] });
    const web = BlockNoteEditor.create({ schema: notebookSchema, initialContent: sanitizeNotebookBlocks(mobile.document) as typeof notebookSchema.PartialBlock[] });
    try {
      web.updateBlock('title', { content: 'Updated on the web' });
      web.insertBlocks([{ id: 'ink-copy', type: 'handwriting', props: drawing }], 'title', 'before');
      web.removeBlocks(['ink']);
      const saved = sanitizeNotebookBlocks(web.document);
      expect(saved.map((block) => block.id)).toEqual(['ink-copy', 'title']);
      expect(saved[0]).toMatchObject({ type: 'handwriting', props: drawing });
      const reopened = BlockNoteEditor.create({ schema: mobileNotebookSchema, initialContent: saved as typeof mobileNotebookSchema.PartialBlock[] });
      try { expect(sanitizeNotebookBlocks(reopened.document)).toEqual(saved); }
      finally { reopened.unmount(); }
    } finally { mobile.unmount(); web.unmount(); }
  });

  it('roundtrips nested word mentions, linked blocks, styles and tables without losing shared IDs', () => {
    const editor = BlockNoteEditor.create({ schema: mobileNotebookSchema, initialContent: [
      { id: 'callout', type: 'callout', props: { icon: '💡' }, content: [{ type: 'text', text: '日本語 ', styles: { bold: true } }, { type: 'vocabularyMention', props: { subjectId: 123, label: '日本語' } }] },
      { id: 'word', type: 'vocabulary', props: { subjectId: 123, label: '日本語' } },
      { id: 'sentence', type: 'sentence', props: { sentenceId: 'sentence-123' } },
      { id: 'page', type: 'pageLink', props: { pageId: 'page-123' } },
      { id: 'toggle', type: 'toggleListItem', content: 'Practice', children: [{ id: 'todo', type: 'checkListItem', props: { checked: true }, content: '読む' }] },
      { id: 'table', type: 'table', content: { type: 'tableContent', rows: [{ cells: [[{ type: 'vocabularyMention', props: { subjectId: 123, label: '日本語' } }], [{ type: 'text', text: 'Japanese', styles: { italic: true } }]] }] } },
    ] });
    const first = sanitizeNotebookBlocks(editor.document);
    const reopened = BlockNoteEditor.create({ schema: mobileNotebookSchema, initialContent: first as typeof mobileNotebookSchema.PartialBlock[] });
    expect(sanitizeNotebookBlocks(reopened.document)).toEqual(first);
    expect(first[0].content).toEqual([{ type: 'text', text: '日本語 ', styles: { bold: true } }, { type: 'vocabularyMention', props: { subjectId: 123, label: '日本語' } }]);
    expect(first[1].props).toEqual({ subjectId: 123, label: '日本語' });
    expect(first[2].props).toEqual({ sentenceId: 'sentence-123' });
    expect(first[3].props).toEqual({ pageId: 'page-123' });
    expect(first[4].children?.[0].props?.checked).toBe(true);
    editor.unmount();
    reopened.unmount();
  });
});
