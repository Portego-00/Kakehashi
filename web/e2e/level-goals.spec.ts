import { expect, test, type Page } from "@playwright/test";
import { settingsStorageKey } from "../src/features/settings/settings";
import {
  createLevelGoal,
  EMPTY_GOAL_STATE,
  goalStorageKey,
} from "../../src/features/level-goals/model";
test.setTimeout(60_000);
const now = new Date("2026-09-30T12:00:00");
const collection = (data: unknown[] = []) => ({
  object: "collection",
  data,
  pages: { next_url: null },
  total_count: data.length,
});
async function mockAccount(
  page: Page,
  username = "Portego",
  level = 7,
  paused = false,
  demo = false,
) {
  const user = {
    id: 1,
    object: "user",
    url: "",
    data_updated_at: now.toISOString(),
    data: {
      username,
      level,
      profile_url: "",
      started_at: "2026-01-01",
      current_vacation_started_at: paused ? now.toISOString() : null,
      preferences: {},
      subscription: { active: true, type: "lifetime", max_level_granted: 60 },
    },
  };
  const progressions = Array.from({ length: level }, (_, i) => ({
    id: i + 1,
    object: "level_progression",
    data_updated_at: now.toISOString(),
    data: {
      level: i + 1,
      unlocked_at: new Date(
        now.getTime() - (level - i - 1) * 7 * 86400000,
      ).toISOString(),
      started_at: null,
      passed_at:
        i < level - 1
          ? new Date(
              now.getTime() - (level - i - 2) * 7 * 86400000,
            ).toISOString()
          : null,
      abandoned_at: null,
    },
  }));
  await page.addInitScript((instant) => {
    const NativeDate = Date;
    const offset = NativeDate.parse(instant) - NativeDate.now();
    // Keep real timers and advancing animation time, while fixing the test's calendar day.
    window.Date = new Proxy(NativeDate, {
      construct(target, args) {
        return Reflect.construct(
          target,
          args.length ? args : [target.now() + offset],
        );
      },
      get(target, property) {
        return property === "now"
          ? () => target.now() + offset
          : Reflect.get(target, property);
      },
      apply(target) {
        return new target(target.now() + offset).toString();
      },
    });
  }, now.toISOString());
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session/wanikani")
      return route.fulfill({ json: { user, demo } });
    if (path.endsWith("/user")) return route.fulfill({ json: user });
    if (path.endsWith("/level_progressions"))
      return route.fulfill({ json: collection(progressions) });
    if (path.endsWith("/summary"))
      return route.fulfill({
        json: { data: { lessons: [], reviews: [], next_reviews_at: null } },
      });
    return route.fulfill({ json: collection() });
  });
}
async function saveGoal(
  page: Page,
  mode: "A level" | "A timeframe" | "A date" = "A level",
  target = 10,
) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: mode, exact: false }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Target level", { exact: true }).fill(String(target));
  if (mode === "A date")
    await dialog.getByLabel("Target date", { exact: true }).fill("2026-10-30");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: /Create goal|Update goal/ }).click();
  await expect(
    dialog.getByText(`Level ${target}. Let’s get there.`),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Keep going" }).click();
}
test("Portego creates, tracks, updates, reloads, hides and restores a goal", async ({
  page,
}, testInfo) => {
  await mockAccount(page);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const widget = page.getByRole("region", {
    name: "Level goal widget",
    exact: true,
  });
  await widget.getByRole("button", { name: "Set a goal" }).click();
  await page
    .getByRole("dialog")
    .screenshot({ path: testInfo.outputPath("goal-setup.png") });
  await saveGoal(page);
  await expect(widget.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "7",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(widget.getByRole("button", { name: "Edit goal" })).toBeVisible();
  await expect(
    widget.getByRole("button", { name: "Hide goal widget" }),
  ).toHaveCount(0);
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  const panel = page.getByRole("region", { name: "Level goal", exact: true });
  await expect(
    panel.getByRole("button", { name: "Hide from Home" }),
  ).toHaveCount(0);
  await expect(panel.locator(":scope > div").first()).toHaveCSS("opacity", "1");
  await panel.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await panel.screenshot({
    path: testInfo.outputPath("goal-summary.png"),
    animations: "disabled",
  });
  await panel.getByText("Track your journey", { exact: true }).click();
  await expect(panel.getByText("Level 8", { exact: true })).toBeVisible();
  await panel.screenshot({ path: testInfo.outputPath("goal-tracker.png") });
  await panel.getByRole("button", { name: "Edit goal" }).click();
  await saveGoal(page, "A timeframe", 11);
  await expect(panel.getByText(/Past goals/)).toHaveCount(0);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(widget.getByText("11", { exact: false }).first()).toBeVisible();
  await widget.getByRole("button", { name: "Edit goal" }).click();
  const editor = page.getByRole("dialog");
  await editor
    .getByRole("button", { name: "Remove goal", exact: true })
    .click();
  await editor.getByRole("button", { name: "Keep goal", exact: true }).click();
  await editor
    .getByRole("button", { name: "Remove goal", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Remove goal", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(widget).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(widget).toHaveCount(0);
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  await expect(panel.getByText(/Past goals/)).toHaveCount(0);
  await panel.getByRole("button", { name: "Show on Home" }).click();
  await panel.getByRole("button", { name: "Set a goal" }).click();
  await saveGoal(page, "A level", 12);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(widget.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    "12",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("date setup rejects past dates and saves a future date", async ({
  page,
}) => {
  await mockAccount(page);
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Set a goal" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "A date", exact: false }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Target date", { exact: true }).fill("2026-09-29");
  await expect(
    dialog.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Target date", { exact: true }).fill("2026-10-30");
  await dialog.getByLabel("Target level", { exact: true }).fill("10");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: "Create goal" }).click();
  await dialog.getByRole("button", { name: "Keep going" }).click();
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    goalStorageKey("1"),
  );
  expect(stored.active.deadline).toBe("2026-10-30");
  expect(stored.active.mode).toBe("date");
});
test("missed, reached and late goals keep their progress and history", async ({
  page,
}, testInfo) => {
  await mockAccount(page, "Portego", 10);
  const goal = createLevelGoal(
    {
      id: "past",
      mode: "date",
      currentLevel: 7,
      targetLevel: 10,
      deadline: "2026-09-29",
    },
    new Date("2026-09-01T12:00:00"),
  );
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    {
      key: goalStorageKey("1"),
      value: JSON.stringify({ ...EMPTY_GOAL_STATE, active: goal }),
    },
  );
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  const panel = page.getByRole("region", { name: "Level goal", exact: true });
  // The target arrived after its date; reaching it still completes the goal.
  await expect(
    panel.getByText("Reached after target", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "10",
  );
  await panel.screenshot({ path: testInfo.outputPath("goal-complete.png") });
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    {
      key: goalStorageKey("1"),
      value: JSON.stringify({
        ...EMPTY_GOAL_STATE,
        active: { ...goal, targetLevel: 11 },
      }),
    },
  );
  await expect(panel.getByText("Time for a new plan")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Adjust plan" }),
  ).toBeVisible();
  await panel.getByText("Track your journey", { exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "End this goal" }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: "Adjust plan" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove goal", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove goal", exact: true })
    .click();
  await expect(panel.getByRole("button", { name: "Set a goal" })).toBeVisible();
  await expect(panel.getByText(/Past goals/)).toHaveCount(0);
});
test("every account can set goals and enable the optional planner", async ({
  page,
}) => {
  await mockAccount(page, "AnotherUser");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Plan your pace" }),
  ).toHaveCount(0);
  const widget = page.getByRole("region", {
    name: "Level goal widget",
    exact: true,
  });
  await widget.getByRole("button", { name: "Set a goal" }).click();
  await saveGoal(page);
  await expect(widget.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    "10",
  );
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const toggle = page.getByRole("checkbox", { name: /Plan your pace/ });
  await expect(toggle).not.toBeChecked();
  await page.getByText("Plan your pace", { exact: true }).click();
  await expect(toggle).toBeChecked();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Plan your pace" }).click();
  await expect(page.getByLabel("Daily lessons", { exact: true })).toBeVisible();
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Edit goal" })).toBeVisible();
  await expect(page.getByText(/Past goals/)).toHaveCount(0);
});

