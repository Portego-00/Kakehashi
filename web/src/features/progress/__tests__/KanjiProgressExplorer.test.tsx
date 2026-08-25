import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KanjiProgressExplorer } from "../components/KanjiProgressExplorer";

const { retry } = vi.hoisted(() => ({ retry: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../data", () => ({
  useProgressData: () => ({ subjects: [], assignments: [], isLoading: false, isError: true, retry }),
}));

describe("KanjiProgressExplorer outage handling", () => {
  it("shows an explicit error instead of a false zero state and retries in place", async () => {
    render(<KanjiProgressExplorer />);
    expect(screen.getByRole("heading", { name: "Kanji progress is unavailable" })).toBeInTheDocument();
    expect(screen.queryByText(/0 of 0 passed/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
  });
});
