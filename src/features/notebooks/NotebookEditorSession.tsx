import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import NotebookEditor from "./NotebookEditor.dom";
import type { NotebookEditorProps } from "./editor-contract";
import { sanitizeNotebookBlocks, type NotebookBlock, type NotebookPage } from "./model";

const StableEditor = memo(NotebookEditor);

type Props = Omit<NotebookEditorProps, "pageId" | "title" | "icon" | "value" | "onChange" | "onTitleChange"> & {
  page: NotebookPage;
  hasDraft: boolean;
  updatePageDraft: (pageId: string, patch: { title?: string; blocks?: NotebookBlock[] }) => void;
};

/** Keep the large DOM payload stable while native save status changes. */
export function NotebookEditorSession({ page, hasDraft, updatePageDraft, ...props }: Props) {
  const [document, setDocument] = useState(() => ({ content: page.content, title: page.title, generation: 0 }));
  const lastLocal = useRef({ content: JSON.stringify(sanitizeNotebookBlocks(page.content)), title: page.title });
  const incomingContent = JSON.stringify(sanitizeNotebookBlocks(page.content));

  useEffect(() => {
    // A cloud refresh may update a clean open page. Local echoes are already in
    // the editor, and replacing them would interrupt typing and Japanese IME.
    if (hasDraft || (incomingContent === lastLocal.current.content && page.title === lastLocal.current.title)) return;
    lastLocal.current = { content: incomingContent, title: page.title };
    setDocument((current) => ({ content: page.content, title: page.title, generation: current.generation + 1 }));
  }, [hasDraft, incomingContent, page.content, page.title]);

  const onChange = useCallback(async (blocks: NotebookBlock[]) => {
    const portable = sanitizeNotebookBlocks(blocks);
    lastLocal.current.content = JSON.stringify(portable);
    updatePageDraft(page.id, { blocks: portable });
  }, [page.id, updatePageDraft]);
  const onTitleChange = useCallback(async (title: string) => {
    lastLocal.current.title = title;
    updatePageDraft(page.id, { title });
  }, [page.id, updatePageDraft]);

  // Server responses create fresh arrays even when metadata did not change.
  // The bridge needs updates only when their actual contents change.
  const pageMetadata = JSON.stringify(props.pages);
  const sentenceData = JSON.stringify(props.sentences);
  const editorPages = useMemo<NotebookEditorProps["pages"]>(() => JSON.parse(pageMetadata), [pageMetadata]);
  const editorSentences = useMemo<NotebookEditorProps["sentences"]>(() => JSON.parse(sentenceData), [sentenceData]);

  return <StableEditor
    {...props}
    key={document.generation}
    pageId={page.id}
    title={document.title}
    icon={page.icon}
    value={document.content}
    pages={editorPages}
    sentences={editorSentences}
    onChange={onChange}
    onTitleChange={onTitleChange}
  />;
}
