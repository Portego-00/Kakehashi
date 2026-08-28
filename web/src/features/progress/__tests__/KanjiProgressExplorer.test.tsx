import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { KanjiProgressExplorer } from "../components/KanjiProgressExplorer";

const { progressData, retry } = vi.hoisted(() => ({
  progressData: { subjects: [] as Subject[], assignments: [] as Assignment[], isLoading: false, isError: true },
  retry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../data", () => ({
  useProgressData: () => ({ ...progressData, retry }),
}));

const resource = <T,>(id: number, object: string, data: T) => ({ id, object, url: "", data_updated_at: "2026-08-25T12:00:00Z", data });
const subject = (id: number, characters: string) => resource(id, "kanji", {
  level: 10,
  created_at: "2026-08-25T12:00:00Z",
  slug: characters,
  document_url: "",
  hidden_at: null,
  characters,
  meanings: [{ meaning: characters, primary: true, accepted_answer: true }],
  auxiliary_meanings: [],
}) as Subject;
const assignment = (id: number, subjectId: number, srsStage: number) => resource(id, "assignment", {
  subject_id: subjectId,
  subject_type: "kanji",
  srs_stage: srsStage,
  available_at: null,
  started_at: null,
  unlocked_at: null,
  passed_at: null,
  burned_at: null,
  resurrected_at: null,
  hidden: false,
  created_at: "2026-08-25T12:00:00Z",
}) as Assignment;

describe("KanjiProgressExplorer", () => {
  beforeEach(() => {
    progressData.subjects = [];
    progressData.assignments = [];
    progressData.isLoading = false;
    progressData.isError = true;
    retry.mockClear();
  });

  it("shows an explicit error instead of a false zero state and retries in place", async () => {
    render(<KanjiProgressExplorer />);
    expect(screen.getByRole("heading", { name: "Kanji progress is unavailable" })).toBeInTheDocument();
    expect(screen.queryByText(/0 of 0 passed/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
  });

  it("orders kanji from the highest SRS stage to not started and shows the matching color legend", () => {
    progressData.isError = false;
    progressData.subjects = [subject(1, "未"), subject(2, "弟"), subject(3, "焼"), subject(4, "悟"), subject(5, "兄")];
    progressData.assignments = [
      assignment(11, 2, 5),
      assignment(12, 3, 9),
      assignment(13, 4, 8),
      assignment(14, 5, 6),
    ];

    render(<KanjiProgressExplorer />);

    const cells = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[data-srs]"));
    expect(cells.map((cell) => cell.querySelector("span")?.textContent)).toEqual(["焼", "悟", "兄", "弟", "未"]);
    expect(cells.map((cell) => cell.dataset.srs)).toEqual(["burned", "enlightened", "guru", "guru", "locked"]);

    const legend = screen.getByRole("list", { name: "Kanji SRS color legend" });
    expect(within(legend).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Burned",
      "Enlightened",
      "Master",
      "Guru",
      "Apprentice",
      "Not started",
    ]);
    expect(Array.from(legend.querySelectorAll("i")).map((swatch) => swatch.dataset.srs)).toEqual([
      "burned",
      "enlightened",
      "master",
      "guru",
      "apprentice",
      "locked",
    ]);
  });
});
