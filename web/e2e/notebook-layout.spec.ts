import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { EXAMPLE_NOTEBOOK_PAGE_IDS } from "../src/features/notebooks/example-notebook";

const DEMO_STORAGE = "kakehashi:notebooks:demo:v1";
const screenshotPath = (name: string) => fileURLToPath(new URL(`../../output/notebooks/${name}`, import.meta.url));

async function openExample(page: Page, id = EXAMPLE_NOTEBOOK_PAGE_IDS.context) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
  await page.goto("/notebooks");
  await expect(page.getByRole("button", { name: "Delete example notebook", exact: true })).toBeVisible();
  await page.goto(`/notebooks/${id}`);
  await expect(page.getByLabel("Notebook page content", { exact: true })).toBeVisible();
}

test("the page browser stays in view and scrolls independently of a long note", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openExample(page);
  // Give the page browser enough real pages to exercise its own overflow.
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    for (let i = 0; i < 35; i++) saved.state.pages.push({ ...saved.state.pages[0], id: `layout-page-${i}`, title: `Practice note ${String(i + 1).padStart(2, "0")}`, parentId: null, sortOrder: i + 10, content: [] });
    saved.revision++;
    localStorage.setItem(key, JSON.stringify(saved));
  }, DEMO_STORAGE);
  await page.reload();
  const sidebar = page.getByRole("complementary", { name: "Notebook pages", exact: true });
  await expect(sidebar.getByRole("button", { name: "Practice note 35", exact: true })).toBeAttached();
  await expect(page.getByLabel("Notebook page content", { exact: true })).toBeVisible();
  await page.mouse.move(900, 450);
  await page.mouse.wheel(0, 950);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  const header = await page.locator("header").first().boundingBox();
  const bounds = await sidebar.boundingBox();
  console.log("notebook sidebar after document scroll", { header, sidebar: bounds });
  expect.soft(bounds!.y, "The page browser must remain below the app header").toBeGreaterThanOrEqual(header!.y + header!.height - 1);
  expect.soft(bounds!.y + bounds!.height, "The page browser must fit the viewport").toBeLessThanOrEqual(721);
  await expect.soft(sidebar.getByRole("textbox", { name: "Search notebook" })).toBeInViewport();
  await expect.soft(sidebar.getByRole("button", { name: "Export notebooks", exact: true })).toBeInViewport();
  const before = await page.evaluate(() => window.scrollY);
  await sidebar.locator('[class*="pageNavigation"]').hover();
  await page.mouse.wheel(0, 1400);
  await expect(sidebar.getByRole("button", { name: "Practice note 35", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY), "Scrolling pages must leave the note in place").toBe(before);
  await page.screenshot({ path: screenshotPath("sidebar-scrolled.png"), animations: "disabled" });
  await page.setViewportSize({ width: 800, height: 720 });
  const compactHeader = await page.locator("header").first().boundingBox();
  await expect.poll(async () => (await sidebar.boundingBox())!.y).toBeGreaterThanOrEqual(compactHeader!.height - 1);
  const compactSidebar = await sidebar.boundingBox();
  expect(compactSidebar!.y + compactSidebar!.height).toBeLessThanOrEqual(721);
  await expect(sidebar.getByRole("textbox", { name: "Search notebook" })).toBeInViewport();
  await expect(sidebar.getByRole("button", { name: "Export notebooks", exact: true })).toBeInViewport();
});

test("slash suggestions fit between the sticky header and the viewport edge", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 540 });
  await openExample(page);
  const editor = page.getByLabel("Notebook page content", { exact: true });
  await editor.locator('[data-content-type="paragraph"]').first().click();
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  const menu = page.locator(".bn-suggestion-menu");
  await expect(menu).toBeVisible();
  const checkMenu = async () => {
    const header = await page.locator("header").first().boundingBox();
    await expect.poll(async () => (await menu.boundingBox())!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 3);
    const bounds = await menu.boundingBox();
    const styles = await menu.evaluate((element) => ({ maxHeight: getComputedStyle(element).maxHeight, overflowY: getComputedStyle(element).overflowY, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
    console.log("notebook slash menu", { header, menu: bounds, ...styles });
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(537);
    expect(styles.scrollHeight).toBeGreaterThan(styles.clientHeight);
    expect(styles.overflowY).toMatch(/auto|scroll/);
    expect(await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + 24, rect.y + 70));
    }), "The menu must receive input above the page content").toBe(true);
  };
  await checkMenu();
  await page.screenshot({ path: screenshotPath("slash-menu-contained.png"), animations: "disabled" });
  await menu.hover();
  await page.mouse.wheel(0, 700);
  await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await page.keyboard.press("Backspace");
  const caretBlockY = () => page.evaluate(() => {
    const anchor = window.getSelection()!.anchorNode!;
    const element = anchor instanceof Element ? anchor : anchor.parentElement!;
    return element.closest('[data-content-type]')!.getBoundingClientRect().y;
  });
  const header = await page.locator("header").first().boundingBox();
  await page.mouse.move(1050, 400);
  await page.mouse.wheel(0, await caretBlockY() - header!.height - 40);
  await expect.poll(caretBlockY).toBeLessThan(header!.height + 70);
  await page.keyboard.type("/");
  await expect(menu).toBeVisible();
  await checkMenu();
  await page.keyboard.press("Escape");
});

