import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReviewForecastMotion } from "./use-review-forecast-motion";

class VisibilityObserver implements IntersectionObserver {
  static instances: VisibilityObserver[] = [];
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [.08];
  private target: Element | null = null;

  constructor(private callback: IntersectionObserverCallback) {
    VisibilityObserver.instances.push(this);
  }

  observe = vi.fn((target: Element) => { this.target = target; });
  disconnect = vi.fn(() => { this.target = null; });
  unobserve = vi.fn(() => { this.target = null; });
  takeRecords = () => [];

  setVisible(isIntersecting: boolean) {
    if (!this.target) return;
    this.callback([{ target: this.target, isIntersecting } as IntersectionObserverEntry], this);
  }
}

class MotionPreference extends EventTarget {
  matches = false;
  media = "(prefers-reduced-motion: reduce)";

  setReducedMotion(matches: boolean) {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}

type RecordedAnimation = {
  target: Element;
  frames: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>;
};

const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
let motion: MotionPreference;
let animations: RecordedAnimation[];

function MotionHarness({ ready = true, presentation = "hourly:off", count = 2 }: { ready?: boolean; presentation?: string; count?: number }) {
  const ref = useReviewForecastMotion(ready, presentation);
  return <div ref={ref} data-testid="content">
    {ready ? <>
      <span data-testid="vertical" data-forecast-bar style={{ height: `${count * 10}%` }} />
      <span data-testid="horizontal" data-forecast-bar data-horizontal="true" style={{ width: `${count * 10}%` }} />
      <div hidden><span data-testid="collapsed" data-forecast-bar /></div>
    </> : <span>Loading</span>}
  </div>;
}

function revealLatest() {
  act(() => VisibilityObserver.instances.at(-1)?.setVisible(true));
}

beforeEach(() => {
  VisibilityObserver.instances = [];
  motion = new MotionPreference();
  animations = [];
  vi.stubGlobal("IntersectionObserver", VisibilityObserver);
  vi.stubGlobal("matchMedia", vi.fn(() => motion));
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: function (this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = { target: this, frames, options, cancel: vi.fn() };
      animations.push(animation);
      return { cancel: animation.cancel } as unknown as Animation;
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalAnimate) Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
});

describe("review forecast motion", () => {
  it("waits for loaded content to become visible before animating visible bars", () => {
    const { rerender } = render(<MotionHarness ready={false} />);
    expect(VisibilityObserver.instances).toHaveLength(0);
    expect(animations).toHaveLength(0);

    rerender(<MotionHarness />);
    const observer = VisibilityObserver.instances[0];
    act(() => observer.setVisible(false));
    expect(animations).toHaveLength(0);
    revealLatest();

    expect(animations.map(({ target }) => target)).toEqual([
      screen.getByTestId("content"), screen.getByTestId("vertical"), screen.getByTestId("horizontal"),
    ]);
    expect(animations[1].frames).toEqual([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }]);
    expect(animations[2].frames).toEqual([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }]);
    expect(animations[2].options.delay).toBeGreaterThan(Number(animations[1].options.delay));
    expect(observer.disconnect).toHaveBeenCalledOnce();
    act(() => observer.setVisible(true));
    expect(animations).toHaveLength(3);
  });

  it("keeps data refreshes still and uses a quicker animation for a changed presentation", () => {
    const { rerender } = render(<MotionHarness />);
    revealLatest();
    const entrance = [...animations];
    rerender(<MotionHarness count={5} />);
    expect(screen.getByTestId("vertical")).toHaveStyle({ height: "50%" });
    expect(animations).toHaveLength(entrance.length);
    entrance.forEach(({ cancel }) => expect(cancel).not.toHaveBeenCalled());

    rerender(<MotionHarness presentation="daily:subject" count={5} />);
    entrance.forEach(({ cancel }) => expect(cancel).toHaveBeenCalledOnce());
    expect(animations).toHaveLength(entrance.length);
    revealLatest();
    const changed = animations.slice(entrance.length);
    expect(changed).toHaveLength(3);
    expect(Number(changed[0].options.duration)).toBeLessThan(Number(entrance[0].options.duration));
    changed.slice(1).forEach(({ options }) => expect(options.delay).toBe(0));
    expect(changed[1].frames[0].transform).not.toBe("scaleY(0)");
  });

  it("respects reduced motion on first appearance and cancels running animations when enabled live", () => {
    motion.matches = true;
    const removeListener = vi.spyOn(motion, "removeEventListener");
    const { rerender, unmount } = render(<MotionHarness />);
    revealLatest();
    expect(animations).toHaveLength(0);

    act(() => motion.setReducedMotion(false));
    rerender(<MotionHarness count={3} />);
    expect(animations).toHaveLength(0);
    rerender(<MotionHarness presentation="daily:off" />);
    revealLatest();
    expect(animations).toHaveLength(3);

    act(() => motion.setReducedMotion(true));
    animations.forEach(({ cancel }) => expect(cancel).toHaveBeenCalledOnce());
    unmount();
    const cancellationCounts = animations.map(({ cancel }) => cancel.mock.calls.length);
    act(() => motion.setReducedMotion(true));
    expect(animations.map(({ cancel }) => cancel.mock.calls.length)).toEqual(cancellationCounts);
    expect(removeListener).toHaveBeenCalledTimes(2);
  });

  it("discards pending offscreen presentations and releases animation work on unmount", () => {
    const { rerender, unmount } = render(<MotionHarness />);
    const first = VisibilityObserver.instances[0];
    rerender(<MotionHarness presentation="daily:off" />);
    const second = VisibilityObserver.instances[1];
    rerender(<MotionHarness presentation="daily:srs" />);
    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(second.disconnect).toHaveBeenCalledOnce();
    act(() => { first.setVisible(true); second.setVisible(true); });
    expect(animations).toHaveLength(0);
    revealLatest();
    expect(animations).toHaveLength(3);
    expect(animations[1].frames[0].transform).toBe("scaleY(0)");

    unmount();
    animations.forEach(({ cancel }) => expect(cancel).toHaveBeenCalledOnce());
    revealLatest();
    expect(animations).toHaveLength(3);
  });

  it("reveals without an observer and remains usable when Web Animations are unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { unmount } = render(<MotionHarness />);
    expect(animations).toHaveLength(3);
    unmount();

    Reflect.deleteProperty(Element.prototype, "animate");
    render(<MotionHarness />);
    expect(screen.getByTestId("content")).toBeVisible();
    expect(animations).toHaveLength(3);
  });
});
