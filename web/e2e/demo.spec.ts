import { expect, test, type Page } from "@playwright/test";

async function openDemo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("complementary", { name: "Demo account", exact: true })).toContainText("Level 21");
}

const quizModes = ["recent-lessons", "random-test", "vocab-reading", "hiragana-meaning", "kana-to-kanji", "audio-vocab", "listening", "context-sentences"];
const gameModes = ["similar-kanji", "kanji-writing", "crossword", "word-search", "kana-wordle"];

for (const mode of [...quizModes, ...gameModes]) {
  test(`demo starts ${mode} with no WaniKani requests`, async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => { if (request.url().includes("/api/wanikani/")) requests.push(request.url()); });
    await openDemo(page);
    await page.goto(`/study/${mode}`);
    const start = page.getByRole("button", { name: mode === "word-search" ? "Build puzzle" : "Start session", exact: true });
    await expect(start).toBeEnabled();
    await start.click();
    await expect(page.locator('[data-study-session="active"]')).toBeVisible();
    await expect(page.getByText(/No matching|No similar groups|No .*vocabulary was found|could not be prepared|Study data didn’t load/)).toHaveCount(0);
    if (quizModes.includes(mode)) await expect(page.locator('[data-study-session="active"] input, [data-study-session="active"] [class*="choice"]').first()).toBeVisible();
    if (mode === "crossword") {
      await page.getByRole("button", { name: "Reveal word", exact: true }).click();
      await expect(page.getByLabel("Crossword grid").locator('[data-completed="true"]').first()).toBeVisible();
    }
    if (mode === "kana-wordle") await expect(page.getByLabel("Guess in kana or romaji")).toBeEnabled();
    if (mode === "similar-kanji") {
      await page.locator('[aria-label="Kanji choices"] button').first().click();
      await expect(page.locator('[aria-label="Meaning choices"] button').first()).toBeEnabled();
    }
    expect(requests).toEqual([]);
  });
}

test("demo crossword keeps the board size when showing a hint in the footer", async ({ page }) => {
  await openDemo(page);
  await page.goto("/study/crossword");
  await page.getByRole("button", { name: "Start session", exact: true }).click();
  const grid = page.getByLabel("Crossword grid", { exact: true });
  const viewport = grid.locator("..");
  await expect(grid).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const before = { grid: await grid.boundingBox(), viewport: await viewport.boundingBox() };
  expect(before.grid).not.toBeNull();
  expect(before.viewport).not.toBeNull();

  await page.getByRole("button", { name: "Show hint", exact: true }).click();
  const hint = page.locator('[data-study-session="active"]').getByText(/^(Written as |Meaning: |\d+ kana$)/);
  await expect(hint).toBeVisible();
  const after = { grid: await grid.boundingBox(), viewport: await viewport.boundingBox() };
  expect(after.grid).not.toBeNull();
  expect(after.viewport).not.toBeNull();
  for (const element of ["grid", "viewport"] as const) {
    for (const dimension of ["x", "y", "width", "height"] as const) {
      expect.soft(Math.abs(after[element]![dimension] - before[element]![dimension]), `${element} ${dimension} changed after showing a hint`).toBeLessThanOrEqual(1);
    }
  }
  await expect(hint.locator("xpath=ancestor::footer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check puzzle", exact: true })).toHaveCount(0);
});

for (const mode of ["custom-review", "custom-lessons"]) {
  test(`demo selects subjects for ${mode}`, async ({ page }) => {
    await openDemo(page);
    await page.goto(`/study/${mode}`);
    await page.getByRole("button", { name: /^Select (all|filtered)$/ }).first().click();
    await page.getByRole("button", { name: mode === "custom-review" ? "Start review" : "Start lessons", exact: true }).click();
    await expect(page.locator('[data-study-session="active"]')).toBeVisible();
    await expect(page.getByText("No subjects selected", { exact: true })).toHaveCount(0);
  });
}

