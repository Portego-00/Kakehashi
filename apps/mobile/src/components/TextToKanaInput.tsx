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
  NativeSyntheticEvent,
  Platform,
  TextInput,
  TextInputProps,
  TextInputSelectionChangeEventData,
} from "react-native";
import * as wanakana from "wanakana";
import KeyboardManager from "../modules/KeyboardManager";
import { useTheme } from "../utils/theme";

interface KanaInputProps
  extends Omit<TextInputProps, "onChangeText" | "value"> {
  /**
   * Called every time valid kana is produced
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
  /**
   * Opt out of the Android controlled-input conversion path.
   * This can reduce fast-typing cursor lag in some RN versions.
   */
  preferUncontrolledAndroidInput?: boolean;
}

export type KanaInputHandle = {
  flushKana: () => string;
  clearInput: () => void;
  focus: () => void;
  setInputText?: (nextText: string) => void;
};

const ANDROID_IME_DUPLICATE_WINDOW_MS = 80;
const SPACE_TO_LONG_VOWEL_MARK_MAPPING: Record<string, string> = {
  " ": "ー",
  "　": "ー",
};

const convertToHiragana = (value: string, IMEMode: boolean) =>
  wanakana.toHiragana(value, {
    IMEMode,
    customKanaMapping: SPACE_TO_LONG_VOWEL_MARK_MAPPING,
  });

