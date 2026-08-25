import "@testing-library/jest-dom/vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject, WKUser } from "@/types/wanikani";
import { JapaneseReader } from "./JapaneseReader";

const fixtures = vi.hoisted(() => {
  const user: WKUser = {
    id: 1,
    object: "user",
    url: "",
    data_updated_at: "",
    data: {
      username: "reader-test",
      level: 12,
      profile_url: "",
      started_at: "",
      current_vacation_started_at: null,
      preferences: { default_voice_actor_id: 1, lessons_autoplay_audio: false, lessons_batch_size: 5, lessons_presentation_order: "ascending_level_then_subject", reviews_autoplay_audio: false, reviews_display_srs_indicator: true },
      subscription: { active: true, type: "lifetime", max_level_granted: 60, period_ends_at: null },
    },
  };
  const subject: Subject = {
    id: 10,
    object: "vocabulary",
    url: "",
    data_updated_at: "",
    data: { level: 3, created_at: "", slug: "学校", document_url: "", hidden_at: null, characters: "学校", meanings: [{ meaning: "School", primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: [{ reading: "がっこう", primary: true, accepted_answer: true }], parts_of_speech: ["noun"] },
  };
  const assignment: Assignment = {
    id: 110,
    object: "assignment",
    url: "",
    data_updated_at: "",
    data: { subject_id: 10, subject_type: "vocabulary", srs_stage: 6, available_at: null, started_at: "", unlocked_at: "", passed_at: "", burned_at: null, resurrected_at: null, hidden: false, created_at: "" },
  };
  return { assignment, subject, user };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/features/study/use-study-dataset", () => ({
  useStudyDataset: () => ({ user: fixtures.user, dataset: { subjects: [fixtures.subject], assignments: [fixtures.assignment] }, loading: false }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({ integrations: { jpdbApiKey: "configured-test-key" } }),
}));

describe("JapaneseReader inspector", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [
          { start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school", "academy"], alternativeSpellings: ["學校"], partsOfSpeech: ["n"], tokenType: "vocabulary" },
          { start: 3, end: 4, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat", "domestic cat"], alternativeSpellings: ["ネコ"], partsOfSpeech: ["n"], tokenType: "vocabulary" },
        ],
      }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses the same hover inspector for mapped and JPDB-only tokens", async () => {
    render(<JapaneseReader text="学校と猫" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped against your WaniKani library"), { timeout: 5_000 });

    const mapped = screen.getByRole("link", { name: /学校, Guru II WaniKani item/ });
    fireEvent.mouseEnter(mapped);
    const inspector = screen.getByRole("complementary");
    expect(within(inspector).getByText("JPDB analysis · Guru II")).toBeInTheDocument();
    expect(within(inspector).getByText("academy")).toBeInTheDocument();
    expect(within(inspector).getByText("學校")).toBeInTheDocument();
    expect(within(inspector).getByText(/vocabulary · Level 3 · School/)).toBeInTheDocument();

    const jpdbOnly = screen.getByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ });
    fireEvent.mouseEnter(jpdbOnly);
    expect(within(inspector).getByText("JPDB analysis · No WaniKani match")).toBeInTheDocument();
    expect(within(inspector).getByText("domestic cat")).toBeInTheDocument();
    expect(within(inspector).getByText("ネコ")).toBeInTheDocument();
    expect(within(inspector).queryByText(/Level 3/)).not.toBeInTheDocument();
  });
});
