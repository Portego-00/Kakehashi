import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import { StudyQueueCard } from "./StudyQueueCard";

const preferences = {
  ...DEFAULT_WEB_SETTINGS.study,
  reviewBatchSizeEnabled: true,
  reviewBatchSize: 50,
  reviewPresetsEnabled: true,
  reviewPresets: [{ id: "short", name: "Quick", batchSize: 5, reviewOrder: "ascendingSrsStage" as const }, { id: "long", name: "Longer", batchSize: 20, reviewOrder: "random" as const }],
};

describe("dashboard review presets", () => {
  it("launches the selected preset and restores the default action without changing saved preferences", () => {
    render(<StudyQueueCard type="review" available count={30} reviewPreferences={preferences} />);
    fireEvent.click(screen.getByRole("button", { name: "Quick, 5 reviews, Lower SRS first" }));
    expect(screen.getByRole("link", { name: "Start 5 reviews" })).toHaveAttribute("href", "/reviews?reviewPresetId=short");
    fireEvent.click(screen.getByRole("button", { name: "Longer, 20 reviews, Random" }));
    expect(screen.getByRole("link", { name: "Start 20 reviews" })).toHaveAttribute("href", "/reviews?reviewPresetId=long");
    fireEvent.click(screen.getByRole("button", { name: "Use default" }));
    expect(screen.getByRole("link", { name: "Start 30 reviews" })).toHaveAttribute("href", "/reviews");
    expect(preferences.reviewBatchSize).toBe(50);
    expect(preferences.reviewOrder).toBe(DEFAULT_WEB_SETTINGS.study.reviewOrder);
  });

  it("hides the choices when batching or presets are disabled and in empty queues", () => {
    const { rerender } = render(<StudyQueueCard type="review" available count={30} reviewPreferences={{ ...preferences, reviewBatchSizeEnabled: false }} />);
    expect(screen.queryByRole("group", { name: "Review session presets" })).toBeNull();
    rerender(<StudyQueueCard type="review" available count={30} reviewPreferences={{ ...preferences, reviewPresetsEnabled: false }} />);
    expect(screen.queryByRole("group", { name: "Review session presets" })).toBeNull();
    rerender(<StudyQueueCard type="review" available count={0} reviewPreferences={preferences} />);
    expect(screen.queryByRole("group", { name: "Review session presets" })).toBeNull();
  });
});