test("vacation pauses forecasts and reduced motion is supported", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockAccount(page, "Portego", 7, true);
  const goal = createLevelGoal(
    { id: "vacation", mode: "level", currentLevel: 7, targetLevel: 10 },
    now,
  );
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    {
      key: goalStorageKey("1"),
      value: JSON.stringify({ ...EMPTY_GOAL_STATE, active: goal }),
    },
  );
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  const panel = page.getByRole("region", { name: "Level goal", exact: true });
  await expect(panel.getByText("Enjoy your break")).toBeVisible();
  await expect(panel.getByText("Estimate paused")).toBeVisible();
});

test("goal overlay preserves the page and reveals each step without losing the background", async ({
  page,
}, testInfo) => {
  await mockAccount(page);
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  const panel = page.getByRole("region", { name: "Level goal", exact: true });
  await panel.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await expect(panel.locator(":scope > div").first()).toHaveCSS("opacity", "1");
  const before = await panel.boundingBox();
  await panel.getByRole("button", { name: "Set a goal" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Make your next level count." }),
  ).toBeVisible();
  await expect(panel).toBeVisible();
  await expect(panel.locator(":scope > div").first()).toHaveCSS("opacity", "1");
  expect(
    await dialog.evaluate((element) => element.parentElement === document.body),
  ).toBe(true);
  const after = await panel.boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
  expect(Math.abs(after!.height - before!.height)).toBeLessThan(2);
  await expect(dialog).toHaveCSS("transform", "none");
  await expect(
    dialog
      .getByRole("heading", { name: "Make your next level count." })
      .locator(".."),
  ).toHaveCSS("opacity", "1");
  const lastChoice = await dialog
    .getByRole("button", { name: "A date", exact: false })
    .boundingBox();
  const footer = await dialog.locator("footer").boundingBox();
  expect(lastChoice!.y + lastChoice!.height).toBeLessThanOrEqual(footer!.y);
  await page.screenshot({
    path: testInfo.outputPath("experience-direction.png"),
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Find your finish line." }),
  ).toBeVisible();
  await dialog.getByLabel("Target level", { exact: true }).fill("15");
  await expect(dialog.getByText("+8 levels from here")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("experience-target.png"),
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "This is your plan." }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "This is your plan." }).locator(".."),
  ).toHaveCSS("opacity", "1");
  const ticket = await dialog
    .getByText("No deadline", { exact: true })
    .boundingBox();
  const planFooter = await dialog.locator("footer").boundingBox();
  expect(ticket!.y + ticket!.height).toBeLessThanOrEqual(planFooter!.y);
  await page.screenshot({
    path: testInfo.outputPath("experience-plan.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Set a goal" })).toBeFocused();
});

