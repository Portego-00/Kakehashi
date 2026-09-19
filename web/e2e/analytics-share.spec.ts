import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectSelectOptionsFit } from "./analytics-layout-helpers";

async function openShare(page: Page) {
  page.setDefaultTimeout(15_000);
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await page.goto("/analytics");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share your progress", exact: true });
  await currentImage(dialog);
  return dialog;
}

async function currentImage(dialog: Locator) {
  const preview = dialog.getByRole("img", { name: "Your progress image preview", exact: true });
  await expect(dialog.getByRole("button", { name: "Download PNG", exact: true })).toBeEnabled();
  await expect(preview).toBeVisible();
  await preview.evaluate((element) => (element as HTMLImageElement).decode());
  return preview;
}

async function inspectPng(page: Page, png: Buffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0, 96, 96);
    const pixels = context.getImageData(0, 0, 96, 96).data;
    const colors = new Set<string>();
    let colorfulPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const channels = [pixels[index], pixels[index + 1], pixels[index + 2]];
      colors.add(channels.join(","));
      if (Math.max(...channels) - Math.min(...channels) > 30) colorfulPixels++;
    }
    return { width: image.naturalWidth, height: image.naturalHeight, colors: colors.size, colorfulPixels, corner: (pixels[0] + pixels[1] + pixels[2]) / 3 };
  }, png.toString("base64"));
}

test("all share formats and themes download the exact visible, nonblank preview", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const dialog = await openShare(page);
  await dialog.getByRole("checkbox", { name: "Hide username", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "Hide days studying", exact: true }).check();
  const hashes = new Set<string>();
  for (const format of ["stats", "kanji", "activity"]) {
    await dialog.getByRole("combobox", { name: "Format", exact: true }).selectOption(format);
    for (const theme of ["Light", "Dark"]) {
      await dialog.getByRole("group", { name: "Image theme", exact: true }).getByRole("button", { name: theme, exact: true }).click();
      const preview = await currentImage(dialog);
      const previewHash = await preview.evaluate(async (element) => {
        const buffer = await (await fetch((element as HTMLImageElement).src)).arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      });
      const downloadPromise = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Download PNG", exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`kakehashi-${format}.png`);
      const path = testInfo.outputPath(`share-${format}-${theme.toLowerCase()}.png`);
      await download.saveAs(path);
      const png = await readFile(path);
      const hash = createHash("sha256").update(png).digest("hex");
      expect(hash).toBe(previewHash);
      hashes.add(hash);
      const pixels = await inspectPng(page, png);
      expect(pixels.width).toBeGreaterThanOrEqual(1000);
      expect(pixels.height).toBeGreaterThanOrEqual(600);
      expect(pixels.colors).toBeGreaterThan(30);
      expect(pixels.colorfulPixels).toBeGreaterThan(50);
      if (theme === "Light") expect(pixels.corner).toBeGreaterThan(200);
      else expect(pixels.corner).toBeLessThan(80);
      await testInfo.attach(`${format}-${theme}-pixels`, { body: JSON.stringify(pixels), contentType: "application/json" });
    }
  }
  expect(hashes.size).toBe(6);
});

test("share controls, full-size preview and focus remain usable across mobile and desktop", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dialog = await openShare(page);
  for (const width of [320, 375, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["Light", "Dark"]) {
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      const themeToggle = page.getByRole("button", { name: `Switch to ${theme.toLowerCase()} theme`, exact: true });
      if (await themeToggle.count()) await themeToggle.click();
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await dialog.getByRole("group", { name: "Image theme", exact: true }).getByRole("button", { name: theme, exact: true }).click();
      await currentImage(dialog);
      await expectSelectOptionsFit(dialog.getByRole("combobox", { name: "Format", exact: true }));
      expect(await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight && element.scrollWidth <= element.clientWidth + 1;
      })).toBe(true);
      for (const name of ["Download PNG", "Copy image", "Copy snapshot link", "Preview snapshot"]) {
        const button = dialog.getByRole("button", { name, exact: true });
        await button.scrollIntoViewIfNeeded();
        await button.focus();
        await expect(button).toBeFocused();
        await expect(button).toBeInViewport({ ratio: 1 });
      }
      const zoom = dialog.getByRole("button", { name: "Zoom preview", exact: true });
      await zoom.click();
      await expect(zoom).toHaveAttribute("aria-pressed", "true");
      const image = await currentImage(dialog);
      expect(await image.evaluate((element) => element.getBoundingClientRect().width >= (element as HTMLImageElement).naturalWidth - 1)).toBe(true);
      const previewRegion = dialog.getByRole("region", { name: "Image preview", exact: true });
      expect(await previewRegion.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await previewRegion.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => previewRegion.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      await zoom.click();
      await expect(zoom).toHaveAttribute("aria-pressed", "false");
      await expect.poll(() => previewRegion.evaluate((element) => element.scrollLeft)).toBe(0);
      await dialog.getByRole("heading", { name: "Share your progress", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`share-modal-${width}-${theme.toLowerCase()}.png`) });
    }
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeFocused();
});

