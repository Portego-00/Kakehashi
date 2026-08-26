import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { LevelProgress } from "../components/LevelProgress";

const { progressData } = vi.hoisted(() => ({
  progressData: {
    assignments: [] as Assignment[],
    subjects: [] as Subject[],
    statistics: [],
    progressions: [],
    resets: [],
    isLoading: false,
    isError: false,
    retry: vi.fn(),
  },
}));

vi.mock("@/lib/session", () => ({ useSession: () => ({ user: { data: { level: 2 } } }) }));
vi.mock("../data", () => ({ useProgressData: () => progressData }));

function subject(id: number, character: string, level = 2): Subject {
  return {
    id,
    object: "kanji",
    url: "",
    data_updated_at: "2026-08-25T00:00:00Z",
    data: {
      level,
      created_at: "2026-08-01T00:00:00Z",
      slug: character,
      document_url: "",
      hidden_at: null,
      characters: character,
      meanings: [{ meaning: `Meaning ${id}`, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
    },
  };
}

function assignment(id: number, stage: number): Assignment {
  const startedAt = stage > 0 ? "2026-08-10T00:00:00Z" : null;
  const passedAt = stage >= 5 ? "2026-08-20T00:00:00Z" : null;
  return {
    id,
    object: "assignment",
    url: "",
    data_updated_at: "2026-08-25T00:00:00Z",
    data: {
      subject_id: id,
      subject_type: "kanji",
      srs_stage: stage,
      available_at: null,
      started_at: startedAt,
      unlocked_at: "2026-08-01T00:00:00Z",
      passed_at: passedAt,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "2026-08-01T00:00:00Z",
    },
  };
}

describe("level progress", () => {
  beforeEach(() => {
    progressData.subjects = [subject(1, "一"), subject(2, "二"), subject(3, "三"), subject(4, "四", 1)];
    progressData.assignments = [assignment(1, 0), assignment(2, 5), assignment(3, 2), assignment(4, 5)];
  });

  it("orders the level-up strip from completed to unstarted", () => {
    render(<LevelProgress />);

    const strip = screen.getByRole("progressbar", { name: /kanji at the passing stage/ });
    expect(Array.from(strip.children).map((segment) => segment.getAttribute("data-state"))).toEqual(["passed", "idle", "idle"]);
    expect(screen.queryByRole("progressbar", { name: /Level 2:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Level progress" })).not.toBeInTheDocument();
  });

  it("shows five gray-to-green stages until Guru, then one uninterrupted bar", () => {
    render(<LevelProgress />);

    const idle = screen.getByRole("progressbar", { name: "Meaning 1: 0 of 5 stages to Guru" });
    const active = screen.getByRole("progressbar", { name: "Meaning 3: 2 of 5 stages to Guru" });
    const guru = screen.getByRole("progressbar", { name: "Meaning 2: Guru reached" });

    expect(within(idle).getAllByRole("presentation")).toHaveLength(5);
    expect(within(idle).getAllByRole("presentation").filter((segment) => segment.hasAttribute("data-filled"))).toHaveLength(0);
    expect(within(active).getAllByRole("presentation")).toHaveLength(5);
    expect(within(active).getAllByRole("presentation").filter((segment) => segment.hasAttribute("data-filled"))).toHaveLength(2);
    expect(within(guru).getAllByRole("presentation")).toHaveLength(1);
    expect(within(guru).getByRole("presentation")).toHaveAttribute("data-complete", "true");
  });

  it("summarizes previous levels with concentric progress rings", () => {
    render(<LevelProgress />);

    const rings = screen.getByRole("img", { name: "Level 1 progress by subject type" });
    expect(rings.querySelectorAll("circle")).toHaveLength(6);
    expect(rings.querySelectorAll("circle[data-type]")).toHaveLength(3);
    expect(rings.querySelector('circle[data-type="kanji"]')).toHaveStyle("--ring-progress: 100");
    expect(rings.parentElement?.querySelector("span")).toBeNull();
    expect(screen.getByText("Level 1")).toBeInTheDocument();
    const recap = screen.getByRole("link", { name: "Open level 1 recap" });
    expect(recap).toHaveTextContent("Kanji1/1");
    expect(within(recap).getByText("100%")).toBeInTheDocument();
  });
});
