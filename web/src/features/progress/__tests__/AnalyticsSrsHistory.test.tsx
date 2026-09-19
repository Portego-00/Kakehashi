import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SrsHistoryWidget } from "../components/AnalyticsSrsHistory";

vi.mock("motion/react", () => ({ useReducedMotion: () => true }));
vi.mock("../analytics-snapshots", () => ({
  MAX_SRS_BACKUP_BYTES: 512_000,
  useSrsSnapshots: () => ({
    persistence: "device",
    snapshots: ["2026-08-01", "2026-09-01", "2026-09-02", "2026-09-05"].map((date) => ({ date, stages: { Locked: 50, Apprentice: 10, Guru: 20, Master: 30, Enlightened: 40, Burned: 50 } })),
    importBackup: vi.fn(),
    exportBackup: vi.fn(),
  }),
}));

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-11T12:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("recorded SRS chart", () => {
  it("preserves calendar spacing with missing values instead of bridging unrecorded days", () => {
    const { container } = render(<SrsHistoryWidget accountKey="test" assignments={[]} />);
    fireEvent.click(screen.getByText("Chart data"));
    const table = screen.getByRole("table", { name: "Recorded SRS stages data" });
    expect(within(table).getAllByRole("rowheader")).toHaveLength(5);
    const missing = within(table).getByRole("row", { name: /2026-09-03: no snapshot recorded/ });
    expect(within(missing).getAllByRole("cell", { name: "Not recorded" })).toHaveLength(5);
    expect(container.querySelectorAll(".recharts-area-dot")).toHaveLength(15);
    const path = container.querySelector(".recharts-area-curve")?.getAttribute("d");
    expect(path?.match(/M/g)).toHaveLength(2);
    fireEvent.click(within(missing).getByRole("button"));
    expect(screen.getByText("No snapshot recorded for Sep 3, 2026.")).toBeVisible();
    expect(screen.queryByText("Apprentice", { selector: "dt" })).not.toBeInTheDocument();
  });

  it("resets an older selection when narrowing the history range", () => {
    render(<SrsHistoryWidget accountKey="test" assignments={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    fireEvent.click(screen.getByText("Chart data"));
    const table = screen.getByRole("table", { name: "Recorded SRS stages data" });
    fireEvent.click(within(within(table).getByRole("row", { name: /2026-08-01$/ })).getByRole("button"));
    expect(screen.getByText("Aug 1, 2026")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "30 days" }));
    expect(screen.getByText("Sep 5, 2026")).toBeVisible();
    expect(screen.queryByText(/No snapshot recorded for/)).not.toBeInTheDocument();
    expect(screen.getByText("Apprentice", { selector: "dt" })).toBeVisible();
  });
});
