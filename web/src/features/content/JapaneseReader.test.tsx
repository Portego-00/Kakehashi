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

  it("keeps mapped terms in the tooltip instead of navigating away", async () => {
    render(<JapaneseReader text="学校と猫" interaction="tooltip" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped against your WaniKani library"), { timeout: 5_000 });

    expect(screen.queryByRole("link", { name: /学校, Guru II WaniKani item/ })).not.toBeInTheDocument();
    const mapped = screen.getByRole("button", { name: /学校, Guru II WaniKani item/ });
    fireEvent.click(mapped);
    expect(within(screen.getByRole("complementary")).getByText("JPDB analysis · Guru II")).toBeInTheDocument();
  });

  it("reuses one transcript-level JPDB parse while the displayed subtitle changes", async () => {
    let finishRequest: (() => void) | undefined;
    const requestGate = new Promise<void>((resolve) => { finishRequest = resolve; });
    const fetchMock = vi.fn(async () => {
      await requestGate;
      return {
        ok: true,
        json: async () => ({
          tokens: [
            { start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
            { start: 3, end: 4, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const analysisContext = { text: "学校と猫", start: 0 };
    const { rerender } = render(<JapaneseReader text="学校" analysisContext={analysisContext} interaction="tooltip" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ text: "学校と猫", apiKey: "configured-test-key" });

    rerender(<JapaneseReader text="猫" analysisContext={{ text: "学校と猫", start: 3 }} interaction="tooltip" />);
    expect((fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal).aborted).toBe(false);
    finishRequest?.();

    expect(await screen.findByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps article images between their text blocks while analyzing the document once", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [
          { start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
          { start: 4, end: 5, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <JapaneseReader
        text={"学校\n\n猫"}
        blocks={[
          { type: "text", text: "学校" },
          { type: "image", url: "https://img.web.nhk/news/example.jpg", alt: "現場" },
          { type: "text", text: "猫" },
        ]}
      />,
    );

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped against your WaniKani library"), { timeout: 5_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ text: "学校\n\n猫", apiKey: "configured-test-key" });
    expect([...container.querySelectorAll("[data-reader-block]")].map((node) => node.getAttribute("data-reader-block"))).toEqual(["text", "image", "text"]);
    expect(screen.getByRole("img", { name: "現場" })).toBeInTheDocument();
  });
});
