import { expect, test, type Page, type Route } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

const now = "2026-08-28T12:00:00.000Z";
const bookTitle = "縦書きの小さな物語";
const inDesignBookTitle = "縦書き回帰試験";
const inDesignStoryMarker = "物語の本文がここから始まります。";
const user = {
  id: 1,
  object: "user",
  url: "",
  data_updated_at: now,
  data: {
    username: "EpubReaderTester",
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
}

function japaneseEpub() {
  const cover = new Uint8Array(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ));
  const illustration = new Uint8Array(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAGQAAACgAQMAAADAVVu1AAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURffz6////6OkWsgAAAABYktHRAH/Ai3eAAAAB3RJTUUH6ggaDzsXwOJDvAAAABlJREFUSMdjYBgFo2AUjIJRMApGwSgYWgAACMAAAaXyogoAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDgtMjZUMTU6NTk6MjMrMDA6MDCOzhDZAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTA4LTI2VDE1OjU5OjIzKzAwOjAw/5OoZQAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wOC0yNlQxNTo1OToyMyswMDowMKiGiboAAAAASUVORK5CYII=",
    "base64",
  ));
  const archive = zipSync({
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles>
          <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml" />
        </rootfiles>
      </container>`),
    "OPS/package.opf": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" unique-identifier="book-id" version="3.0">
        <metadata>
          <dc:identifier id="book-id">urn:uuid:kakehashi-e2e-vertical-book</dc:identifier>
          <dc:title>${bookTitle}</dc:title>
          <dc:language>ja</dc:language>
          <meta property="dcterms:modified">2026-08-28T12:00:00Z</meta>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
          <item id="cover" href="images/cover.png" media-type="image/png" properties="cover-image" />
          <item id="scene" href="images/scene.png" media-type="image/png" />
          <item id="chapter-one" href="text/chapter-1.xhtml" media-type="application/xhtml+xml" />
          <item id="chapter-two" href="text/chapter-2.xhtml" media-type="application/xhtml+xml" />
        </manifest>
        <spine page-progression-direction="rtl">
          <itemref idref="chapter-one" />
          <itemref idref="chapter-two" />
        </spine>
      </package>`),
    "OPS/nav.xhtml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ja">
        <head><title>目次</title></head>
        <body><nav epub:type="toc"><ol><li><a href="text/chapter-1.xhtml">第一章</a></li><li><a href="text/chapter-2.xhtml">第二章</a></li></ol></nav></body>
      </html>`),
    "OPS/text/chapter-1.xhtml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
        <head>
          <title>第一章</title>
          <link rel="stylesheet" href="https://epub-remote.invalid/tracker.css" />
          <style>html, body { writing-mode: vertical-rl; text-orientation: mixed; }</style>
        </head>
        <body>
          <h1>第一章</h1>
          <p><span id="epub-lookup-word">学校</span>から山の向こうに小さな町が見えました。</p>
          <img src="../images/scene.png" alt="山の挿絵" />
          <img src="https://epub-remote.invalid/tracker.png" alt="remote tracker" />
          <p>町の人々は毎朝、静かな空を見上げました。</p>
        </body>
      </html>`),
    "OPS/text/chapter-2.xhtml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
        <head><title>第二章</title><style>html, body { writing-mode: vertical-rl; text-orientation: mixed; }</style></head>
        <body><h1>第二章</h1><p>次の日、新しい旅が始まりました。</p></body>
      </html>`),
    "OPS/images/cover.png": cover,
    "OPS/images/scene.png": illustration,
  }, { level: 0 });

  return Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength);
}

function inDesignStyleVerticalEpub() {
  const openingImage = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
    <rect width="768" height="1024" fill="#f9e8f7" />
    <text x="384" y="480" text-anchor="middle" font-size="64" fill="#211d20">縦書きの扉絵</text>
  </svg>`;
  const story = Array.from({ length: 28 }, (_, index) => `<p>${index === 0 ? inDesignStoryMarker : "縦書きの文章を最後まで読めることを確認します。"}</p>`).join("");
  const archive = zipSync({
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml" /></rootfiles>
      </container>`),
    "OPS/package.opf": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="id">
        <metadata><dc:identifier id="id">kakehashi-indesign-regression</dc:identifier><dc:title>${inDesignBookTitle}</dc:title><dc:language>ja</dc:language></metadata>
        <manifest>
          <item id="css" href="book.css" media-type="text/css" />
          <item id="opening" href="opening.svg" media-type="image/svg+xml" />
          <item id="story" href="story.xhtml" media-type="application/xhtml+xml" />
          <item id="colophon" href="colophon.xhtml" media-type="application/xhtml+xml" />
        </manifest>
        <spine page-progression-direction="rtl"><itemref idref="story" /><itemref idref="colophon" /></spine>
      </package>`),
    "OPS/book.css": strToU8(`body { -epub-writing-mode: vertical-rl; }
      .opening { page-break-after: always; text-align: center; }
      .opening-inner { display: inline-block; }
      .opening-image { height: 100%; min-height: 100%; width: 100%; }
      .story { -epub-writing-mode: vertical-rl; }
      .story p { margin: 0; text-indent: 1em; text-align: justify; }`),
    "OPS/opening.svg": strToU8(openingImage),
    "OPS/story.xhtml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml" lang="ja"><head><title>本文</title><link href="book.css" rel="stylesheet" /></head>
      <body><div class="opening"><div class="opening-inner"><img class="opening-image" src="opening.svg" alt="扉絵" /></div></div><div class="story">${story}</div></body></html>`),
    "OPS/colophon.xhtml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml" lang="ja"><head><title>奥付</title><link href="book.css" rel="stylesheet" /></head><body><p>奥付だけのページ</p></body></html>`),
  }, { level: 0 });
  return Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength);
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

