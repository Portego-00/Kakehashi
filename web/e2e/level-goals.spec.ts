import { expect, test, type Page } from "@playwright/test";
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
      construct(target, args) { return Reflect.construct(target, args.length ? args : [target.now() + offset]); },
      get(target, property) { return property === "now" ? () => target.now() + offset : Reflect.get(target, property); },
      apply(target) { return new target(target.now() + offset).toString(); },
    });
  }, now.toISOString());
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session/wanikani")
      return route.fulfill({ json: { user } });
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
  await widget.getByRole("button", { name: "Hide goal widget" }).click();
  await expect(widget).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(widget).toHaveCount(0);
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  const panel = page.getByRole("region", { name: "Level goal", exact: true });
  await panel.getByRole("button", { name: "Show on Home" }).click();
  await expect(panel.locator(":scope > div").first()).toHaveCSS("opacity", "1");
  await panel.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await panel.screenshot({ path: testInfo.outputPath("goal-summary.png"), animations: "disabled" });
  await panel.getByText("Track your journey", { exact: true }).click();
  await expect(panel.getByText("Level 8", { exact: true })).toBeVisible();
  await panel.screenshot({ path: testInfo.outputPath("goal-tracker.png") });
  await panel.getByRole("button", { name: "Edit goal" }).click();
  await saveGoal(page, "A timeframe", 11);
  await panel.locator("summary").filter({ hasText: "Past goals" }).click();
  await expect(panel.getByText("Updated", { exact: true })).toBeVisible();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(widget.getByText("11", { exact: false }).first()).toBeVisible();
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
  await panel.getByRole("button", { name: "End this goal" }).click();
  await panel.locator("summary").filter({ hasText: "Past goals" }).click();
  await expect(
    panel
      .locator("details")
      .filter({ hasText: "Past goals" })
      .getByText("Time for a new plan", { exact: true }),
  ).toBeVisible();
});
test("other accounts see no goal entry points", async ({ page }) => {
  await mockAccount(page, "AnotherUser");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Level goal", exact: true }),
  ).toHaveCount(0);
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Set a goal" })).toHaveCount(0);
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
