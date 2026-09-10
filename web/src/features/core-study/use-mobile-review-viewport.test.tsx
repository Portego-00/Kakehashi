import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMobileReviewViewport } from "./use-mobile-review-viewport";

function Review({ active = true, mounted = true }: { active?: boolean; mounted?: boolean }) {
  const ref = useMobileReviewViewport<HTMLDivElement>(active);
  return mounted ? <div ref={ref} data-testid="review"><input aria-label="Answer" /></div> : null;
}

describe("phone review visual viewport", () => {
  let viewport: EventTarget & { height: number; offsetTop: number; scale: number };
  let phone: EventTarget & { matches: boolean };

  beforeEach(() => {
    viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
    phone = Object.assign(new EventTarget(), { matches: true });
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", 844);
    vi.stubGlobal("matchMedia", () => phone);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  function showKeyboard(offsetTop = 0) {
    act(() => {
      screen.getByRole("textbox").focus();
      viewport.height = 390;
      viewport.offsetTop = offsetTop;
      viewport.dispatchEvent(new Event("resize"));
    });
  }

  it("uses the visible height and follows Safari viewport panning while answering", () => {
    render(<Review />);
    const review = screen.getByTestId("review");
    expect(review).not.toHaveAttribute("data-mobile-review-keyboard");
    showKeyboard();
    expect(review).toHaveAttribute("data-mobile-review-keyboard", "true");
    expect(review.style.getPropertyValue("--review-viewport-height")).toBe("390px");
    act(() => { viewport.offsetTop = 80; viewport.dispatchEvent(new Event("scroll")); });
    expect(review.style.getPropertyValue("--review-viewport-top")).toBe("80px");
    expect(screen.getByRole("textbox")).toHaveFocus();
    act(() => { viewport.height = 844; viewport.dispatchEvent(new Event("resize")); });
    expect(review).not.toHaveAttribute("data-mobile-review-keyboard");
    expect(review.style.cssText).toBe("");
  });

  it("leaves desktop sizing and focus alone even when the visible viewport shrinks", () => {
    phone.matches = false;
    render(<Review />);
    showKeyboard();
    expect(screen.getByTestId("review")).not.toHaveAttribute("data-mobile-review-keyboard");
    expect(screen.getByTestId("review")).not.toHaveAttribute("style");
  });

  it("attaches after loading finishes even if the review phase was already active", () => {
    const { rerender } = render(<Review mounted={false} />);
    rerender(<Review />);
    showKeyboard();
    expect(screen.getByTestId("review")).toHaveAttribute("data-mobile-review-keyboard", "true");
  });

  it("allows normal pinch zoom instead of treating it as an open keyboard", () => {
    render(<Review />);
    viewport.scale = 2;
    showKeyboard();
    expect(screen.getByTestId("review")).not.toHaveAttribute("data-mobile-review-keyboard");
  });

  it("does not apply the keyboard layout to browser chrome changes or unfocused reviews", () => {
    render(<Review />);
    act(() => { viewport.height = 770; viewport.dispatchEvent(new Event("resize")); });
    expect(screen.getByTestId("review")).not.toHaveAttribute("data-mobile-review-keyboard");
    act(() => { viewport.height = 390; viewport.dispatchEvent(new Event("resize")); });
    expect(screen.getByTestId("review")).not.toHaveAttribute("data-mobile-review-keyboard");
  });

  it("cleans up the keyboard layout and listeners when the review ends", () => {
    const { rerender } = render(<Review />);
    showKeyboard();
    const review = screen.getByTestId("review");
    rerender(<Review active={false} />);
    expect(review).not.toHaveAttribute("data-mobile-review-keyboard");
    act(() => { viewport.dispatchEvent(new Event("resize")); });
    expect(review).not.toHaveAttribute("data-mobile-review-keyboard");
  });
});
