import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment, LevelProgression, ReviewStatistic, Subject, SubjectType } from "@/types/wanikani";
import { LevelWrapped } from "../components/LevelWrapped";

const { progressData } = vi.hoisted(() => ({
  progressData: {
    assignments: [] as Assignment[],
    subjects: [] as Subject[],
    statistics: [] as ReviewStatistic[],
    progressions: [] as LevelProgression[],
    resets: [],
    isLoading: false,
    isError: false,
    retry: vi.fn(),
  },
}));

vi.mock("../data", () => ({ useProgressData: () => progressData }));

function subject(id: number, object: SubjectType, characters: string | null, meaning: string, position: number): Subject {
  return {
    id,
    object,
    url: "",
    data_updated_at: "2026-08-25T00:00:00Z",
    data: {
      level: 5,
      lesson_position: position,
      created_at: "2026-08-01T00:00:00Z",
      slug: meaning.toLowerCase(),
      document_url: "",
      hidden_at: null,
      characters,
      meanings: [{ meaning, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: object === "radical" ? undefined : [{ reading: `よみ${id}`, primary: true, accepted_answer: true }],
    },
  };
}

function assignment(subjectId: number, subjectType: SubjectType, stage: number): Assignment {
  return {
    id: subjectId,
    object: "assignment",
    url: "",
    data_updated_at: "2026-08-25T00:00:00Z",
    data: {
      subject_id: subjectId,
      subject_type: subjectType,
      srs_stage: stage,
      available_at: null,
      started_at: stage ? "2026-08-10T00:00:00Z" : null,
      unlocked_at: "2026-08-01T00:00:00Z",
      passed_at: stage >= 5 ? "2026-08-20T00:00:00Z" : null,
      burned_at: stage >= 9 ? "2026-08-25T00:00:00Z" : null,
      resurrected_at: null,
      hidden: false,
      created_at: "2026-08-01T00:00:00Z",
    },
  };
}

function statistic(subjectId: number, percentage: number, correct: number, incorrect: number): ReviewStatistic {
  return {
    id: subjectId,
    object: "review_statistic",
    url: "",
    data_updated_at: "2026-08-25T00:00:00Z",
    data: {
      subject_id: subjectId,
      subject_type: "kanji",
      meaning_correct: correct,
      meaning_incorrect: incorrect,
      meaning_max_streak: 0,
      meaning_current_streak: 0,
      reading_correct: 0,
      reading_incorrect: 0,
      reading_max_streak: 0,
      reading_current_streak: 0,
      percentage_correct: percentage,
      hidden: false,
      created_at: "2026-08-01T00:00:00Z",
    },
  };
}

describe("level recap", () => {
  beforeEach(() => {
    progressData.subjects = [
      subject(101, "radical", null, "Ground", 1),
      subject(102, "radical", null, "Line", 2),
      subject(201, "kanji", "一", "One", 1),
      subject(202, "kanji", "二", "Two", 2),
      subject(301, "vocabulary", "一つ", "One Thing", 1),
      subject(302, "kana_vocabulary", "こんにちは", "Hello", 2),
    ];
    progressData.assignments = [
      assignment(101, "radical", 4),
      assignment(102, "radical", 1),
      assignment(201, "kanji", 5),
      assignment(202, "kanji", 2),
      assignment(301, "vocabulary", 9),
      assignment(302, "kana_vocabulary", 3),
    ];
    progressData.statistics = [statistic(201, 95, 19, 1), statistic(202, 70, 7, 3)];
    progressData.progressions = [{
      id: 5,
      object: "level_progression",
      url: "",
      data_updated_at: "2026-08-25T00:00:00Z",
      data: {
        level: 5,
        abandoned_at: null,
        completed_at: null,
        created_at: "2026-08-01T00:00:00Z",
        unlocked_at: "2026-08-01T00:00:00Z",
        started_at: "2026-08-01T00:00:00Z",
        passed_at: "2026-08-06T00:00:00Z",
      },
    }];
  });

  it("keeps the recap statistics and shows a truthful SRS distribution", () => {
    render(<LevelWrapped level={5} />);

    expect(screen.getByRole("heading", { level: 1, name: "Level 5" })).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText("5 days")).toBeInTheDocument();
    expect(screen.getByText("86.7%")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Accuracy range" })).not.toBeInTheDocument();
    const summary = screen.getByLabelText("Level 5 summary");
    const stats = summary.querySelector("dl");
    expect(within(stats as HTMLElement).getByText("Burned").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByRole("img", { name: "Lesson 0, Apprentice 4, Guru 1, Master 0, Enlightened 0, Burned 1" })).toBeInTheDocument();
  });

  it("separates subjects by type and orders every group by ascending SRS stage", () => {
    render(<LevelWrapped level={5} />);

    const groups = ["radical", "kanji", "vocabulary"].map((type) => document.querySelector(`[data-level-subject-type="${type}"]`));
    expect(groups.every(Boolean)).toBe(true);
    expect(groups.map((group) => group?.querySelector("h3")?.textContent)).toEqual(["Radicals", "Kanji", "Vocabulary"]);
    expect(within(groups[0] as HTMLElement).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/subjects/102", "/subjects/101"]);
    expect(within(groups[1] as HTMLElement).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/subjects/202", "/subjects/201"]);
    expect(within(groups[2] as HTMLElement).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/subjects/302", "/subjects/301"]);

    const meter = screen.getByRole("progressbar", { name: "Hello: 3 of 5 stages to Guru" });
    expect(within(meter).getAllByRole("presentation").filter((segment) => segment.hasAttribute("data-filled"))).toHaveLength(3);
    expect(screen.getByText("Apprentice I")).toBeInTheDocument();
    expect(screen.getByText("Burned", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("こんにちは")).toHaveAttribute("data-character-count", "5");
  });

  it("uses WaniKani artwork for image-only radicals in the level inventory", () => {
    progressData.subjects[0].data.character_images = [
      { url: "https://files.wanikani.com/ground-256.png", content_type: "image/png", metadata: { dimensions: "256x256" } },
      { url: "https://files.wanikani.com/ground.svg", content_type: "image/svg+xml" },
    ];

    render(<LevelWrapped level={5} />);

    expect(screen.getByRole("img", { name: "Ground radical" })).toHaveAttribute("src", "https://files.wanikani.com/ground.svg");
    expect(screen.queryByText("Gr")).not.toBeInTheDocument();
  });
});
