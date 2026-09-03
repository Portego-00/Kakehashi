import type {
  FormattedNoteSegment,
  NoteFormat,
} from "../utils/note-formatting";
import type { SubjectColors, SubjectType } from "../utils/subjectColors";

/**
 * The serializable note representation shared by the native and DOM editors.
 * It is deliberately the same restricted shape produced by parseFormattedNote.
 */
export type NoteVisualEditorRun = FormattedNoteSegment;

export type NoteVisualEditorSubjectType = SubjectType;

export type NoteVisualEditorSubjectTypes = Record<
  string,
  NoteVisualEditorSubjectType
>;

export type NoteVisualEditorAppearance = {
  colorScheme: "light" | "dark";
  isolatedHost: boolean;
  backgroundColor: string;
  textColor: string;
  placeholderColor: string;
  caretColor: string;
  selectionColor: string;
  subjectColors: SubjectColors;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  minHeight?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
};

type NoteVisualEditorCommandBase = {
  /** A command is applied once per unique nonce, even if its object is recreated. */
  nonce: number;
};

export type NoteVisualEditorCommand =
  | (NoteVisualEditorCommandBase & {
      type: "toggle-format";
      format: NoteFormat;
    })
  | (NoteVisualEditorCommandBase & {
      type: "set-link";
      subjectId: number;
      fallbackLabel: string;
    })
  | (NoteVisualEditorCommandBase & {
      type: "remove-link";
    })
  | (NoteVisualEditorCommandBase & {
      type: "focus";
    })
  | (NoteVisualEditorCommandBase & {
      type: "capture-selection";
    })
  | (NoteVisualEditorCommandBase & {
      type: "prepare-source";
    })
  | (NoteVisualEditorCommandBase & {
      type: "capture-value";
    });

export type NoteVisualEditorSelection = {
  text: string;
  formats: NoteFormat[];
  subjectId?: number;
  requestNonce?: number;
};

export type NoteVisualEditorSourceSnapshot = {
  requestNonce: number;
  runs: NoteVisualEditorRun[];
};

export type NoteVisualEditorValueSnapshot = NoteVisualEditorSourceSnapshot;

export type NoteVisualEditorDOMProps = {
  runs: NoteVisualEditorRun[];
  appearance: NoteVisualEditorAppearance;
  subjectTypes: NoteVisualEditorSubjectTypes;
  command?: NoteVisualEditorCommand | null;
  placeholder?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  autoFocus?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  editable?: boolean;
  maxLength?: number;
  spellCheck?: boolean;
  onChange: (runs: NoteVisualEditorRun[]) => Promise<void>;
  onSelectionChange: (selection: NoteVisualEditorSelection) => Promise<void>;
  onSourceReady: (snapshot: NoteVisualEditorSourceSnapshot) => Promise<void>;
  onValueReady: (snapshot: NoteVisualEditorValueSnapshot) => Promise<void>;
  onFocus?: () => Promise<void>;
  onBlur?: () => Promise<void>;
  dom?: import("expo/dom").DOMProps;
};
