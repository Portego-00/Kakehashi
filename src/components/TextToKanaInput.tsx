import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Platform,
  TextInput,
  TextInputProps,
} from "react-native";
import * as wanakana from "wanakana";
import KeyboardManager from "../modules/KeyboardManager";
import { inferKanaInputEditEnd, type KanaInputSelection } from "../utils/kanaInputSelection";
import { useTheme } from "../utils/theme";

interface KanaInputProps
  extends Omit<TextInputProps, "onChangeText" | "value"> {
  /**
   * Reports text changes, including unfinished romaji while typing.
   */
  onKanaChange?: (kana: string) => void;
  initialValue?: string;
  /**
   * Whether to convert input to kana
   */
  enableKanaConversion?: boolean;
  /**
   * When true, requests the native Japanese keyboard.
   * Disables wanakana romaji-to-kana conversion since the keyboard handles it.
   */
  useJapaneseKeyboard?: boolean;
  /**
   * When this value changes, the input will be imperatively cleared.
   * Useful to sync uncontrolled input with parent navigation changes.
   */
  resetSignal?: string | number;
}

export type KanaInputHandle = {
  flushKana: (nativeText?: string) => string;
  clearInput: () => void;
  focus: () => void;
  setInputText?: (nextText: string) => void;
};

const SPACE_TO_LONG_VOWEL_MARK_MAPPING: Record<string, string> = {
  " ": "ー",
  "　": "ー",
};

const convertToKana = (value: string, IMEMode: boolean) =>
  wanakana.toKana(value, {
    IMEMode,
    customKanaMapping: SPACE_TO_LONG_VOWEL_MARK_MAPPING,
  });

const KanaInput = forwardRef<
  KanaInputHandle,
  KanaInputProps
