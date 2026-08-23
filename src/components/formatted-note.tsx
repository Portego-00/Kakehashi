import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import {
  parseFormattedNote,
  selectionHasNoteFormat,
  toggleNoteFormat,
  type NoteFormat,
  type NoteSelection,
} from "../utils/note-formatting";
import { useTheme } from "../utils/theme";

type FormattedNoteTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  selectable?: boolean;
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
}: FormattedNoteTextProps) {
  const segments = useMemo(() => parseFormattedNote(text), [text]);

  return (
    <Text selectable={selectable} style={style}>
      {segments.map((segment, index) => (
        <Text
          key={`${index}:${segment.text}`}
          style={segment.formats.map((format) => FORMAT_TEXT_STYLES[format])}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
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

const FORMAT_BUTTONS: {
  format: NoteFormat;
  label: string;
  accessibilityLabel: string;
}[] = [
  { format: "bold", label: "B", accessibilityLabel: "Bold" },
  { format: "italic", label: "I", accessibilityLabel: "Italic" },
  { format: "underline", label: "U", accessibilityLabel: "Underline" },
];

export function FormattedNoteEditor({
  value,
  onChangeText,
  style,
  containerStyle,
  ...textInputProps
}: FormattedNoteEditorProps) {
  const { theme } = useTheme();
  const [selection, setSelection] = useState<NoteSelection>({
    start: value.length,
    end: value.length,
  });

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

  return (
    <View style={containerStyle}>
      <TextInput
        {...textInputProps}
        multiline
        style={style}
        value={value}
        onChangeText={onChangeText}
        selection={selection}
        onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
