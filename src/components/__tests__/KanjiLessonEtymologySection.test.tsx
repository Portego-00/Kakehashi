import { render, screen } from "@testing-library/react-native";
import React from "react";

import KanjiLessonEtymologySection from "../KanjiLessonEtymologySection";

jest.mock("../KanjiEtymologySection", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text, View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    default: ({
      characters,
      visible,
    }: {
      characters: string | null | undefined;
      visible: boolean;
    }) => (
      <View testID="lesson-etymology">
        <Text>{characters}</Text>
        <Text>{visible ? "visible" : "hidden"}</Text>
      </View>
    ),
  };
});

describe("KanjiLessonEtymologySection", () => {
  it.each([
    [false, "hidden"],
    [true, "visible"],
  ])(
    "passes the kanji characters and visible=%s to the shared section",
    (visible, visibilityLabel) => {
      render(
        <KanjiLessonEtymologySection
          subject={{ object: "kanji", data: { characters: "休" } }}
          visible={visible}
        />
      );

      expect(screen.getByTestId("lesson-etymology")).toBeTruthy();
      expect(screen.getByText("休")).toBeTruthy();
      expect(screen.getByText(visibilityLabel)).toBeTruthy();
    }
  );

  it.each(["vocabulary", "kana_vocabulary", "radical"])(
    "does not render for %s lessons",
    (object) => {
      render(
        <KanjiLessonEtymologySection
          subject={{ object, data: { characters: "一" } }}
          visible
        />
      );

      expect(screen.queryByTestId("lesson-etymology")).toBeNull();
    }
  );
});
