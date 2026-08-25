import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewActivityHeatmap, type ReviewActivityDay } from "./ReviewActivityHeatmap";

function activityDays(): ReviewActivityDay[] {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(2026, 7, 12 + index);
    return {
      date,
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      count: index === 12 ? 3 : 0,
    };
  });
}

describe("ReviewActivityHeatmap", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders fixed daily cells with useful accessible labels", () => {
    render(<ReviewActivityHeatmap days={activityDays()} />);

    const calendar = screen.getByRole("group", { name: "Review activity over the past year" });
    expect(calendar).toBeInTheDocument();
    expect(within(calendar).getAllByRole("button")).toHaveLength(14);
    expect(screen.getByRole("button", { name: /3 activity signals on Monday, August 24, 2026/ })).toHaveAttribute("data-level", "4");
  });

  it("switches from the rolling year to a previous calendar year", () => {
    const days = [
      { date: new Date(2025, 11, 30), key: "2025-12-30", count: 2 },
      { date: new Date(2025, 11, 31), key: "2025-12-31", count: 0 },
      { date: new Date(2026, 0, 1), key: "2026-01-01", count: 1 },
      { date: new Date(2026, 0, 2), key: "2026-01-02", count: 0 },
    ];
    render(<ReviewActivityHeatmap days={days} />);

    expect(screen.getByRole("button", { name: "2026, past 12 months" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "2025" }));

    const calendar = screen.getByRole("group", { name: "Review activity in 2025" });
    expect(within(calendar).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /2 activity signals on Tuesday, December 30, 2025/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /January 1, 2026/ })).not.toBeInTheDocument();
  });

  it("shows day details after the hover delay and immediately on focus", () => {
    vi.useFakeTimers();
    render(<ReviewActivityHeatmap days={activityDays()} />);
    const activeDay = screen.getByRole("button", { name: /3 activity signals/ });

    fireEvent.pointerEnter(activeDay, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByRole("tooltip")).toHaveTextContent("3 activity signals");

    fireEvent.pointerLeave(activeDay);
    act(() => vi.advanceTimersByTime(120));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(activeDay);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Monday, August 24, 2026");
  });

  it("supports arrow-key movement across weeks", () => {
    render(<ReviewActivityHeatmap days={activityDays()} />);
    const buttons = within(screen.getByRole("group", { name: "Review activity over the past year" })).getAllByRole("button");
    buttons[6].focus();

    fireEvent.keyDown(buttons[6], { key: "ArrowRight" });

    expect(buttons[13]).toHaveFocus();
  });
});
