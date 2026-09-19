import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateAnalyticsInsights } from "../analytics-insights";
import { ShareAnalytics } from "../components/AnalyticsShare";
import { createAnalyticsShareImage, downloadAnalyticsFile } from "../analytics-export";
import { parsePublicAnalyticsSnapshot } from "../analytics-public-share";

vi.mock("../analytics-export", async (importOriginal) => ({ ...await importOriginal<typeof import("../analytics-export")>(), createAnalyticsShareImage: vi.fn(), downloadAnalyticsFile: vi.fn() }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("analytics sharing privacy", () => {
  it("immediately disables the previous image when privacy changes and ignores stale generation", async () => {
    const pending: Array<(blob: Blob) => void> = [];
    vi.mocked(createAnalyticsShareImage).mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:preview"); static revokeObjectURL = vi.fn(); });
    const insights = calculateAnalyticsInsights({ assignments: [], subjects: [], statistics: [], progressions: [] });
    render(<ShareAnalytics insights={insights} assignments={[]} subjects={[]} statistics={[]} level={1} username="Private learner" startedAt="2026-01-01" onClose={vi.fn()} />);
    const download = screen.getByRole("button", { name: "Download PNG" });
    expect(download).toBeDisabled();
    await act(async () => pending[0](new Blob(["first"])));
    expect(download).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Hide username" }));
    expect(download).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy image" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Hide days studying" }));
    await act(async () => pending[1](new Blob(["stale"])));
    expect(download).toBeDisabled();
    const privateImage = new Blob(["private"]);
    await act(async () => pending[2](privateImage));
    fireEvent.click(download);
    expect(downloadAnalyticsFile).toHaveBeenCalledWith(privateImage, "kakehashi-stats.png");
  });

  it("creates snapshot links from the current privacy settings without waiting for an image", async () => {
    vi.mocked(createAnalyticsShareImage).mockImplementation(() => new Promise(() => {}));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: { writeText } } }));
    const insights = calculateAnalyticsInsights({ assignments: [], subjects: [], statistics: [], progressions: [] });
    render(<ShareAnalytics insights={insights} assignments={[]} subjects={[]} statistics={[]} level={1} username="Private learner" startedAt="2026-01-01" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Hide username" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Hide days studying" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy snapshot link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const snapshot = parsePublicAnalyticsSnapshot(new URL(writeText.mock.calls[0][0]).hash);
    expect(snapshot).not.toBeNull();
    expect(snapshot).not.toHaveProperty("username");
    expect(snapshot).not.toHaveProperty("daysStudying");
  });

  it("keeps the complete captured input consistent while the dashboard refreshes", async () => {
    vi.mocked(createAnalyticsShareImage).mockClear().mockImplementation(() => new Promise(() => {}));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: { writeText } } }));
    const insights = calculateAnalyticsInsights({ assignments: [], subjects: [], statistics: [], progressions: [] });
    const props = { insights, assignments: [], subjects: [], statistics: [], level: 1, username: "Captured learner", startedAt: "2026-01-01", onClose: vi.fn() };
    const view = render(<ShareAnalytics {...props} />);
    view.rerender(<ShareAnalytics {...props} insights={{ ...insights }} assignments={[]} level={2} username="Updated learner" />);
    expect(createAnalyticsShareImage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Copy snapshot link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const snapshot = parsePublicAnalyticsSnapshot(new URL(writeText.mock.calls[0][0]).hash);
    expect(snapshot?.username).toBe("Captured learner");
    expect(snapshot?.level).toBe(1);
  });

  it("recovers a failed preview without changing its options", async () => {
    vi.mocked(createAnalyticsShareImage).mockRejectedValueOnce(new Error("Image failed")).mockResolvedValueOnce(new Blob(["retry"]));
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:preview"); static revokeObjectURL = vi.fn(); });
    const insights = calculateAnalyticsInsights({ assignments: [], subjects: [], statistics: [], progressions: [] });
    render(<ShareAnalytics insights={insights} assignments={[]} subjects={[]} statistics={[]} level={1} username="Learner" startedAt="2026-01-01" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Download PNG" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Zoom preview" }));
    expect(screen.getByRole("region", { name: "Image preview" })).toHaveAttribute("data-zoom", "true");
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByRole("region", { name: "Image preview" })).toHaveAttribute("data-zoom", "false");
  });
});
