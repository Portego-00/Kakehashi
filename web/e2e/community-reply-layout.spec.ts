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

const parentMessages = [
  {
    name: "long prose",
    content: "I have the same issue, but slightly different. I use the voice recognition function, and today this happened for the first time. My voice was recognized incorrectly, but I clicked the answer button before noticing the transcription. I tried again after restarting the lesson and the same thing happened. These details should remain readable when another learner replies to this message, including this final sentence.",
  },
  {
    name: "a long unbroken string",
    content: `RecognitionResult${"abcdefghij".repeat(60)}EndOfMessage`,
  },
];

for (const parent of parentMessages) {
  test(`wraps quoted replies containing ${parent.name} without horizontal overflow`, async ({ page }) => {
    await mockIssue(page, parent.content);
    await page.goto(`/community/${issueId}`);
    await expect(page.getByRole("heading", { name: "Voice recognition issue" })).toBeVisible();

    const reply = page.locator("article").filter({ has: page.getByText(replyContent, { exact: true }) });
    const quote = reply.getByText("Replying to Larionov", { exact: true }).locator("..").locator("p");
    await expect(quote).toHaveText(parent.content);
    await quote.scrollIntoViewIfNeeded();

    const layout = await quote.evaluate((element) => {
      const paragraph = element.getBoundingClientRect();
      const context = element.parentElement!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      const fitsInside = (line: DOMRect, bounds: DOMRect) => line.left >= bounds.left - 1
        && line.right <= bounds.right + 1
        && line.top >= bounds.top - 1
        && line.bottom <= bounds.bottom + 1;
      return {
        lineCount: new Set(lines.map((line) => Math.round(line.top))).size,
        allTextFits: lines.every((line) => fitsInside(line, paragraph) && fitsInside(line, context)),
        contextFitsViewport: context.left >= 0 && context.right <= window.innerWidth + 1,
        horizontalOverflow: element.scrollWidth - element.clientWidth,
        verticalOverflow: element.scrollHeight - element.clientHeight,
      };
    });

    expect(layout.lineCount, "The quoted message should continue onto another line").toBeGreaterThan(1);
    expect(layout.allTextFits, "Every line should fit inside the quote without clipping or truncation").toBe(true);
    expect(layout.contextFitsViewport, "The quote should stay within the visible page width").toBe(true);
    expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(layout.verticalOverflow).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const composer = page.getByRole("textbox", { name: "Reply as WebTester" });
    await expect(composer).toBeVisible();
    expect(await composer.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= window.innerWidth + 1;
    }), "The reply composer should stay within the visible page width").toBe(true);
  });
}
