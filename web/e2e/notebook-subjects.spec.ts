import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { EXAMPLE_NOTEBOOK_PAGE_IDS } from "../src/features/notebooks/example-notebook";

const screenshotPath = (name: string) => fileURLToPath(new URL(`../../output/notebooks/${name}`, import.meta.url));
const DEMO_STORAGE = "kakehashi:notebooks:demo:v1";

async function openExample(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
  await page.goto("/notebooks");
  await expect(page.getByRole("button", { name: "Delete example notebook", exact: true })).toBeVisible();
  await page.goto(`/notebooks/${EXAMPLE_NOTEBOOK_PAGE_IDS.context}`);
  await expect(page.getByLabel("Notebook page content", { exact: true })).toBeVisible();
}

async function openSubjectPicker(page: Page) {
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole("toolbar", { name: "Notebook study tools" }).getByRole("button", { name: "Word", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Link a subject", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Search subjects", exact: true }).fill("山");
  return dialog;
}

test("notebooks insert all subject types and preserve editing while opening rich references", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openExample(page);
  const notebookUrl = page.url();
  const editor = page.getByLabel("Notebook page content", { exact: true });

  for (const [kind, filter, japanese, meaning] of [["radical", "Radicals", "一", "Ground"], ["kanji", "Kanji", "山", "Mountain"], ["vocabulary", "Vocabulary", "山", "Mountain"]] as const) {
    const references = editor.locator(`[data-content-type="vocabulary"] a[data-kind="${kind}"]`);
    const previousCount = await references.count();
    await editor.locator('[data-content-type="paragraph"]').first().click();
    const dialog = await openSubjectPicker(page);
    await dialog.getByRole("textbox", { name: "Search subjects", exact: true }).fill(japanese);
    await dialog.getByRole("group", { name: "Subject type", exact: true }).getByRole("button", { name: filter, exact: true }).click();
    const result = dialog.getByRole("button", { name: `Link ${kind}: ${japanese}, ${meaning}`, exact: true });
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute("data-type", kind);
    const color = await result.evaluate((element) => {
      const style = getComputedStyle(element);
      return { actual: style.getPropertyValue("--subject-color").trim(), expected: style.getPropertyValue(`--color-${element.getAttribute("data-type")}`).trim() };
    });
    expect(color.actual).toBe(color.expected);
    if (kind === "kanji") await page.screenshot({ path: screenshotPath("subject-picker-desktop.png") });
    await result.click();
    await expect(dialog).not.toBeVisible();
    await expect(references).toHaveCount(previousCount + 1);
    await expect(references.last()).toHaveAttribute("target", "_blank");
  }

  const inlineMentions = editor.locator('[data-inline-content-type="vocabularyMention"] a[data-kind="kanji"]');
  const initialInlineCount = await inlineMentions.count();
  await editor.locator('[data-content-type="paragraph"]').first().click();
  const dialog = await openSubjectPicker(page);
  await dialog.getByLabel("Insert within the text", { exact: true }).check();
  await dialog.getByRole("group", { name: "Subject type", exact: true }).getByRole("button", { name: "Kanji", exact: true }).click();
  await dialog.getByRole("button", { name: "Link kanji: 山, Mountain", exact: true }).click();
  await expect(inlineMentions).toHaveCount(initialInlineCount + 1);
  const inline = inlineMentions.first();

  const colors = await Promise.all(["radical", "kanji", "vocabulary"].map((kind) => editor.locator(`[data-content-type="vocabulary"] a[data-kind="${kind}"]`).last().evaluate((element) => {
    const style = getComputedStyle(element);
    return { actual: style.getPropertyValue("--reference-color").trim(), expected: style.getPropertyValue(`--color-${element.getAttribute("data-kind")}-ink`).trim() };
  })));
  for (const color of colors) expect(color.actual).toBe(color.expected);
  expect(new Set(colors.map((color) => color.actual)).size).toBe(3);

  const vocabulary = editor.locator('[data-content-type="vocabulary"] a[data-kind="vocabulary"]').last();
  await vocabulary.hover();
  let preview = page.getByRole("dialog", { name: "山 details", exact: true });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Reading");
  await expect(preview).toContainText("Meaning");
  await expect(preview).toContainText("Mountain");
  await expect(preview.getByRole("link", { name: "View details", exact: true })).toHaveAttribute("target", "_blank");
  await page.screenshot({ path: screenshotPath("subject-hover-preview.png") });
  await page.getByLabel("Page title", { exact: true }).click();
  await expect(preview).not.toBeVisible();
  await inline.focus();
  preview = page.getByRole("dialog", { name: "山 details", exact: true });
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).not.toBeVisible();

  await expect.poll(() => page.evaluate((key) => JSON.stringify(JSON.parse(localStorage.getItem(key)!).state.pages), DEMO_STORAGE)).toContain('"vocabularyMention"');
  const href = await inline.getAttribute("href");
  const popupPromise = page.waitForEvent("popup");
  await inline.click();
  const subjectPage = await popupPromise;
  await expect(subjectPage).toHaveURL(new RegExp(`${href}$`));
  await expect(page).toHaveURL(notebookUrl);
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("Japanese in context");
  await subjectPage.close();
  await page.reload();
  await expect(inlineMentions).toHaveCount(initialInlineCount + 1);
  for (const kind of ["radical", "kanji", "vocabulary"]) await expect(editor.locator(`[data-content-type="vocabulary"] a[data-kind="${kind}"]`).last()).toBeAttached();
  expect(errors).toEqual([]);
});

