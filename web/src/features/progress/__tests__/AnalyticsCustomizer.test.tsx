import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsCustomizer } from "../components/AnalyticsCustomizer";
import { ANALYTICS_CARD_IDS, createAnalyticsPreset, type AnalyticsDashboardConfig } from "../analytics-layout";

afterEach(cleanup);

const initialConfig: AnalyticsDashboardConfig = {
  version: 2,
  cards: [{ id: "accuracy", size: "compact" }, { id: "activity", size: "wide" }],
};

describe("analytics customization", () => {
  it("applies visibility, order and width changes together without changing saved state while editing", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<AnalyticsCustomizer open config={initialConfig} onApply={onApply} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Move Accuracy later" }));
    fireEvent.click(screen.getByRole("button", { name: "Wide Accuracy" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Study activity" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Kanji coverage" }));

    expect(onApply).not.toHaveBeenCalled();
    expect(initialConfig.cards).toEqual([{ id: "accuracy", size: "compact" }, { id: "activity", size: "wide" }]);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({ version: 2, cards: [{ id: "accuracy", size: "wide" }, { id: "coverage", size: "wide" }] });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("discards changes on Cancel and starts the next draft from the saved configuration", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(<AnalyticsCustomizer open config={initialConfig} onApply={onApply} onClose={onClose} />);
    fireEvent.click(screen.getByRole("radio", { name: "Deep dive" }));
    expect(within(screen.getByRole("list", { name: "Dashboard widget order" })).getAllByRole("listitem")).toHaveLength(ANALYTICS_CARD_IDS.length);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<AnalyticsCustomizer open={false} config={initialConfig} onApply={onApply} onClose={onClose} />);
    rerender(<AnalyticsCustomizer open config={initialConfig} onApply={onApply} onClose={onClose} />);
    expect(within(screen.getByRole("list", { name: "Dashboard widget order" })).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Compact Accuracy" })).toHaveAttribute("aria-pressed", "true");
  });

  it("supports keyboard reorder with position announcements", () => {
    render(<AnalyticsCustomizer open config={initialConfig} onApply={vi.fn()} onClose={vi.fn()} />);
    const handle = screen.getByRole("button", { name: "Reorder Study activity" });
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true });
    expect(screen.getByRole("status")).toHaveTextContent("Study activity moved to position 1 of 2.");
    expect(screen.getByRole("button", { name: "Move Study activity earlier" })).toBeDisabled();
    expect(handle).toHaveFocus();
  });

  it("keeps a resized width when hiding and restoring a widget within the draft", () => {
    render(<AnalyticsCustomizer open config={initialConfig} onApply={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Wide Accuracy" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Accuracy" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Accuracy" }));
    expect(screen.getByRole("button", { name: "Wide Accuracy" })).toHaveAttribute("aria-pressed", "true");
  });

  it("requires a visible widget and restores defaults only in the draft", () => {
    const onApply = vi.fn();
    render(<AnalyticsCustomizer open config={initialConfig} onApply={onApply} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Accuracy" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Study activity" }));
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Overview" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(createAnalyticsPreset("overview"));
  });

  it("closes without saving when the native dialog is cancelled", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<AnalyticsCustomizer open config={initialConfig} onApply={onApply} onClose={onClose} />);
    fireEvent(screen.getByRole("dialog", { name: "Customize analytics" }), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });
});
