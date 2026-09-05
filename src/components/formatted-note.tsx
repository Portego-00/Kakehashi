import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type GestureResponderEvent,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useNoteSubjectTypes } from "../hooks/use-note-subject-types";
import type { Subject } from "../utils/api";
import {
  getNoteLinkSearchText,
  getNoteSubjectLinkAtSelection,
  normalizeFormattedNoteSegments,
  parseFormattedNote,
  removeNoteSubjectLink,
  selectionHasNoteFormat,
  serializeFormattedNote,
  setNoteSubjectLink,
  toggleNoteFormat,
  type NoteFormat,
  type NoteSelection,
  type NoteSubjectLink,
} from "../utils/note-formatting";
import { rememberNoteSubjectType } from "../utils/note-subject-metadata";
import { useSubjectColors, withAlpha } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";
import NoteSubjectLinkPicker from "./note-subject-link-picker";
import NoteSubjectPreview from "./note-subject-preview";
import NoteVisualEditorDOM from "./note-visual-editor-dom";
import type {
  NoteVisualEditorCommand,
  NoteVisualEditorRun,
  NoteVisualEditorSelection,
  NoteVisualEditorSourceSnapshot,
  NoteVisualEditorSubjectTypes,
  NoteVisualEditorValueSnapshot,
} from "./note-visual-editor-types";

type FormattedNoteTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  selectable?: boolean;
  onSubjectLinkPress?: (subjectId: number, linkText: string) => void;
};

const FORMAT_TEXT_STYLES: Record<NoteFormat, TextStyle> = {
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  underline: { textDecorationLine: "underline" },
};

export const FormattedNoteText = React.memo(function FormattedNoteText({
  text,
  style,
  selectable = true,
  onSubjectLinkPress,
}: FormattedNoteTextProps) {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const segments = useMemo(() => parseFormattedNote(text), [text]);
  const [previewLink, setPreviewLink] = useState<NoteSubjectLink | null>(null);
  const linkedSubjectIds = useMemo(
    () =>
      Array.from(
        new Set(
          segments.flatMap((segment) =>
            segment.subjectId ? [segment.subjectId] : [],
          ),
        ),
      ),
    [segments],
  );
  const linkedSubjectTypes = useNoteSubjectTypes(linkedSubjectIds);

  const handleSubjectLinkPress = useCallback(
    (
      event: GestureResponderEvent | undefined,
      subjectId: number,
      linkText: string,
    ) => {
      event?.stopPropagation();

      if (onSubjectLinkPress) {
        onSubjectLinkPress(subjectId, linkText);
        return;
      }

      setPreviewLink({ subjectId, text: linkText });
    },
    [onSubjectLinkPress],
  );

  const renderedSegments: React.ReactNode[] = [];
  for (let index = 0; index < segments.length;) {
    const segment = segments[index];
    if (!segment.subjectId) {
      renderedSegments.push(
        <Text
          key={`${index}:${segment.text}`}
          style={segment.formats.map((format) => FORMAT_TEXT_STYLES[format])}
        >
          {segment.text}
        </Text>,
      );
      index += 1;
      continue;
    }

    const subjectId = segment.subjectId;
    let linkEnd = index + 1;
    while (
      linkEnd < segments.length &&
      segments[linkEnd].subjectId === subjectId
    ) {
      linkEnd += 1;
    }

    const linkedSegments = segments.slice(index, linkEnd);
    const linkText = linkedSegments.map((part) => part.text).join("");
    const subjectType = linkedSubjectTypes[subjectId];
    const linkColor = subjectType
      ? subjectColors.getColorForType(subjectType)
      : theme.textColor;
    renderedSegments.push(
      <Text
        accessibilityHint="Shows a quick subject preview"
        accessibilityLabel={linkText}
        accessibilityRole="link"
        key={`${index}:${subjectId}:${linkText}`}
        onPress={(event) => handleSubjectLinkPress(event, subjectId, linkText)}
        style={[styles.subjectLink, { color: linkColor }]}
      >
        {linkedSegments.map((part, partIndex) => (
          <Text
            key={`${partIndex}:${part.text}`}
            style={part.formats.map((format) => FORMAT_TEXT_STYLES[format])}
          >
            {part.text}
          </Text>
        ))}
      </Text>,
    );
    index = linkEnd;
  }

  return (
    <>
      <Text selectable={selectable} style={style}>
        {renderedSegments}
      </Text>

      {previewLink && !onSubjectLinkPress ? (
        <NoteSubjectPreview
          linkText={previewLink.text}
          onClose={() => setPreviewLink(null)}
          subjectId={previewLink.subjectId}
        />
      ) : null}
    </>
  );
});

