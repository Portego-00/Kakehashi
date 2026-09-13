import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomSrsProgressionToast, type CustomSrsProgression } from "./CustomSrsProgressionToast";

const apprentice: CustomSrsProgression = { startingStage: 0, endingStage: 1, nextReviewInterval: "4h" };

function DismissibleToast({ onDismiss }: { onDismiss: () => void }) {
  const [progression, setProgression] = useState<CustomSrsProgression | null>(apprentice);
  const dismiss = useCallback(() => {
    setProgression(null);
    onDismiss();
  }, [onDismiss]);
  return <CustomSrsProgressionToast progression={progression} mode="normal" onDismiss={dismiss} />;
}

describe("CustomSrsProgressionToast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("portals the notice outside the study layout without stealing answer focus", () => {
    const { container, rerender } = render(<><input aria-label="Your answer" /><CustomSrsProgressionToast progression={null} mode="normal" onDismiss={vi.fn()} /></>);
    const answer = screen.getByRole("textbox", { name: "Your answer" });
    answer.focus();
    rerender(<><input aria-label="Your answer" /><CustomSrsProgressionToast progression={apprentice} mode="normal" onDismiss={vi.fn()} /></>);

    const notice = screen.getByRole("status", { name: "SRS progression" });
    expect(container).not.toContainElement(notice);
    expect(notice.parentElement).toBe(document.body);
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(notice).toHaveAttribute("aria-atomic", "true");
    expect(answer).toHaveFocus();
    expect(notice).toHaveTextContent("Lesson → Apprentice I");
    expect(notice).toHaveTextContent("Next review in 4h");
    expect(notice.querySelector("use")).toHaveAttribute("href", "/srs/srs-icons.svg#apprentice-1");
  });

  it("dismisses manually and cancels its pending auto-dismissal", () => {
    const onDismiss = vi.fn();
    render(<DismissibleToast onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss SRS progression" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses automatically after three seconds", () => {
    const onDismiss = vi.fn();
    render(<DismissibleToast onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(2_999));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("gives each new progression a fresh three-second display even at the same stage", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<CustomSrsProgressionToast progression={apprentice} mode="normal" onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(2_000));
    rerender(<CustomSrsProgressionToast progression={{ ...apprentice }} mode="normal" onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(2_999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not display or schedule dismissal for hidden mode or an empty progression", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<CustomSrsProgressionToast progression={apprentice} mode="hidden" onDismiss={onDismiss} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_000));
    rerender(<CustomSrsProgressionToast progression={null} mode="normal" onDismiss={onDismiss} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_000));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("keeps compact mode concise without removing the next review or dismiss action", () => {
    render(<CustomSrsProgressionToast progression={apprentice} mode="compact" onDismiss={vi.fn()} />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveAttribute("data-mode", "compact");
    expect(notice).toHaveTextContent("Apprentice I");
    expect(notice).not.toHaveTextContent("Lesson");
    expect(notice).toHaveTextContent("Next review in 4h");
    expect(screen.getByRole("button", { name: "Dismiss SRS progression" })).toBeInTheDocument();
  });

  it("does not promise another review for burned words", () => {
    render(<CustomSrsProgressionToast progression={{ startingStage: 8, endingStage: 9, nextReviewInterval: "Burned" }} mode="normal" onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Enlightened → Burned");
    expect(screen.getByRole("status")).toHaveTextContent("No more reviews");
    expect(screen.getByRole("status")).not.toHaveTextContent("Next review");
  });

  it("cancels dismissal when the notification unmounts", () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<CustomSrsProgressionToast progression={apprentice} mode="normal" onDismiss={onDismiss} />);
    unmount();
    act(() => vi.advanceTimersByTime(3_000));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("keeps the portal fixed outside document flow and honors reduced motion", () => {
    const css = readFileSync("src/features/custom-srs/CustomSrsProgressionToast.module.css", "utf8");
    expect(css).toMatch(/\.toast\s*\{[^}]*position:\s*fixed;/);
    expect(css).toContain("var(--color-surface)");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.toast\s*\{\s*animation:\s*none;/);
  });
});
