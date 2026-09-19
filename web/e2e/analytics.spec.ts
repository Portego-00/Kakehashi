import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { analyticsChart, chartData, closeChartData, expectDrawn } from "./analytics-chart-helpers";

async function openAnalytics(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await page.goto("/analytics");
  await expect(page.getByRole("combobox", { name: "Dashboard preset" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Kanji coverage", exact: true })).toBeVisible();
}

async function deepDive(page: Page) {
  await page.getByRole("combobox", { name: "Dashboard preset" }).selectOption("deep-dive");
  await expect(page.locator('button[aria-label^="Expand "]')).toHaveCount(18);
}

test("all analytics widgets expand, retain focus, and close with Escape", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openAnalytics(page);
  await deepDive(page);
  const labels = await page.locator('button[aria-label^="Expand "]').evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")!));
  for (const label of labels) {
    const opener = page.getByRole("button", { name: label, exact: true });
    await opener.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => scrollY);
    await opener.click();
    await expect(page.locator("dialog:modal")).toHaveCount(1);
    await expect(page.locator("dialog:modal").getByRole("heading").first()).toHaveText(label.replace("Expand ", ""));
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog:modal")).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect.poll(() => page.evaluate((before) => Math.abs(scrollY - before), scrollBefore)).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});

test("customization supports cancel, resize, keyboard reorder, hiding, and reload persistence", async ({ page }) => {
  await openAnalytics(page);
  await deepDive(page);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  let editor = page.getByRole("dialog", { name: "Customize analytics" });
  await editor.getByRole("checkbox", { name: "Show Study time", exact: true }).uncheck();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("region", { name: "Study time", exact: true })).toBeAttached();
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  editor = page.getByRole("dialog", { name: "Customize analytics" });
  await editor.getByRole("checkbox", { name: "Show Study time", exact: true }).uncheck();
  await editor.getByRole("button", { name: "Compact Kanji coverage", exact: true }).click();
  await editor.getByRole("button", { name: "Reorder Level projections", exact: true }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(editor.getByRole("list", { name: "Dashboard widget order" }).locator("li").first()).toContainText("Level projections");
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Dashboard preset" })).toHaveValue("custom");
  await expect(page.getByRole("region", { name: "Study time", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-analytics-grid]").getByRole("region").first()).toHaveAccessibleName("Level projections");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Dashboard preset" })).toHaveValue("custom");
  await expect(page.getByRole("region", { name: "Study time", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-analytics-grid]").getByRole("region").first()).toHaveAccessibleName("Level projections");
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  editor = page.getByRole("dialog", { name: "Customize analytics" });
  await expect(editor.getByRole("button", { name: "Compact Kanji coverage", exact: true })).toHaveAttribute("aria-pressed", "true");
  await editor.getByRole("button", { name: "Restore defaults", exact: true }).click();
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Dashboard preset" })).toHaveValue("overview");
});

test("coverage filters persist and nested Escape closes only the item browser", async ({ page }) => {
  await openAnalytics(page);
  const coverage = page.getByRole("region", { name: "Kanji coverage", exact: true });
  for (const name of ["Joyo", "Frequency", "Vocabulary", "JLPT"]) {
    await coverage.getByRole("button", { name, exact: true }).click();
    await expect(coverage.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await coverage.getByRole("meter").count()).toBeGreaterThan(0);
  }
  await coverage.getByRole("button", { name: "Joyo", exact: true }).click();
  await coverage.getByRole("button", { name: "Burned", exact: true }).click();
  await coverage.getByRole("button", { name: "Expand Kanji coverage", exact: true }).click();
  const expanded = page.locator("dialog:modal").first();
  await expect(expanded.getByRole("button", { name: "Joyo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(expanded.getByRole("button", { name: "Burned", exact: true })).toHaveAttribute("aria-pressed", "true");
  const browse = expanded.getByRole("button", { name: /^Browse Grade 1:/ });
  await browse.click();
  await expect(page.locator("dialog:modal")).toHaveCount(2);
  const items = page.locator("dialog:modal").last();
  await items.getByRole("button", { name: "Remaining", exact: true }).click();
  await expect(items.getByRole("button", { name: "Remaining", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog:modal")).toHaveCount(1);
  await expect(browse).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog:modal")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Expand Kanji coverage", exact: true })).toBeFocused();
  await coverage.getByRole("button", { name: "At level", exact: true }).click();
  await expect(coverage.getByRole("group", { name: "Known threshold", exact: true })).toHaveCount(0);
  await coverage.getByRole("slider", { name: "Preview coverage at WaniKani level", exact: true }).fill("60");
  await expect(coverage).toContainText("Passed through level 60");
  const projectedCount = Number(await coverage.getByRole("meter", { name: "Grade 1 coverage", exact: true }).getAttribute("aria-valuenow"));
  await coverage.getByRole("button", { name: /^Browse Grade 1:/ }).click();
  await page.locator("dialog:modal").getByRole("button", { name: "Known", exact: true }).click();
  await expect(page.locator("dialog:modal").locator("a[data-stage]")).toHaveCount(projectedCount);
  await page.keyboard.press("Escape");
  await coverage.getByRole("button", { name: "Current", exact: true }).click();
  await expect(coverage.getByRole("button", { name: "Burned", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("reading analysis keeps pasted text, distinguishes unique coverage, and exports unknown kanji", async ({ page }) => {
  await openAnalytics(page);
  await deepDive(page);
  const reader = page.getByRole("region", { name: "Reading readiness", exact: true });
  await reader.getByRole("textbox", { name: "Japanese text", exact: true }).fill("日日日月𠮷");
  await reader.getByRole("button", { name: "Expand Reading readiness", exact: true }).click();
  const expanded = page.locator("dialog:modal");
  await expect(expanded.getByRole("textbox", { name: "Japanese text", exact: true })).toHaveValue("日日日月𠮷");
  await expect(expanded).toContainText("4 of 5 occurrences");
  await expect(expanded).toContainText("2 of 3 characters");
  await expanded.getByRole("button", { name: "To learn (1)", exact: true }).click();
  await expect(expanded).toContainText("Outside WaniKani");
  const downloadPromise = page.waitForEvent("download");
  await expanded.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain('"𠮷","1","Outside WaniKani"');
  await page.keyboard.press("Escape");
  await reader.getByRole("button", { name: "Passage", exact: true }).click();
  await expect(reader.getByRole("textbox", { name: "Japanese text", exact: true })).toHaveValue("日日日月𠮷");
  await reader.getByRole("textbox", { name: "Japanese text", exact: true }).fill("こんにちは。");
  await expect(reader).toContainText("This passage has no kanji");
  await reader.getByRole("textbox", { name: "Japanese text", exact: true }).fill("日日日月𠮷");
  await reader.getByText("Kanji learned outside WaniKani", { exact: true }).click();
  await reader.getByRole("textbox", { name: "Known characters", exact: true }).fill("𠮷");
  await expect(reader).toContainText("5 of 5 occurrences");
  await reader.getByRole("button", { name: "At level", exact: true }).click();
  await expect(reader.getByRole("group", { name: "Reading known threshold", exact: true })).toHaveCount(0);
  await reader.getByRole("spinbutton", { name: "Reading preview level", exact: true }).fill("60");
  await expect(reader).toContainText("3 of 3 characters");
  await expect(reader).toContainText("Passed through level 60");
  await reader.getByRole("button", { name: "Current", exact: true }).click();
  await expect(reader.getByRole("button", { name: "Guru+", exact: true })).toHaveAttribute("aria-pressed", "true");
  await reader.getByRole("combobox", { name: "Reading sample", exact: true }).selectOption("A weekend trip");
  await expect(reader.getByRole("textbox", { name: "Japanese text", exact: true })).toHaveValue(/^来月、友達と京都/);
  await reader.getByRole("button", { name: "Clear reading text", exact: true }).click();
  await expect(reader.getByRole("textbox", { name: "Japanese text", exact: true })).toHaveValue("");
});

test("kanji explorer searches readings, filters stages and levels, and paginates", async ({ page }) => {
  await openAnalytics(page);
  await deepDive(page);
  const wall = page.getByRole("region", { name: "Item explorer", exact: true });
  await expect(wall.locator("a[data-stage]")).toHaveCount(80);
  await wall.getByRole("button", { name: "Show 120 more", exact: true }).click();
  await expect(wall.locator("a[data-stage]")).toHaveCount(200);
  await wall.getByRole("searchbox", { name: "Search kanji, meaning or reading", exact: true }).fill("nichi");
  await expect(wall.getByRole("link", { name: /^日:/ })).toBeVisible();
  await wall.getByRole("button", { name: "Expand Item explorer", exact: true }).click();
  const expanded = page.locator("dialog:modal");
  await expect(expanded.getByRole("searchbox", { name: "Search kanji, meaning or reading", exact: true })).toHaveValue("nichi");
  await expanded.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expanded.getByRole("combobox", { name: "Level", exact: true }).selectOption("1");
  const firstLevel = await expanded.locator("a[data-stage]").evaluateAll((links) => links.map((link) => link.getAttribute("aria-label")));
  expect(firstLevel.length).toBeGreaterThan(0);
  expect(firstLevel.every((label) => label?.includes("; level 1;"))).toBe(true);
  await expanded.getByRole("combobox", { name: "Level", exact: true }).selectOption("all");
  await expanded.getByRole("combobox", { name: "Stage", exact: true }).selectOption("Burned");
  expect(await expanded.locator('a[data-stage="burned"]').count()).toBeGreaterThan(0);
  await expect(expanded.locator('a[data-stage]:not([data-stage="burned"])')).toHaveCount(0);
  await expanded.getByRole("searchbox", { name: "Search kanji, meaning or reading", exact: true }).fill("no-such-kanji-987654");
  await expect(expanded).toContainText("No kanji match these filters.");
});

test("SRS snapshots export, reject another account, and import dated history", async ({ page }) => {
  await openAnalytics(page);
  await page.getByRole("button", { name: "Expand SRS distribution", exact: true }).click();
  const history = page.getByRole("region", { name: "Recorded SRS history", exact: true });
  await expect(history).toContainText("Your first daily snapshot is recorded.");
  const downloadPromise = page.waitForEvent("download");
  await history.getByRole("button", { name: "Export SRS snapshots", exact: true }).click();
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.version).toBe(1);
  expect(backup.snapshots).toHaveLength(1);
  const input = history.getByLabel("SRS snapshot backup file", { exact: true });
  await input.setInputFiles({ name: "wrong-account.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...backup, accountKey: "different-account" })) });
  await expect(history.getByRole("alert")).toHaveText("This snapshot backup belongs to a different account.");
  const yesterday = new Date(`${backup.snapshots[0].date}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  backup.snapshots.unshift({ date: yesterday.toISOString().slice(0, 10), stages: backup.snapshots[0].stages });
  const older = new Date(yesterday);
  older.setUTCDate(older.getUTCDate() - 40);
  backup.snapshots.unshift({ date: older.toISOString().slice(0, 10), stages: backup.snapshots[0].stages });
  await input.setInputFiles({ name: "history.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(history.getByRole("status")).toContainText("3 daily snapshots available.");
  const historyChart = analyticsChart(history, "Recorded SRS stages");
  await expectDrawn(historyChart);
  await expect((await chartData(historyChart)).locator("tbody tr")).toHaveCount(2);
  await history.getByRole("button", { name: "90 days", exact: true }).click();
  const fullHistory = await chartData(historyChart);
  const calendarDays = Math.round((new Date(`${backup.snapshots.at(-1).date}T12:00:00Z`).getTime() - older.getTime()) / 86_400_000) + 1;
  await expect(fullHistory.locator("tbody tr")).toHaveCount(calendarDays);
  await expect(fullHistory.locator("tbody tr").nth(1)).toContainText("Not recorded");
  await fullHistory.getByRole("button").nth(1).click();
  await expect(history.getByText(/^No snapshot recorded for /)).toBeVisible();
  await fullHistory.getByRole("button").first().click();
  await expect(fullHistory.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  await history.getByRole("button", { name: "30 days", exact: true }).click();
  await expect((await chartData(historyChart)).locator("tbody tr")).toHaveCount(2);
  await expect(historyChart.getByRole("table").getByRole("button").last()).toHaveAttribute("aria-pressed", "true");
  await expect(history.getByText(/^No snapshot recorded for /)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "Expand SRS distribution", exact: true }).click();
  await expect((await chartData(analyticsChart(page.getByRole("region", { name: "Recorded SRS history", exact: true }), "Recorded SRS stages"))).locator("tbody tr")).toHaveCount(2);
});

test("difficult item scoring, never-passed ordering, and nested practice retain their state", async ({ page }) => {
  await openAnalytics(page);
  await deepDive(page);
  const leeches = page.getByRole("region", { name: "Difficult items", exact: true });
  await leeches.locator("summary").filter({ hasText: /^Filters$/ }).click();
  await leeches.getByText("More filters", { exact: true }).click();
  await leeches.getByRole("combobox", { name: "Scoring method", exact: true }).selectOption("recent");
  await expect(leeches).toContainText("Recent struggle uses current answer streaks, not dated review history.");
  await leeches.getByRole("button", { name: "Expand Difficult items", exact: true }).click();
  const expanded = page.locator("dialog:modal").first();
  await expect(expanded.getByRole("combobox", { name: "Scoring method", exact: true })).toHaveValue("recent");
  await expanded.getByRole("button", { name: "Stuck in Apprentice", exact: true }).click();
  await expect(expanded.getByRole("checkbox", { name: "Never passed Guru", exact: true })).toBeChecked();
  await expect(expanded.getByRole("combobox", { name: "Sort difficult items", exact: true })).toHaveValue("stuck");
  const rows = expanded.locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  const waiting = await rows.evaluateAll((items) => items.map((item) => Number(item.textContent?.match(/(\d+) days since lesson/)?.[1] ?? "NaN")));
  expect(waiting.every(Number.isFinite)).toBe(true);
  expect(waiting).toEqual([...waiting].sort((a, b) => b - a));
  const practice = rows.first().getByRole("button");
  await practice.click();
  await expect(page.locator("dialog:modal")).toHaveCount(2);
  await page.locator("dialog:modal").last().getByRole("button", { name: "Reveal answer", exact: true }).click();
  await expect(page.locator("dialog:modal").last().getByRole("button", { name: "Know", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog:modal")).toHaveCount(1);
  await expect(practice).toBeFocused();
  await expect(expanded.getByRole("checkbox", { name: "Never passed Guru", exact: true })).toBeChecked();
});

test("typed practice switches meaning, reading, and both without keeping stale answers", async ({ page }, testInfo) => {
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" && request.url().includes("/api/wanikani/")) writes.push(request.url()); });
  await page.setViewportSize({ width: 320, height: 900 });
  await openAnalytics(page);
  await deepDive(page);
  const leeches = page.getByRole("region", { name: "Difficult items", exact: true });
  await leeches.locator("summary").filter({ hasText: /^Filters$/ }).click();
  await leeches.getByRole("combobox", { name: "Subject type", exact: true }).selectOption("kanji");
  await leeches.locator("summary").filter({ hasText: /^Practice options$/ }).click();
  await leeches.getByRole("button", { name: "Type answers", exact: true }).click();
  const first = leeches.locator("tbody tr").first();
  const meaning = await first.getByRole("link").locator("strong").innerText();
  await first.getByRole("button").click();
  const practice = page.getByRole("dialog", { name: "Difficult item practice", exact: true });
  const questions = practice.getByRole("group", { name: "Practice questions", exact: true });
  await expect(questions.getByRole("button", { name: "Both", exact: true })).toHaveAttribute("aria-pressed", "true");
  await practice.getByRole("textbox", { name: "Meaning", exact: true }).fill("not-the-meaning");
  await practice.getByRole("button", { name: "Check", exact: true }).click();
  await expect(practice.getByText("Incorrect", { exact: true })).toBeVisible();
  await questions.getByRole("button", { name: "Reading", exact: true }).click();
  await expect(practice.getByRole("textbox", { name: "Reading", exact: true })).toHaveValue("");
  await expect(practice.getByRole("progressbar")).toHaveAttribute("value", "0");
  await expect(practice.getByRole("progressbar")).toHaveAttribute("max", "1");
  await expect(practice.getByText("Incorrect", { exact: true })).toHaveCount(0);
  await questions.getByRole("button", { name: "Both", exact: true }).click();
  await expect(practice.getByRole("textbox", { name: "Meaning", exact: true })).toHaveValue("");
  await expect(practice.getByRole("progressbar")).toHaveAttribute("max", "2");
  await questions.getByRole("button", { name: "Meaning", exact: true }).click();
  await practice.getByRole("textbox", { name: "Meaning", exact: true }).fill(meaning);
  await practice.getByRole("button", { name: "Check", exact: true }).click();
  await expect(practice.getByText("Correct", { exact: true })).toBeVisible();
  await practice.getByRole("button", { name: "Next", exact: true }).click();
  await expect(practice.getByRole("heading", { name: "Practice complete", exact: true })).toBeVisible();
  await questions.getByRole("button", { name: "Reading", exact: true }).click();
  await expect(practice.getByRole("textbox", { name: "Reading", exact: true })).toHaveValue("");
  await expect(practice.getByRole("heading", { name: "Practice complete", exact: true })).toHaveCount(0);
  expect(await practice.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("typed-reading-320.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await leeches.getByRole("combobox", { name: "Subject type", exact: true }).selectOption("radical");
  await leeches.locator("tbody tr").first().getByRole("button").click();
  await practice.getByRole("group", { name: "Practice questions", exact: true }).getByRole("button", { name: "Reading", exact: true }).click();
  await expect(practice.getByRole("heading", { name: "No reading prompts", exact: true })).toBeVisible();
  await expect(practice.getByRole("heading", { name: "Practice complete", exact: true })).toHaveCount(0);
  await practice.getByRole("group", { name: "Practice questions", exact: true }).getByRole("button", { name: "Meaning", exact: true }).click();
  await expect(practice.getByRole("textbox", { name: "Meaning", exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test("all-subject catalog filters, grouping, CSV, and practice links work on desktop and mobile", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await openAnalytics(page);
  await deepDive(page);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const items = page.getByRole("region", { name: "Item explorer", exact: true });
    await items.getByRole("button", { name: "All subjects", exact: true }).click();
    await items.getByRole("button", { name: "Expand Item explorer", exact: true }).click();
    const expanded = page.locator("dialog:modal").first();
    await expanded.getByRole("button", { name: "Reset filters", exact: true }).click();
    await expanded.getByRole("combobox", { name: "Subject type", exact: true }).selectOption("kanji");
    await expanded.getByRole("textbox", { name: "Reading", exact: true }).fill("nichi");
    await expanded.getByRole("spinbutton", { name: "From level", exact: true }).fill("2");
    await expanded.getByRole("spinbutton", { name: "To level", exact: true }).fill("2");
    await expect(expanded.getByRole("link", { name: "日", exact: true })).toBeVisible();
    await expanded.getByRole("button", { name: "Reset filters", exact: true }).click();
    await expanded.getByRole("combobox", { name: "Subject type", exact: true }).selectOption("vocabulary");
    await expanded.getByRole("button", { name: "Vocab type", exact: true }).click();
    const vocabulary = page.getByRole("dialog", { name: "Vocabulary type", exact: true });
    const noun = vocabulary.getByRole("checkbox", { name: "Noun", exact: true });
    const nounAvailable = await noun.count() > 0;
    if (nounAvailable) await noun.check();
    else {
      await expect(vocabulary).toContainText("No matching types.");
      testInfo.annotations.push({ type: "Demo data", description: "The demo catalog does not include parts of speech; the selector empty state is exercised. Positive POS filtering is covered by analytics-items unit fixtures." });
    }
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog:modal")).toHaveCount(1);
    await expect(expanded.getByRole("button", { name: nounAvailable ? "Vocab type, Noun" : "Vocab type", exact: true })).toBeFocused();
    await expanded.getByRole("combobox", { name: "SRS substage", exact: true }).selectOption("9");
    await expanded.getByRole("combobox", { name: "Review availability", exact: true }).selectOption("now");
    await expect(expanded).toContainText("No subjects match these filters.");
    await expanded.getByRole("button", { name: "Reset filters", exact: true }).click();
    await expanded.getByRole("combobox", { name: "Review availability", exact: true }).selectOption("today");
    await expanded.getByRole("combobox", { name: "Group by", exact: true }).selectOption("stage");
    expect(await expanded.getByRole("heading", { level: 3 }).count()).toBeGreaterThan(0);
    await expect(expanded.getByRole("link", { name: /^Practice \d+ items$/ })).toHaveAttribute("href", /^\/study\/custom-review\?subjectIds=\d+(,\d+)*&start=1$/);
    await expect(expanded.getByRole("link", { name: "Saved decks", exact: true })).toHaveAttribute("href", "/lists");
    const csvPromise = page.waitForEvent("download");
    await expanded.getByRole("button", { name: "Export filtered subjects CSV", exact: true }).click();
    const csv = await readFile((await (await csvPromise).path())!, "utf8");
    expect(csv).toContain('"ID","Type","Character","Meaning","Reading","Level","SRS stage","Next review"');
    expect(csv.split("\r\n").length).toBeGreaterThan(1);
    expect(await expanded.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`all-subjects-${width}.png`), animations: "disabled" });
    await page.keyboard.press("Escape");
  }
});

test("fastest sessions, promotion tiers, and hourly activity expose schedules and source data", async ({ page }) => {
  await openAnalytics(page);
  await deepDive(page);
  await page.getByRole("button", { name: "Expand Current level", exact: true }).click();
  const route = page.getByRole("region", { name: "Fastest level review plan", exact: true });
  await expect(route.getByRole("button", { name: "Export sessions", exact: true })).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await route.getByRole("button", { name: "Export sessions", exact: true }).click();
  const calendar = await readFile((await (await downloadPromise).path())!, "utf8");
  expect(calendar).toContain("BEGIN:VCALENDAR");
  expect(calendar).toContain("BEGIN:VEVENT");
  await route.locator("tbody tr").first().getByRole("button").click();
  await expect(route.getByRole("table")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Expand Review workload", exact: true }).click();
  const promotions = page.getByRole("region", { name: "Upcoming SRS promotions", exact: true });
  for (const horizon of ["24 hours", "7 days", "30 days"]) {
    await promotions.getByRole("button", { name: horizon, exact: true }).click();
    await expect(promotions.getByRole("button", { name: horizon, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  for (const tier of ["Guru", "Master", "Enlightened", "Burned"]) {
    const filter = promotions.getByRole("button", { name: new RegExp(`^${tier} \\(`) });
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    const labels = await promotions.locator("tbody tr td:nth-child(2)").allTextContents();
    expect(labels.every((label) => label.endsWith(tier))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Expand Study activity", exact: true }).click();
  const activity = page.locator("dialog:modal");
  await expect(activity).toContainText("7-day average");
  await expect(activity).toContainText("Best day in period");
  await activity.getByRole("combobox", { name: "Activity display", exact: true }).selectOption("hourly");
  await expect((await chartData(analyticsChart(activity, "lessons by local hour"))).locator("tbody tr")).toHaveCount(24);
  await activity.getByRole("button", { name: "Reviews", exact: true }).click();
  await expect((await chartData(analyticsChart(activity, "reviews by local hour"))).locator("tbody tr")).toHaveCount(24);
});

test("CSV and every share image format export usable, nonblank files", async ({ page }) => {
  await openAnalytics(page);
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export activity CSV", exact: true }).click();
  const csvDownload = await csvPromise;
  const csv = await readFile((await csvDownload.path())!, "utf8");
  expect(csv).toContain('"Date","Lessons","Burns","Reviews"');
  expect(csv.split(/\r?\n/).length).toBeGreaterThan(30);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const share = page.getByRole("dialog", { name: "Share your progress", exact: true });
  await share.getByRole("checkbox", { name: "Hide username", exact: true }).check();
  for (const format of ["stats", "kanji", "activity"]) {
    const previous = await share.getByRole("img", { name: "Your progress image preview" }).getAttribute("src");
    await share.getByRole("combobox", { name: "Format", exact: true }).selectOption(format);
    if (format !== "stats") await expect(share.getByRole("img", { name: "Your progress image preview" })).not.toHaveAttribute("src", previous!);
    await expect(share.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await share.getByRole("button", { name: "Download PNG", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`kakehashi-${format}.png`);
    const buffer = await readFile((await download.path())!);
    expect(buffer.byteLength).toBeGreaterThan(10_000);
    const pixels = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 64; canvas.height = 64;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0, 64, 64);
      const data = context.getImageData(0, 0, 64, 64).data;
      const colors = new Set<string>();
      for (let index = 0; index < data.length; index += 4) colors.add(`${data[index]}-${data[index + 1]}-${data[index + 2]}`);
      return { width: image.naturalWidth, height: image.naturalHeight, colors: colors.size };
    }, buffer.toString("base64"));
    expect(pixels.width).toBe(1440);
    expect(pixels.height).toBeGreaterThanOrEqual(900);
    expect(pixels.colors).toBeGreaterThan(20);
  }
});

test("accuracy, SRS, schedule, activity, burns, and achievement controls show their drilldowns", async ({ page }) => {
  test.setTimeout(90_000);
  await openAnalytics(page);
  await deepDive(page);
  const accuracy = page.getByRole("region", { name: "Accuracy", exact: true });
  for (const grouping of ["SRS stage", "Level", "Type"]) {
    await accuracy.getByRole("button", { name: grouping, exact: true }).click();
    await expect(accuracy.getByRole("button", { name: grouping, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  for (const metric of ["meaning", "reading", "effective", "overall"]) {
    await accuracy.getByRole("combobox", { name: "Metric", exact: true }).selectOption(metric);
    const typeChart = analyticsChart(accuracy, "Accuracy by type");
    await expectDrawn(typeChart);
    expect(await (await chartData(typeChart)).locator("tbody tr").count()).toBeGreaterThan(0);
    await closeChartData(typeChart);
  }
  const srs = page.getByRole("region", { name: "SRS distribution", exact: true });
  await srs.getByRole("button", { name: "Kanji", exact: true }).click();
  await srs.getByRole("button", { name: /^Guru:/ }).click();
  await expect(srs.getByRole("table")).toBeVisible();
  await srs.getByRole("textbox", { name: "Search items", exact: true }).fill("no-such-subject-987654");
  await expect(srs).toContainText("No items match these filters.");
  await srs.getByRole("textbox", { name: "Search items", exact: true }).fill("");
  await expect(srs.getByRole("table")).toBeVisible();
  const schedule = page.getByRole("region", { name: "Review workload", exact: true });
  const chart = analyticsChart(schedule, "Currently scheduled reviews");
  const scheduleData = await chartData(chart);
  await expect(scheduleData.locator("tbody tr")).toHaveCount(7);
  await scheduleData.getByRole("button").first().click();
  await closeChartData(chart);
  await expect(schedule.getByRole("table")).toBeVisible();
  await schedule.getByRole("button", { name: "Clear selection", exact: true }).click();
  await schedule.getByRole("button", { name: "24 hours", exact: true }).click();
  await expect((await chartData(chart)).locator("tbody tr")).toHaveCount(24);
  await closeChartData(chart);
  await schedule.getByRole("button", { name: "Review chart options", exact: true }).click();
  await schedule.getByRole("spinbutton", { name: "Seconds per item", exact: true }).fill("30");
  await expect(schedule.getByRole("spinbutton", { name: "Seconds per item", exact: true })).toHaveValue("30");
  const activity = page.getByRole("region", { name: "Study activity", exact: true });
  await activity.getByRole("button", { name: "Burns", exact: true }).click();
  await expect(activity.locator('button[aria-label$=" burns"][tabindex="0"]')).toHaveCount(1);
  const lastDay = activity.locator('button[aria-label$=" burns"][tabindex="0"]');
  const originalDate = await lastDay.getAttribute("aria-label");
  await lastDay.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(activity.locator('button[aria-label$=" burns"][tabindex="0"]')).not.toHaveAttribute("aria-label", originalDate!);
  await activity.getByRole("button", { name: /: [1-9]\d* burns$/ }).first().click();
  await expect(activity.getByRole("table")).toBeVisible();
  await activity.getByRole("button", { name: "Close day", exact: true }).click();
  await activity.getByRole("combobox", { name: "Activity display", exact: true }).selectOption("bars");
  await expect(activity.getByRole("group", { name: "burns per day", exact: true })).toBeVisible();
  const burns = page.getByRole("region", { name: "Burn progress", exact: true });
  for (const mode of ["Cumulative", "Upcoming", "Monthly"]) {
    await burns.getByRole("button", { name: mode, exact: true }).click();
    await expect(burns.getByRole("button", { name: mode, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  const burnChart = analyticsChart(burns, "Recorded burns");
  await (await chartData(burnChart)).getByRole("button").last().click();
  await closeChartData(burnChart);
  await expect(burns.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Expand Achievements", exact: true }).click();
  const achievements = page.locator("dialog:modal").first();
  await achievements.getByRole("button", { name: "Earned", exact: true }).click();
  const medal = achievements.getByRole("button", { name: /, earned$/ }).first();
  await medal.click();
  await expect(page.locator("dialog:modal")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog:modal")).toHaveCount(1);
  await expect(medal).toBeFocused();
  await achievements.getByRole("textbox", { name: "Search medals", exact: true }).fill("no-such-medal-987654");
  await expect(achievements).toContainText("No achievements in this group yet.");
  await page.keyboard.press("Escape");
  const study = page.getByRole("region", { name: "Study time", exact: true });
  for (const range of ["Today", "Month", "All", "Week"]) {
    await study.getByRole("button", { name: range, exact: true }).click();
    await expect(study.getByRole("button", { name: range, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
});

test("stacked Recharts bars use a common baseline and heights proportional to visible source values", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAnalytics(page);
  await deepDive(page);
  const chart = analyticsChart(page, "Currently scheduled reviews");
  const values = await (await chartData(chart)).evaluate((table) => {
    const series = Array.from(table.querySelectorAll("thead th")).slice(1).map((cell) => cell.textContent!.trim());
    return Array.from(table.querySelectorAll("tbody tr")).map((row) => Object.fromEntries(Array.from(row.querySelectorAll("td")).map((cell, index) => [series[index], Number(cell.textContent!.replaceAll(",", ""))])));
  });
  await closeChartData(chart);
  await expectDrawn(chart);
  const geometry = await chart.locator(".recharts-rectangle").evaluateAll((bars) => bars.map((bar) => {
    const bounds = bar.getBoundingClientRect();
    return { series: bar.getAttribute("name")!, x: bounds.x, top: bounds.top, bottom: bounds.bottom, height: bounds.height };
  }));
  const positions = [...new Set(geometry.map((bar) => bar.x))].sort((a, b) => a - b);
  expect(positions).toHaveLength(values.length);
  expect(geometry.length).toBeGreaterThan(10);
  const scale = geometry[0].height / values[positions.indexOf(geometry[0].x)][geometry[0].series];
  const baselines: number[] = [];
  for (const [index, x] of positions.entries()) {
    const stack = geometry.filter((bar) => bar.x === x).sort((a, b) => b.bottom - a.bottom);
    expect(stack).toHaveLength(Object.values(values[index]).filter((value) => value > 0).length);
    baselines.push(stack[0].bottom);
    for (const [stage, bar] of stack.entries()) {
      expect(Math.abs(bar.height - values[index][bar.series] * scale)).toBeLessThan(0.1);
      if (stage > 0) expect(Math.abs(bar.bottom - stack[stage - 1].top)).toBeLessThan(0.1);
    }
  }
  expect(Math.max(...baselines) - Math.min(...baselines)).toBeLessThan(0.1);
});

test("expanded mobile widgets keep charts and numeric metrics within their dialogs", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 900 });
  await openAnalytics(page);
  await deepDive(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const problems: string[] = [];
  const labels = await page.locator('button[aria-label^="Expand "]').evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")!));
  for (const label of labels) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const dialog = page.locator("dialog:modal");
    await expect(dialog).toHaveCount(1);
    if (label === "Expand Review forecast") {
      await dialog.getByRole("button", { name: "180 days", exact: true }).click();
      await dialog.getByRole("button", { name: "Daily", exact: true }).click();
    }
    const layout = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const wrappedNumbers = Array.from(element.querySelectorAll("dd")).filter((metric) => {
        if (!/^[\d,.]+%?$/.test(metric.textContent?.trim() ?? "")) return false;
        const range = document.createRange();
        range.selectNodeContents(metric);
        return new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))).size > 1;
      }).map((metric) => metric.textContent);
      return { outside: bounds.left < 0 || bounds.right > innerWidth, overflow: element.scrollWidth > element.clientWidth + 1, wrappedNumbers };
    });
    if (layout.outside || layout.overflow || layout.wrappedNumbers.length) problems.push(`${label}: ${JSON.stringify(layout)}`);
    if (["Expand Review forecast", "Expand Reading readiness", "Expand Review history"].includes(label)) await page.screenshot({ path: testInfo.outputPath(`${label.replaceAll(" ", "-").toLowerCase()}-320.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(problems).toEqual([]);
});

test("all widgets fit desktop and mobile in both themes", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await openAnalytics(page);
  await deepDive(page);
  const layoutProblems: string[] = [];
  for (const theme of ["light", "dark"]) {
    const themeButton = page.getByRole("button", { name: `Switch to ${theme} theme`, exact: true });
    if (await themeButton.count()) await themeButton.click();
    for (const width of [320, 375, 414, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const clippedControls = await page.locator("main button, main h2, main label").evaluateAll((elements) => elements.filter((element) => {
        const html = element as HTMLElement;
        if (!html.checkVisibility()) return false;
        return html.getBoundingClientRect().width > 0 && html.scrollWidth > html.clientWidth + 3 && getComputedStyle(html).overflowX !== "auto";
      }).map((element) => element.getAttribute("aria-label") ?? element.textContent));
      const overlappingLabels = await page.locator('[data-chart-kind]:not([data-chart-kind="donut"])').evaluateAll((charts) => charts.flatMap((chart) => {
        const labels = Array.from(chart.querySelectorAll(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value")).filter((label) => label.checkVisibility() && label.textContent && label.getBoundingClientRect().width > 0).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        return labels.slice(1).filter((label, index) => label.getBoundingClientRect().left < labels[index].getBoundingClientRect().right - 1).map((label) => `${chart.getAttribute("aria-label")}: ${label.textContent}`);
      }));
      layoutProblems.push(...clippedControls.map((label) => `${width}px ${theme}: clipped ${label}`), ...overlappingLabels.map((label) => `${width}px ${theme}: overlapping ${label}`));
      await page.screenshot({ path: testInfo.outputPath(`analytics-${width}-${theme}.png`), fullPage: true });
    }
  }
  expect(layoutProblems).toEqual([]);
});