test("the mobile subject picker fits and shared sentences keep a compact usable footer", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await openExample(page);
  const editor = page.getByLabel("Notebook page content", { exact: true });
  const sentence = editor.locator('[data-content-type="sentence"]').first();
  await expect(sentence).not.toContainText("やまがみえます。");
  await expect(sentence).not.toContainText("Shared sentence");
  await expect(sentence).not.toContainText("Connected sentence");
  const word = sentence.getByRole("link", { name: "山", exact: true });
  const translation = sentence.getByRole("button", { name: "Translation", exact: true });
  await sentence.scrollIntoViewIfNeeded();
  const wordBounds = await word.boundingBox();
  const translationBounds = await translation.boundingBox();
  expect(Math.abs(wordBounds!.y - translationBounds!.y)).toBeLessThan(8);
  const panelId = await translation.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();
  const panel = sentence.locator(`[id="${panelId}"]`);
  await expect(translation).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  expect(await panel.evaluate((element) => getComputedStyle(element).transitionDuration.split(",").some((duration) => parseFloat(duration) > 0))).toBe(true);
  await translation.click();
  await expect(translation).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  await expect(sentence.getByText("I can see a mountain.", { exact: true })).toBeVisible();
  await expect.poll(() => panel.evaluate((element) => parseFloat(getComputedStyle(element).gridTemplateRows))).toBeGreaterThan(0);
  await expect.poll(() => panel.evaluate((element) => element.getAnimations().some((animation) => animation.playState === "running"))).toBe(false);
  const openedBounds = await translation.boundingBox();
  expect(Math.abs(openedBounds!.x - translationBounds!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(openedBounds!.y - translationBounds!.y)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: screenshotPath("sentence-translation-mobile.png") });
  await translation.click();
  await expect(translation).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => panel.evaluate((element) => parseFloat(getComputedStyle(element).gridTemplateRows))).toBe(0);
  const closedBounds = await translation.boundingBox();
  expect(Math.abs(closedBounds!.x - translationBounds!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(closedBounds!.y - translationBounds!.y)).toBeLessThanOrEqual(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.screenshot({ path: screenshotPath("sentence-compact-mobile.png") });

  const dialog = await openSubjectPicker(page);
  await expect(dialog.getByRole("button", { name: "Link kanji: 山, Mountain", exact: true })).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812);
  expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  const glyphOverflow = await dialog.locator('[class*="character"]').evaluateAll((elements) => elements.map((element) => element.scrollHeight - element.clientHeight));
  expect(glyphOverflow.every((overflow) => overflow <= 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: screenshotPath("subject-picker-mobile.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
