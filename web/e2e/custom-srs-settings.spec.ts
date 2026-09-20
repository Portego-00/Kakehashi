import { expect, test } from "@playwright/test";
import { createCustomSrsState, updateCustomSrsSettings } from "../src/features/custom-srs/model";
import { settingsForPolicy } from "../src/features/custom-srs/srs-settings";

const now = "2026-09-19T10:00:00.000Z";
const user = { id: 1, object: "user", url: "", data_updated_at: now, data: { username: "Portego", level: 4, profile_url: "", started_at: now, current_vacation_started_at: null, preferences: {}, subscription: { active: true, type: "lifetime", max_level_granted: 60 } } };

test("saves an account schedule, reloads it, handles failure, and restores WaniKani defaults", async ({ page }, testInfo) => {
  let state = createCustomSrsState(new Date(now));
  let revision = 0;
  let fail = false;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/session/wanikani") return route.fulfill({ json: { user } });
    if (url.pathname === "/api/custom-srs") {
      expect(url.searchParams.get("accountId") ?? route.request().postDataJSON()?.accountId).toBe("1");
      if (route.request().method() === "POST") {
        if (fail) return route.fulfill({ status: 503, json: { error: "Could not save your schedule. Please retry." } });
        const command = route.request().postDataJSON();
        state = updateCustomSrsSettings(state, command.settings, command.expectedSettingsRevision, command.eventId);
        revision++;
      }
      return route.fulfill({ json: { available: true, state, revision } });
    }
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: user });
    return route.fulfill({ json: { object: "collection", data: [], pages: { next_url: null }, total_count: 0 } });
  });
  await page.goto("/settings#custom-srs-settings");
  const section = page.getByRole("region", { name: "Custom vocabulary schedule" });
  await expect(section.getByLabel("Scheduling mode")).toHaveValue("wanikani");
  await expect(section.getByLabel("Apprentice III interval")).toHaveValue("23h");
  await section.getByLabel("Apprentice I interval").fill("10m");
  await section.getByRole("button", { name: "Save schedule" }).click();
  await expect(section.getByRole("status")).toContainText("saved to your account");
  expect(settingsForPolicy(state.policy).stageIntervals[0]).toBe(10);
  await page.reload();
  await expect(section.getByLabel("Apprentice I interval")).toHaveValue("10m");
  await section.getByLabel("Scheduling mode").selectOption("fsrs");
  await section.getByLabel("Target retention (%)").fill("95");
  fail = true;
  await section.getByRole("button", { name: "Save schedule" }).click();
  await expect(section.getByRole("alert")).toContainText("Please retry");
  await expect(section.getByLabel("Target retention (%)")).toHaveValue("95");
  fail = false;
  await section.getByRole("button", { name: "Save schedule" }).click();
  await expect(section.getByRole("status")).toContainText("saved to your account");
  expect(settingsForPolicy(state.policy).requestRetention).toBe(0.95);
  await section.screenshot({ path: testInfo.outputPath("adaptive-settings.png") });
  await section.getByRole("button", { name: "Use WaniKani defaults" }).click();
  await section.getByRole("button", { name: "Save schedule" }).click();
  await expect(section.getByRole("status")).toContainText("saved to your account");
  await expect(section.getByLabel("Apprentice I interval")).toHaveValue("4h");
  await section.screenshot({ path: testInfo.outputPath("wanikani-settings.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("searchbox", { name: "Search settings" }).fill("retention");
  await page.getByRole("list", { name: "Settings search results" }).getByRole("button", { name: /Custom vocabulary schedule/ }).click();
  await expect(section.getByLabel("Scheduling mode")).toBeFocused();
});
