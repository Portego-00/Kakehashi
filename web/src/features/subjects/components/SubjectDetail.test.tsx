import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyMaterial } from "@/types/wanikani";
import { StudyMaterialEditor, SubjectStickyHeader } from "./SubjectDetail";

const { wkRequestMock } = vi.hoisted(() => ({ wkRequestMock: vi.fn() }));

vi.mock("@/lib/wanikani/client", () => ({
  wkCollection: vi.fn(),
  wkRequest: wkRequestMock,
}));

const material: StudyMaterial = {
  id: 42,
  object: "study_material",
  url: "https://api.wanikani.com/v2/study_materials/42",
  data_updated_at: "2026-08-25T10:00:00.000Z",
  data: {
    subject_id: 7,
    subject_type: "vocabulary",
    meaning_synonyms: ["daily"],
    meaning_note: "Keep this compact.",
    reading_note: "Remember the long vowel.",
    hidden: false,
    created_at: "2026-08-25T09:00:00.000Z",
  },
};

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><StudyMaterialEditor subjectId={7} material={material} queryKey={["study-material", 7]} loading={false} /></QueryClientProvider>);
}

describe("subject detail notes", () => {
  beforeEach(() => wkRequestMock.mockReset());

  it("shows compact read-only notes by default", () => {
    renderEditor();

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText("daily")).toBeInTheDocument();
    expect(screen.getByText("Keep this compact.")).toBeInTheDocument();
    expect(screen.getByText("Remember the long vowel.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Meaning note" })).not.toBeInTheDocument();
    expect(screen.queryByText("Notes and synonyms sync back to WaniKani.")).not.toBeInTheDocument();
  });

  it("turns comma-separated synonyms into removable chips and saves the normalized list", async () => {
    const saved: StudyMaterial = {
      ...material,
      data: {
        ...material.data,
        meaning_synonyms: ["daily", "speedy", "quick"],
        meaning_note: "Updated meaning note.",
      },
    };
    wkRequestMock.mockResolvedValue(saved);
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const synonymInput = screen.getByRole("textbox", { name: "Meaning synonyms" });
    fireEvent.change(synonymInput, { target: { value: "speedy," } });
    expect(screen.getByRole("button", { name: "Remove synonym speedy" })).toBeInTheDocument();
    expect(synonymInput).toHaveValue("");

    fireEvent.change(synonymInput, { target: { value: "quick" } });
    fireEvent.keyDown(synonymInput, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Remove synonym quick" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Meaning note" }), { target: { value: "Updated meaning note." } });
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));

    await waitFor(() => expect(wkRequestMock).toHaveBeenCalledWith("study_materials/42", {
      method: "PUT",
      body: {
        study_material: {
          meaning_note: "Updated meaning note.",
          reading_note: "Remember the long vowel.",
          meaning_synonyms: ["daily", "speedy", "quick"],
        },
      },
    }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Meaning synonyms" })).not.toBeInTheDocument();
  });
});

describe("subject detail sticky header", () => {
  it("reveals after the subject hero clears the navigation and returns to the hero", async () => {
    const hero = document.createElement("header");
    let heroBottom = 120;
    hero.getBoundingClientRect = () => ({ bottom: heroBottom, height: 320, left: 0, right: 1200, top: heroBottom - 320, width: 1200, x: 0, y: heroBottom - 320, toJSON: () => ({}) });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));

    const { container } = render(<SubjectStickyHeader heroRef={{ current: hero }} characters="一" characterCount={1} meaning="One" reading="いち" level={1} />);
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Back to One"]');
    const stickyHeader = button?.parentElement;

    expect(stickyHeader).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveAttribute("tabindex", "-1");

    heroBottom = -1;
    fireEvent.scroll(window);
    await waitFor(() => expect(stickyHeader).toHaveAttribute("data-visible", "true"));
    expect(stickyHeader).toHaveAttribute("aria-hidden", "false");
    expect(button).toHaveAttribute("tabindex", "0");

    fireEvent.click(button!);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