// Some Android IMEs occasionally emit an immediate "duplicate append" event
// after JS transforms text in a controlled TextInput.
const isLikelyAndroidImeDuplicateAppend = (
  previousText: string,
  nextText: string,
  previousAcceptedAtMs: number,
  nowMs: number
) => {
  if (!previousText) return false;
  if (nextText.length !== previousText.length + 1) return false;
  if (!nextText.startsWith(previousText)) return false;

  const appendedChar = nextText[nextText.length - 1];
  const previousLastChar = previousText[previousText.length - 1];
  if (!appendedChar || appendedChar !== previousLastChar) return false;

  return nowMs - previousAcceptedAtMs <= ANDROID_IME_DUPLICATE_WINDOW_MS;
};

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
      preferUncontrolledAndroidInput = false,
      onFocus,
      onSelectionChange,
      caretHidden: caretHiddenProp,
      keyboardType: keyboardTypeProp,
      ...rest
    }: KanaInputProps,
    ref
  ) => {
    const [text, setText] = useState(initialValue);
    const inputRef = useRef<TextInput>(null);
    const selectionRef = useRef({ start: 0, end: 0 });
    const lastRawValue = useRef(initialValue);
    const lastCommittedText = useRef(initialValue);
    const lastCommittedAtMs = useRef(0);
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
    const shouldUseControlledAndroidInput =
      Platform.OS === "android" &&
      shouldConvertWithWanakana &&
      !preferUncontrolledAndroidInput;
    const keyboardType = keyboardTypeProp ?? "default";

    const updateRenderedText = useCallback((nextText: string) => {
      // iOS stays truly uncontrolled while typing. The ref below remains the
      // source of truth for answers, and Android still tracks state for the
      // controlled IME path and empty-field caret workaround.
      if (Platform.OS === "android") {
        setText(nextText);
      }
    }, []);

    const getConvertedSelection = useCallback(
      (raw: string, processedText: string, previousText: string) => {
        const endSelection = {
          start: processedText.length,
          end: processedText.length,
        };
        const currentSelection = selectionRef.current;
        const isLikelyEndEdit =
          raw.startsWith(previousText) ||
          previousText.startsWith(raw) ||
          currentSelection.start >= previousText.length;

        if (isLikelyEndEdit) {
          return endSelection;
        }

        const convertSelectionOffset = (offset: number | undefined) => {
          const clampedOffset = Math.max(
            0,
            Math.min(offset ?? raw.length, raw.length)
          );
          if (!shouldConvertWithWanakana) {
            return Math.min(clampedOffset, processedText.length);
          }

          return Math.min(
            convertToHiragana(raw.slice(0, clampedOffset), true).length,
            processedText.length
          );
        };

        return {
          start: convertSelectionOffset(currentSelection.start),
          end: convertSelectionOffset(currentSelection.end),
        };
      },
      [shouldConvertWithWanakana]
    );

    const setNativeText = useCallback(
      (
        nextText: string,
        selection = { start: nextText.length, end: nextText.length }
      ) => {
        if (!inputRef.current) return;

        inputRef.current.setNativeProps({
          text: nextText,
          selection,
        });
        selectionRef.current = selection;
      },
      []
    );

    const resetCursorIfEmptyOnAndroid = useCallback(() => {
      if (Platform.OS !== "android") return;
      if (lastRawValue.current.length > 0) return;

      requestAnimationFrame(() => {
        inputRef.current?.setNativeProps({
          selection: { start: 0, end: 0 },
        });
      });
    }, []);

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

    // Convert final romaji to kana (e.g., きぶn to きぶん)
    // This is important for cases like "n" which doesn't auto-convert to "ん" until
    // followed by a non-n character or when input is submitted
    const flushKana = useCallback(() => {
      const currentText = lastCommittedText.current;
      // Only convert when wanakana conversion is active (not when using native Japanese keyboard)
      if (shouldConvertWithWanakana) {
        // Force convert any trailing romaji to kana
        const convertedText = convertToHiragana(currentText, false);
        lastCommittedText.current = convertedText;
        lastCommittedAtMs.current = Date.now();
        updateRenderedText(convertedText);
        // Update native text value when operating in uncontrolled mode
        if (!shouldUseControlledAndroidInput && inputRef.current) {
          setNativeText(convertedText);
        }
        return convertedText;
      }

      return currentText;
    }, [
      setNativeText,
      shouldConvertWithWanakana,
      shouldUseControlledAndroidInput,
      updateRenderedText,
    ]);

    // Clear the input field completely
    const clearInput = useCallback(() => {
      // Reset the raw-value guard so pending conversion timeouts
      // cannot re-apply stale text after a manual clear.
      lastRawValue.current = "";
      lastCommittedText.current = "";
      lastCommittedAtMs.current = 0;
      selectionRef.current = { start: 0, end: 0 };
      updateRenderedText("");
      if (!shouldUseControlledAndroidInput && inputRef.current?.clear) {
        // Prefer the native clear() for reliability across platforms
        inputRef.current.clear();
      } else if (!shouldUseControlledAndroidInput && inputRef.current) {
        setNativeText("");
      }
      resetCursorIfEmptyOnAndroid();
    }, [
      resetCursorIfEmptyOnAndroid,
      setNativeText,
      shouldUseControlledAndroidInput,
      updateRenderedText,
    ]);

    // Focus the input field
    const focus = useCallback(() => {
      inputRef.current?.focus();
      if (Platform.OS === "android") {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          resetCursorIfEmptyOnAndroid();
        });
      }
    }, [resetCursorIfEmptyOnAndroid]);

    const setInputText = useCallback((nextText: string) => {
      updateRenderedText(nextText);
      lastRawValue.current = nextText;
      lastCommittedText.current = nextText;
      lastCommittedAtMs.current = Date.now();
      selectionRef.current = { start: nextText.length, end: nextText.length };
      if (!shouldUseControlledAndroidInput && inputRef.current) {
        setNativeText(nextText, selectionRef.current);
      }
    }, [
      setNativeText,
      shouldUseControlledAndroidInput,
      updateRenderedText,
    ]);

    // Expose methods to parent components
    useImperativeHandle(ref, () => ({
      flushKana,
      clearInput,
      focus,
      setInputText,
    }));

    // Handle selection changes to preserve cursor position
    const handleSelectionChange = useCallback(
      (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        selectionRef.current = event.nativeEvent.selection;
        onSelectionChange?.(event);
      },
      [onSelectionChange]
    );

    const handleFocus = useCallback(
      (event: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
        onFocus?.(event);
        applyNativeKeyboardPreference(true);
        resetCursorIfEmptyOnAndroid();
      },
      [applyNativeKeyboardPreference, onFocus, resetCursorIfEmptyOnAndroid]
    );

    const handleChange = useCallback(
      (raw: string) => {
        // Only do wanakana conversion if enabled and not using native Japanese keyboard
        let processedText = raw;
        if (shouldConvertWithWanakana) {
          // IMEMode keeps unfinished chunks (e.g. lone 'n') in romaji
          processedText = convertToHiragana(raw, true);
        }

        const nowMs = Date.now();
        const previousText = lastCommittedText.current;
        if (
          shouldUseControlledAndroidInput &&
          isLikelyAndroidImeDuplicateAppend(
            previousText,
            processedText,
            lastCommittedAtMs.current,
            nowMs
          )
        ) {
          setNativeText(previousText);
          return;
        }

        lastRawValue.current = raw;
        lastCommittedText.current = processedText;
        lastCommittedAtMs.current = nowMs;

        // Update internal state
        updateRenderedText(processedText);

        // If the processed text is different from raw input, update the TextInput
        // using setNativeProps to avoid triggering another render cycle.
        // We use a timeout to give the native side time to process the input event,
        // but we check lastRawValue to ensure we don't overwrite newer input (fixing cursor jumps).
        if (
          !shouldUseControlledAndroidInput &&
          processedText !== raw &&
          inputRef.current
        ) {
          const nextSelection = getConvertedSelection(
            raw,
            processedText,
            previousText
          );
          setTimeout(() => {
            if (lastRawValue.current === raw && inputRef.current) {
              setNativeText(processedText, nextSelection);
            }
          }, 0);
        }

        onKanaChange?.(processedText);
      },
      [
        getConvertedSelection,
        onKanaChange,
        setNativeText,
        shouldConvertWithWanakana,
        shouldUseControlledAndroidInput,
        updateRenderedText,
      ]
    );

    // When resetSignal changes, clear the input reliably without blurring
    useLayoutEffect(() => {
      if (resetSignal === undefined) return;
      const wasFocused = Boolean(
        inputRef.current && (inputRef.current as any).isFocused?.()
      );
      if (!shouldUseControlledAndroidInput && inputRef.current?.clear) {
        inputRef.current.clear();
      } else if (!shouldUseControlledAndroidInput && inputRef.current) {
        setNativeText("");
      }
      updateRenderedText("");
      lastRawValue.current = "";
      lastCommittedText.current = "";
      lastCommittedAtMs.current = 0;
      selectionRef.current = { start: 0, end: 0 };
      resetCursorIfEmptyOnAndroid();
      // Restore focus synchronously if it was focused
      if (wasFocused) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }, [
      resetSignal,
      resetCursorIfEmptyOnAndroid,
      setNativeText,
      shouldUseControlledAndroidInput,
      updateRenderedText,
    ]);

    const textInputValueProps = shouldUseControlledAndroidInput
      ? { value: text }
      : { defaultValue: initialValue };

    return (
      <TextInput
        {...rest}
        {...textInputValueProps}
        ref={inputRef}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onSelectionChange={handleSelectionChange}
        caretHidden={
          Boolean(caretHiddenProp) ||
          (Platform.OS === "android" && text.length === 0)
        }
        autoCapitalize="none"
        autoCorrect={false}
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
