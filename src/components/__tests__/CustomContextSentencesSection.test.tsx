/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories are hoisted. */
import {
  act,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

import {
  getCustomContextSentencesForSubject,
  updateCustomContextSentence,
} from "../../services/customContextSentenceService";
import type { CustomContextSentence } from "../../types/customContextSentence";
import { azureTranslatorService } from "../../utils/azureTranslator";
import {
  CustomContextSentencesSection,
  type CustomContextSentencesSectionHandle,
} from "../CustomContextSentencesSection";

jest.mock("react-native-safe-area-context", () => {
  const mockReact = require("react");
  const MockView = require("react-native").View;
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      mockReact.createElement(MockView, props, children),
  };
});

jest.mock("@expo/vector-icons", () => {
  const mockReact = require("react");
  const MockText = require("react-native").Text;
  return {
    Ionicons: ({ name }: { name: string }) =>
      mockReact.createElement(MockText, null, name),
  };
});

jest.mock("../../utils/store", () => ({
  useAuthStore: (selector: (state: { userData: { id: string } }) => unknown) =>
    selector({ userData: { id: "wk-user-1" } }),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      backgroundColor: "#f6f6f6",
      cardBackground: "#ffffff",
      textColor: "#222222",
      textSecondary: "#666666",
      textLight: "#999999",
      primary: "#3a86ff",
      border: "#dddddd",
      error: "#cc3333",
      isDark: false,
    },
  }),
}));

jest.mock("../../services/customContextSentenceService", () => ({
  deleteCustomContextSentence: jest.fn(() => Promise.resolve(true)),
  getCustomContextSentencesForSubject: jest.fn(),
  updateCustomContextSentence: jest.fn(),
  upsertCustomContextSentence: jest.fn(),
}));

jest.mock("../../utils/azureTranslator", () => ({
  azureTranslatorService: {
    translate: jest.fn(),
    transliterateJapaneseToKana: jest.fn(),
  },
}));

jest.mock("../../utils/azureSpeech", () => ({
  azureSpeechService: {
    speak: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
  },
}));

const storedSentence: CustomContextSentence = {
  version: 1,
  id: "sentence-1",
  subjectId: 42,
  japanese: "世界は広いです。",
  kana: "せかいはひろいです。",
  english: "The world is wide.",
  displayMode: "kana",
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T10:00:00.000Z",
};

function renderSection(ref?: React.Ref<CustomContextSentencesSectionHandle>) {
  return render(
    <CustomContextSentencesSection
      ref={ref}
      subjectId={42}
      subjectCharacters="世界"
      subjectReadings={["せかい"]}
    />,
  );
}

describe("CustomContextSentencesSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCustomContextSentencesForSubject as jest.Mock).mockResolvedValue([]);
    (updateCustomContextSentence as jest.Mock).mockImplementation(
      async (_userId: string, _id: string, updates: object) => ({
        ...storedSentence,
        ...updates,
      }),
    );
    (
      azureTranslatorService.transliterateJapaneseToKana as jest.Mock
    ).mockImplementation(async (text: string) => text);
    (azureTranslatorService.translate as jest.Mock).mockResolvedValue("");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses and persists the display mode from a saved sentence", async () => {
    (getCustomContextSentencesForSubject as jest.Mock).mockResolvedValue([
      storedSentence,
    ]);
    const screen = renderSection();

    expect(await screen.findByText("せかいはひろいです。")).toBeTruthy();
    expect(screen.queryByText("世界は広いです。")).toBeNull();

    fireEvent.press(screen.getByLabelText("Show this sentence in kanji"));

    expect(screen.getByText("世界は広いです。")).toBeTruthy();
    await waitFor(() =>
      expect(updateCustomContextSentence).toHaveBeenCalledWith(
        "wk-user-1",
        "sentence-1",
        { displayMode: "kanji" },
      ),
    );
  });

  it("aborts and ignores an older translation when typing continues", async () => {
    jest.useFakeTimers();
    let resolveFirstTranslation: ((value: string) => void) | undefined;
    let firstSignal: AbortSignal | undefined;

    (azureTranslatorService.translate as jest.Mock).mockImplementation(
      (
        text: string,
        _from: string,
        _to: string,
        options?: { signal?: AbortSignal },
      ) => {
        if (text === "世界") {
          firstSignal = options?.signal;
          return new Promise<string>((resolve) => {
            resolveFirstTranslation = resolve;
          });
        }
        return Promise.resolve("It is the world.");
      },
    );
    (
      azureTranslatorService.transliterateJapaneseToKana as jest.Mock
    ).mockImplementation((text: string) =>
      Promise.resolve(text === "世界" ? "せかい" : "せかいです"),
    );

    const editorRef = React.createRef<CustomContextSentencesSectionHandle>();
    const screen = renderSection(editorRef);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      editorRef.current?.openNewEditor();
    });

    expect(screen.queryByLabelText("Japanese display style")).toBeNull();
    const japaneseInput = screen.getByLabelText("Japanese sentence");
    fireEvent.changeText(japaneseInput, "世界");
    await act(async () => {
      jest.advanceTimersByTime(650);
      await Promise.resolve();
    });

    fireEvent.changeText(japaneseInput, "世界です");
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(650);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("English translation").props.value).toBe(
      "It is the world.",
    );

    await act(async () => {
      resolveFirstTranslation?.("The old world.");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByLabelText("English translation").props.value).toBe(
      "It is the world.",
    );
  });
});
