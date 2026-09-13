import React, { createRef } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Platform, TextInput } from "react-native";
import KanaInput, { type KanaInputHandle } from "../TextToKanaInput";
import KeyboardManager from "../../modules/KeyboardManager";

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({ theme: { isDark: false, textColor: "#000", textLight: "#888" } }),
}));
jest.mock("../../modules/KeyboardManager", () => ({
  __esModule: true,
  default: { setUseJapaneseKeyboard: jest.fn(() => Promise.resolve(true)) },
}));

const originalPlatform = Platform.OS;
const platformDescriptors = ["isPad", "constants"].map((property) => ({
  property,
  descriptor: Object.getOwnPropertyDescriptor(Platform, property),
}));

function renderInput(props: React.ComponentProps<typeof KanaInput> = {}) {
  const ref = createRef<KanaInputHandle>();
  const screen = render(<KanaInput ref={ref} testID="kana-input" {...props} />);
  const input = () => screen.getByTestId("kana-input");
  const nativeInput = screen.UNSAFE_getByType(TextInput).instance;
  const writes = jest.spyOn(nativeInput, "setNativeProps");
  return { ...screen, ref, input, writes };
}

describe("KanaInput event ordering", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Platform.OS = "ios";
    Object.defineProperty(Platform, "isPad", { configurable: true, value: false });
    Object.defineProperty(Platform, "constants", { configurable: true, value: { interfaceIdiom: "phone" } });
    jest.mocked(KeyboardManager!.setUseJapaneseKeyboard).mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    Platform.OS = originalPlatform;
    for (const { property, descriptor } of platformDescriptors) {
      if (descriptor) Object.defineProperty(Platform, property, descriptor);
      else Reflect.deleteProperty(Platform, property);
    }
  });

  it("does not roll a completed answer back when conversion was still pending at submit", () => {
    const { input, ref, writes } = renderInput();
    let visibleText = "kibun";
    writes.mockImplementation(({ text }: { text?: string }) => {
      if (text !== undefined) visibleText = text;
    });
    fireEvent.changeText(input(), "kibun");
    act(() => { expect(ref.current?.flushKana()).toBe("きぶん"); });
    // Controlled updates also represent what the native field should display.
    visibleText = input().props.value ?? visibleText;
    act(() => jest.runOnlyPendingTimers());
    expect(visibleText).toBe("きぶん");
  });

  it("submits the full native text when its last change has not reached JavaScript", () => {
    const submitted = jest.fn();
    const { input, ref } = renderInput({
      onSubmitEditing: (event) => submitted(event.nativeEvent.text, ref.current?.flushKana()),
    });
    fireEvent.changeText(input(), "kib");
    fireEvent(input(), "submitEditing", { nativeEvent: { text: "kibun" } });
    expect(submitted).toHaveBeenCalledWith("きぶん", "きぶん");
  });

  it("keeps a fast repeated kana instead of mistaking it for an IME duplicate", () => {
    Platform.OS = "android";
    const changed = jest.fn();
    const { input, ref } = renderInput({ onKanaChange: changed });
    fireEvent.changeText(input(), "a");
    fireEvent.changeText(input(), "あa");
    expect(changed).toHaveBeenLastCalledWith("ああ");
    act(() => { expect(ref.current?.flushKana()).toBe("ああ"); });
  });

  it("does not replay the pre-edit cursor position after a middle insertion", () => {
    const { input, writes } = renderInput({ initialValue: "かき" });
    // Native preserves the cursor's distance from the end when applying the
    // shorter conversion. A late JS selection must not move it back to zero.
    let nativeSelection = { start: 1, end: 1 };
    writes.mockImplementation(({ selection }: { selection?: typeof nativeSelection }) => {
      if (selection) nativeSelection = selection;
    });
    fireEvent(input(), "selectionChange", { nativeEvent: { selection: { start: 0, end: 0 } } });
    fireEvent.changeText(input(), "naかき");
    act(() => jest.runOnlyPendingTimers());
    expect(nativeSelection).toEqual({ start: 1, end: 1 });
  });

  const devices = [
    { device: "iPhone", os: "ios", idiom: "phone", nativeKeyboard: true },
    { device: "iPad", os: "ios", idiom: "pad", nativeKeyboard: false },
    { device: "Mac", os: "ios", idiom: "mac", nativeKeyboard: false },
    { device: "Android", os: "android", idiom: "phone", nativeKeyboard: true },
    { device: "web", os: "web", idiom: "phone", nativeKeyboard: false },
  ] as const;

  describe.each(devices)("$device settings", ({ os, idiom, nativeKeyboard }) => {
    it.each([
      { conversion: true, japanese: false },
      { conversion: true, japanese: true },
      { conversion: false, japanese: false },
      { conversion: false, japanese: true },
    ])("conversion=$conversion Japanese keyboard=$japanese", ({ conversion, japanese }) => {
      Platform.OS = os;
      Object.defineProperty(Platform, "constants", { value: { interfaceIdiom: idiom } });
      const converts = conversion && !(japanese && nativeKeyboard);
      const changed = jest.fn();
      const submitted = jest.fn();
      const { input, ref, writes } = renderInput({
        enableKanaConversion: conversion,
        useJapaneseKeyboard: japanese,
        onKanaChange: changed,
        onSubmitEditing: (event) => submitted(event.nativeEvent.text),
      });
      fireEvent(input(), "focus", { nativeEvent: {} });
      expect(KeyboardManager!.setUseJapaneseKeyboard).toHaveBeenLastCalledWith(japanese && nativeKeyboard);
      expect(input().props.autoCorrect).toBe(false);
      expect(input().props.spellCheck).toBe(false);
      fireEvent.changeText(input(), "kibun");
      expect(changed).toHaveBeenLastCalledWith(converts ? "きぶn" : "kibun");
      expect(input().props.value).toBe(converts ? "きぶn" : undefined);
      fireEvent(input(), "submitEditing", { nativeEvent: { text: "kibun" } });
      expect(submitted).toHaveBeenCalledWith(converts ? "きぶん" : "kibun");
      act(() => { expect(ref.current?.flushKana()).toBe(converts ? "きぶん" : "kibun"); });
      expect(writes).not.toHaveBeenCalled();
    });
  });

  describe.each(["ios", "android"] as const)("%s conversion", (os) => {
    it.each([
      ["kibun", "きぶn", "きぶん"],
      ["n", "n", "ん"],
      ["nn", "ん", "ん"],
      ["kan'i", "かんい", "かんい"],
      ["kon'nichiha", "こんにちは", "こんにちは"],
      ["gakkou", "がっこう", "がっこう"],
      ["xtsu", "っ", "っ"],
      ["SHINBUN", "シンブN", "シンブン"],
      ["ko-hi-", "こーひー", "こーひー"],
      ["ko hi　", "こーひー", "こーひー"],
      ["aa", "ああ", "ああ"],
      ["あああ", "あああ", "あああ"],
      ["計算", "計算", "計算"],
      ["かnaき", "かなき", "かなき"],
      ["か", "か", "か"],
      ["", "", ""],
    ])("converts and finalizes %s", (raw, typing, answer) => {
      Platform.OS = os;
      const { input, ref } = renderInput();
      fireEvent.changeText(input(), raw);
      expect(input().props.value).toBe(typing);
      act(() => { expect(ref.current?.flushKana()).toBe(answer); });
      expect(input().props.value).toBe(answer);
    });

    it("retains every character across a burst of changes before rendering", () => {
      Platform.OS = os;
      const { input, ref } = renderInput();
      const onChangeText = input().props.onChangeText;
      act(() => {
        for (const word of ["k", "ki", "kib", "kibu", "kibun"]) onChangeText(word);
        expect(ref.current?.flushKana()).toBe("きぶん");
      });
      expect(input().props.value).toBe("きぶん");
    });

    it("keeps the latest synchronous programmatic text, including clipping from a change callback", () => {
      Platform.OS = os;
      const ref = createRef<KanaInputHandle>();
      const { getByTestId } = render(
        <KanaInput ref={ref} testID="kana-input" onKanaChange={(text) => ref.current?.setInputText?.(text.slice(0, 2))} />,
      );
      fireEvent.changeText(getByTestId("kana-input"), "kakikukeko");
      expect(getByTestId("kana-input").props.value).toBe("かき");
      act(() => { expect(ref.current?.flushKana()).toBe("かき"); });
    });
  });

  it("honors an explicitly empty native submit instead of reviving the previous answer", () => {
    const submitted = jest.fn();
    const { input } = renderInput({ onSubmitEditing: (event) => submitted(event.nativeEvent.text) });
    fireEvent.changeText(input(), "neko");
    fireEvent(input(), "submitEditing", { nativeEvent: { text: "" } });
    expect(submitted).toHaveBeenCalledWith("");
  });

  it("preserves native Japanese composition, spaces, punctuation and selection events", () => {
    const changed = jest.fn();
    const selectionChanged = jest.fn();
    const { input, writes, ref } = renderInput({
      useJapaneseKeyboard: true,
      onKanaChange: changed,
      onSelectionChange: selectionChanged,
    });
    for (const text of ["け", "けいさん", "計算", "計算 です。"]) fireEvent.changeText(input(), text);
    fireEvent(input(), "selectionChange", { nativeEvent: { selection: { start: 2, end: 4 } } });
    expect(changed).toHaveBeenLastCalledWith("計算 です。");
    expect(selectionChanged).toHaveBeenCalledTimes(1);
    expect(input().props.value).toBeUndefined();
    expect(writes).not.toHaveBeenCalled();
    act(() => { expect(ref.current?.flushKana()).toBe("計算 です。"); });
  });

  it("clears a new question once, without a delayed clear deleting its first characters", () => {
    const { input, ref, rerender } = renderInput({ resetSignal: "first" });
    fireEvent.changeText(input(), "neko");
    rerender(<KanaInput ref={ref} testID="kana-input" resetSignal="second" />);
    expect(input().props.value).toBe("");
    fireEvent.changeText(input(), "inu");
    act(() => jest.runOnlyPendingTimers());
    expect(input().props.value).toBe("いぬ");
    act(() => {
      ref.current?.clearInput();
      expect(ref.current?.flushKana()).toBe("");
    });
    expect(input().props.value).toBe("");
  });

  it("does not erase text when conversion or keyboard settings change", () => {
    const { input, ref, rerender } = renderInput({ enableKanaConversion: false, resetSignal: 1 });
    fireEvent.changeText(input(), "猫");
    rerender(<KanaInput ref={ref} testID="kana-input" enableKanaConversion resetSignal={1} />);
    expect(input().props.value).toBe("猫");
    rerender(<KanaInput ref={ref} testID="kana-input" useJapaneseKeyboard resetSignal={1} />);
    expect(input().props.defaultValue).toBe("猫");
    fireEvent.changeText(input(), "犬");
    expect(input().props.defaultValue).toBe("猫");
    rerender(<KanaInput ref={ref} testID="kana-input" resetSignal={1} />);
    expect(input().props.value).toBe("犬");
    act(() => { expect(ref.current?.flushKana()).toBe("犬"); });
  });

  it("corrects an Android middle caret with the converted value, then releases it", () => {
    Platform.OS = "android";
    const renderedSelections: (typeof TextInput.prototype.props.selection)[] = [];
    const nativeRender = TextInput.prototype.render;
    jest.spyOn(TextInput.prototype, "render").mockImplementation(function (this: TextInput) {
      renderedSelections.push(this.props.selection);
      return nativeRender.call(this);
    });
    const { input, ref, rerender, writes } = renderInput({ initialValue: "shああああ" });
    fireEvent(input(), "selectionChange", { nativeEvent: { selection: { start: 2, end: 2 } } });
    fireEvent.changeText(input(), "shiああああ");
    expect(input().props.value).toBe("しああああ");
    expect(renderedSelections).toContainEqual({ start: 1, end: 1 });
    expect(input().props.selection).toBeUndefined();
    expect(writes).not.toHaveBeenCalled();

    renderedSelections.length = 0;
    fireEvent(input(), "selectionChange", { nativeEvent: { selection: { start: 3, end: 3 } } });
    rerender(<KanaInput ref={ref} testID="kana-input" placeholder="Changed parent prop" />);
    expect(renderedSelections.every((selection) => selection === undefined)).toBe(true);
  });

  it("does not attach an old Android cursor correction to a newer unconverted keystroke", () => {
    Platform.OS = "android";
    const renderedSelections: (typeof TextInput.prototype.props.selection)[] = [];
    const nativeRender = TextInput.prototype.render;
    jest.spyOn(TextInput.prototype, "render").mockImplementation(function (this: TextInput) {
      renderedSelections.push(this.props.selection);
      return nativeRender.call(this);
    });
    const { input } = renderInput();
    const onChangeText = input().props.onChangeText;
    act(() => {
      onChangeText("a");
      onChangeText("あk");
    });
    expect(input().props.value).toBe("あk");
    expect(renderedSelections.every((selection) => selection === undefined)).toBe(true);
  });

  it.each([
    { changes: ["a", "aa"], expectedText: "ああ" },
    { changes: ["k", "kk", "kka"], expectedText: "っか" },
  ])("keeps the Android caret after a burst of raw letters $changes before native selection arrives", ({ changes, expectedText }) => {
    Platform.OS = "android";
    const renderedSelections: (typeof TextInput.prototype.props.selection)[] = [];
    const nativeRender = TextInput.prototype.render;
    jest.spyOn(TextInput.prototype, "render").mockImplementation(function (this: TextInput) {
      renderedSelections.push(this.props.selection);
      return nativeRender.call(this);
    });
    const { input } = renderInput();
    const onChangeText = input().props.onChangeText;

    act(() => {
      for (const raw of changes) onChangeText(raw);
    });

    expect(input().props.value).toBe(expectedText);
    expect(renderedSelections).toContainEqual({ start: 2, end: 2 });
    expect(renderedSelections).not.toContainEqual({ start: 1, end: 1 });
    expect(input().props.selection).toBeUndefined();
  });

  it("honors a later Android cursor move after inferring an earlier raw edit", () => {
    Platform.OS = "android";
    const renderedSelections: (typeof TextInput.prototype.props.selection)[] = [];
    const nativeRender = TextInput.prototype.render;
    jest.spyOn(TextInput.prototype, "render").mockImplementation(function (this: TextInput) {
      renderedSelections.push(this.props.selection);
      return nativeRender.call(this);
    });
    const { input } = renderInput();
    fireEvent.changeText(input(), "kaki");
    fireEvent(input(), "selectionChange", { nativeEvent: { selection: { start: 0, end: 0 } } });
    renderedSelections.length = 0;

    fireEvent.changeText(input(), "naかき");

    expect(input().props.value).toBe("なかき");
    expect(renderedSelections).toContainEqual({ start: 1, end: 1 });
    expect(input().props.selection).toBeUndefined();
  });

  it("preserves focus, keyboard type and the Android empty-field caret setting", () => {
    Platform.OS = "android";
    const focused = jest.fn();
    const { input, ref, UNSAFE_getByType } = renderInput({
      enableKanaConversion: false,
      onFocus: focused,
      keyboardType: "ascii-capable",
    });
    expect(input().props.caretHidden).toBe(true);
    fireEvent.changeText(input(), "ground");
    expect(input().props.caretHidden).toBe(false);
    expect(input().props.keyboardType).toBe("ascii-capable");
    fireEvent(input(), "focus", { nativeEvent: {} });
    expect(focused).toHaveBeenCalledTimes(1);
    act(() => ref.current?.focus());
    expect(UNSAFE_getByType(TextInput).instance.focus).toHaveBeenCalled();
  });
});
