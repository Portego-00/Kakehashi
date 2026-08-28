import { readFileSync } from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DASHBOARD_SECTIONS } from "@/features/settings/settings";
import { IncompleteLevelsWidget, StudyTimeWidget } from "./DashboardDataWidgets";
import { AppStreakWidget, DashboardLevelWidget, SrsSpreadWidget } from "./DashboardNativeWidgets";
import { DashboardWidgetPreview } from "./DashboardWidgetPreview";
import { StudyQueueCard } from "./StudyQueueCard";
import { cacheRemoteStudyTimeDays, getStudyTimeDeviceId, localDayKey, recordStudyTime } from "./study-time";

describe("dashboard widget previews", () => {
  it("keeps only the Guru target bar in the home level widget", () => {
    const { container } = render(<DashboardLevelWidget
      currentLevel={21}
      progress={{ radical: { passed: 1, total: 2 }, kanji: { passed: 1, total: 2 }, vocabulary: { passed: 1, total: 2 } }}
      subjects={[]}
    />);

    expect(screen.getByRole("progressbar", { name: "1 of 2 kanji at the passing stage" })).toBeInTheDocument();
    expect(container.querySelector('[class*="levelOverallMeter"]')).toBeNull();
  });

  it("renders a truthful section-specific structure for every dashboard widget", () => {
    const { container } = render(<>{DASHBOARD_SECTIONS.map((id) => <DashboardWidgetPreview id={id} key={id} />)}</>);

    expect(container.querySelectorAll("[data-widget-preview]")).toHaveLength(DASHBOARD_SECTIONS.length);
    expect([...container.querySelectorAll("[data-widget-preview] h2")].map((heading) => heading.textContent)).toEqual([
      "Today",
      "Active Item Spread",
      "Level — Progress",
      "Extra study",
      "Next 12 hours",
      "Review stats",
      "Recent Mistakes",
      "App Streak",
      "Subject lists",
      "Incomplete levels",
      "Recent unlocks",
      "Critical items",
      "Burned items",
      "Review heatmap",
      "Level timing",
      "Today’s Study",
      "Study time",
    ]);
    expect(container.querySelectorAll('[data-widget-preview="srs"] [class*="srsBarColumn"]')).toHaveLength(9);
    expect(container.querySelector('[data-widget-preview="level"] [class*="levelGuruSegments"]')).not.toBeNull();
    expect(container.querySelector('[data-widget-preview="level"] [class*="levelOverallMeter"]')).toBeNull();
    expect(container.querySelector('[data-widget-preview="level"]')).not.toHaveTextContent("Active on level");
    expect(container.querySelectorAll('[data-widget-preview="level"] [data-subject="kanji"]')).toHaveLength(18);
    const levelSubject = container.querySelector('[data-widget-preview="level"] [data-subject="kanji"]');
    expect(levelSubject?.querySelector('[class*="levelSubjectBlock"]')).not.toBeNull();
    expect(levelSubject?.querySelector('[class*="levelSubjectBlock"] [class*="levelSubjectMeter"]')).toBeNull();
    const unstartedSubject = container.querySelector('[data-widget-preview="level"] [data-subject="kanji"][data-status="unstarted"]');
    expect(unstartedSubject?.querySelectorAll('[class*="levelSubjectMeter"] b')).toHaveLength(5);
    expect(unstartedSubject?.querySelector('[class*="levelSubjectMeter"] [data-filled]')).toBeNull();
    expect(container.querySelectorAll('[data-widget-preview="study-streak"] [class*="streakDay"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-widget-preview="forecast"] [class*="forecastCol"]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-widget-preview="recent-mistakes"] [class*="recentMistakeTile"]')).toHaveLength(3);
    expect(container.querySelector('[data-widget-preview="daily-study"] img[src*="Lessons.png"]')).not.toBeNull();
    expect(container.querySelector('[data-widget-preview="daily-study"] img[src*="Reviews.png"]')).not.toBeNull();
    expect(container.querySelector('[data-widget-preview="recent-unlocks"] [data-long="true"]')).toHaveTextContent("見当たる");
    expect(container.querySelectorAll('[data-widget-preview="incomplete-levels"] [class*="incompleteRingProgress"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-widget-preview="study-time"] [class*="studyChartColumn"]')).toHaveLength(14);
  });

  it("groups SRS stages with full names and exposes a focused breakdown", () => {
    const rows = [
      { stage: 1, label: "Apprentice I", roman: "I", radical: 1, kanji: 2, vocabulary: 3, total: 6 },
      { stage: 5, label: "Guru I", roman: "V", radical: 2, kanji: 3, vocabulary: 4, total: 9 },
    ];
    const { container } = render(<SrsSpreadWidget rows={rows} />);

    fireEvent.click(screen.getByRole("button", { name: "Group the SRS stages" }));
    expect(container.querySelectorAll('[class*="srsStageKey"] small')[0]).toHaveTextContent("Apprentice");
    expect(container.querySelectorAll('[class*="srsStageKey"] small')[1]).toHaveTextContent("Guru");
    fireEvent.pointerEnter(container.querySelectorAll('[class*="srsBarColumn"]')[0]);
    expect(container.querySelector('[class*="srsHoverSummary"]')).toHaveTextContent("6 items · 1 radicals · 2 kanji · 3 vocabulary");
  });

  it("shows the hovered subject-type completion inside the incomplete-level rings", () => {
    const { container } = render(<IncompleteLevelsWidget levels={[{
      level: 12,
      passed: 6,
      total: 10,
      radical: { passed: 1, total: 1 },
      kanji: { passed: 2, total: 4 },
      vocabulary: { passed: 3, total: 5 },
    }]} />);

    fireEvent.pointerEnter(container.querySelector('[data-type="kanji"][class*="incompleteRingProgress"]')!);
    expect(container.querySelector('[class*="incompleteRingCenter"]')).toHaveTextContent("50%Kanji");
  });

  it("renders combined local and other-device study time", () => {
    window.localStorage.clear();
    const now = new Date();
    const userId = "wk-user-123";
    const deviceId = getStudyTimeDeviceId(window.localStorage, () => "browser-device-123");
    recordStudyTime(window.localStorage, userId, deviceId, "reviews", 60, now);
    cacheRemoteStudyTimeDays(window.localStorage, userId, deviceId, [{
      day: localDayKey(now),
      appTotalSeconds: 120,
      byCategory: { reviews: 60, lessons: 60 },
    }]);

    const { container } = render(<StudyTimeWidget userId={userId} />);

    expect(container.querySelector('[class*="studyTimeHead"] strong')).toHaveTextContent("3m");
    expect(container.querySelector('[class*="studyChartHead"]')).toHaveTextContent("All devices");
    expect(container.querySelector('[data-category="reviews"] dd')).toHaveTextContent("2m");
    expect(container.querySelector('[data-category="lessons"] dd')).toHaveTextContent("1m");
    window.localStorage.clear();
  });

  it("uses the left arrow for lower levels and the right arrow for higher levels", () => {
    const { container } = render(<IncompleteLevelsWidget levels={[
      { level: 12, passed: 6, total: 10, radical: { passed: 1, total: 1 }, kanji: { passed: 2, total: 4 }, vocabulary: { passed: 3, total: 5 } },
      { level: 11, passed: 2, total: 10, radical: { passed: 0, total: 2 }, kanji: { passed: 1, total: 4 }, vocabulary: { passed: 1, total: 4 } },
    ]} />);
    const vocabularyRing = container.querySelector('[data-type="vocabulary"][class*="incompleteRingProgress"]') as SVGCircleElement;
    const [left, right] = [...container.querySelectorAll('[class*="incompleteSwitcher"] button')] as HTMLButtonElement[];

    expect(vocabularyRing.style.getPropertyValue("--ring-progress")).toBe("60");
    expect(left).toHaveAccessibleName("Show lower incomplete level");
    expect(right).toHaveAccessibleName("Show higher incomplete level");
    expect(left).toBeEnabled();
    expect(right).toBeDisabled();

    fireEvent.click(left);

    expect(container.querySelector('[data-type="vocabulary"][class*="incompleteRingProgress"]')).toBe(vocabularyRing);
    expect(vocabularyRing.style.getPropertyValue("--ring-progress")).toBe("25");
    expect(container.querySelector('[class*="incompleteSwitcher"]')).toHaveTextContent("Level11");
    expect(left).toBeDisabled();
    expect(right).toBeEnabled();

    fireEvent.click(right);

    expect(vocabularyRing.style.getPropertyValue("--ring-progress")).toBe("60");
    expect(container.querySelector('[class*="incompleteSwitcher"]')).toHaveTextContent("Level12");
  });

  it("releases the initial ring draw so level changes can morph and disables motion for reduced-motion users", () => {
    const css = readFileSync("src/features/dashboard/dashboard.module.css", "utf8");
    const ringRule = css.match(/\.incompleteRingProgress \{ stroke:[^}]+\}/)?.[0] ?? "";
    const reducedMotionRules = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(ringRule).toContain("animation: dashboardRingDraw var(--dur-long) var(--ease-out)");
    expect(ringRule).not.toContain("both");
    expect(ringRule).toContain("transition: --ring-progress 320ms var(--ease-out)");
    expect(reducedMotionRules).toContain(".incompleteRingProgress { transition: none; }");
  });

  it("keeps the main lesson and review queues disabled while they are coming soon", () => {
    render(<><StudyQueueCard type="lesson" count={12} /><StudyQueueCard type="review" count={34} /></>);

    for (const name of ["Lessons", "Reviews"]) {
      const queue = screen.getByRole("article", { name: `${name} study queue, coming soon` });
      expect(within(queue).getByRole("button", { name: "Coming soon" })).toBeDisabled();
      expect(within(queue).queryByRole("link")).not.toBeInTheDocument();
    }
  });

  it("uses the mobile empty-state artwork while a queue is clear", () => {
    const { container } = render(<><StudyQueueCard type="lesson" count={0} /><StudyQueueCard type="review" count={0} /></>);

    expect(container.querySelector('img[src*="NoLessons.png"]')).not.toBeNull();
    expect(container.querySelector('img[src*="ReviewsFinished.png"]')).not.toBeNull();
    expect(container).toHaveTextContent("Main lessons are coming to the web app.");
    expect(container).toHaveTextContent("Main reviews are coming to the web app.");
  });

  it("renders streak days without React key warnings when identifiers repeat", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const days = [
      { dayKey: "2026-08-24", date: new Date(2026, 7, 24), label: "M", active: true, isToday: false },
      { dayKey: "2026-08-24", date: new Date(2026, 7, 25), label: "T", active: false, isToday: true },
    ];

    try {
      render(<AppStreakWidget current={1} longest={1} days={days} />);
      const keyWarnings = consoleError.mock.calls.filter(([message]) => /unique ["']key["']|same key/i.test(String(message)));
      expect(keyWarnings).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });
});