type FormattedNoteEditorProps = Omit<
  TextInputProps,
  | "onBlur"
  | "onChangeText"
  | "onFocus"
  | "onSelectionChange"
  | "selection"
  | "style"
  | "value"
> & {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

type NoteEditorMode = "visual" | "source";

type NoteLinkPickerContext =
  | {
      editorMode: "source";
      selection: NoteSelection;
      initialQuery: string;
      linkedSubjectId?: number;
    }
  | {
      editorMode: "visual";
      initialQuery: string;
      linkedSubjectId?: number;
    };

type NoteVisualEditorCommandInput =
  NoteVisualEditorCommand extends infer Command
    ? Command extends { nonce: number }
      ? Omit<Command, "nonce">
      : never
    : never;

export type FormattedNoteEditorHandle = {
  closeLinkPicker: () => boolean;
  flush: () => Promise<string>;
};

type PendingVisualValueRequest = {
  resolve: (value: string) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const FORMAT_BUTTONS: {
  format: NoteFormat;
  label: string;
  accessibilityLabel: string;
}[] = [
  { format: "bold", label: "B", accessibilityLabel: "Bold" },
  { format: "italic", label: "I", accessibilityLabel: "Italic" },
  { format: "underline", label: "U", accessibilityLabel: "Underline" },
];

export const FormattedNoteEditor = React.forwardRef<
  FormattedNoteEditorHandle,
  FormattedNoteEditorProps
>(function FormattedNoteEditor(
  {
    value,
    onChangeText,
    onBlur,
    onFocus,
    style,
    containerStyle,
    ...textInputProps
  },
  forwardedRef,
) {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const textInputRef = useRef<TextInput>(null);
  const currentValueRef = useRef(value);
  const shouldRestoreFocusRef = useRef(false);
  const visualCommandNonceRef = useRef(0);
  const pendingVisualLinkRequestNonceRef = useRef<number | null>(null);
  const pendingSourceRequestNonceRef = useRef<number | null>(null);
  const pendingVisualValueRequestsRef = useRef(
    new Map<number, PendingVisualValueRequest>(),
  );
  currentValueRef.current = value;
  const [editorMode, setEditorMode] = useState<NoteEditorMode>("visual");
  const [visualCommand, setVisualCommand] =
    useState<NoteVisualEditorCommand | null>(null);
  const [visualSelection, setVisualSelection] =
    useState<NoteVisualEditorSelection>({ text: "", formats: [] });
  const [selection, setSelection] = useState<NoteSelection>({
    start: value.length,
    end: value.length,
  });
  const [linkPickerContext, setLinkPickerContext] =
    useState<NoteLinkPickerContext | null>(null);
  const visualRuns = useMemo(() => parseFormattedNote(value), [value]);
  const linkedSubjectIds = useMemo(
    () =>
      Array.from(
        new Set(
          visualRuns.flatMap((run) => (run.subjectId ? [run.subjectId] : [])),
        ),
      ),
    [visualRuns],
  );
  const linkedSubjectTypes = useNoteSubjectTypes(linkedSubjectIds);
  const visualSubjectTypes = useMemo<NoteVisualEditorSubjectTypes>(() => {
    const subjectTypes: NoteVisualEditorSubjectTypes = {};
    for (const [subjectId, subjectType] of Object.entries(linkedSubjectTypes)) {
      subjectTypes[subjectId] = subjectType;
    }
    return subjectTypes;
  }, [linkedSubjectTypes]);
  const editorIsEditable = textInputProps.editable !== false;
  const flattenedEditorStyle = StyleSheet.flatten(style) ?? {};
  const deviceFontScale =
    textInputProps.allowFontScaling === false ? 1 : PixelRatio.getFontScale();
  const fontScale =
    typeof textInputProps.maxFontSizeMultiplier === "number" &&
    textInputProps.maxFontSizeMultiplier > 0
      ? Math.min(deviceFontScale, textInputProps.maxFontSizeMultiplier)
      : deviceFontScale;
  const visualEditorHeight = Math.max(
    120,
    typeof flattenedEditorStyle.height === "number"
      ? flattenedEditorStyle.height
      : typeof flattenedEditorStyle.minHeight === "number"
        ? flattenedEditorStyle.minHeight
        : 120,
  );
  const visualEditorFrameStyle = useMemo<ViewStyle>(
    () => ({
      ...(typeof flattenedEditorStyle.height === "number"
        ? { height: flattenedEditorStyle.height }
        : {}),
      ...(typeof flattenedEditorStyle.minHeight === "number"
        ? { minHeight: flattenedEditorStyle.minHeight }
        : {}),
      ...(typeof flattenedEditorStyle.maxHeight === "number"
        ? { maxHeight: flattenedEditorStyle.maxHeight }
        : {}),
      ...(typeof flattenedEditorStyle.borderWidth === "number"
        ? { borderWidth: flattenedEditorStyle.borderWidth }
        : {}),
      ...(typeof flattenedEditorStyle.borderColor === "string"
        ? { borderColor: flattenedEditorStyle.borderColor }
        : {}),
      ...(typeof flattenedEditorStyle.borderRadius === "number"
        ? { borderRadius: flattenedEditorStyle.borderRadius }
        : {}),
      ...(typeof flattenedEditorStyle.backgroundColor === "string"
        ? { backgroundColor: flattenedEditorStyle.backgroundColor }
        : {}),
    }),
    [
      flattenedEditorStyle.backgroundColor,
      flattenedEditorStyle.borderColor,
      flattenedEditorStyle.borderRadius,
      flattenedEditorStyle.borderWidth,
      flattenedEditorStyle.height,
      flattenedEditorStyle.maxHeight,
      flattenedEditorStyle.minHeight,
    ],
  );

  const issueVisualCommand = useCallback(
    (command: NoteVisualEditorCommandInput) => {
      visualCommandNonceRef.current += 1;
      const nonce = visualCommandNonceRef.current;
      setVisualCommand({
        ...command,
        nonce,
      } as NoteVisualEditorCommand);
      return nonce;
    },
    [],
  );

  const commitValue = useCallback(
    (nextValue: string) => {
      currentValueRef.current = nextValue;
      onChangeText(nextValue);
    },
    [onChangeText],
  );

  const flushValue = useCallback((): Promise<string> => {
    if (editorMode === "source") {
      return Promise.resolve(currentValueRef.current);
    }

    return new Promise((resolve) => {
      const requestNonce = issueVisualCommand({ type: "capture-value" });
      const timeoutId = setTimeout(() => {
        pendingVisualValueRequestsRef.current.delete(requestNonce);
        resolve(currentValueRef.current);
      }, 2_500);
      pendingVisualValueRequestsRef.current.set(requestNonce, {
        resolve,
        timeoutId,
      });
    });
  }, [editorMode, issueVisualCommand]);

  useEffect(
    () => () => {
      for (const pendingRequest of pendingVisualValueRequestsRef.current.values()) {
        clearTimeout(pendingRequest.timeoutId);
        pendingRequest.resolve(currentValueRef.current);
      }
      pendingVisualValueRequestsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (linkPickerContext || !shouldRestoreFocusRef.current) return;

    shouldRestoreFocusRef.current = false;
    const frame = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [linkPickerContext]);

  useEffect(() => {
    if (selection.start <= value.length && selection.end <= value.length) {
      return;
    }
    setSelection({ start: value.length, end: value.length });
  }, [selection.end, selection.start, value.length]);

  const handleFormatPress = useCallback(
    (format: NoteFormat) => {
      if (!editorIsEditable) return;
      if (editorMode === "visual") {
        issueVisualCommand({ type: "toggle-format", format });
        return;
      }

      const result = toggleNoteFormat(value, selection, format);
      commitValue(result.text);
      setSelection(result.selection);
    },
    [
      commitValue,
      editorIsEditable,
      editorMode,
      issueVisualCommand,
      selection,
      value,
    ],
  );

  const handleLinkPress = useCallback(() => {
    if (!editorIsEditable) return;
    if (editorMode === "visual") {
      pendingVisualLinkRequestNonceRef.current = issueVisualCommand({
        type: "capture-selection",
      });
      return;
    }

    const existingLink = getNoteSubjectLinkAtSelection(value, selection);
    setLinkPickerContext({
      editorMode: "source",
      selection: { ...selection },
      initialQuery: getNoteLinkSearchText(value, selection),
      linkedSubjectId: existingLink?.subjectId,
    });
  }, [editorIsEditable, editorMode, issueVisualCommand, selection, value]);

  const closeLinkPicker = useCallback(() => {
    if (linkPickerContext?.editorMode === "visual") {
      issueVisualCommand({ type: "focus" });
    } else {
      shouldRestoreFocusRef.current = true;
    }
    setLinkPickerContext(null);
  }, [issueVisualCommand, linkPickerContext?.editorMode]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      closeLinkPicker: () => {
        if (!linkPickerContext) return false;
        closeLinkPicker();
        return true;
      },
      flush: flushValue,
    }),
    [closeLinkPicker, flushValue, linkPickerContext],
  );

  const handleLinkSubjectSelect = useCallback(
    (subject: Subject) => {
      if (!linkPickerContext) return;

      rememberNoteSubjectType(subject.id, subject.object);

      const fallbackLabel =
        subject.data.characters ||
        subject.data.meanings.find((meaning) => meaning.primary)?.meaning ||
        subject.data.meanings[0]?.meaning ||
        "";

      if (linkPickerContext.editorMode === "visual") {
        issueVisualCommand({
          type: "set-link",
          subjectId: subject.id,
          fallbackLabel,
        });
        setLinkPickerContext(null);
        return;
      }

      const result = setNoteSubjectLink(
        value,
        linkPickerContext.selection,
        subject.id,
        fallbackLabel,
      );

      commitValue(result.text);
      setSelection(result.selection);
      closeLinkPicker();
    },
    [
      closeLinkPicker,
      commitValue,
      issueVisualCommand,
      linkPickerContext,
      value,
    ],
  );

  const handleRemoveLink = useCallback(() => {
    if (!editorIsEditable || !linkPickerContext) return;

    if (linkPickerContext.editorMode === "visual") {
      issueVisualCommand({ type: "remove-link" });
      setLinkPickerContext(null);
      return;
    }

    const result = removeNoteSubjectLink(value, linkPickerContext.selection);
    commitValue(result.text);
    setSelection(result.selection);
    closeLinkPicker();
  }, [
    closeLinkPicker,
    commitValue,
    editorIsEditable,
    issueVisualCommand,
    linkPickerContext,
    value,
  ]);

  const handleRemoveSelectedLink = useCallback(() => {
    if (!editorIsEditable) return;
    if (editorMode === "visual") {
      issueVisualCommand({ type: "remove-link" });
      return;
    }

    const result = removeNoteSubjectLink(value, selection);
    commitValue(result.text);
    setSelection(result.selection);
  }, [
    commitValue,
    editorIsEditable,
    editorMode,
    issueVisualCommand,
    selection,
    value,
  ]);

  const handleVisualRunsChange = useCallback(
    async (nextRuns: NoteVisualEditorRun[]) => {
      const normalizedRuns = normalizeFormattedNoteSegments(nextRuns);
      if (!normalizedRuns) return;

      const nextValue = serializeFormattedNote(normalizedRuns);
      if (nextValue !== currentValueRef.current) commitValue(nextValue);
    },
    [commitValue],
  );

  const handleVisualSelectionChange = useCallback(
    async (nextSelection: NoteVisualEditorSelection) => {
      const { requestNonce, ...selectionSnapshot } = nextSelection;
      setVisualSelection(selectionSnapshot);

      if (
        requestNonce !== undefined &&
        requestNonce === pendingVisualLinkRequestNonceRef.current
      ) {
        pendingVisualLinkRequestNonceRef.current = null;
        setLinkPickerContext({
          editorMode: "visual",
          initialQuery: selectionSnapshot.text,
          linkedSubjectId: selectionSnapshot.subjectId,
        });
      }
    },
    [],
  );

  const handleVisualSourceReady = useCallback(
    async (snapshot: NoteVisualEditorSourceSnapshot) => {
      if (snapshot.requestNonce !== pendingSourceRequestNonceRef.current) {
        return;
      }

      const normalizedRuns = normalizeFormattedNoteSegments(snapshot.runs);
      if (!normalizedRuns) return;

      const nextValue = serializeFormattedNote(normalizedRuns);
      pendingSourceRequestNonceRef.current = null;
      pendingVisualLinkRequestNonceRef.current = null;
      if (nextValue !== currentValueRef.current) commitValue(nextValue);
      setSelection({ start: nextValue.length, end: nextValue.length });
      setEditorMode("source");
      requestAnimationFrame(() => textInputRef.current?.focus());
    },
    [commitValue],
  );

  const handleVisualValueReady = useCallback(
    async (snapshot: NoteVisualEditorValueSnapshot) => {
      const pendingRequest = pendingVisualValueRequestsRef.current.get(
        snapshot.requestNonce,
      );
      if (!pendingRequest) return;

      pendingVisualValueRequestsRef.current.delete(snapshot.requestNonce);
      clearTimeout(pendingRequest.timeoutId);
      const normalizedRuns = normalizeFormattedNoteSegments(snapshot.runs);
      if (!normalizedRuns) {
        pendingRequest.resolve(currentValueRef.current);
        return;
      }

      const nextValue = serializeFormattedNote(normalizedRuns);
      if (nextValue !== currentValueRef.current) commitValue(nextValue);
      pendingRequest.resolve(nextValue);
    },
    [commitValue],
  );

  const handleVisualFocus = useCallback(async () => {
    onFocus?.();
  }, [onFocus]);

  const handleVisualBlur = useCallback(async () => {
    onBlur?.();
  }, [onBlur]);

  const handleEditorModeChange = useCallback(
    (nextMode: NoteEditorMode) => {
      if (nextMode === editorMode) return;

      pendingVisualLinkRequestNonceRef.current = null;
      if (nextMode === "source") {
        pendingSourceRequestNonceRef.current = issueVisualCommand({
          type: "prepare-source",
        });
        return;
      }

      pendingSourceRequestNonceRef.current = null;
      setEditorMode("visual");
      if (nextMode === "visual") {
        issueVisualCommand({ type: "focus" });
      }
    },
    [editorMode, issueVisualCommand],
  );

  const sourceLink = getNoteSubjectLinkAtSelection(value, selection);
  const selectedLinkSubjectId =
    editorMode === "visual" ? visualSelection.subjectId : sourceLink?.subjectId;
  const selectedLinkText =
    editorMode === "visual" ? visualSelection.text : sourceLink?.text || "";
  const selectedLinkType = selectedLinkSubjectId
    ? linkedSubjectTypes[selectedLinkSubjectId]
    : undefined;
  const selectedLinkColor = selectedLinkType
    ? subjectColors.getColorForType(selectedLinkType)
    : theme.textColor;

  return (
    <View style={[styles.editorContainer, containerStyle]}>
      {linkPickerContext ? (
        <NoteSubjectLinkPicker
          initialQuery={linkPickerContext.initialQuery}
          linkedSubjectId={linkPickerContext.linkedSubjectId}
          onCancel={closeLinkPicker}
          onRemove={
            linkPickerContext.linkedSubjectId ? handleRemoveLink : undefined
          }
          onSearchFocus={onFocus}
          onSelect={handleLinkSubjectSelect}
        />
      ) : null}

      <View
        pointerEvents={linkPickerContext ? "none" : "auto"}
        style={linkPickerContext ? styles.hiddenEditorControls : undefined}
      >
        <View
          accessibilityLabel="Note editor mode"
          accessibilityRole="tablist"
          style={[
            styles.modeSwitcher,
            {
              borderColor: theme.border,
              backgroundColor: theme.cardBackground,
            },
          ]}
        >
          {(["visual", "source"] as const).map((mode) => {
            const selected = editorMode === mode;
            const label = mode === "visual" ? "Visual" : "Source";
            return (
              <Pressable
                key={mode}
                accessibilityLabel={`Use ${mode} editor`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => handleEditorModeChange(mode)}
                style={({ pressed }) => [
                  styles.modeButton,
                  {
                    backgroundColor: selected
                      ? theme.headerSurface
                      : "transparent",
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    { color: selected ? theme.primary : theme.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            visualEditorFrameStyle,
            styles.visualEditorFrame,
            editorMode !== "visual" && styles.hiddenEditorSurface,
          ]}
        >
          <NoteVisualEditorDOM
            accessibilityHint={
              typeof textInputProps.accessibilityHint === "string"
                ? textInputProps.accessibilityHint
                : undefined
            }
            accessibilityLabel={
              typeof textInputProps.accessibilityLabel === "string"
                ? textInputProps.accessibilityLabel
                : "Note text"
            }
            appearance={{
              colorScheme: theme.isDark ? "dark" : "light",
              isolatedHost: Platform.OS !== "web",
              backgroundColor:
                typeof flattenedEditorStyle.backgroundColor === "string"
                  ? flattenedEditorStyle.backgroundColor
                  : theme.cardBackground,
              textColor:
                typeof flattenedEditorStyle.color === "string"
                  ? flattenedEditorStyle.color
                  : theme.textColor,
              placeholderColor:
                typeof textInputProps.placeholderTextColor === "string"
                  ? textInputProps.placeholderTextColor
                  : theme.textLight,
              caretColor: theme.primary,
              selectionColor: withAlpha(theme.primary, 0.28),
              subjectColors: {
                radical: subjectColors.radical,
                kanji: subjectColors.kanji,
                vocabulary: subjectColors.vocabulary,
              },
              fontFamily:
                typeof flattenedEditorStyle.fontFamily === "string"
                  ? flattenedEditorStyle.fontFamily
                  : undefined,
              fontSize:
                typeof flattenedEditorStyle.fontSize === "number"
                  ? flattenedEditorStyle.fontSize * fontScale
                  : 16 * fontScale,
              lineHeight:
                typeof flattenedEditorStyle.lineHeight === "number"
                  ? flattenedEditorStyle.lineHeight * fontScale
                  : 22 * fontScale,
              minHeight: visualEditorHeight,
              paddingHorizontal:
                typeof flattenedEditorStyle.paddingHorizontal === "number"
                  ? flattenedEditorStyle.paddingHorizontal
                  : typeof flattenedEditorStyle.padding === "number"
                    ? flattenedEditorStyle.padding
                    : 12,
              paddingVertical:
                typeof flattenedEditorStyle.paddingVertical === "number"
                  ? flattenedEditorStyle.paddingVertical
                  : typeof flattenedEditorStyle.padding === "number"
                    ? flattenedEditorStyle.padding
                    : 12,
            }}
            autoFocus={
              editorMode === "visual" && Boolean(textInputProps.autoFocus)
            }
            autoCapitalize={textInputProps.autoCapitalize}
            autoCorrect={textInputProps.autoCorrect !== false}
            command={visualCommand}
            dom={{
              keyboardDisplayRequiresUserAction: false,
              scrollEnabled: true,
              style: { width: "100%", height: visualEditorHeight },
            }}
            onChange={handleVisualRunsChange}
            onBlur={handleVisualBlur}
            onFocus={handleVisualFocus}
            onSelectionChange={handleVisualSelectionChange}
            onSourceReady={handleVisualSourceReady}
            onValueReady={handleVisualValueReady}
            placeholder={
              typeof textInputProps.placeholder === "string"
                ? textInputProps.placeholder
                : ""
            }
            runs={visualRuns}
            editable={editorIsEditable}
            maxLength={textInputProps.maxLength}
            spellCheck={
              textInputProps.spellCheck ?? textInputProps.autoCorrect ?? true
            }
            subjectTypes={visualSubjectTypes}
          />
        </View>

        <TextInput
          {...textInputProps}
          ref={textInputRef}
          autoFocus={
            editorMode === "source" && Boolean(textInputProps.autoFocus)
          }
          multiline
          style={[style, editorMode !== "source" && styles.hiddenEditorSurface]}
          value={value}
          onChangeText={commitValue}
          onBlur={onBlur}
          onFocus={onFocus}
          selection={selection}
          onSelectionChange={(event) =>
            setSelection(event.nativeEvent.selection)
          }
        />

        <View
          style={styles.toolbar}
          accessibilityRole="toolbar"
          accessibilityLabel="Note formatting"
        >
          <Text style={[styles.toolbarLabel, { color: theme.textSecondary }]}>
            Format
          </Text>
          {FORMAT_BUTTONS.map(({ format, label, accessibilityLabel }) => {
            const selected =
              editorMode === "visual"
                ? visualSelection.formats.includes(format)
                : selectionHasNoteFormat(value, selection, format);
            return (
              <Pressable
                key={format}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={`Formats the selected note text as ${accessibilityLabel.toLocaleLowerCase("en-US")}`}
                accessibilityState={{ disabled: !editorIsEditable, selected }}
                disabled={!editorIsEditable}
                hitSlop={6}
                onPress={() => handleFormatPress(format)}
                style={({ pressed }) => [
                  styles.formatButton,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected
                      ? theme.headerSurface
                      : theme.cardBackground,
                    opacity: !editorIsEditable ? 0.45 : pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.formatButtonText,
                    FORMAT_TEXT_STYLES[format],
                    { color: selected ? theme.primary : theme.textColor },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            accessibilityHint="Searches for a WaniKani subject to link from the selected note text"
            accessibilityLabel="Link to subject"
            accessibilityRole="button"
            accessibilityState={{
              disabled: !editorIsEditable,
              selected: Boolean(selectedLinkSubjectId),
            }}
            disabled={!editorIsEditable}
            hitSlop={6}
            onPress={handleLinkPress}
            style={({ pressed }) => [
              styles.formatButton,
              {
                borderColor: selectedLinkSubjectId
                  ? selectedLinkColor
                  : theme.border,
                backgroundColor: selectedLinkSubjectId
                  ? withAlpha(selectedLinkColor, 0.14)
                  : theme.cardBackground,
                opacity: !editorIsEditable ? 0.45 : pressed ? 0.65 : 1,
              },
            ]}
          >
            <Ionicons
              name="link"
              size={17}
              color={
                selectedLinkSubjectId ? selectedLinkColor : theme.textColor
              }
            />
          </Pressable>
        </View>

        {selectedLinkSubjectId ? (
          <View
            style={[
              styles.linkActions,
              {
                borderColor: theme.border,
                backgroundColor: theme.cardBackground,
              },
            ]}
          >
            <View style={styles.linkActionsLabel}>
              <Ionicons name="link" size={15} color={selectedLinkColor} />
              <Text
                numberOfLines={1}
                style={[styles.linkActionsText, { color: selectedLinkColor }]}
              >
                {selectedLinkText || "Linked subject"}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Change subject link"
              accessibilityRole="button"
              accessibilityState={{ disabled: !editorIsEditable }}
              disabled={!editorIsEditable}
              hitSlop={6}
              onPress={handleLinkPress}
              style={({ pressed }) => [
                styles.linkActionButton,
                { opacity: pressed ? 0.55 : 1 },
              ]}
            >
              <Text style={[styles.linkActionText, { color: theme.primary }]}>
                Change
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Remove subject link"
              accessibilityRole="button"
              accessibilityState={{ disabled: !editorIsEditable }}
              disabled={!editorIsEditable}
              hitSlop={6}
              onPress={handleRemoveSelectedLink}
              style={({ pressed }) => [
                styles.linkActionButton,
                { opacity: pressed ? 0.55 : 1 },
              ]}
            >
              <Text style={[styles.linkActionText, { color: theme.error }]}>
                Remove
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  editorContainer: {
    minHeight: 0,
    minWidth: 0,
    flexShrink: 1,
  },
  hiddenEditorControls: {
    display: "none",
  },
  modeSwitcher: {
    alignSelf: "flex-start",
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    padding: 2,
    marginBottom: 8,
  },
  modeButton: {
    minWidth: 72,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  visualEditorFrame: {
    overflow: "hidden",
    padding: 0,
  },
  hiddenEditorSurface: {
    display: "none",
  },
  toolbar: {
    minHeight: 40,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolbarLabel: {
    fontSize: 13,
    marginRight: 2,
  },
  formatButton: {
    width: 36,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  formatButtonText: {
    fontSize: 16,
    lineHeight: 20,
  },
  linkActions: {
    minHeight: 42,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 9,
    paddingLeft: 10,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkActionsLabel: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkActionsText: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  linkActionButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  linkActionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  subjectLink: {
    fontWeight: "600",
  },
});
