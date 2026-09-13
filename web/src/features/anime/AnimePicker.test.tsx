import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimePicker } from "./AnimePicker";
import { ALL_ANIME_SOURCE } from "./types";

const anime = [
  { id: "death_note", title: "Death Note", malTitle: "Death Note", imageUrl: "https://cdn.myanimelist.net/images/anime/9/9453.jpg", synopsis: "A notebook changes Light's life.", score: 8.62, episodes: 37, mediaType: "tv", malId: 1535, aniListId: 1535 },
  { id: "your_name", title: "Your Name", malTitle: "Kimi no Na wa.", imageUrl: "https://cdn.myanimelist.net/images/anime/5/87048.jpg", synopsis: "Two students mysteriously swap lives.", score: 8.83, episodes: 1, mediaType: "movie", malId: 32281, aniListId: 21519 },
];

function renderPicker(onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AnimePicker selectedSources={[ALL_ANIME_SOURCE]} onChange={onChange} /></QueryClientProvider>);
  return onChange;
}

afterEach(() => vi.restoreAllMocks());

describe("anime picker", () => {
  it("locks both page scroll containers while the modal is open", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ anime }), { status: 200 }));
    renderPicker();
    fireEvent.click(await screen.findByRole("button", { name: /Anime sources: All 2 anime/i }));
    expect(document.documentElement).toHaveStyle({ overflow: "hidden", overscrollBehavior: "none" });
    expect(document.body).toHaveStyle({ overflow: "hidden", overscrollBehavior: "none", position: "fixed", width: "100%" });

    fireEvent.click(screen.getByRole("button", { name: "Close anime picker" }));
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.documentElement.style.overscrollBehavior).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.overscrollBehavior).toBe("");
    expect(document.body.style.position).toBe("");
    expect(document.body.style.width).toBe("");
  });

  it("shows MAL artwork and metadata and applies a staged visual selection", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ anime }), { status: 200 }));
    const onChange = renderPicker();
    const trigger = await screen.findByRole("button", { name: /Anime sources: All 2 anime/i });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Choose anime" });
    expect(dialog.querySelector('[data-provider-icon="myanimelist"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-provider-icon="anilist"]')).toBeInTheDocument();
    expect(within(dialog).getByText("Death Note")).toBeInTheDocument();
    expect(within(dialog).getByText("8.62")).toBeInTheDocument();
    expect(dialog.querySelectorAll("img")).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Death Note/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply selection" }));
    expect(onChange).toHaveBeenCalledWith(["death_note"]);
  });

  it("replaces the draft with a synced watched list", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/anime/catalog")) return new Response(JSON.stringify({ anime }), { status: 200 });
      return new Response(JSON.stringify({ provider: "anilist", username: "reader", watched: 12, matchedSources: ["your_name"] }), { status: 200 });
    });
    const onChange = renderPicker();
    fireEvent.click(await screen.findByRole("button", { name: /Anime sources: All 2 anime/i }));
    const dialog = screen.getByRole("dialog", { name: "Choose anime" });
    fireEvent.change(within(dialog).getByLabelText("AniList"), { target: { value: "reader" } });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Sync watched" })[1]);
    await waitFor(() => expect(within(dialog).getByText("1 of 12 watched anime matched ImmersionKit.")).toBeInTheDocument());
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply selection" }));
    expect(onChange).toHaveBeenCalledWith(["your_name"]);
  });
});
