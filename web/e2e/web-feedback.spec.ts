import { expect, test } from "@playwright/test";

test("daily limit and completely hidden answers persist and apply to lessons", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // Start a fresh study day; the demo normally seeds some lessons as completed today.
  await page.evaluate(() => {
    const key = "kakehashi:demo:wanikani:v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.createdAt = Date.now() - 2 * 86_400_000;
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto("/settings");
  await page.getByRole("spinbutton", { name: "Daily lesson limit" }).fill("3");
  await page.getByRole("combobox", { name: "Anki mode", exact: true }).selectOption("both");
  await page.getByText("Hide answer completely", { exact: true }).click();
  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "Daily lesson limit" })).toHaveValue("3");
  await expect(page.getByRole("checkbox", { name: /Hide answer completely/ })).toBeChecked();
  await page.goto("/dashboard");
  const lessons = page.getByRole("article", { name: "Lessons study queue, demo" });
  await expect(lessons.getByText("3", { exact: true })).toBeVisible();
  await lessons.getByRole("link", { name: "Pick lessons" }).click();
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.getByRole("button", { name: "Start 3 lessons", exact: true }).click();
  await expect(page.getByRole("list", { name: "Lessons in this batch" }).getByRole("listitem")).toHaveCount(3);
  await page.getByRole("list", { name: "Lessons in this batch" }).getByRole("listitem").last().getByRole("button").click();
  await page.getByRole("button", { name: "Start lesson review", exact: true }).click();
  const preview = page.getByTestId("anki-answer-preview");
  await expect(preview).toHaveAttribute("data-visibility", "hidden");
  await expect(preview.locator("strong")).toHaveCount(0);
  await preview.click();
  await expect(page.getByRole("button", { name: "Correct", exact: true })).toBeVisible();
  await expect(page.getByTestId("anki-answer-content")).toBeVisible();
});
