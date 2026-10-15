import { expect, test, type Page } from "@playwright/test";

const now = "2026-10-15T10:00:00.000Z";
const issueId = "11111111-1111-4111-8111-111111111111";
const commentId = "22222222-2222-4222-8222-222222222222";
const issue = { id: issueId, user_username: "Author", title: "Community like tooltips", content: "Hover over a heart to see who liked this post.", status: "open", created_at: now, updated_at: now, likes_count: 52, reply_count: 1 };
const user = { id: 1, object: "user", url: "", data_updated_at: now, data: { username: "Portego", level: 12, profile_url: "", started_at: now, current_vacation_started_at: null, preferences: {}, subscription: { active: true, type: "lifetime", max_level_granted: 60 } } };

async function mockCommunity(page: Page, username = "Portego", demo = false) {
  let liked = false;
  const likeRequests: URL[] = [];
  const viewer = { ...user, data: { ...user.data, username } };
  await page.route("**/api/session/wanikani", (route) => route.fulfill({ json: { user: viewer, demo } }));
  await page.route("**/api/wanikani/**", (route) => route.fulfill({ json: route.request().url().endsWith("/user") ? viewer : { object: "collection", data: [], total_count: 0, pages: { next_url: null } } }));
  await page.route("**/api/analytics/session", (route) => route.fulfill({ json: { recorded: true } }));
  await page.route("**/community/api**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST") {
      liked = !liked;
      return route.fulfill({ json: { liked, likes_count: 52 + Number(liked) } });
    }
    if (url.searchParams.get("action") === "likes") {
      likeRequests.push(url);
      const names = url.searchParams.get("kind") === "issue"
        ? Array.from({ length: 52 }, (_, index) => ({ id: `like-${index}`, username: `Learner ${index + 1}` }))
        : [{ id: "comment-like", username: "ReplyLiker" }];
      if (liked) names.push({ id: "viewer-like", username });
      const start = Number(url.searchParams.get("page")) * 50;
      return route.fulfill({ json: { items: names.slice(start, start + 50), hasMore: names.length > start + 50 } });
    }
    if (url.searchParams.get("action") === "activity") return route.fulfill({ json: { items: [] } });
    return route.fulfill({ json: {
      configured: true, writable: true, items: [issue], counts: { open: 1, closed: 0 }, issue,
      comments: [{ id: commentId, issue_id: issueId, user_username: "CommentAuthor", content: "This reply has its own liker list.", created_at: now, likes_count: 1 }],
    } });
  });
  return likeRequests;
}

test("shows all feed likers in a scrollable tooltip and refreshes after liking", async ({ page }) => {
  const requests = await mockCommunity(page);
  await page.goto("/community");
  const button = page.getByRole("button", { name: `Like ${issue.title}, 52 likes` });
  await expect(button).toBeVisible();
  expect(requests).toHaveLength(0);
  await button.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip.getByRole("listitem")).toHaveCount(52);
  expect(requests.every((url) => url.searchParams.get("kind") === "issue" && url.searchParams.get("id") === issueId)).toBe(true);
  await expect(tooltip).toBeInViewport();
  expect(await tooltip.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return element.scrollHeight > element.clientHeight && rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);
  await tooltip.hover();
  await page.waitForTimeout(180);
  await expect(tooltip).toBeVisible();
  await tooltip.getByText("Learner 52", { exact: true }).scrollIntoViewIfNeeded();
  await expect(tooltip.getByText("Learner 52", { exact: true })).toBeVisible();
  await button.click();
  await expect(tooltip.getByText("Portego", { exact: true })).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
});

test("shows separate post and comment likers with keyboard focus", async ({ page }) => {
  await mockCommunity(page);
  await page.goto(`/community/${issueId}`);
  const post = page.getByRole("button", { name: "Like issue, 52 likes" });
  await post.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip.getByRole("listitem")).toHaveCount(52);
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await page.getByRole("button", { name: "Like reply by CommentAuthor, 1 likes" }).focus();
  await expect(tooltip).toHaveText("Liked byReplyLiker");
  await expect(tooltip).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("comment-likers.png") });
});

for (const viewer of [{ username: "Viewer", demo: false }, { username: "Portego", demo: true }]) {
  test(`keeps liking available without liker tooltips for ${viewer.demo ? "demo Portego" : viewer.username}`, async ({ page }) => {
    const requests = await mockCommunity(page, viewer.username, viewer.demo);
    await page.goto("/community");
    const feedButton = page.getByRole("button", { name: `Like ${issue.title}, 52 likes` });
    await feedButton.hover();
    await feedButton.focus();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await feedButton.click();
    await expect(page.getByRole("button", { name: `Unlike ${issue.title}, 53 likes` })).toBeEnabled();
    await page.goto(`/community/${issueId}`);
    for (const label of ["Like issue, 52 likes", "Like reply by CommentAuthor, 1 likes"]) {
      const button = page.getByRole("button", { name: label });
      await button.hover();
      await button.focus();
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await expect(button).not.toHaveAttribute("aria-describedby");
    }
    expect(requests).toHaveLength(0);
  });
}
