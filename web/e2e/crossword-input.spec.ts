import { expect, test } from "@playwright/test";

test("types and backspaces directly in crossword squares", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("complementary", { name: "Demo account", exact: true })).toContainText("Level 21");
  await page.goto("/study/crossword");
  await page.getByRole("button", { name: "Start session", exact: true }).click();

  const grid = page.getByLabel("Crossword grid", { exact: true });
  const selected = grid.locator('button[data-selected="true"]');
  const first = selected.nth(0);
  const second = selected.nth(1);
  const input = grid.getByRole("textbox", { name: "Crossword grid input" });
  await first.click();
  await expect(input).toBeFocused();
  await page.keyboard.type("ka");
  await expect(first.locator("[data-letter]")).toHaveText("か");
  await expect(second).toHaveAttribute("data-cursor", "true");

  await second.click();
  await page.keyboard.press("Backspace");
  await expect(first.locator("[data-letter]")).toHaveText("");
  await expect(input).toBeFocused();
  await page.keyboard.type("sa");
  await expect(first.locator("[data-letter]")).toHaveText("さ");
  await expect(page.locator("#crossword-word-answer")).toHaveCount(0);
});