test("native clipboard and public snapshots honor current privacy choices without account access", async ({ page, context, browser, baseURL }, testInfo) => {
  test.setTimeout(90_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });
  const dialog = await openShare(page);
  await dialog.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Image copied.");
  const copiedImage = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const item = items.find((entry) => entry.types.includes("image/png"));
    return item ? (await item.getType("image/png")).size : 0;
  });
  expect(copiedImage).toBeGreaterThan(10_000);
  await dialog.getByRole("checkbox", { name: "Hide username", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "Hide days studying", exact: true }).check();
  await dialog.getByRole("button", { name: "Copy snapshot link", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Snapshot link copied.");
  const snapshotUrl = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(snapshotUrl.pathname).toBe("/shared-progress");
  expect(snapshotUrl.search).toBe("");
  const payload = JSON.parse(Buffer.from(snapshotUrl.hash.replace("#snapshot=", ""), "base64url").toString("utf8"));
  expect(payload).not.toHaveProperty("username");
  expect(payload).not.toHaveProperty("daysStudying");
  expect(Object.keys(payload).sort()).toEqual(["accuracy", "burned", "capturedAt", "learnedGuruKanji", "level", "srs", "version"].sort());
  const previewPagePromise = context.waitForEvent("page");
  await dialog.getByRole("button", { name: "Preview snapshot", exact: true }).click();
  const previewPage = await previewPagePromise;
  try {
    await expect(previewPage).toHaveURL(snapshotUrl.href);
    await expect(previewPage.getByRole("heading", { name: "WaniKani progress", exact: true })).toBeVisible();
  } finally {
    await previewPage.close();
  }
  const guest = await browser.newContext({ viewport: { width: 375, height: 1000 }, reducedMotion: "reduce" });
  try {
    const publicPage = await guest.newPage();
    const accountRequests: string[] = [];
    publicPage.on("request", (request) => { if (request.url().includes("/api/wanikani/") || request.url().includes("api.wanikani.com")) accountRequests.push(request.url()); });
    await publicPage.goto(snapshotUrl.href);
    await expect(publicPage.getByRole("heading", { name: "WaniKani progress", exact: true })).toBeVisible();
    await expect(publicPage.getByText(/demo-level-21/)).toHaveCount(0);
    await expect(publicPage.getByText(/days since starting/)).toHaveCount(0);
    await expect(publicPage.getByRole("link", { name: "Open Kakehashi", exact: true })).toBeVisible();
    expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await publicPage.screenshot({ path: testInfo.outputPath("private-snapshot-375.png"), fullPage: true });
    expect(accountRequests).toEqual([]);
    await publicPage.goto(`${snapshotUrl.origin}/shared-progress#snapshot=invalid`);
    await expect(publicPage.getByRole("heading", { name: "Progress snapshot unavailable", exact: true })).toBeVisible();
  } finally {
    await guest.close();
  }
  await dialog.getByRole("checkbox", { name: "Hide username", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Copy snapshot link", exact: true }).click();
  const namedUrl = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  const named = JSON.parse(Buffer.from(namedUrl.hash.replace("#snapshot=", ""), "base64url").toString("utf8"));
  expect(named.username).toBe("demo-level-21");
  expect(named).not.toHaveProperty("daysStudying");
});
