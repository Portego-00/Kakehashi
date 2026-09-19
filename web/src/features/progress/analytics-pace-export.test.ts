import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaceChartImage, type PaceChartImageOptions } from "./analytics-pace-export";

const options: PaceChartImageOptions = {
  levels: [{ level: 3, days: 8, excluded: false }, { level: 4, days: 40, excluded: true }],
  currentLevel: 5, goalLevel: 30, projectedDate: "2027-03-01T12:00:00.000Z", paceDays: 8.5, medianDays: 8,
  clipAt: 16, origin: "started", capturedAt: new Date("2026-09-10T12:00:00.000Z"),
};

afterEach(() => vi.restoreAllMocks());

describe("pace chart PNG export", () => {
  it("draws the selected settings, clipped bars and exclusions into a PNG", async () => {
    const context = { fillRect: vi.fn(), fillText: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const blob = new Blob(["png"], { type: "image/png" });
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(blob));
    expect(await createPaceChartImage(options)).toBe(blob);
    expect(encode).toHaveBeenCalledWith(expect.any(Function), "image/png");
    const labels = context.fillText.mock.calls.map(([label]) => label);
    expect(labels).toEqual(expect.arrayContaining(["Kakehashi", "Level pace", "8.5 days", "Excluded from pace", "Duration from first lesson", "Bars capped at 16 days", "L3", "L4"]));
    expect(context.fillRect).toHaveBeenCalledWith(expect.any(Number), 362, expect.any(Number), 334);
    expect(context.fillRect).toHaveBeenCalledWith(expect.any(Number), 529, expect.any(Number), 167);
  });

  it("rejects missing history and unavailable canvas support", async () => {
    await expect(createPaceChartImage({ ...options, levels: [] })).rejects.toThrow("Complete a level");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(createPaceChartImage(options)).rejects.toThrow("unavailable");
  });
});