test("a sentence has a thin selection that clears on outside click and Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openExample(page);
  const editor = page.getByLabel("Notebook page content", { exact: true });
  const sentence = editor.locator('[data-content-type="sentence"]').first();
  await sentence.click({ position: { x: 8, y: 8 } });
  const selected = editor.locator(".ProseMirror-selectednode");
  await expect(selected).toHaveCount(1);
  const overlays = await sentence.evaluate((element) => [element, ...element.querySelectorAll("*")].map((node) => {
    const style = getComputedStyle(node, "::after");
    return { content: style.content, boxShadow: style.boxShadow, background: style.backgroundColor };
  }).filter((style) => style.content !== "none" && style.boxShadow !== "none"));
  console.log("notebook sentence selection overlays", overlays);
  const selectedText = await sentence.evaluate((element) => ({
    text: window.getSelection()?.toString(),
    focus: document.activeElement?.className,
    content: [...element.querySelectorAll("p")].map((node) => ({ text: node.textContent, color: getComputedStyle(node).color, opacity: getComputedStyle(node).opacity, selectionColor: getComputedStyle(node, "::selection").color, selectionBackground: getComputedStyle(node, "::selection").backgroundColor })),
  }));
  expect.soft(selectedText.content[0].selectionColor, "Selecting a sentence must keep its Japanese text readable").toBe(selectedText.content[0].color);
  expect.soft(overlays.every((style) => !/0px 0px 0px [3-9]px/.test(style.boxShadow)), "Selection should use a subtle one- or two-pixel outline").toBe(true);
  await page.screenshot({ path: screenshotPath("sentence-selection.png"), animations: "disabled" });
  await page.getByLabel("Page title", { exact: true }).click();
  await expect.soft(selected, "Clicking outside the editor clears the sentence highlight").toHaveCount(0);
  // Exercise Escape independently of ProseMirror's post-blur mouse selection behavior.
  await page.reload();
  await expect(editor).toBeVisible();
  await sentence.click({ position: { x: 8, y: 8 } });
  await expect(selected).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(selected, "Escape clears the sentence highlight").toHaveCount(0);
});

test("notebooks use a flush, stable header across screen sizes", async ({ page }) => {
  await openExample(page);
  const notebook = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), DEMO_STORAGE);
  // Exercise account chrome with isolated sample data, without personal credentials.
  await page.route("**/api/session/wanikani", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), demo: false } });
  });
  await page.route("**/api/notebooks", (route) => route.fulfill({ json: notebook }));
  await page.goto("/notebooks");
  await expect(page.getByRole("heading", { name: "Your notebooks" })).toBeVisible();
  const header = page.locator("header").first();
  for (const width of [1440, 1280, 1024, 864, 800, 768, 414, 375, 320]) {
    await page.setViewportSize({ width, height: 720 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await header.boundingBox())!.height).toBe(57);
    const bar = await header.locator(":scope > div").boundingBox();
    expect(bar!.x).toBe(0);
    expect(bar!.width).toBe(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(header).not.toHaveAttribute("data-floating", "true");
    expect((await header.boundingBox())!.y).toBe(0);
    expect((await header.locator(":scope > div").boundingBox())!.width).toBe(width);
    await expect(page.getByRole("button", { name: "More destinations", exact: true })).toBeInViewport();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: screenshotPath("workspace-header.png"), animations: "disabled" });
  await page.getByRole("button", { name: "More destinations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "All destinations" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('[data-workspace="notebooks"]')).toHaveCount(0);
});
