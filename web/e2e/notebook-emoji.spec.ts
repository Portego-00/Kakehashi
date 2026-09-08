import { expect, test, type Page } from "@playwright/test";

const DEMO_STORAGE = "kakehashi:notebooks:demo:v1";

async function createPage(page: Page, title: string) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const session = await page.request.post("/api/session/demo", { headers: { Origin: origin } });
  expect(session.ok()).toBe(true);
  await page.goto("/notebooks");
  await expect(page.locator("html")).toHaveAttribute("data-theme", /light|dark|midnight/);
  await expect(page.getByRole("complementary", { name: "Demo account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Empty page Start with/ }).click();
  await page.getByRole("textbox", { name: "Page title", exact: true }).fill(title);
  await expect(page.getByLabel("Notebook page content", { exact: true })).toBeVisible({ timeout: 45_000 });
}

async function expectSavedIcon(page: Page, icon: string) {
  const pageId = new URL(page.url()).pathname.split("/").at(-1);
  await expect.poll(() => page.evaluate(({ key, id }) => {
    const stored = JSON.parse(localStorage.getItem(key) || '{"state":{"pages":[]}}');
    return stored.state.pages.find((item: { id: string; icon: string }) => item.id === id)?.icon;
  }, { key: DEMO_STORAGE, id: pageId })).toBe(icon);
  await expect(page.getByRole("status").filter({ hasText: "Saved locally" })).toBeVisible();
}

async function expectSidebarIcon(page: Page, title: string, icon: string) {
  const pagesButton = page.getByRole("button", { name: "Pages", exact: true });
  const mobileSidebar = await pagesButton.isVisible();
  if (mobileSidebar) await pagesButton.click();
  const entry = page.getByRole("complementary", { name: "Notebook pages", exact: true }).getByRole("button", { name: title, exact: true });
  await expect(entry).toContainText(icon);
  if (mobileSidebar) await entry.click();
}

test("notebook emoji suggestions and the full catalogue save to the page and sidebar", async ({ page, isMobile }, testInfo) => {
  test.setTimeout(90_000);
  const title = "Language discoveries";
  await createPage(page, title);
  const trigger = page.getByRole("button", { name: "Change page emoji", exact: true });
  const dialog = page.getByRole("dialog", { name: "Page emoji", exact: true });
  await expect(trigger).toHaveText("📓");
  await trigger.click();
  const search = dialog.getByRole("searchbox", { name: "Search emojis", exact: true });
  await expect(search).toBeFocused();
  const suggested = dialog.getByRole("region", { name: "Suggested emojis", exact: true });
  if (!isMobile) {
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("combobox", { name: "Emoji category", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(suggested.getByRole("button", { name: "open book", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(suggested.getByRole("button", { name: "writing hand", exact: true })).toBeFocused();
    await page.keyboard.press("End");
    await expect(suggested.getByRole("button", { name: "sparkles", exact: true })).toBeFocused();
  }
  const allEmojis = dialog.getByRole("region", { name: "Emoji results", exact: true });
  const initialButtonCount = await allEmojis.getByRole("button").count();
  await allEmojis.getByRole("button", { name: "Show more emojis", exact: true }).click();
  await expect(allEmojis.getByRole("button")).toHaveCount(initialButtonCount + 120);
  await suggested.getByRole("button", { name: "cherry blossom", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toHaveText("🌸");
  await expectSavedIcon(page, "🌸");
  await expectSidebarIcon(page, title, "🌸");

  // A Unicode 17 addition and a joined skin-tone sequence are searchable beyond the suggestions.
  await trigger.click();
  await expect(search).toBeFocused();
  await search.fill("orca");
  await dialog.getByRole("region", { name: "Emoji results", exact: true }).getByRole("button", { name: "orca", exact: true }).click();
  await expect(trigger).toHaveText("🫍");
  await expectSavedIcon(page, "🫍");
  await trigger.click();
  await search.fill("astronaut medium skin tone");
  await dialog.getByRole("button", { name: "astronaut: medium skin tone", exact: true }).click();
  await expect(trigger).toHaveText("🧑🏽‍🚀");
  await expectSavedIcon(page, "🧑🏽‍🚀");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toHaveValue(title);
  await expect(trigger).toHaveText("🧑🏽‍🚀");
  await expectSidebarIcon(page, title, "🧑🏽‍🚀");
  await trigger.click();
  await expect(search).toBeFocused();
  await testInfo.attach("Notebook emoji picker", { body: await page.screenshot({ path: testInfo.outputPath("emoji-picker.png"), fullPage: true }), contentType: "image/png" });
});

test("notebook emoji browsing, cancellation, and reset fit narrow screens", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const titleText = "Japanese language discoveries and reading notes from an especially interesting journey";
  await page.setViewportSize({ width: 375, height: 812 });
  await createPage(page, titleText);
  const title = page.getByRole("textbox", { name: "Page title", exact: true });
  const trigger = page.getByRole("button", { name: "Change page emoji", exact: true });
  const dialog = page.getByRole("dialog", { name: "Page emoji", exact: true });
  await trigger.click();
  const search = dialog.getByRole("searchbox", { name: "Search emojis", exact: true });
  const results = dialog.getByRole("region", { name: "Emoji results", exact: true });
  await search.fill("no-such-emoji-9347");
  await expect(results.getByRole("button")).toHaveCount(0);
  await search.fill("japan");
  await dialog.getByRole("combobox", { name: "Emoji category", exact: true }).selectOption({ label: "Flags" });
  await results.getByRole("button", { name: "flag: Japan", exact: true }).click();
  await expectSavedIcon(page, "🇯🇵");

  await trigger.click();
  await search.fill("fox");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText("🇯🇵");
  await trigger.click();
  await dialog.getByRole("button", { name: "Close emoji picker", exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText("🇯🇵");

  await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await trigger.click();
  await expect(search).toBeFocused();
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await expect.poll(() => dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await expect.poll(() => title.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await expect.poll(() => title.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  }
  await testInfo.attach("Narrow notebook emoji picker in dark theme", { body: await page.screenshot({ path: testInfo.outputPath("emoji-picker-dark.png"), fullPage: true }), contentType: "image/png" });
  await dialog.getByRole("button", { name: "Reset icon", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toHaveText("📓");
  await expectSavedIcon(page, "");
  await title.fill(`${titleText} in Japan`);
  await title.blur();
  await expect(page.getByRole("status").filter({ hasText: "Saved locally" })).toBeVisible();
  await page.reload();
  await expect(title).toHaveValue(`${titleText} in Japan`);
  await expect(trigger).toHaveText("📓");
});
