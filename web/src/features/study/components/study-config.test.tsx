import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import { getModeDefaultFilters } from "../mode-config";
import type { StudyFilters, SubjectList } from "../types";
import { StudyConfig } from "./study-config";

function renderConfig(component: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}

function imageRadical(): Subject {
  return {
    id: 876,
    object: "radical",
    url: "https://api.wanikani.com/v2/subjects/876",
    data_updated_at: "2026-08-26T00:00:00.000Z",
    data: {
      level: 4,
      created_at: "2026-08-26T00:00:00.000Z",
      slug: "rib-cage",
      document_url: "https://www.wanikani.com/radicals/rib-cage",
      hidden_at: null,
      characters: null,
      character_images: [
        { url: "https://files.wanikani.com/rib-cage-256.png", content_type: "image/png", metadata: { dimensions: "256x256" } },
        { url: "https://files.wanikani.com/rib-cage.svg", content_type: "image/svg+xml" },
      ],
      meanings: [{ meaning: "Rib Cage", primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
    },
  };
}

function reviewSubject(id: number, object: SubjectType, characters: string, meaning: string, reading: string, level = 1): Subject {
  return {
    id,
    object,
    url: `https://api.wanikani.com/v2/subjects/${id}`,
    data_updated_at: "2026-08-27T00:00:00.000Z",
    data: {
      level,
      created_at: "2026-08-27T00:00:00.000Z",
      slug: characters,
      document_url: "",
      hidden_at: null,
      characters,
      meanings: [{ meaning, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: reading ? [{ reading, primary: true, accepted_answer: true }] : [],
    },
  };
}

function reviewAssignment(subjectId: number, subjectType: SubjectType, srsStage: number): Assignment {
  return {
    id: 1000 + subjectId,
    object: "assignment",
    url: `https://api.wanikani.com/v2/assignments/${1000 + subjectId}`,
    data_updated_at: "2026-08-27T00:00:00.000Z",
    data: {
      subject_id: subjectId,
      subject_type: subjectType,
      srs_stage: srsStage,
      available_at: null,
      started_at: "2026-08-27T00:00:00.000Z",
      unlocked_at: "2026-08-27T00:00:00.000Z",
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "2026-08-27T00:00:00.000Z",
    },
  };
}

function ReviewHarness({ initialFilters, subjects, assignments, lists = [], onStart }: { initialFilters: StudyFilters; subjects: Subject[]; assignments: Assignment[]; lists?: SubjectList[]; onStart: () => void }) {
  const [filters, setFilters] = useState(initialFilters);
  return <StudyConfig mode="custom-review" filters={filters} subjects={subjects} assignments={assignments} lists={lists} userLevel={5} onChange={setFilters} onStart={onStart} />;
}

function LessonHarness({ initialFilters, subjects, assignments, lists = [], onStart }: { initialFilters: StudyFilters; subjects: Subject[]; assignments: Assignment[]; lists?: SubjectList[]; onStart: () => void }) {
  const [filters, setFilters] = useState(initialFilters);
  return <StudyConfig mode="custom-lessons" filters={filters} subjects={subjects} assignments={assignments} lists={lists} userLevel={5} onChange={setFilters} onStart={onStart} />;
}

afterEach(() => vi.restoreAllMocks());

describe("native-parity study configuration", () => {
  it("offers original word recordings or context sentence speech for audio vocabulary", () => {
    const onChange = vi.fn();
    renderConfig(<StudyConfig mode="audio-vocab" filters={getModeDefaultFilters("audio-vocab", 5)} subjects={[]} lists={[]} userLevel={5} onChange={onChange} onStart={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Words" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Context sentences" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Context sentences" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ audioVocabSource: "sentence" }));
  });
  it("uses a subject-first custom review picker with reading search and a direct start action", () => {
    const cat = reviewSubject(1, "vocabulary", "猫", "Cat", "ねこ", 2);
    const end = reviewSubject(2, "kanji", "末", "End", "まつ", 3);
    const onStart = vi.fn();
    renderConfig(
      <ReviewHarness
        initialFilters={getModeDefaultFilters("custom-review", 5)}
        subjects={[cat, end]}
        assignments={[reviewAssignment(1, "vocabulary", 2), reviewAssignment(2, "kanji", 5)]}
        onStart={onStart}
      />,
    );

    expect(screen.queryByText("Session setup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start review" })).toBeDisabled();
    const search = screen.getByRole("textbox", { name: "Search subjects" });
    fireEvent.change(search, { target: { value: "neko" } });
    expect(screen.getByText("1 matching subject")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose 猫, Cat, Vocabulary, level 2, Apprentice II/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Choose End/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Choose 猫, Cat/i }));
    expect(screen.getByRole("button", { name: "Start review" })).toBeEnabled();
    expect(screen.getByText("1", { selector: "p strong" })).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Enter", code: "Enter" });
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("keeps filters disclosed and consolidates saved-list and bulk selection", async () => {
    const subjects = [
      reviewSubject(1, "vocabulary", "猫", "Cat", "ねこ", 2),
      reviewSubject(2, "kanji", "末", "End", "まつ", 3),
      reviewSubject(3, "kanji", "犬", "Dog", "いぬ", 4),
    ];
    renderConfig(
      <ReviewHarness
        initialFilters={getModeDefaultFilters("custom-review", 5)}
        subjects={subjects}
        assignments={[
          reviewAssignment(1, "vocabulary", 2),
          reviewAssignment(2, "kanji", 5),
          reviewAssignment(3, "kanji", 7),
        ]}
        lists={[{ id: "trouble", name: "Trouble items", subjectIds: [1, 2], createdAt: "", updatedAt: "" }]}
        onStart={vi.fn()}
      />,
    );

    expect(screen.queryByRole("group", { name: "Subject filters" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("region", { name: "Subject filters" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trouble items 2" }));
    expect(screen.getByText("2", { selector: "p strong" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Choose 犬, Dog/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trouble items 2" }));
    expect(screen.getByText("2", { selector: "p strong" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Choose 犬, Dog/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trouble items 2" }));
    expect(screen.queryByRole("button", { name: /Choose 犬, Dog/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Deselect filtered" }));
    expect(screen.getByRole("button", { name: "Start review" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Select filtered" }));
    expect(screen.getByRole("button", { name: "Start review" })).toBeEnabled();
    const resetFilters = screen.getByRole("button", { name: "Reset filters" });
    resetFilters.focus();
    fireEvent.click(resetFilters);
    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
    expect(screen.getByText("2", { selector: "p strong" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Choose 犬, Dog/i })).toBeInTheDocument();
  });

  it("uses the subject-first workbench for custom lessons with reading search and a direct start action", () => {
    const cat = reviewSubject(1, "vocabulary", "猫", "Cat", "ねこ", 2);
    const end = reviewSubject(2, "kanji", "末", "End", "まつ", 3);
    const futureLevel = reviewSubject(3, "kanji", "龍", "Dragon", "りゅう", 40);
    const onStart = vi.fn();
    renderConfig(
      <LessonHarness
        initialFilters={getModeDefaultFilters("custom-lessons", 5)}
        subjects={[cat, end, futureLevel]}
        assignments={[reviewAssignment(1, "vocabulary", 2), reviewAssignment(2, "kanji", 5)]}
        onStart={onStart}
      />,
    );

    expect(screen.queryByText("Session setup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start lessons" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Choose 龍, Dragon, Kanji, level 40, Locked/i })).toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "Search subjects" });
    fireEvent.change(search, { target: { value: "neko" } });
    expect(screen.getByText("1 matching subject")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose 猫, Cat, Vocabulary, level 2, Apprentice II/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Choose End/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Choose 猫, Cat/i }));
    expect(screen.getByRole("button", { name: "Start lessons" })).toBeEnabled();
    fireEvent.keyDown(search, { key: "Enter", code: "Enter" });
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start lessons" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("does not count stale or hidden subject ids as runnable lesson selections", () => {
    const hidden = reviewSubject(1, "kanji", "秘", "Secret", "ひ", 3);
    hidden.data.hidden_at = "2026-08-27T00:00:00.000Z";
    renderConfig(
      <LessonHarness
        initialFilters={{ ...getModeDefaultFilters("custom-lessons", 5), selectedSubjectIds: [1, 999] }}
        subjects={[hidden]}
        assignments={[]}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByText("0", { selector: "p strong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start lessons" })).toBeDisabled();
  });

  it("uses lesson lists as non-destructive catalog filters", async () => {
    const subjects = [
      reviewSubject(1, "vocabulary", "猫", "Cat", "ねこ", 2),
      reviewSubject(2, "kanji", "末", "End", "まつ", 3),
      reviewSubject(3, "kanji", "犬", "Dog", "いぬ", 4),
    ];
    renderConfig(
      <LessonHarness
        initialFilters={{ ...getModeDefaultFilters("custom-lessons", 5), selectedSubjectIds: [3] }}
        subjects={subjects}
        assignments={[
          reviewAssignment(1, "vocabulary", 2),
          reviewAssignment(2, "kanji", 5),
          reviewAssignment(3, "kanji", 7),
        ]}
        lists={[{ id: "trouble", name: "Trouble items", subjectIds: [1, 2], createdAt: "", updatedAt: "" }]}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Start lessons" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Trouble items 2" }));
    expect(screen.getByText("1", { selector: "p strong" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Choose 犬, Dog/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(await screen.findByRole("button", { name: /Choose 犬, Dog/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1", { selector: "p strong" })).toBeInTheDocument();
  });

  it("renders 200 lesson rows while bulk-selecting every match", () => {
    const subjects = Array.from({ length: 201 }, (_, index) => reviewSubject(index + 1, "kanji", `字${index + 1}`, `Item ${index + 1}`, "じ", 1));
    renderConfig(
      <LessonHarness
        initialFilters={getModeDefaultFilters("custom-lessons", 5)}
        subjects={subjects}
        assignments={[]}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: /^Choose / })).toHaveLength(200);
    expect(screen.getByText("Showing the first 200 matches. Bulk selection still includes all 201.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("201", { selector: "p strong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start lessons" })).toBeEnabled();
  });

  it("uses WaniKani artwork tinted with the radical color in the subject picker", () => {
    const { container } = renderConfig(<StudyConfig mode="custom-lessons" filters={getModeDefaultFilters("custom-lessons", 60)} subjects={[imageRadical()]} lists={[]} onChange={vi.fn()} onStart={vi.fn()} />);

    const artwork = screen.getByRole("img", { name: "Rib Cage radical" });
    const tintFilter = container.querySelector("filter[data-subject-image-tint]");
    expect(artwork).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
    expect(tintFilter?.querySelector("feFlood")).toHaveAttribute("flood-color", "currentColor");
    expect(artwork.style.filter).toMatch(/^url\("#[^"]+"\)$/);
    expect(screen.queryByText("◈")).not.toBeInTheDocument();
  });

  it("shows all mobile stroke-strictness levels and maps the legacy default to Lenient", () => {
    renderConfig(<StudyConfig mode="kanji-writing" filters={{ ...getModeDefaultFilters("kanji-writing", 60), strokeLeniency: 1.5 }} subjects={[]} lists={[]} onChange={vi.fn()} onStart={vi.fn()} />);

    const strictness = screen.getByRole("group", { name: "Stroke strictness" });
    expect(within(strictness).getByRole("button", { name: "Very Strict" })).toBeInTheDocument();
    expect(within(strictness).getByRole("button", { name: "Strict" })).toBeInTheDocument();
    expect(within(strictness).getByRole("button", { name: "Lenient" })).toHaveAttribute("aria-pressed", "true");
    expect(within(strictness).getByRole("button", { name: "Very Lenient" })).toBeInTheDocument();
  });

  it("updates writing correction to the selected mobile strictness", () => {
    const filters = { ...getModeDefaultFilters("kanji-writing", 60), strokeLeniency: 1.5 };
    const onChange = vi.fn();
    renderConfig(<StudyConfig mode="kanji-writing" filters={filters} subjects={[]} lists={[]} onChange={onChange} onStart={vi.fn()} />);

    fireEvent.click(within(screen.getByRole("group", { name: "Stroke strictness" })).getByRole("button", { name: "Strict" }));

    expect(onChange).toHaveBeenCalledWith({ ...filters, strokeLeniency: 1.2 });
  });

  it("shows crossword presets and never exposes the generic 100-item slider", () => {
    const onChange = vi.fn();
    renderConfig(<StudyConfig mode="crossword" filters={getModeDefaultFilters("crossword", 60)} subjects={[]} lists={[]} onChange={onChange} onStart={vi.fn()} />);

    expect(screen.queryByText("Session length")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Crossword size" })).toBeInTheDocument();
    expect(screen.getByText("9×9")).toBeInTheDocument();
    expect(screen.getByText("13×13")).toBeInTheDocument();
    expect(screen.getByText("17×17")).toBeInTheDocument();
    expect(screen.getByText("Number of words: 10")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Large 17×17/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ crosswordSize: "large", crosswordMaxWords: 16 }));
  });

  it("configures both word-search directions with a compact word count", () => {
    const filters = getModeDefaultFilters("word-search", 60);
    const onChange = vi.fn();
    renderConfig(<StudyConfig mode="word-search" filters={filters} subjects={[]} lists={[]} onChange={onChange} onStart={vi.fn()} />);

    expect(screen.getByLabelText("Session length")).toHaveAttribute("max", "15");
    expect(screen.getByText("10", { selector: "output strong" })).toBeInTheDocument();
    expect(screen.getByText("words", { selector: "output span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kanji clues → kana grid" })).toHaveAttribute("data-active", "true");
    fireEvent.click(screen.getByRole("button", { name: "Kana clues → kanji grid" }));
    expect(onChange).toHaveBeenCalledWith({ ...filters, wordSearchDirection: "kana-to-kanji" });
    expect(screen.getByRole("button", { name: "Build puzzle" })).toBeInTheDocument();
  });

  it("matches the native listening and context controls", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { rerender } = render(<QueryClientProvider client={client}><StudyConfig mode="listening" filters={{ ...getModeDefaultFilters("listening", 60), animeSources: ["death_note"] }} subjects={[]} lists={[]} onChange={vi.fn()} onStart={vi.fn()} /></QueryClientProvider>);

    expect(screen.getByRole("button", { name: /Anime sources: 1 selected/i })).toBeInTheDocument();
    expect(screen.getByText("Auto-play audio")).toBeInTheDocument();
    expect(screen.queryByText("WaniKani pronunciation")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Session length")).toHaveAttribute("max", "20");

    rerender(<QueryClientProvider client={client}><StudyConfig mode="context-sentences" filters={getModeDefaultFilters("context-sentences", 60)} subjects={[]} lists={[]} onChange={vi.fn()} onStart={vi.fn()} /></QueryClientProvider>);
    expect(screen.getByText("Sentence audio (TTS)")).toBeInTheDocument();
    expect(screen.getByText("Hide translation until tap")).toBeInTheDocument();
    expect(screen.getByText("JPDB-style sentence breakdown")).toBeInTheDocument();
    expect(screen.getByText("Stop after answer")).toBeInTheDocument();
  });

  it("does not nest forms when the anime picker is open", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ anime: [] }), { status: 200 }));
    const onStart = vi.fn();
    renderConfig(<StudyConfig mode="listening" filters={getModeDefaultFilters("listening", 60)} subjects={[]} lists={[]} onChange={vi.fn()} onStart={onStart} />);

    fireEvent.click(await screen.findByRole("button", { name: /Anime sources:/i }));
    const dialog = await screen.findByRole("dialog", { name: "Choose anime" });
    expect(document.querySelector("form form")).not.toBeInTheDocument();

    fireEvent.submit(dialog.querySelector('form[data-provider="myanimelist"]')!);
    expect(onStart).not.toHaveBeenCalled();
  });
});