test("imports and reads an illustrated Japanese EPUB with manga-like page controls", async ({ page }, testInfo) => {
  const usesCompactControls = testInfo.project.name.includes("mobile");
  const remoteBookRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://epub-remote.invalid/")) remoteBookRequests.push(request.url());
  });
  await mockSession(page);
  await page.goto("/epubs");

  await page.locator('input[type="file"][accept*=".epub"]').setInputFiles({
    name: "vertical-story.epub",
    mimeType: "application/epub+zip",
    buffer: japaneseEpub(),
  });

  await expect(page.getByRole("heading", { name: bookTitle })).toBeVisible();
  await expect(page.getByText("EPUB · 2 chapters", { exact: true })).toBeVisible();
  const cover = page.getByRole("img", { name: `Cover of ${bookTitle}` });
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  await page.getByRole("link", { name: `Read ${bookTitle}` }).click();
  await expect(page).toHaveURL(/\/epubs\/book-/u);

  const reader = page.getByTestId("epub-reader-stage").locator("..");
  await expect(reader).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });
  const renditionFrame = page.frameLocator('[data-testid="epub-rendition"] iframe');
  await expect(renditionFrame.locator("body")).toHaveCSS("writing-mode", "vertical-rl");
  await expect(renditionFrame.locator("body")).toHaveCSS("direction", "ltr");

  const illustration = renditionFrame.getByRole("img", { name: "山の挿絵" });
  await expect(illustration).toBeVisible();
  await expect.poll(() => illustration.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(remoteBookRequests).toEqual([]);

  await expect(page.getByRole("complementary", { name: "Recognized text" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download OCR model" })).toHaveCount(0);

  const lookupWord = renditionFrame.locator("#epub-lookup-word");
  await expect(lookupWord).toHaveCSS("text-decoration-line", "none");
  await expect(lookupWord).toHaveCSS("cursor", "pointer");
  await lookupWord.click();
  const wordDetails = page.getByRole("dialog", { name: "Word details" });
  await expect(wordDetails).toBeVisible();
  await expect(wordDetails.getByText("学校", { exact: true })).toBeVisible();
  await expect.poll(() => page.locator(".kakehashi-epub-word-highlight rect").count()).toBeGreaterThan(0);
  await wordDetails.getByRole("button", { name: "Close word details" }).click();
  await expect(wordDetails).toHaveCount(0);
  await expect(page.locator(".kakehashi-epub-word-highlight rect")).toHaveCount(0);

  const viewport = page.getByTestId("epub-reader-viewport");
  const pageSurface = page.getByTestId("epub-reader-page-surface");
  await expect(pageSurface).toBeVisible();
  const next = page.getByRole("button", { name: "Next" });
  const previous = page.getByRole("button", { name: "Previous" });
  await expect(next).toHaveAttribute("data-physical-side", "left");
  await expect(previous).toHaveAttribute("data-physical-side", "right");
  await expect(next).toBeEnabled();
  await expect(previous).toBeDisabled();

  if (!usesCompactControls) {
    const [viewportBox, pageSurfaceBox, nextBox, previousBox] = await Promise.all([
      viewport.boundingBox(),
      pageSurface.boundingBox(),
      next.boundingBox(),
      previous.boundingBox(),
    ]);
    expect(viewportBox).not.toBeNull();
    expect(pageSurfaceBox).not.toBeNull();
    expect(nextBox).not.toBeNull();
    expect(previousBox).not.toBeNull();
    if (!viewportBox || !pageSurfaceBox || !nextBox || !previousBox) throw new Error("The desktop EPUB reader did not have measurable bounds.");
    expect(pageSurfaceBox.width).toBeLessThan(viewportBox.width);
    expect(Math.abs((pageSurfaceBox.x + pageSurfaceBox.width / 2) - (viewportBox.x + viewportBox.width / 2))).toBeLessThanOrEqual(2);
    expect(intersects(nextBox, viewportBox), "Next should stay outside the book page").toBe(false);
    expect(intersects(previousBox, viewportBox), "Previous should stay outside the book page").toBe(false);
    expect(nextBox.x + nextBox.width).toBeLessThanOrEqual(viewportBox.x + 1);
    expect(previousBox.x).toBeGreaterThanOrEqual(viewportBox.x + viewportBox.width - 1);
  }

  await next.click();
  await expect(previous).toBeEnabled();
  await expect(renditionFrame.getByRole("heading", { name: "第二章" })).toBeVisible();
});

test("paginates an InDesign-style vertical chapter after its full-page opening image", async ({ page }) => {
  await mockSession(page);
  await page.goto("/epubs");
  await page.locator('input[type="file"][accept*=".epub"]').setInputFiles({
    name: "indesign-vertical.epub",
    mimeType: "application/epub+zip",
    buffer: inDesignStyleVerticalEpub(),
  });
  await page.getByRole("link", { name: `Read ${inDesignBookTitle}` }).click();
  await expect(page.getByTestId("epub-reader-stage").locator("..")).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });

  const renditionFrame = page.frameLocator('[data-testid="epub-rendition"] iframe');
  const opening = renditionFrame.getByRole("img", { name: "扉絵" });
  await expect(opening).toBeVisible();
  await expect.poll(() => opening.evaluate((image) => {
    const rect = image.getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    return rect.height ? visibleHeight / rect.height : 0;
  })).toBeGreaterThan(0.98);

  await page.getByRole("button", { name: "Next" }).click();
  await expect(renditionFrame.locator("body")).toContainText(inDesignStoryMarker);
  await expect(renditionFrame.locator("body")).not.toContainText("奥付だけのページ");
});
