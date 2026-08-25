import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Assignment, ReviewStatistic, Subject } from "@/types/wanikani";
import { SubjectTile } from "./SubjectTile";

const vocabulary = {
  id: 42,
  object: "vocabulary",
  data: {
    level: 16,
    slug: "世界史",
    characters: "世界史",
    meanings: [{ meaning: "World History", primary: true }],
    readings: [
      { reading: "せかいし", primary: true },
      { reading: "せかいじ", primary: false },
      { reading: "せかいれきし", primary: false },
    ],
  },
} as Subject;

const assignment = {
  data: { subject_id: vocabulary.id, srs_stage: 6 },
} as Assignment;

const statistic = {
  data: { subject_id: vocabulary.id, percentage_correct: 88 },
} as ReviewStatistic;

describe("SubjectTile", () => {
  it("shows level and SRS stage without a subject-type chip", () => {
    render(<SubjectTile subject={vocabulary} assignment={assignment} />);

    expect(screen.getByText("Level 16")).toBeDefined();
    expect(screen.getByText("Guru II")).toBeDefined();
    expect(screen.queryByText("Vocabulary")).toBeNull();
  });

  it("shows accuracy beside the SRS stage and mobile-style reading chips below the meaning", () => {
    render(<SubjectTile subject={vocabulary} assignment={assignment} statistic={statistic} />);

    expect(screen.getByText("88% accuracy").parentElement).toBe(screen.getByText("Guru II").parentElement);
    expect(screen.getByText("せかいし")).toHaveAttribute("data-primary", "true");
    expect(screen.getByText("せかいじ")).not.toHaveAttribute("data-primary");
    expect(screen.getByText("+1")).toHaveAccessibleName("1 more reading");
  });
});
