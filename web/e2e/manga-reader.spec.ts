import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-08-26T12:00:00.000Z";
const user = {
  id: 1,
  object: "user",
  url: "",
  data_updated_at: now,
  data: {
    username: "MangaGeometryTester",
    level: 2,
    profile_url: "",
    started_at: now,
    current_vacation_started_at: null,
    preferences: {
      default_voice_actor_id: 1,
      lessons_autoplay_audio: false,
      lessons_batch_size: 5,
      lessons_presentation_order: "ascending_level_then_subject",
      reviews_autoplay_audio: false,
      reviews_display_srs_indicator: true,
    },
    subscription: { active: true, type: "lifetime", max_level_granted: 60, period_ends_at: null },
  },
};

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockSession(page: Page) {
  await page.route("**/api/session/wanikani", (route) => fulfillJson(route, { user }));
  await page.route("**/api/wanikani/**", (route) => fulfillJson(route, {
    object: "collection",
    url: "",
    pages: { next_url: null, previous_url: null, per_page: 1_000 },
    total_count: 0,
    data_updated_at: now,
    data: [],
  }));
  await page.route("**/news/analyze", (route) => fulfillJson(route, { provider: "jpdb", tokens: [] }));
  await page.route("**/manga/translate", (route) => fulfillJson(route, {
    provider: "jpdb",
    translation: "It is a cat.",
    isTruncated: false,
  }));
}

async function seedPortraitManga(page: Page) {
  await page.goto("/manga");
  await page.evaluate(async ({ pageData, timestamp }) => {
    const assetIds = ["geometry-page-1", "geometry-page-2", "geometry-page-3", "geometry-page-4", "geometry-page-5"];
    const pageBlob = await fetch(`data:image/png;base64,${pageData}`).then((response) => response.blob());

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("kakehashi-content-v1", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("assets")) request.result.createObjectStore("assets");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open the manga test database."));
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("assets", "readwrite");
      const store = transaction.objectStore("assets");
      assetIds.forEach((assetId) => {
        const request = store.put(pageBlob, assetId);
        request.onerror = () => reject(request.error ?? new Error(`Could not seed ${assetId}.`));
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not seed the manga test pages."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Seeding the manga test pages was aborted."));
    });
    database.close();

    localStorage.setItem("kakehashi:content:v1:library:manga", JSON.stringify([{
      id: "geometry-manga",
      kind: "manga",
      title: "Geometry manga",
      fileName: "geometry.cbz",
      mimeType: "image/*",
      assetIds,
      createdAt: timestamp,
      updatedAt: timestamp,
      progress: 0,
      currentPage: 1,
      totalPages: assetIds.length,
      metadata: {
        sourceType: "cbz",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: JSON.stringify([null, null, null, null, null]),
      },
    }]));
    localStorage.setItem("kakehashi:content:v1:manga-ocr:geometry-manga", JSON.stringify({
      1: { text: "猫です", updatedAt: timestamp },
    }));
    localStorage.setItem("kakehashi-web:settings:mangageometrytester:v1", JSON.stringify({
      integrations: { jpdbApiKey: "browser-test-key" },
    }));
  }, {
    pageData: "iVBORw0KGgoAAAANSUhEUgAAAGQAAACgAQMAAADAVVu1AAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURffz6////6OkWsgAAAABYktHRAH/Ai3eAAAAB3RJTUUH6ggaDzsXwOJDvAAAABlJREFUSMdjYBgFo2AUjIJRMApGwSgYWgAACMAAAaXyogoAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDgtMjZUMTU6NTk6MjMrMDA6MDCOzhDZAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTA4LTI2VDE1OjU5OjIzKzAwOjAw/5OoZQAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wOC0yNlQxNTo1OToyMyswMDowMKiGiboAAAAASUVORK5CYII=",
    timestamp: now,
  });
}

async function seedMangaShelf(page: Page) {
  await page.goto("/manga");
  await page.evaluate((timestamp) => {
    const titles = ["Manga A", "Manga B", "Manga C"];
    const records = titles.map((title, index) => ({
      id: `shelf-manga-${index + 1}`,
      kind: "manga",
      title,
      fileName: `${title}.cbz`,
      mimeType: "image/*",
      assetIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      progress: 0,
      currentPage: 1,
      totalPages: 1,
      metadata: {
        sourceType: "cbz",
        isPdf: false,
        readingDirection: "rtl",
        pagePlacements: "[null]",
      },
    }));
    localStorage.setItem("kakehashi:content:v1:library:manga", JSON.stringify(records));
  }, now);
  await page.reload();
}

