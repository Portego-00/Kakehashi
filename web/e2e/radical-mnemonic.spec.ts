import { expect, test, type Page } from "@playwright/test";

const timestamp = "2026-11-06T00:00:00.000Z";
const subject = {
  id: 213, object: "radical", url: "", data_updated_at: timestamp,
  data: {
    level: 13, created_at: timestamp, slug: "soul", characters: "忄", hidden_at: null,
    document_url: "https://www.wanikani.com/radicals/soul",
    meanings: [{ meaning: "Soul", primary: true, accepted_answer: true }], auxiliary_meanings: [],
    meaning_mnemonic: "A friendly little <radical>soul</radical> on its way to get reincarnated into a new body.",
    amalgamation_subject_ids: [],
  },
};
const collection = (data: unknown[] = []) => ({ object: "collection", data, pages: { next_url: null }, total_count: data.length });

async function mockAccount(page: Page, surface: string) {
  const user = { id: 1, object: "user", data: { username: "MnemonicTest", level: 13, preferences: {}, subscription: { active: true, max_level_granted: 60 } } };
  const assignment = { id: 313, object: "assignment", data_updated_at: timestamp, data: {
    subject_id: subject.id, subject_type: "radical", srs_stage: surface === "lessons" ? 0 : 3,
    started_at: surface === "lessons" ? null : timestamp, unlocked_at: timestamp,
    available_at: "2020-01-01T00:00:00.000Z", passed_at: null, burned_at: null, hidden: false,
  } };
  await page.addInitScript((compact) => {
    localStorage.setItem("kakehashi-web:settings:mnemonictest:v1", JSON.stringify({
      study: { compactReviews: compact, pauseOnCorrect: true, pauseOnWrong: true, showAnswerStopSubjectDetails: true, autoplayAudio: false, answerFeedbackSoundEnabled: false, dailyLessonLimit: 0 },
      subjectDetails: { showImmersionExamples: false, showPitchAccent: false, showPatternsOfUse: false },
    }));
  }, surface === "compact reviews");
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    // Exercise the real server proxy and WaniKani artwork, with no account writes.
    if (path === "/api/wanikani/mnemonic-image") return route.continue();
    if (path === "/api/session/wanikani") return route.fulfill({ json: { user } });
    if (path.endsWith("/user")) return route.fulfill({ json: user });
    if (path.endsWith(`/subjects/${subject.id}`)) return route.fulfill({ json: subject });
    if (path.endsWith("/subjects")) return route.fulfill({ json: collection([subject]) });
    if (path.endsWith("/assignments")) return route.fulfill({ json: collection([assignment]) });
    if (path.endsWith("/summary")) return route.fulfill({ json: { data: { lessons: [], reviews: [], next_reviews_at: null } } });
    return route.fulfill({ json: collection() });
  });
}

for (const surface of ["subject details", "lessons", "reviews", "compact reviews"]) {
  test(`Soul illustration loads automatically in ${surface}`, async ({ page }, testInfo) => {
    await mockAccount(page, surface);
    await page.goto(surface === "subject details" ? `/subjects/${subject.id}` : surface === "lessons" ? "/lessons" : "/reviews");
    if (surface.includes("reviews")) {
      await page.getByRole("textbox", { name: "Your answer" }).fill("soul");
      await page.getByRole("button", { name: "Check", exact: true }).click();
      const showDetails = page.getByRole("button", { name: "Show subject details" });
      if (await showDetails.isVisible()) await showDetails.click();
    }
    const image = page.getByRole("img", { name: "Mnemonic illustration for Soul", exact: true });
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0), { timeout: 30_000 }).toBe(true);
    await expect(image.locator("..")).toHaveAttribute("data-state", "loaded");
    await expect(image).toHaveCSS("object-fit", "contain");
    if (surface === "compact reviews") {
      await expect(page.getByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");
      await page.getByRole("button", { name: "Show more" }).click();
      await expect(image).toHaveCount(1);
    }
    for (const theme of ["light", "dark"]) {
      // Theme is presentation state; keep this independent of the responsive navigation.
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      await image.scrollIntoViewIfNeeded();
      const bounds = await image.boundingBox();
      expect(bounds!.width).toBeGreaterThan(100);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await image.locator("..").screenshot({ path: testInfo.outputPath(`${surface.replaceAll(" ", "-")}-${theme}.png`) });
    }
  });
}
