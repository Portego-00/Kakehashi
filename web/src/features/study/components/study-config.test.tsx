import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getModeDefaultFilters } from "../mode-config";
import { StudyConfig } from "./study-config";

function renderConfig(component: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe("native-parity study configuration", () => {
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
