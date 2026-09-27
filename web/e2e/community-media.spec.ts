import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-09-07T10:00:00.000Z";
const issueId = "reply-layout-issue";
const replyContent = "I have the same issue on my phone.";
const user = {
  id: 1,
  object: "user",
  url: "",
  data_updated_at: now,
  data: {
    username: "WebTester",
    level: 12,
    profile_url: "",
    started_at: now,
    current_vacation_started_at: null,
    preferences: {},
    subscription: { active: true, type: "lifetime", max_level_granted: 60 },
  },
};

async function fulfillJson(route: Route, json: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
}

async function mockIssue(page: Page, parentContent: string) {
  await page.route("**/api/session/wanikani", (route) => fulfillJson(route, { user }));
  await page.route("**/api/wanikani/**", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").pop();
    if (resource === "user") return fulfillJson(route, user);
    return fulfillJson(route, {
      object: "collection", url: "", data_updated_at: now, total_count: 0, data: [],
      pages: { next_url: null, previous_url: null, per_page: 1000 },
    });
  });
  await page.route("**/api/analytics/session", (route) => fulfillJson(route, { recorded: true }));
  await page.route("**/community/api**", (route) => fulfillJson(route, {
    configured: true,
    writable: true,
    canManage: false,
    commentsHasMore: false,
    issue: {
      id: issueId,
      user_username: "WebTester",
      user_level: 12,
      title: "Voice recognition issue",
      content: "Voice recognition sometimes returns the wrong answer.",
      status: "open",
      labels: [],
      created_at: now,
      updated_at: now,
      likes_count: 0,
      reply_count: 2,
    },
    comments: [
      {
        id: "parent-comment",
        issue_id: issueId,
        user_username: "Larionov",
        user_level: 12,
        content: parentContent,
        created_at: now,
        likes_count: 0,
        reply_to_comment_id: null,
      },
      {
        id: "child-comment",
        issue_id: issueId,
        user_username: "WebTester",
        user_level: 12,
        content: replyContent,
        created_at: now,
        likes_count: 0,
        reply_to_comment_id: "parent-comment",
      },
    ],
  }));
}


for (const editor of ["issue", "reply"]) {
  test(`uploads images and previews Markdown in the ${editor} editor`, async ({ page }) => {
    await mockIssue(page, "An existing comment");
    await page.route("**/community/media", (route) => fulfillJson(route, { url: "https://example.com/test-image.webp" }));
    await page.route("https://example.com/test-image.webp", (route) => route.fulfill({ body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"), contentType: "image/png" }));
    await page.goto(editor === "issue" ? "/community/new" : `/community/${issueId}`);
    const textbox = page.getByRole("textbox", { name: editor === "issue" ? "Details" : "Reply as WebTester" });
    await textbox.fill("1. *First step*\n2. Second step\n\n```js\nconst answer = 42;\n```");
    await page.locator('input[type="file"]').setInputFiles({ name: "screenshot.png", mimeType: "image/png", buffer: Buffer.from([1, 2, 3]) });
    await expect(textbox).toHaveValue(/!\[Image\]\(https:\/\/example.com\/test-image.webp\)/);
    await page.getByRole("tab", { name: "Preview", exact: true }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel.locator("ol > li")).toHaveCount(2);
    await expect(panel.locator("em")).toHaveText("First step");
    await expect(panel.locator("pre code")).toContainText("const answer = 42;");
    await expect(panel.getByRole("img")).toBeVisible();
    await expect.poll(() => panel.getByRole("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/community-${editor}-${test.info().project.name}.png`, fullPage: true });
    await page.getByRole("tab", { name: "Write", exact: true }).click();
    await expect(textbox).toHaveValue(/First step/);
  });
}

