import { createSettingsScrollGuard } from "../settings-scroll-guard";

describe("settings section navigation", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("keeps the tapped chip selected while passing other sections on a long jump", () => {
    const guard = createSettingsScrollGuard();
    let selected = "reviews";
    guard.beginNavigation();
    for (const section of ["support", "voice", "reading", "lessons", "reviews"]) {
      jest.advanceTimersByTime(140);
      if (!guard.shouldIgnoreScroll()) selected = section;
      expect(selected).toBe("reviews");
    }
    guard.endNavigation();
  });

  it("resumes tracking immediately when a drag interrupts automatic scrolling", () => {
    const guard = createSettingsScrollGuard();
    guard.beginNavigation();
    expect(guard.shouldIgnoreScroll()).toBe(true);
    guard.endNavigation();
    expect(guard.shouldIgnoreScroll()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("resumes tracking after the scroll settles", () => {
    const guard = createSettingsScrollGuard();
    guard.beginNavigation();
    guard.shouldIgnoreScroll();
    jest.advanceTimersByTime(160);
    expect(guard.shouldIgnoreScroll()).toBe(false);
  });

  it("handles a jump that produces no events and replaces an earlier jump", () => {
    const guard = createSettingsScrollGuard();
    guard.beginNavigation();
    jest.advanceTimersByTime(400);
    guard.beginNavigation();
    jest.advanceTimersByTime(400);
    expect(guard.shouldIgnoreScroll()).toBe(true);
    jest.advanceTimersByTime(160);
    expect(guard.shouldIgnoreScroll()).toBe(false);
    guard.beginNavigation();
    jest.advanceTimersByTime(500);
    expect(guard.shouldIgnoreScroll()).toBe(false);
  });
});
