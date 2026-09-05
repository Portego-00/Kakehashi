import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Pressable, Text } from "react-native";

import { NoteFieldContainer } from "../note-field-container";

describe("NoteFieldContainer", () => {
  it("leaves populated note content passive while preserving its child actions", () => {
    const onAdd = jest.fn();
    const onEdit = jest.fn();
    const onLinkPress = jest.fn();
    const screen = render(
      <NoteFieldContainer
        addAccessibilityLabel="Add meaning note"
        hasContent
        onAdd={onAdd}
      >
        <Text>Remember this subject</Text>
        <Pressable
          accessibilityLabel="Linked subject"
          accessibilityRole="link"
          onPress={onLinkPress}
        >
          <Text>橋</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Edit meaning note"
          accessibilityRole="button"
          onPress={onEdit}
        >
          <Text>Edit</Text>
        </Pressable>
      </NoteFieldContainer>,
    );

    expect(
      screen.queryByRole("button", { name: "Add meaning note" }),
    ).toBeNull();

    fireEvent.press(screen.getByRole("link", { name: "Linked subject" }));
    fireEvent.press(screen.getByRole("button", { name: "Edit meaning note" }));

    expect(onLinkPress).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("keeps an empty note field as one accessible add button", () => {
    const onAdd = jest.fn();
    const screen = render(
      <NoteFieldContainer
        addAccessibilityLabel="Add reading note"
        hasContent={false}
        onAdd={onAdd}
      >
        <Text>Tap to add reading note</Text>
      </NoteFieldContainer>,
    );

    fireEvent.press(screen.getByRole("button", { name: "Add reading note" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
