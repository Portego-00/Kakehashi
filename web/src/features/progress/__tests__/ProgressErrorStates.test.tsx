import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsOverview } from "../components/AnalyticsOverview";
import { LevelProgress } from "../components/LevelProgress";
import { LevelWrapped } from "../components/LevelWrapped";

const { retry, progressState } = vi.hoisted(() => ({ retry: vi.fn<() => Promise<void>>(), progressState: { isLoading: false, isError: true } }));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { level: 2 } } }),
}));

vi.mock("../data", () => ({
  useProgressData: () => ({
    subjects: [],
    assignments: [],
    statistics: [],
    progressions: [],
    resets: [],
    isLoading: progressState.isLoading,
    isError: progressState.isError,
    retry,
  }),
}));

describe("progress outage recovery", () => {
  beforeEach(() => { retry.mockReset(); progressState.isLoading = false; progressState.isError = true; });

  it.each([
    ["level progress", () => render(<LevelProgress />)],
    ["analytics", () => render(<AnalyticsOverview />)],
    ["level recap", () => render(<LevelWrapped level={1} />)],
  ])("renders an aria-busy loading state for %s", (_name, renderView) => {
    progressState.isLoading = true;
    progressState.isError = false;
    renderView();

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it.each([
    ["level progress", () => render(<LevelProgress />), "Progress is unavailable"],
    ["analytics", () => render(<AnalyticsOverview />), "Analytics are unavailable"],
    ["level recap", () => render(<LevelWrapped level={1} />), "Level recap is unavailable"],
  ])("retries %s in place with a loading-aware action", async (_name, renderView, heading) => {
    let finishRetry = () => {};
    retry.mockImplementation(() => new Promise<void>((resolve) => { finishRetry = resolve; }));

    renderView();
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(button);

    expect(retry).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    finishRetry();
    await waitFor(() => expect(button).toBeEnabled());
  });
});
