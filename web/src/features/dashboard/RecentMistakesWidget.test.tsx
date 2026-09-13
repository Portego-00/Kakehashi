import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createListRepository } from "@/features/subjects/lists";
import type { Subject } from "@/types/wanikani";
import type { DashboardSubjectRow } from "./dashboard-data";
import { RecentMistakesWidget } from "./RecentMistakesWidget";

const NOW = new Date("2026-08-25T12:00:00Z");

function mistake(id: number, characters: string, date: string, type: DashboardSubjectRow["type"] = "kanji"): DashboardSubjectRow {
  const subject = {
    id,
    object: type,
    data: {
      characters,
      level: 4,
      slug: `subject-${id}`,
      meanings: [{ meaning: `Meaning ${id}`, primary: true, accepted_answer: true }],
    },
  } as Subject;
  return { id, characters, meaning: `Meaning ${id}`, type, level: 4, value: 72, date, subject };
}

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("RecentMistakesWidget", () => {
  it("defaults to the mobile 24-hour view and filters the horizontal rail by period", () => {
    const items = [
      mistake(1, "一", "2026-08-25T11:30:00Z"),
      mistake(2, "二", "2026-08-25T09:00:00Z"),
      mistake(3, "三", "2026-08-23T12:00:00Z"),
      mistake(4, "四", "2026-08-17T12:00:00Z"),
    ];
    const { container } = render(<RecentMistakesWidget items={items} now={NOW} />);

    expect(screen.getByRole("button", { name: "24h" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Past 24 hours.")).toBeInTheDocument();
    expect(container.querySelector('[class*="recentMistakesRail"]')).toHaveAttribute("data-item-count", "2");
    expect(screen.getByRole("link", { name: /Extra Study/ })).toHaveAttribute("href", "/study/custom-review?subjectIds=1,2&start=1");
    expect(screen.getByRole("link", { name: /Redo Lessons/ })).toHaveAttribute("href", "/study/custom-lessons?subjectIds=1,2&start=1");

    fireEvent.click(screen.getByRole("button", { name: "1h" }));
    expect(screen.getByText("Past hour.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "一, Meaning 1" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "二, Meaning 2" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(screen.getByText("Past week.")).toBeInTheDocument();
    expect(container.querySelector('[class*="recentMistakesRail"]')).toHaveAttribute("data-item-count", "3");
  });

  it("keeps the actions visible but disabled when the selected period is clear", () => {
    render(<RecentMistakesWidget items={[mistake(3, "三", "2026-08-23T12:00:00Z")]} now={NOW} />);

    expect(screen.getByText("No mistakes in the past 24 hours")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extra Study" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo Lessons" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add to Subject List" })).toBeDisabled();
  });

  it("keeps the widget visible when the seven-day mistake batch is empty", () => {
    render(<RecentMistakesWidget items={[]} now={NOW} />);

    expect(screen.getByRole("heading", { name: "Recent Mistakes" })).toBeInTheDocument();
    expect(screen.getByText("No mistakes in the past 24 hours")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extra Study" })).toBeDisabled();
  });

  it("adds the current filtered batch to an existing subject list", async () => {
    const username = "tester";
    const repository = createListRepository(window.localStorage, username, () => NOW, () => "trouble");
    repository.create("Trouble items");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => init?.method === "PUT" ? {} : { lists: repository.load() },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RecentMistakesWidget items={[
      mistake(1, "一", "2026-08-25T11:30:00Z"),
      mistake(2, "二", "2026-08-25T09:00:00Z"),
    ]} username={username} now={NOW} />);

    fireEvent.click(screen.getByRole("button", { name: /Add to Subject List/ }));
    const dialog = await screen.findByRole("dialog", { name: "Add to Lists" });
    fireEvent.click(within(dialog).getByText("Trouble items"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add All" }));

    await waitFor(() => expect(repository.load()[0].subjectIds).toEqual([1, 2]));
    expect(screen.queryByRole("dialog", { name: "Add to Lists" })).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/subjects/lists", expect.objectContaining({ method: "PUT" })));
  });
});
