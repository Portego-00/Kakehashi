import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|analytics)$/);
  await page.goto("/analytics");
  await expect(page.getByRole("combobox", { name: "Pace scenario" })).toBeVisible();
});

test("projection scenarios change the drawn trajectory and survive reload", async ({ page }) => {
  const widget = page.getByRole("region", { name: "Level projections", exact: true });
  const curves = widget.locator(".recharts-line-curve");
  await expect(curves).toHaveCount(4);
  await expect(curves.first()).toHaveAttribute("d", /L/);
  await widget.getByRole("checkbox", { name: "Compare paces" }).uncheck();
  await expect(curves).toHaveCount(2);
  await widget.getByRole("combobox", { name: "Pace scenario" }).selectOption("custom");
  const slider = widget.getByRole("slider", { name: "Days per level" });
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("6");
  const early = await widget.locator("strong time").getAttribute("dateTime");
  await slider.press("End");
  await expect(slider).toHaveValue("60");
  const later = await widget.locator("strong time").getAttribute("dateTime");
  expect(Date.parse(later!)).toBeGreaterThan(Date.parse(early!));
  await widget.getByRole("checkbox", { name: "Compare paces" }).check();
  await expect(curves).toHaveCount(5);
  await page.reload();
  await expect(widget.getByRole("combobox", { name: "Pace scenario" })).toHaveValue("custom");
  await expect(widget.getByRole("slider", { name: "Days per level" })).toHaveValue("60");
});

test("projection chart remains drawn and contained across sizes and reduced motion", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const widget = page.getByRole("region", { name: "Level projections", exact: true });
  const chart = widget.getByRole("group", { name: "Level projection scenarios", exact: true });
  await expect(chart).toHaveAttribute("data-motion", "reduced");
  for (const width of [320, 375, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await widget.scrollIntoViewIfNeeded();
    await expect(chart.locator(".recharts-line-curve").first()).toHaveAttribute("d", /L/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const geometry = await chart.evaluate((element) => {
      const parent = element.getBoundingClientRect();
      const svg = element.querySelector("svg")!.getBoundingClientRect();
      return { width: svg.width, height: svg.height, contained: svg.right <= parent.right + 1 && svg.left >= parent.left - 1 };
    });
    expect(geometry.width).toBeGreaterThan(200);
    expect(geometry.height).toBeGreaterThanOrEqual(240);
    expect(geometry.contained).toBe(true);
    await widget.screenshot({ path: testInfo.outputPath(`level-projection-${width}.png`) });
  }
  await widget.getByRole("button", { name: "Expand Level projections", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Level projections", exact: true });
  await expect(dialog.locator(".recharts-line-curve").first()).toHaveAttribute("d", /L/);
  await dialog.getByRole("combobox", { name: "Goal level" }).selectOption("21");
  await expect(dialog.getByText("Goal reached", { exact: true })).toBeVisible();
});
