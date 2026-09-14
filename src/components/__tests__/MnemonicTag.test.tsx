import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Platform, StyleSheet, Text, View } from "react-native";
import { MnemonicTag } from "../MnemonicTag";

const badgeStyle = { backgroundColor: "#f09", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginHorizontal: 2 };
const labelStyle = { fontSize: 14, fontWeight: "bold" as const, color: "white" };
const line = { x: 0, y: 0, width: 45, height: 18, ascender: 14, descender: 4, text: "seven", capHeight: 10, xHeight: 7 };

afterEach(() => jest.restoreAllMocks());

it("aligns an Android attachment to the measured glyph baseline while retaining its full rounded badge", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const screen = render(<MnemonicTag style={badgeStyle} textStyle={labelStyle}>seven</MnemonicTag>);
  fireEvent(screen.getByText("seven"), "textLayout", { nativeEvent: { lines: [line] } });
  const [attachment, badge] = screen.UNSAFE_getAllByType(View);
  expect(StyleSheet.flatten(attachment.props.style)).toMatchObject({ height: 16, marginHorizontal: 2, overflow: "visible" });
  expect(StyleSheet.flatten(badge.props.style)).toMatchObject({ height: 22, borderRadius: 4, backgroundColor: "#f09", overflow: "visible" });
  expect(StyleSheet.flatten(attachment.props.style).transform).toBeUndefined();
});

it("flows a label that wraps through native text spans instead of a tall inline attachment", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const screen = render(<MnemonicTag style={badgeStyle} textStyle={labelStyle}>seven things</MnemonicTag>);
  fireEvent(screen.getByText("seven things"), "textLayout", { nativeEvent: { lines: [
    { ...line, height: 27, ascender: 21, descender: 6, text: "seven" },
    { ...line, y: 27, height: 27, ascender: 21, descender: 6, text: "things" },
  ] } });
  expect(screen.UNSAFE_queryAllByType(View)).toHaveLength(0);
  expect(StyleSheet.flatten(screen.getByText("seven things").props.style)).toMatchObject({
    backgroundColor: "#f09", color: "white", fontSize: 14,
  });
  expect(StyleSheet.flatten(screen.getByText("seven things").props.style).height).toBeUndefined();
});

it("keeps the measured baseline when only label color changes", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const screen = render(<MnemonicTag style={badgeStyle} textStyle={labelStyle}>seven</MnemonicTag>);
  fireEvent(screen.getByText("seven"), "textLayout", { nativeEvent: { lines: [line] } });
  screen.rerender(<MnemonicTag style={badgeStyle} textStyle={{ ...labelStyle, color: "black" }}>seven</MnemonicTag>);
  expect(StyleSheet.flatten(screen.UNSAFE_getAllByType(View)[0].props.style).height).toBe(16);
});

it("leaves the iOS View and Text styles and natural sizing unchanged", () => {
  jest.replaceProperty(Platform, "OS", "ios");
  const screen = render(<MnemonicTag style={badgeStyle} textStyle={labelStyle}>seven</MnemonicTag>);
  expect(screen.UNSAFE_getAllByType(View)).toHaveLength(1);
  expect(screen.UNSAFE_getByType(View).props.style).toBe(badgeStyle);
  expect(screen.UNSAFE_getByType(Text).props.style).toBe(labelStyle);
  expect(screen.UNSAFE_getByType(Text).props.onTextLayout).toBeUndefined();
});


it("removes Android font padding before measuring a Japanese label", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const screen = render(<MnemonicTag style={badgeStyle} textStyle={{ ...labelStyle, fontFamily: "SourceHanSansJP-Bold", includeFontPadding: true }}>七つ</MnemonicTag>);
  expect(StyleSheet.flatten(screen.getByText("七つ").props.style).includeFontPadding).toBe(false);
});

it("remeasures a wrapped label after its typography changes", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const screen = render(<MnemonicTag style={badgeStyle} textStyle={labelStyle}>seven things</MnemonicTag>);
  fireEvent(screen.getByText("seven things"), "textLayout", { nativeEvent: { lines: [line, { ...line, y: 18 }] } });
  expect(screen.UNSAFE_queryAllByType(View)).toHaveLength(0);
  screen.rerender(<MnemonicTag style={badgeStyle} textStyle={{ ...labelStyle, fontSize: 12 }}>seven things</MnemonicTag>);
  fireEvent(screen.getByText("seven things"), "textLayout", { nativeEvent: { lines: [{ ...line, ascender: 12, height: 15 }] } });
  expect(screen.UNSAFE_getAllByType(View)).toHaveLength(2);
  expect(StyleSheet.flatten(screen.UNSAFE_getAllByType(View)[0].props.style).height).toBe(14);
});
