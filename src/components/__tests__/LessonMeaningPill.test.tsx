import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import LessonMeaningPill from "../LessonMeaningPill";

describe("LessonMeaningPill", () => {
  it("keeps long, scaled meanings inside a content-sized pill", () => {
    const meaning =
      "A deliberately long kanji definition that needs more than one line";
    const { getByTestId, getByText } = render(
      <LessonMeaningPill meaning={meaning} />
    );

    const pill = getByTestId("lesson-meaning-pill");
    const text = getByTestId("lesson-meaning-pill-text");
    const pillStyle = StyleSheet.flatten(pill.props.style);
    const textStyle = StyleSheet.flatten(text.props.style);

    expect(getByText(meaning)).toBeTruthy();
    expect(text.props.allowFontScaling).toBe(false);
    expect(text.props.numberOfLines).toBeUndefined();
    expect(pillStyle).toEqual(
      expect.objectContaining({
        alignSelf: "center",
        maxWidth: "100%",
        minWidth: 0,
      })
    );
    expect(pillStyle.height).toBeUndefined();
    expect(pillStyle.maxHeight).toBeUndefined();
    expect(pillStyle.overflow).not.toBe("hidden");
    expect(textStyle.maxWidth).toBe("100%");
    expect(textStyle.minWidth).toBe(0);
  });
});