test("dial labels never intersect ticks and the focused value has no underline", async ({
  page,
}, testInfo) => {
  await mockAccount(page);
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Set a goal" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    dialog
      .getByRole("heading", { name: "Find your finish line." })
      .locator(".."),
  ).toHaveCSS("opacity", "1");
  const target = dialog.getByLabel("Target level", { exact: true });
  await target.fill("15");
  const labels = [
    dialog.getByText("TARGET LEVEL", { exact: true }),
    dialog.getByText("+8 levels from here", { exact: true }),
  ];
  const ticks = await dialog
    .locator('svg[viewBox="0 0 240 240"] line')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
  for (const label of labels) {
    const box = await label.boundingBox();
    const intersects = ticks.some(
      (tick) =>
        tick.left < box!.x + box!.width + 4 &&
        tick.right > box!.x - 4 &&
        tick.top < box!.y + box!.height + 4 &&
        tick.bottom > box!.y - 4,
    );
    expect(
      intersects,
      "Dial ticks should leave clear space around the label",
    ).toBe(false);
  }
  await expect(target).toHaveCSS("box-shadow", "none");
  await page.screenshot({
    path: testInfo.outputPath("dial-spacing.png"),
    animations: "disabled",
  });
});

test("pace planner links workload, applies settings and saves the goal date", async ({
  page,
}, testInfo) => {
  await mockAccount(page);
  const subjects = Array.from({ length: 140 }, (_, i) => ({
    id: i + 1,
    object: "kanji",
    data_updated_at: now.toISOString(),
    data: {
      level: 7,
      hidden_at: null,
      characters: "字",
      slug: `item-${i}`,
      meanings: [{ meaning: "letter", primary: true }],
      readings: [{ reading: "じ", primary: true }],
      component_subject_ids: [],
      amalgamation_subject_ids: [],
      visually_similar_subject_ids: [],
    },
  }));
  const assignments = [
    {
      id: 1,
      object: "assignment",
      data_updated_at: now.toISOString(),
      data: {
        subject_id: 1,
        subject_type: "kanji",
        srs_stage: 1,
        hidden: false,
        unlocked_at: "2026-09-20T08:00:00Z",
        started_at: "2026-09-20T08:00:00Z",
        available_at: now.toISOString(),
        burned_at: null,
        passed_at: null,
      },
    },
  ];
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/subjects"))
      return route.fulfill({ json: collection(subjects) });
    if (path.endsWith("/assignments"))
      return route.fulfill({ json: collection(assignments) });
    return route.fallback();
  });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Plan your pace" }),
  ).toHaveCount(0);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const preference = page.getByRole("checkbox", { name: /Plan your pace/ });
  await expect(preference).not.toBeChecked();
  await page.getByText("Plan your pace", { exact: true }).click();
  await expect(preference).toBeChecked();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Plan your pace" }).click();
  const planner = page.locator("#study-pace-planner");
  await planner.getByRole("button", { name: "Two weeks", exact: true }).click();
  await expect(
    planner.getByLabel("Days per level", { exact: true }),
  ).toHaveValue("14");
  await expect(
    planner.getByLabel("Daily lessons", { exact: true }),
  ).toHaveValue("10");
  const workload = await planner.locator('[aria-live="polite"]').innerText();
  await planner
    .getByLabel("Reviews per session", { exact: true })
    .press("Home");
  await expect(
    planner.getByLabel("Reviews per session", { exact: true }),
  ).toHaveValue("5");
  expect(
    (await planner.locator('[aria-live="polite"]').innerText()).split("\n")[0],
  ).toBe(workload.split("\n")[0]);
  await expect(
    planner
      .getByRole("list", { name: "Estimated review workload for 14 days" })
      .getByRole("listitem"),
  ).toHaveCount(14);
  await planner
    .getByRole("button", { name: "Apply daily plan", exact: false })
    .click();
  await expect(
    planner.getByRole("button", { name: "Plan applied" }),
  ).toBeVisible();
  const settings = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    settingsStorageKey("Portego"),
  );
  expect(settings.study.dailyLessonLimit).toBe(10);
  expect(settings.study.reviewBatchSizeEnabled).toBe(true);
  expect(settings.study.reviewBatchSize).toBe(5);
  await planner.getByRole("button", { name: "Use date for my goal" }).click();
  const goal = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    goalStorageKey("1"),
  );
  expect(goal.studyPlan).toEqual({
    daysPerLevel: 14,
    dailyLessons: 10,
    reviewBatch: 5,
  });
  expect(goal.active.deadline).toBe("2026-11-11");
  await planner.locator("summary").click();
  await expect(planner.getByText(/Assumes correct, on-time/)).toBeVisible();
  await planner.screenshot({
    path: testInfo.outputPath("pace-planner.png"),
    animations: "disabled",
    // Isolate the component from fixed navigation during the tall element capture.
    style:
      '[data-app-header], nav[aria-label="Mobile navigation"], a[href="#main-content"], nextjs-portal { visibility: hidden !important; }',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Plan your pace" }).click();
  await expect(
    planner.getByLabel("Daily lessons", { exact: true }),
  ).toHaveValue("10");
  await expect(
    planner.getByLabel("Reviews per session", { exact: true }),
  ).toHaveValue("5");
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByText("Plan your pace", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Plan your pace/ }),
  ).not.toBeChecked();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Plan your pace" }),
  ).toHaveCount(0);
});

