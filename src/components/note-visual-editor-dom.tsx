"use dom";

import React from "react";

import NoteVisualEditorContent from "./note-visual-editor-content";
import type { NoteVisualEditorDOMProps } from "./note-visual-editor-types";

export default function NoteVisualEditorDOM(props: NoteVisualEditorDOMProps) {
  return <NoteVisualEditorContent {...props} />;
}
