import { expect, test, type APIRequestContext } from "@playwright/test";

const restrictedPages = [
  "/notebooks",
  "/notebooks/example-start",
  "/custom-vocabulary",
  "/custom-vocabulary/lessons",
  "/custom-vocabulary/reviews",
  "/custom-vocabulary/words/example-word",
];

async function startDemo(request: APIRequestContext, baseURL: string) {
  const response = await request.post("/api/session/demo", {
    headers: { Origin: new URL(baseURL).origin },
  });
  expect(response.ok()).toBe(true);
}

for (const account of ["anonymous", "demo"] as const) {
  test(`${account} cannot open notebooks or custom SRS directly or use their APIs`, async ({ request, baseURL }) => {
    if (account === "demo") await startDemo(request, baseURL!);

    for (const path of restrictedPages) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }

    for (const path of ["/api/notebooks", "/api/custom-srs"]) {
      const expectedStatus = account === "demo" && path === "/api/notebooks" ? 403 : 401;
      const read = await request.get(path);
      expect(read.status(), `GET ${path}`).toBe(expectedStatus);
      expect(await read.json()).toHaveProperty("error");

      const write = await request.post(path, {
        headers: { Origin: new URL(baseURL!).origin },
        data: { action: "enroll_pack", packId: "example", eventId: "9ad82874-4f12-4f5a-a82e-32d3b565b20f" },
      });
      expect(write.status(), `POST ${path}`).toBe(expectedStatus);
      expect(await write.json()).toHaveProperty("error");
    }
  });
}

test("demo hides notebooks and custom SRS from navigation, settings, and word details", async ({ page, baseURL }) => {
  const restrictedRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(notebooks|custom-srs)(?:[/?]|$)/.test(request.url())) restrictedRequests.push(request.url());
  });
  await startDemo(page.request, baseURL!);
  await page.goto("/dashboard");
  await expect(page.getByRole("complementary", { name: "Demo account", exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/notebooks"], a[href^="/custom-vocabulary"]')).toHaveCount(0);

  await page.getByRole("button", { name: "More destinations", exact: true }).click();
  const more = page.getByRole("navigation", { name: "All destinations", exact: true });
  await expect(more).toBeVisible();
  await expect(more.getByRole("link", { name: "Notebooks", exact: true })).toHaveCount(0);
  await expect(more.getByRole("link", { name: "Custom vocabulary", exact: true })).toHaveCount(0);
  await more.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  const layout = page.getByRole("region", { name: "Workspace layout", exact: true });
  await expect(layout).toBeVisible();
  await expect(layout.getByText("Notebooks", { exact: true })).toHaveCount(0);
  await expect(layout.getByText("Custom vocabulary", { exact: true })).toHaveCount(0);

  await page.goto("/subjects/2570");
  await expect(page.getByRole("heading", { name: "Japan", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Notebook", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add to notebook", exact: true })).toHaveCount(0);
  expect(restrictedRequests).toEqual([]);
});
