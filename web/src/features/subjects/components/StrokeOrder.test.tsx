import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { loadKanjiStrokeData } from "@/features/study/stroke-data";
import { StrokeOrder } from "./StrokeOrder";

vi.mock("@/features/study/stroke-data", () => ({
  loadKanjiStrokeData: vi.fn(),
}));

const TWO_STROKES = {
  strokes: ["M 100 700 L 900 700 Z", "M 100 300 L 900 300 Z"],
  medians: [
    [[100, 700], [900, 700]],
    [[100, 300], [900, 300]],
  ],
};

function renderStrokeOrder() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><StrokeOrder character="二" /></QueryClientProvider>);
}

describe("StrokeOrder", () => {
  it("traces every stroke along its median in sequence", async () => {
    vi.mocked(loadKanjiStrokeData).mockResolvedValue(TWO_STROKES);
    const { container } = renderStrokeOrder();

    await screen.findByRole("img", { name: "Animated stroke order for 二" });
    const traces = container.querySelectorAll("[data-stroke-trace]");

    expect(traces).toHaveLength(2);
    expect(traces[0]).toHaveAttribute("pathLength", "1");
    expect(traces[0]).toHaveAttribute("clip-path", expect.stringMatching(/^url\(#.+-stroke-0\)$/));
    expect(traces[1]).toHaveAttribute("clip-path", expect.stringMatching(/^url\(#.+-stroke-1\)$/));
    expect(traces[0]).toHaveAttribute("d", expect.stringMatching(/^M\s/));
    expect(traces[1]).toHaveAttribute("style", expect.stringContaining("--stroke-delay"));

    const firstTrace = traces[0];
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(container.querySelector("[data-stroke-trace]")).not.toBe(firstTrace);
  });
});
