import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CustomVocabularyWord } from "./types";
import { CustomSrsReviewResults, type CustomReviewOutcome } from "./CustomSrsReviewResults";

const kanaWord: CustomVocabularyWord = {
  id: "kana-cat",
  characters: "ねこ",
  reading: "ねこ",
  meanings: ["Cat", "Kitty"],
  partsOfSpeech: ["noun"],
  meaningMnemonic: "A cat curls up by your neck.",
  contextSentences: [{ ja: "ねこが寝ています。", en: "The cat is sleeping." }],
};

const kanjiWord: CustomVocabularyWord = {
  id: "level-8-footsteps",
  characters: "足音",
  reading: "あしおと",
  meanings: ["Footsteps", "Sound of footsteps"],
  partsOfSpeech: ["noun"],
  meaningMnemonic: "You hear the sound of feet before anyone reaches the door.",
  readingMnemonic: "Join foot and sound.",
  contextSentences: [{ ja: "廊下から足音が聞こえた。", en: "I heard footsteps from the hallway." }],
  requiredLevel: 8,
  kanjiLevels: { "足": 4, "音": 8 },
};

const outcomes: Record<string, CustomReviewOutcome> = {
  [kanaWord.id]: {
    startingStage: 8,
    endingStage: 9,
    nextReviewAt: null,
  },
  [kanjiWord.id]: {
    startingStage: 4,
    endingStage: 3,
    nextReviewAt: "2026-09-07T12:00:00.000Z",
  },
};

describe("CustomSrsReviewResults", () => {
  it("shows mobile-style accuracy details and filters the reviewed words by mistakes", () => {
    render(<CustomSrsReviewResults
      words={[kanaWord, kanjiWord]}
      outcomesByWord={outcomes}
      mistakesByQuestion={{
        [kanaWord.id]: { meaning: 0 },
        [kanjiWord.id]: { meaning: 1, reading: 2 },
      }}
      startedAt={new Date("2026-09-06T10:00:00.000Z")}
      completedAt={new Date("2026-09-06T10:02:00.000Z")}
    />);

    expect(screen.getByRole("heading", { name: "Custom reviews complete" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "50% overall accuracy" })).toBeInTheDocument();

    const summary = screen.getByLabelText("Review summary");
    expect(within(summary).getByText("Items completed").nextElementSibling).toHaveTextContent("2");
    expect(within(summary).getByText("Meaning accuracy").nextElementSibling).toHaveTextContent("50%");
    expect(within(summary).getByText("Reading accuracy").nextElementSibling).toHaveTextContent("0%");
    expect(within(summary).getByText("Incorrect attempts").nextElementSibling).toHaveTextContent("3");
    expect(within(summary).getByText("Time studied").nextElementSibling).toHaveTextContent("2 min");

    expect(screen.getByRole("tab", { name: "Mistakes (1)" })).toHaveAttribute("aria-selected", "true");
    const mistakenResult = screen.getByRole("article", { name: "足音 review result" });
    expect(mistakenResult).toHaveTextContent("Meaning1 mistake");
    expect(mistakenResult).toHaveTextContent("Reading2 mistakes");
    expect(mistakenResult).toHaveTextContent("Apprentice IV");
    expect(mistakenResult).toHaveTextContent("Apprentice III");
    expect(within(mistakenResult).getByRole("link", { name: "View 足音 details" })).toHaveAttribute("href", "/custom-vocabulary/words/level-8-footsteps");
    expect(screen.queryByRole("article", { name: "ねこ review result" })).not.toBeInTheDocument();

    const mistakesTab = screen.getByRole("tab", { name: "Mistakes (1)" });
    mistakesTab.focus();
    fireEvent.keyDown(mistakesTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "All items (2)" })).toHaveFocus();
    const perfectResult = screen.getByRole("article", { name: "ねこ review result" });
    expect(perfectResult).toHaveTextContent("MeaningCorrect");
    expect(perfectResult).toHaveTextContent("Enlightened");
    expect(perfectResult).toHaveTextContent("Burned");
    expect(perfectResult).toHaveTextContent("No more reviews");
    expect(within(perfectResult).getByRole("link", { name: "Open ねこ subject details" })).toHaveAttribute("href", "/custom-vocabulary/words/kana-cat");
  });

  it("uses all reviewed words as the useful default and reports N/A when no reading was tested", () => {
    render(<CustomSrsReviewResults
      words={[kanaWord]}
      outcomesByWord={{ [kanaWord.id]: outcomes[kanaWord.id] }}
      mistakesByQuestion={{}}
      startedAt={new Date("2026-09-06T10:00:00.000Z")}
      completedAt={new Date("2026-09-06T10:00:01.000Z")}
    />);

    expect(screen.getByRole("tab", { name: "All items (1)" })).toHaveAttribute("aria-selected", "true");
    const summary = screen.getByLabelText("Review summary");
    expect(within(summary).getByText("Reading accuracy").nextElementSibling).toHaveTextContent("N/A");
    expect(screen.getByRole("article", { name: "ねこ review result" })).toBeInTheDocument();
  });

  it("does not call a rounded 100% session perfect when it still contains a mistake", () => {
    const words = Array.from({ length: 200 }, (_, index) => ({ ...kanaWord, id: `kana-${index}`, characters: `ねこ${index}` }));
    const manyOutcomes = Object.fromEntries(words.map((word) => [word.id, outcomes[kanaWord.id]]));
    render(<CustomSrsReviewResults
      words={words}
      outcomesByWord={manyOutcomes}
      mistakesByQuestion={{ [words[0].id]: { meaning: 1 } }}
      startedAt={new Date("2026-09-06T10:00:00.000Z")}
      completedAt={new Date("2026-09-06T10:05:00.000Z")}
    />);

    expect(screen.getByRole("img", { name: "100% overall accuracy" })).toBeInTheDocument();
    expect(screen.getByText(/1 word needs another look/)).toBeInTheDocument();
    expect(screen.queryByText(/Every reviewed word was answered without a mistake/)).not.toBeInTheDocument();
  });
});