function intersects(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

async function expectPagesToFitOutsideControls(page: Page) {
  const rasterizationTolerance = 1;
  const viewport = page.getByTestId("manga-spread-viewport");
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  if (!viewportBox) return;

  const surfaces = page.getByTestId("manga-page-surface");
  expect(await surfaces.count()).toBeGreaterThan(0);
  const surfaceBoxes = await surfaces.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }));
  for (const surface of surfaceBoxes) {
    expect(surface.x).toBeGreaterThanOrEqual(viewportBox.x - rasterizationTolerance);
    expect(surface.y).toBeGreaterThanOrEqual(viewportBox.y - rasterizationTolerance);
    expect(surface.x + surface.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width + rasterizationTolerance);
    expect(surface.y + surface.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height + rasterizationTolerance);
    expect(surface.width / surface.height).toBeCloseTo(1_000 / 1_600, 2);
  }

  for (const label of ["Next", "Previous"]) {
    const buttonBox = await page.getByRole("button", { name: label }).boundingBox();
    expect(buttonBox).not.toBeNull();
    if (!buttonBox) continue;
    expect(surfaceBoxes.some((surface) => intersects(buttonBox, surface))).toBe(false);
  }
}

test("keeps portrait pages fitted and non-fullscreen controls outside page content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "The Chromium run also verifies the compact reader width; WebKit cannot seed Blob-backed IndexedDB in Playwright.");
  await mockSession(page);
  await seedPortraitManga(page);
  await page.goto("/manga/geometry-manga");

  await expect(page.getByRole("group", { name: "Select text on Geometry manga, page 1" })).toBeVisible();
  await expect(page.getByRole("region", { name: "JPDB translation" })).toContainText("It is a cat.");
  await expectPagesToFitOutsideControls(page);

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("group", { name: "Select text on Geometry manga, page 2" })).toBeVisible();
  await page.getByTestId("manga-spread").evaluate(async (spread) => {
    await Promise.all(spread.getAnimations().map((animation) => animation.finished));
  });
  await expectPagesToFitOutsideControls(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("group", { name: "Select text on Geometry manga, page 3" })).toBeVisible();
  await page.getByTestId("manga-spread").evaluate(async (spread) => {
    await Promise.all(spread.getAnimations().map((animation) => animation.finished));
  });
  await expectPagesToFitOutsideControls(page);
});

test("aligns the manga header actions and keeps one empty-state divider", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop header alignment assertion");
  await mockSession(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/manga");

  const download = page.getByRole("button", { name: "Download OCR model" });
  const jpdb = page.getByRole("link", { name: "Add JPDB API key" });
  const importAction = page.getByText("Import manga", { exact: true }).locator("..");
  await expect(download).toBeVisible();

  const boxes = await Promise.all([download, jpdb, importAction].map((action) => action.boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);
  const centers = boxes.flatMap((box) => box ? [box.y + box.height / 2] : []);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2);

  const emptyState = page.getByRole("heading", { name: "No manga yet" }).locator("..");
  await expect(emptyState).toHaveCSS("border-top-width", "0px");
});

test("removes manga metadata when its local file is gone", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop local-storage assertion");
  await mockSession(page);
  await page.goto("/manga");
  await page.evaluate((timestamp) => {
    localStorage.setItem("kakehashi:content:v1:library:manga", JSON.stringify([{
      id: "missing-local-manga",
      kind: "manga",
      title: "Missing local manga",
      fileName: "missing.cbz",
      mimeType: "image/*",
      assetIds: ["cleared-indexeddb-page"],
      createdAt: timestamp,
      updatedAt: timestamp,
      progress: 0,
      currentPage: 1,
      totalPages: 1,
      metadata: { sourceType: "cbz", isPdf: false, readingDirection: "rtl", pagePlacements: "[null]" },
    }]));
  }, now);
  await page.reload();

  await expect.poll(() => page.evaluate(() => localStorage.getItem("kakehashi:content:v1:library:manga"))).toBe("[]");
  await expect(page.getByRole("heading", { name: "Missing local manga" })).toHaveCount(0);
});

test("reorders the manga shelf by drag and keeps the order after reload", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop drag-and-drop assertion");
  await mockSession(page);
  await seedMangaShelf(page);

  const shelf = page.getByRole("list", { name: "Manga library order" });
  const shelfItems = shelf.getByRole("listitem");
  await expect(shelfItems).toHaveCount(3);
  await expect(shelfItems.getByRole("heading", { level: 2 })).toHaveText(["Manga A", "Manga B", "Manga C"]);

  const source = shelfItems.filter({ has: page.getByRole("heading", { level: 2, name: "Manga C" }) });
  const target = shelfItems.filter({ has: page.getByRole("heading", { level: 2, name: "Manga A" }) });
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !targetBox) return;

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.width * 0.75);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.width * 0.75, { steps: 16 });
  await page.mouse.up();

  await expect(shelfItems.getByRole("heading", { level: 2 })).toHaveText(["Manga C", "Manga A", "Manga B"]);
  await expect(page.getByText("Manga C moved to position 1 of 3.", { exact: true })).toHaveCount(1);
  await expect(page).toHaveURL(/\/manga$/u);
  await expect(page.getByText("Drop to import manga", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(shelfItems.getByRole("heading", { level: 2 })).toHaveText(["Manga C", "Manga A", "Manga B"]);
});
