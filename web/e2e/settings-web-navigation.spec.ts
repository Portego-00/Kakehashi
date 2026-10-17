import { test, expect, type Page } from "@playwright/test";
const timestamp = "2026-10-12T10:00:00.000Z";
async function settings(page: Page, username = "Portego", demo = false) {
  const user = { id: 1, object: "user", url: "", data_updated_at: timestamp, data: { id: 1, username, level: 4, profile_url: "", started_at: timestamp, current_vacation_started_at: null, preferences: {}, subscription: { active: true, type: "lifetime", max_level_granted: 60 } } };
  await page.route("**/api/session/wanikani", (route) => route.fulfill({ json: { user, demo } }));
  await page.route("**/api/bunpro?**", (route) => route.fulfill({ json: { connected: true } }));
  await page.route("**/api/custom-srs**", (route) => route.fulfill({ json: { available: false, state: null, revision: -1 } }));
  await page.route("**/api/custom-vocabulary/**", (route) => route.fulfill({ json: { words: [], packs: [], available: false } }));
  await page.goto("/settings");
  await expect(page.getByRole("searchbox", { name: "Search settings" })).toBeVisible();
}
async function category(page: Page, name: string) {
  await page.getByRole("complementary", { name: "Settings categories" }).getByRole("button", { name, exact: true }).click();
}
test("workspace layout keeps its title above full-width navigation and dashboard controls", async ({ page }, info) => {
  const widths = info.project.name === "desktop" ? [1024, 1280, 1440] : [320, 375, 414, 768];
  await settings(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/settings?category=workspace");
    const workspace = page.locator('[data-settings-category="workspace"]');
    const title = workspace.getByRole("heading", { name: "Workspace layout", exact: true });
    await expect(title).toBeVisible();
    const navigation = workspace.getByRole("heading", { name: "Desktop navbar tabs", exact: true }).locator("..").locator("..");
    const editor = workspace.locator('[data-settings-search="Dashboard layout"]');
    const heading = workspace.locator(":scope > div").first();
    const [sectionBox, headingBox, navBox, editorBox] = await Promise.all([workspace.boundingBox(), heading.boundingBox(), navigation.boundingBox(), editor.boundingBox()]);
    expect(sectionBox).not.toBeNull(); expect(headingBox).not.toBeNull(); expect(navBox).not.toBeNull(); expect(editorBox).not.toBeNull();
    expect(headingBox!.y + headingBox!.height, `Title must be above navigation at ${width}px`).toBeLessThanOrEqual(navBox!.y);
    for (const [name, box] of [["Navigation", navBox!], ["Dashboard editor", editorBox!]] as const) {
      expect(Math.abs(box.x - sectionBox!.x), `${name} must align with the settings content at ${width}px`).toBeLessThanOrEqual(2);
      expect(box.width, `${name} must use the entire settings content width at ${width}px`).toBeGreaterThanOrEqual(sectionBox!.width - 2);
    }
    expect(editorBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`workspace-${width}.png`), fullPage: true });
  }
});
test("compact sidebar, animated disclosures, tooltips and section scroll reset", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.setViewportSize({ width: 1440, height: 900 });
  await settings(page);
  const sidebar = page.getByRole("complementary", { name: "Settings categories" });
  await expect(sidebar.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  expect(await sidebar.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
  const disclosure = page.locator("details").filter({ has: page.getByText("Review order", { exact: true }) });
  const summary = disclosure.locator("summary");
  const content = disclosure.locator(":scope > div");
  await summary.click();
  await expect.poll(() => disclosure.evaluate((node) => node.getAnimations({ subtree: true }).some((a) => a.playState === "running"))).toBe(true);
  await expect(page.getByRole("combobox", { name: "Review subject order", exact: true })).toBeVisible();
  await expect.poll(() => disclosure.evaluate((node) => node.getAnimations({ subtree: true }).some((a) => a.playState === "running"))).toBe(false);
  const fullHeight = await content.evaluate((node) => node.getBoundingClientRect().height);
  const caret = await page.getByRole("combobox", { name: "Review subject order", exact: true }).evaluate((node) => {
    const s = getComputedStyle(node); return { appearance: s.appearance, left: s.paddingLeft, right: s.paddingRight, position: s.backgroundPosition };
  });
  expect(caret).toMatchObject({ appearance: "none", left: "12px", right: "36px" });
  expect(caret.position).toContain("12px");
  await summary.click();
  await page.waitForTimeout(70);
  const closingHeight = await content.evaluate((node) => node.getBoundingClientRect().height);
  expect(closingHeight).toBeGreaterThan(0); expect(closingHeight).toBeLessThan(fullHeight);
  await expect(disclosure).not.toHaveAttribute("open", "");
  const help = page.getByRole("button", { name: "About Answer feedback sounds", exact: true });
  const checkbox = page.getByRole("checkbox", { name: "Answer feedback sounds", exact: true });
  const checked = await checkbox.isChecked();
  await help.hover(); await expect(page.getByRole("tooltip")).toContainText("feedback sound");
  await help.click(); expect(await checkbox.isChecked()).toBe(checked);
  await help.press("Escape"); await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await category(page, "Lessons");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.setViewportSize({ width: 1440, height: 560 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => sidebar.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  const before = await page.evaluate(() => window.scrollY);
  await sidebar.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  expect(await sidebar.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});
test("Bunpro controls persist, reveal conditional options and keep shared values", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await settings(page);
  await category(page, "Bunpro");
  const furigana = page.getByRole("checkbox", { name: "Hide Bunpro furigana", exact: true });
  await expect(furigana).toBeVisible();
  await furigana.setChecked(true, { force: true });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kakehashi-web:settings:portego:v1")!).study.bunproHideFurigana)).toBe(true);
  await page.getByRole("radiogroup", { name: "Bunpro answer mode", exact: true }).getByRole("radio", { name: "Anki cards" }).click();
  await page.getByText("Anki card details", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Group meaning and reading", exact: true })).toBeEnabled();
  await page.getByRole("radiogroup", { name: "Bunpro Anki applies to" }).getByRole("radio", { name: "Meanings", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Group meaning and reading", exact: true })).toBeDisabled();
  await page.reload();
  await expect(furigana).toBeChecked();
  await category(page, "Reviews");
  await expect(page.getByRole("radiogroup", { name: "Anki applies to", exact: true }).getByRole("radio", { name: "Meanings", exact: true })).toHaveAttribute("aria-checked", "true");
});
for (const session of [{ username: "OtherUser", demo: false }, { username: "Portego", demo: true }]) {
  test(`custom vocabulary settings hidden for ${session.username} demo=${session.demo}`, async ({ page }) => {
    await settings(page, session.username, session.demo);
    await expect(page.locator('[data-settings-category="custom"]')).toHaveCount(0);
    await page.getByRole("searchbox").fill("custom vocabulary schedule");
    await expect(page.getByRole("list", { name: "Settings search results" })).toHaveCount(0);
  });
}
test("search indexes hidden help and opens advanced controls with reduced motion", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settings(page);
  await page.getByRole("searchbox").fill("Kyoko");
  await page.getByRole("button", { name: /Voice actor/ }).click();
  await expect(page.getByRole("combobox", { name: "Voice actor", exact: true })).toBeFocused();
  await category(page, "Lessons");
  const details = page.locator("details").filter({ has: page.getByText("Workload limits", { exact: true }) });
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  expect(await details.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
});
test("narrow web settings keep controls in bounds and show help on tap", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await settings(page, "OtherUser");
  const picker = page.getByRole("combobox", { name: "Settings category", exact: true });
  await picker.selectOption("bunpro");
  const help = page.getByRole("button", { name: "About Answer feedback sounds", exact: true });
  await help.tap();
  await expect(page.getByRole("tooltip")).toContainText("correct and incorrect");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await picker.selectOption("lessons");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("combobox", { name: "Lesson batch size", exact: true })).toBeVisible();
});
