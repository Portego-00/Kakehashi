import { render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { getKanjiEtymology } from "../../data/kanjiEtymology";
import KanjiEtymologySection from "../KanjiEtymologySection";

jest.mock("../../data/kanjiEtymology", () => ({
  getKanjiEtymology: jest.fn(),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      cardBackground: "#ffffff",
      textColor: "#333333",
      textSecondary: "#666666",
      textLight: "#999999",
      primary: "#3A86FF",
      border: "#eeeeee",
      isDark: false,
    },
  }),
}));

const mockGetKanjiEtymology =
  getKanjiEtymology as jest.MockedFunction<typeof getKanjiEtymology>;

describe("KanjiEtymologySection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not look up or render an entry when disabled", () => {
    const { queryByTestId } = render(
      <KanjiEtymologySection characters="休" visible={false} />
    );

    expect(mockGetKanjiEtymology).not.toHaveBeenCalled();
    expect(queryByTestId("kanji-etymology-section")).toBeNull();
  });

  it("does not render when the kanji has no entry", () => {
    mockGetKanjiEtymology.mockReturnValue(null);

    const { queryByTestId } = render(
      <KanjiEtymologySection characters="休" />
    );

    expect(mockGetKanjiEtymology).toHaveBeenCalledWith("休");
    expect(queryByTestId("kanji-etymology-section")).toBeNull();
  });

  it("renders the explanation, note, and source attribution", () => {
    mockGetKanjiEtymology.mockReturnValue({
      explanation:
        "A person beside a tree depicts resting, which led to the meaning “rest.”",
      note: "The modern shapes are standardized forms.",
      source: {
        title: "Example source",
        url: "https://example.com/rest",
      },
    });
    const { getByLabelText, getByText } = render(
      <KanjiEtymologySection characters="休" />
    );

    expect(
      getByText(
        "A person beside a tree depicts resting, which led to the meaning “rest.”"
      )
    ).toBeTruthy();
    expect(getByText("The modern shapes are standardized forms.")).toBeTruthy();
    expect(getByLabelText("Source: Example source")).toBeTruthy();
  });

  it("exposes the source as an accessible link", () => {
    mockGetKanjiEtymology.mockReturnValue({
      explanation: "A sourced character-formation explanation.",
      source: {
        title: "Example source",
        url: "https://example.com/pinned-source",
      },
    });
    const { getByLabelText } = render(
      <KanjiEtymologySection characters="休" />
    );

    const sourceLink = getByLabelText("Source: Example source");
    expect(sourceLink.props.accessibilityRole).toBe("link");
    expect(sourceLink.props.accessibilityHint).toBe(
      "Opens the etymology source"
    );
  });

  it("uses the existing Kanji Details section and card styling", () => {
    mockGetKanjiEtymology.mockReturnValue({
      explanation:
        "A person beside a tree depicts resting, which led to the meaning “rest.”",
      source: {
        title: "Example source",
        url: "https://example.com/rest",
      },
    });
    const { getByTestId } = render(
      <KanjiEtymologySection characters="休" presentation="details" />
    );

    expect(
      StyleSheet.flatten(getByTestId("kanji-etymology-section").props.style)
    ).toMatchObject({
      marginHorizontal: 16,
      marginTop: 16,
    });
    expect(
      StyleSheet.flatten(getByTestId("kanji-etymology-card").props.style)
    ).toMatchObject({
      borderRadius: 8,
      padding: 16,
    });
  });
});
