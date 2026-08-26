import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { filterStudySubjects } from "../engine";
import { wordleCandidates } from "../games";
import { getModeDefaultFilters } from "../mode-config";
import { KanaWordle } from "./special-modes";

function vocabulary(id: number, characters: string, reading: string, meaning: string): Subject {
  return {
    id,
    object: "vocabulary",
    url: "",
    data_updated_at: "",
    data: {
      level: 1,
      created_at: "",
      slug: characters,
      document_url: "",
      hidden_at: null,
      characters,
      meanings: [{ meaning, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: [{ reading, primary: true, accepted_answer: true }],
    },
  };
}

function assignment(id: number, subjectId: number): Assignment {
  return {
    id,
    object: "assignment",
    url: "",
    data_updated_at: "",
    data: {
      subject_id: subjectId,
      subject_type: "vocabulary",
      srs_stage: 5,
      available_at: null,
      started_at: "2026-08-26T00:00:00.000Z",
      unlocked_at: "2026-08-26T00:00:00.000Z",
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "2026-08-26T00:00:00.000Z",
    },
  };
}

describe("Kana Wordle", () => {
  afterEach(() => window.localStorage.clear());

  it("starts a matching game immediately when the kana count changes", () => {
    const subjects = [
      vocabulary(1, "桜", "さくら", "Cherry blossom"),
      vocabulary(2, "平仮名", "ひらがな", "Hiragana"),
    ];
    const dataset = {
      subjects,
      assignments: subjects.map((subject, index) => assignment(index + 1, subject.id)),
    };
    const filters = { ...getModeDefaultFilters("kana-wordle", 60), wordLength: 3 };

    expect(wordleCandidates(filterStudySubjects(dataset, filters), 4)).toHaveLength(1);

    render(
      <KanaWordle
        dataset={dataset}
        filters={filters}
        scope="wordle-length-test"
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Guesses").firstElementChild?.children).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "4 kana" }));

    expect(screen.queryByText("No 4-kana vocabulary was found in this range.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Guesses").firstElementChild?.children).toHaveLength(4);
  });
});