test("demo exposes content tabs, additional destinations, sample media, text analysis, and editable local lists", async ({ page }) => {
  await openDemo(page);
  const nav = page.getByRole("navigation", { name: "Main navigation", exact: true });
  for (const name of ["Home", "Level", "News", "Books", "Video", "Manga", "Songs"]) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  for (const name of ["Extra study", "Items", "Analytics"]) await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "More destinations", exact: true }).click();
  const more = page.getByRole("navigation", { name: "All destinations", exact: true });
  for (const name of ["Extra study", "Items", "Analytics"]) await expect(more.getByRole("link", { name, exact: true })).toBeVisible();
  await page.getByRole("dialog", { name: "All destinations" }).getByRole("button", { name: "Close More menu" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.goto("/manga");
  await page.getByRole("link", { name: /葬送のフリーレン/ }).first().click();
  await expect(page).toHaveURL(/\/manga\/demo-frieren-opening/);
  await expect(page.locator('img').filter({ visible: true }).last()).toBeVisible();
  await page.goto("/video");
  await expect(page.getByText("A Day in Japan / Easy Japanese for Beginners (N5–N4)", { exact: true })).toBeVisible();
  await expect(page.getByText("A Day in my Life in Sendai, Japan!【Comprehensible Japanese】", { exact: true })).toBeVisible();
  await page.goto("/study/text-analysis");
  await expect(page.locator("textarea").first()).not.toHaveValue("");
  await page.goto("/study/subject-lists");
  await page.getByLabel("New list", { exact: true }).fill("My demo practice");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My demo practice", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /My demo practice/ })).toBeVisible();
});

test("demo can connect later, survives reload, and never changes the personal library", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("kakehashi:content:v1:library:manga", JSON.stringify([{ id: "personal", title: "Personal upload" }])));
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.reload();
  await page.getByRole("link", { name: "Connect your account", exact: true }).click();
  await expect(page.getByLabel("API token", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByRole("button", { name: "Continue demo", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "More destinations", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kakehashi:content:v1:library:manga")!))).toEqual([{ id: "personal", title: "Personal upload" }]);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => ["kakehashi_wk_session", "kakehashi_demo_session"].includes(cookie.name))).toBe(false);
});

test("demo level views show radicals, mixed progress, and varied completion times", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Level", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Level 21 progress", exact: true })).toBeVisible();
  await expect(page.locator('a[data-type="radical"]')).toHaveCount(8);
  await expect(page.locator('a[data-type="radical"][data-status="passed"]').first()).toBeVisible();
  await expect(page.locator('a[data-type="radical"][data-status="started"]').first()).toBeVisible();
  await expect(page.locator('a[data-type="kanji"][data-status="passed"]').first()).toBeVisible();
  await page.getByRole("link", { name: "Open level 21 recap", exact: true }).click();
  await expect(page.locator('[data-level-subject-type="radical"] li')).toHaveCount(8);
  const timings: string[] = [];
  for (const level of [19, 20]) {
    await page.goto(`/progress/wrapped/${level}`);
    const timing = page.locator("dl > div").filter({ has: page.getByText("Time to pass", { exact: true }) }).locator("dd");
    await expect(timing).toHaveText(/\d.* days/);
    timings.push((await timing.textContent())!);
  }
  expect(new Set(timings).size).toBe(2);
  await page.reload();
  await expect(page.locator("dl > div").filter({ has: page.getByText("Time to pass", { exact: true }) }).locator("dd")).toHaveText(timings[1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

for (const mode of ["lessons", "reviews"]) {
  test(`demo runs the main ${mode} queue locally`, async ({ page }) => {
    const outbound: string[] = [];
    page.on("request", (request) => { if (/\/api\/wanikani\/(assignments|reviews|subjects)/.test(request.url())) outbound.push(request.url()); });
    await openDemo(page);
    await page.getByRole("link", { name: mode === "lessons" ? "Try lessons" : "Try reviews", exact: true }).click();
    if (mode === "lessons") {
      for (let index = 0; index < 4; index += 1) await page.getByRole("button", { name: "Next lesson", exact: true }).click();
      await page.getByRole("button", { name: "Start lesson review", exact: true }).click();
    }
    await expect(page.getByRole("textbox", { name: "Your answer", exact: true })).toBeVisible();
    expect(outbound).toEqual([]);
  });
}