>(
  (
    {
      onKanaChange,
      initialValue = "",
      enableKanaConversion = true,
      useJapaneseKeyboard = false,
      resetSignal,
      onFocus,
      onSubmitEditing,
      onSelectionChange,
      caretHidden: caretHiddenProp,
      keyboardType: keyboardTypeProp,
      ...rest
    }: KanaInputProps,
    ref
  ) => {
    const [text, setText] = useState(initialValue);
    const inputRef = useRef<TextInput>(null);
    const textRef = useRef(initialValue);
    const previousRawTextRef = useRef(initialValue);
    const selectionRef = useRef({ start: initialValue.length, end: initialValue.length });
    const [selection, setSelection] = useState<KanaInputSelection>();
    const { theme } = useTheme();

    const interfaceIdiom = (
      Platform.constants as { interfaceIdiom?: string } | undefined
    )?.interfaceIdiom;
    const isIpadOrMacFormFactor =
      Platform.OS === "ios" &&
      ((Platform as any).isPad === true ||
        interfaceIdiom === "pad" ||
        interfaceIdiom === "mac");
    const shouldUseNativeJapaneseKeyboard =
      useJapaneseKeyboard &&
      (Platform.OS === "android" ||
        (Platform.OS === "ios" && !isIpadOrMacFormFactor));

    // When useJapaneseKeyboard is true, the native keyboard produces kana
    // directly so we skip wanakana conversion.
    const shouldConvertWithWanakana =
      enableKanaConversion && !shouldUseNativeJapaneseKeyboard;
    const keyboardType = keyboardTypeProp ?? "default";
    const [inputMode, setInputMode] = useState({
      converts: shouldConvertWithWanakana,
      defaultValue: initialValue,
    });
    if (inputMode.converts !== shouldConvertWithWanakana) {
      // Changing value -> defaultValue must preserve the current answer. Keep
      // that default fixed throughout native editing so composition stays native.
      setInputMode({ converts: shouldConvertWithWanakana, defaultValue: text });
    }

    // Only transformed input is controlled. React Native applies value updates
    // with its native event count, rejecting conversions after newer native
    // change events. Native keyboards keep ownership of their composing text.
    const updateText = useCallback((nextText: string) => {
      textRef.current = nextText;
      setText(nextText);
    }, []);

    const setInputText = useCallback((nextText: string) => {
      updateText(nextText);
      previousRawTextRef.current = nextText;
      const nextSelection = { start: nextText.length, end: nextText.length };
      selectionRef.current = nextSelection;
      setSelection(shouldConvertWithWanakana ? nextSelection : undefined);
      if (!shouldConvertWithWanakana) {
        inputRef.current?.setNativeProps({ text: nextText, selection: nextSelection });
      }
    }, [shouldConvertWithWanakana, updateText]);

    const clearInput = useCallback(() => {
      updateText("");
      previousRawTextRef.current = "";
      selectionRef.current = { start: 0, end: 0 };
      setSelection(undefined);
      // clear() also clears unfinished native text when the converted value
      // was already empty, and keeps the existing field and keyboard focused.
      inputRef.current?.clear();
    }, [updateText]);

    const focus = useCallback(() => {
      inputRef.current?.focus();
    }, []);

    const flushKana = useCallback((nativeText?: string) => {
      // Enter carries the native field's complete snapshot, which can be ahead
      // of the latest change callback. Buttons use the synchronous ref instead.
      const currentText = nativeText ?? textRef.current;
      const answer = shouldConvertWithWanakana
        ? convertToKana(currentText, false)
        : currentText;
      updateText(answer);
      return answer;
    }, [shouldConvertWithWanakana, updateText]);

    useImperativeHandle(ref, () => ({
      flushKana,
      clearInput,
      focus,
      setInputText,
    }), [flushKana, clearInput, focus, setInputText]);

    const isInputFocused = useCallback(
      () => Boolean(inputRef.current && (inputRef.current as any).isFocused?.()),
      []
    );

    const applyNativeKeyboardPreference = useCallback((force = false) => {
      if (KeyboardManager) {
        if (Platform.OS === "android" && !force && !isInputFocused()) {
          return;
        }

        KeyboardManager.setUseJapaneseKeyboard(
          shouldUseNativeJapaneseKeyboard
        ).catch(() => {});
      }
    }, [isInputFocused, shouldUseNativeJapaneseKeyboard]);

    // Tell the native KeyboardManager to switch keyboard language.
    useEffect(() => {
      applyNativeKeyboardPreference();
      return () => {
        // Reset to default keyboard when unmounting or when prop changes
        if (
          KeyboardManager &&
          (Platform.OS !== "android" || isInputFocused())
        ) {
          KeyboardManager.setUseJapaneseKeyboard(false).catch(() => {});
        }
      };
    }, [applyNativeKeyboardPreference, isInputFocused]);

    const handleFocus = useCallback(
      (event: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
        onFocus?.(event);
        applyNativeKeyboardPreference(true);
      },
      [applyNativeKeyboardPreference, onFocus]
    );

    const handleChange = useCallback((raw: string) => {
      const nextText = shouldConvertWithWanakana
        ? convertToKana(raw, true)
        : raw;
      let nextSelection: KanaInputSelection | undefined;
      if (Platform.OS === "android" && shouldConvertWithWanakana) {
        const rawEnd = inferKanaInputEditEnd(textRef.current, raw, selectionRef.current, previousRawTextRef.current);
        // Record the native edit's caret even before its selection event arrives.
        // Keep raw offsets here: native may reject our converted replacement.
        selectionRef.current = { start: rawEnd, end: rawEnd };
        if (nextText !== raw) {
          // Android's whole-text replacement can shift a middle caret. Send the
          // converted caret with value, through RN's event-count-checked command.
          const end = Math.min(convertToKana(raw.slice(0, rawEnd), true).length, nextText.length);
          nextSelection = { start: end, end };
        }
      }
      setSelection(nextSelection);
      previousRawTextRef.current = raw;
      updateText(nextText);
      onKanaChange?.(nextText);
    }, [onKanaChange, shouldConvertWithWanakana, updateText]);

    useLayoutEffect(() => {
      // TextInput's child layout effect has now sent the correction. Release it
      // so later selection events or parent renders cannot pin the user's caret.
      if (selection) setSelection(undefined);
    }, [selection]);

    const handleSubmitEditing: NonNullable<TextInputProps["onSubmitEditing"]> = (event) => {
      const answer = flushKana(event.nativeEvent.text);
      onSubmitEditing?.({
        ...event,
        nativeEvent: { ...event.nativeEvent, text: answer },
      });
    };

    useLayoutEffect(() => {
      if (resetSignal !== undefined) clearInput();
    }, [resetSignal, clearInput]);

    return (
      <TextInput
        {...rest}
        {...(shouldConvertWithWanakana ? { value: text } : { defaultValue: inputMode.defaultValue })}
        ref={inputRef}
        selection={selection ?? rest.selection}
        onSelectionChange={(event) => {
          selectionRef.current = event.nativeEvent.selection;
          onSelectionChange?.(event);
        }}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onSubmitEditing={handleSubmitEditing}
        caretHidden={
          Boolean(caretHiddenProp) ||
          (Platform.OS === "android" && text.length === 0)
        }
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType={keyboardType}
        keyboardAppearance={theme.isDark ? "dark" : "light"}
        style={[
          {
            fontSize: 20,
            color: theme.textColor,
            backgroundColor: "transparent",
            textAlign: "center",
            includeFontPadding: false,
            textAlignVertical: "center",
          },
          rest.style,
        ]}
        placeholderTextColor={theme.textLight}
      />
    );
  }
);

KanaInput.displayName = "KanaInput";

export default KanaInput;
