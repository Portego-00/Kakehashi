import React from "react";
import { render } from "@testing-library/react-native";
import { Platform, StyleSheet, Text, View } from "react-native";
import { MnemonicTag } from "../MnemonicTag";

const badgeStyle = { backgroundColor: "#f09", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginHorizontal: 2 };
const labelStyle = { fontSize: 14, fontWeight: "bold" as const, color: "white" };
afterEach(() => jest.restoreAllMocks());

it("keeps highlighted and surrounding Android text in a single native paragraph", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const screen = render(<Text><MnemonicTag style={badgeStyle} textStyle={labelStyle}>Kuzey</MnemonicTag>{" radikali, kanji olarak da "}<MnemonicTag style={badgeStyle} textStyle={labelStyle}>Kuzey</MnemonicTag>{"."}</Text>);
  expect(screen.getByText("Kuzey radikali, kanji olarak da Kuzey.")).toBeTruthy();
  expect(screen.UNSAFE_queryAllByType(View)).toHaveLength(0);
});

it("allows long labels and paragraph breaks without fixed heights or measurement callbacks", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const value = "a long highlighted term\nwith another line";
  const screen = render(<MnemonicTag style={badgeStyle} textStyle={labelStyle}>{value}</MnemonicTag>);
  const text = screen.UNSAFE_getByType(Text);
  expect(text.props.children).toBe(value);
  expect(StyleSheet.flatten(text.props.style)).toMatchObject({ backgroundColor: "#f09", color: "white", fontSize: 14 });
  expect(StyleSheet.flatten(text.props.style).height).toBeUndefined();
  expect(text.props.onTextLayout).toBeUndefined();
  expect(text.props.numberOfLines).toBeUndefined();
  expect(screen.UNSAFE_queryAllByType(View)).toHaveLength(0);
  screen.rerender(<MnemonicTag style={badgeStyle} textStyle={{ ...labelStyle, fontSize: 24, color: "black" }}>{value}</MnemonicTag>);
  expect(StyleSheet.flatten(screen.UNSAFE_getByType(Text).props.style)).toMatchObject({ fontSize: 24, color: "black", backgroundColor: "#f09" });
  expect(screen.UNSAFE_queryAllByType(View)).toHaveLength(0);
});

it("leaves iOS rounded badge sizing and styles unchanged", () => {
  jest.replaceProperty(Platform, "OS", "ios");
  const screen = render(<MnemonicTag style={badgeStyle} textStyle={labelStyle}>north</MnemonicTag>);
  expect(screen.UNSAFE_getByType(View).props.style).toBe(badgeStyle);
  expect(screen.UNSAFE_getByType(Text).props.style).toBe(labelStyle);
});
