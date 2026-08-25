import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getModeDefaultFilters } from "../mode-config";
import { StudyConfig } from "./study-config";

function renderConfig(component: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}

describe("native-parity study configuration", () => {
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
});