test("custom timeframe date and level 25 dial keep their exact values", async ({
  page,
}, testInfo) => {
  await mockAccount(page, "Portego", 21);
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Set a goal" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "A timeframe", exact: false })
    .click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Target date", { exact: true }).fill("2026-10-15");
  await dialog.getByLabel("Target level", { exact: true }).fill("25");
  const ticks = dialog.locator('svg[viewBox="0 0 240 240"] line');
  await expect(ticks).toHaveCount(39);
  await expect(
    dialog.locator('svg[viewBox="0 0 240 240"] line[data-active="true"]'),
  ).toHaveCount(4);
  const geometry = await ticks.evaluateAll((lines) =>
    lines.map((line) => ({
      x1: Number(line.getAttribute("x1")),
      y1: Number(line.getAttribute("y1")),
      x2: Number(line.getAttribute("x2")),
      y2: Number(line.getAttribute("y2")),
    })),
  );
  const angles = geometry.map((point) => {
    expect(Math.hypot(point.x2 - 120, point.y2 - 120)).toBeCloseTo(110, 6);
    expect(
      (point.x1 - 120) * (point.y2 - 120) - (point.y1 - 120) * (point.x2 - 120),
    ).toBeCloseTo(0, 6);
    return Math.atan2(point.y2 - 120, point.x2 - 120);
  });
  angles
    .slice(1)
    .forEach((angle, index) =>
      expect((angle - angles[index] + Math.PI * 2) % (Math.PI * 2)).toBeCloseTo(
        (1.5 * Math.PI) / 38,
        6,
      ),
    );
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  const number = dialog.getByLabel("Target level", { exact: true });
  await expect(
    dialog.getByRole("heading", { name: "This is your plan." }).locator(".."),
  ).toHaveCSS("opacity", "1");
  await expect(number).toHaveValue("25");
  await expect(number).toHaveCSS("letter-spacing", "normal");
  expect(
    await number.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const dateBox = await dialog
    .getByText("Oct 15", { exact: true })
    .boundingBox();
  const footerBox = await dialog.locator("footer").boundingBox();
  expect(dateBox!.y + dateBox!.height).toBeLessThanOrEqual(footerBox!.y);
  await page.screenshot({
    path: testInfo.outputPath("level-25-custom-date.png"),
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Create goal" }).click();
  await dialog.getByRole("button", { name: "Keep going" }).click();
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    goalStorageKey("1"),
  );
  expect(stored.active).toMatchObject({
    mode: "duration",
    durationDays: 15,
    deadline: "2026-10-15",
    targetLevel: 25,
  });
});

test("demo visitors can use goals without sharing real-account storage", async ({
  page,
}) => {
  await mockAccount(page, "demo-level-21", 21, false, true);
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Set a goal" }).click();
  await saveGoal(page, "A level", 25);
  const demoGoal = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    goalStorageKey("demo:demo-level-21"),
  );
  expect(demoGoal.active.targetLevel).toBe(25);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      goalStorageKey("1"),
    ),
  ).toBeNull();
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("checkbox", { name: /Plan your pace/ }),
  ).not.toBeChecked();
});
