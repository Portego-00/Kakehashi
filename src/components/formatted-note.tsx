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
import type { Subject } from "../utils/api";
import {
  getNoteLinkSearchText,
  getNoteSubjectLinkAtSelection,
  parseFormattedNote,
  removeNoteSubjectLink,
  selectionHasNoteFormat,
  selectionHasNoteSubjectLink,
  setNoteSubjectLink,
  toggleNoteFormat,
  type NoteFormat,
  type NoteSelection,
  type NoteSubjectLink,
} from "../utils/note-formatting";
import { useTheme } from "../utils/theme";
import NoteSubjectLinkPicker from "./note-subject-link-picker";
import NoteSubjectPreview from "./note-subject-preview";

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
  const segments = useMemo(() => parseFormattedNote(text), [text]);
  const [previewLink, setPreviewLink] = useState<NoteSubjectLink | null>(null);

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
  for (let index = 0; index < segments.length; ) {
    const segment = segments[index];
    if (!segment.subjectId) {
      renderedSegments.push(
        <Text
          key={`${index}:${segment.text}`}
          style={segment.formats.map(
            (format) => FORMAT_TEXT_STYLES[format],
          )}
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
    renderedSegments.push(
      <Text
        accessibilityHint="Shows a quick subject preview"
        accessibilityLabel={linkText}
        accessibilityRole="link"
        key={`${index}:${subjectId}:${linkText}`}
        onPress={(event) =>
          handleSubjectLinkPress(event, subjectId, linkText)
        }
        style={[
          styles.subjectLink,
          {
            color: theme.primary,
            textDecorationColor: theme.primary,
          },
        ]}
      >
        {linkedSegments.map((part, partIndex) => (
          <Text
            key={`${partIndex}:${part.text}`}
            style={part.formats.map(
              (format) => FORMAT_TEXT_STYLES[format],
            )}
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
  "onChangeText" | "onSelectionChange" | "selection" | "style" | "value"
> & {
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export type FormattedNoteEditorHandle = {
  closeLinkPicker: () => boolean;
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
    style,
    containerStyle,
    ...textInputProps
  },
  forwardedRef,
) {
  const { theme } = useTheme();
  const textInputRef = useRef<TextInput>(null);
  const shouldRestoreFocusRef = useRef(false);
  const [selection, setSelection] = useState<NoteSelection>({
    start: value.length,
    end: value.length,
  });
  const [linkPickerContext, setLinkPickerContext] = useState<{
    selection: NoteSelection;
    initialQuery: string;
    linkedSubjectId?: number;
  } | null>(null);

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
      const result = toggleNoteFormat(value, selection, format);
      onChangeText(result.text);
      setSelection(result.selection);
    },
    [onChangeText, selection, value],
  );

  const handleLinkPress = useCallback(() => {
    const existingLink = getNoteSubjectLinkAtSelection(value, selection);
    setLinkPickerContext({
      selection: { ...selection },
      initialQuery: getNoteLinkSearchText(value, selection),
      linkedSubjectId: existingLink?.subjectId,
    });
  }, [selection, value]);

  const closeLinkPicker = useCallback(() => {
    shouldRestoreFocusRef.current = true;
    setLinkPickerContext(null);
  }, []);

  useImperativeHandle(
    forwardedRef,
    () => ({
      closeLinkPicker: () => {
        if (!linkPickerContext) return false;
        closeLinkPicker();
        return true;
      },
    }),
    [closeLinkPicker, linkPickerContext],
  );

  const handleLinkSubjectSelect = useCallback(
    (subject: Subject) => {
      if (!linkPickerContext) return;

      const fallbackLabel =
        subject.data.characters ||
        subject.data.meanings.find((meaning) => meaning.primary)?.meaning ||
        subject.data.meanings[0]?.meaning ||
        "";
      const result = setNoteSubjectLink(
        value,
        linkPickerContext.selection,
        subject.id,
        fallbackLabel,
      );

      onChangeText(result.text);
      setSelection(result.selection);
      closeLinkPicker();
    },
    [closeLinkPicker, linkPickerContext, onChangeText, value],
  );

  const handleRemoveLink = useCallback(() => {
    if (!linkPickerContext) return;

    const result = removeNoteSubjectLink(value, linkPickerContext.selection);
    onChangeText(result.text);
    setSelection(result.selection);
    closeLinkPicker();
  }, [closeLinkPicker, linkPickerContext, onChangeText, value]);

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
          onSearchFocus={textInputProps.onFocus}
          onSelect={handleLinkSubjectSelect}
        />
      ) : (
        <>
          <TextInput
            {...textInputProps}
            ref={textInputRef}
            multiline
            style={style}
            value={value}
            onChangeText={onChangeText}
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
              const selected = selectionHasNoteFormat(value, selection, format);
              return (
                <Pressable
                  key={format}
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  accessibilityHint={`Formats the selected note text as ${accessibilityLabel.toLocaleLowerCase("en-US")}`}
                  accessibilityState={{ selected }}
                  hitSlop={6}
                  onPress={() => handleFormatPress(format)}
                  style={({ pressed }) => [
                    styles.formatButton,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected
                        ? theme.headerSurface
                        : theme.cardBackground,
                      opacity: pressed ? 0.65 : 1,
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
                selected: selectionHasNoteSubjectLink(value, selection),
              }}
              hitSlop={6}
              onPress={handleLinkPress}
              style={({ pressed }) => {
                const selected = selectionHasNoteSubjectLink(value, selection);
                return [
                  styles.formatButton,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected
                      ? theme.headerSurface
                      : theme.cardBackground,
                    opacity: pressed ? 0.65 : 1,
                  },
                ];
              }}
            >
              <Ionicons
                name="link"
                size={17}
                color={
                  selectionHasNoteSubjectLink(value, selection)
                    ? theme.primary
                    : theme.textColor
                }
              />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  editorContainer: {
    minHeight: 0,
    minWidth: 0,
    flexShrink: 1,
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
  subjectLink: {
    fontWeight: "600",
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
  },
});
