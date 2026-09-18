import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-09-15T10:00:00.000Z";
const sessionKey = "kakehashi-core-session:portego:reviews";
const user = {
  id: 1, object: "user", url: "", data_updated_at: now,
  data: {
    username: "Portego", level: 2, profile_url: "", started_at: now,
    current_vacation_started_at: null, preferences: {},
    subscription: { active: true, type: "lifetime", max_level_granted: 60 },
  },
};
const vocabulary = {
  id: 7, object: "vocabulary", url: "", data_updated_at: now,
  data: {
    level: 2, created_at: now, slug: "川", document_url: "https://www.wanikani.com/vocabulary/%E5%B7%9D",
    hidden_at: null, characters: "川",
    meanings: [{ meaning: "River", primary: true, accepted_answer: true }], auxiliary_meanings: [],
    readings: [{ reading: "かわ", primary: true, accepted_answer: true }],
    meaning_mnemonic: "A river.", reading_mnemonic: "Read it as かわ.", component_subject_ids: [],
    context_sentences: [], parts_of_speech: ["noun"], pronunciation_audios: [],
  },
};
const assignment = {
  id: 107, object: "assignment", url: "", data_updated_at: now,
  data: {
    subject_id: 7, subject_type: "vocabulary", srs_stage: 3, available_at: "2020-01-01T00:00:00.000Z",
    started_at: now, unlocked_at: now, passed_at: null, burned_at: null, resurrected_at: null,
    hidden: false, created_at: now,
  },
};

function collection(data: unknown[]) {
  return { object: "collection", url: "", pages: { next_url: null, previous_url: null, per_page: 1000 }, total_count: data.length, data_updated_at: now, data };
}

async function fulfillJson(route: Route, json: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
}

async function mockCoreStudy(page: Page, mode: "reviews" | "lessons" = "reviews") {
  await page.addInitScript(() => {
    localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({
      study: {
        reviewQuestionOrderEnabled: true, reviewQuestionOrder: "meaning-first", pauseOnCorrect: true,
        pauseOnWrong: true, autoShowCorrectAnswerInfo: false, autoShowIncorrectAnswerInfo: false,
      },
      subjectDetails: { showImmersionExamples: false, showPitchAccent: false, showPatternsOfUse: false },
    }));
  });
  await page.route("**/api/custom-srs", (route) => fulfillJson(route, { available: false, state: null, revision: -1 }));
  await page.route("**/api/analytics/session", (route) => fulfillJson(route, { recorded: true }));
  await page.route(/\/api\/analytics\/study-time(?:\?.*)?$/, (route) => fulfillJson(route, { available: true, days: [] }));
  await page.route(/\/api\/analytics\/streak(?:\?.*)?$/, (route) => fulfillJson(route, { activeDays: [], available: true }));
  await page.route("**/api/subjects/lists", (route) => fulfillJson(route, { lists: [] }));
  await page.route("**/api/subjects/enrichments", (route) => fulfillJson(route, { pitchAccents: [], patterns: [] }));
  await page.route("**/api/session/wanikani", (route) => fulfillJson(route, { user }));
  await page.route("**/api/wanikani/**", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").pop();
    if (resource === "user") return fulfillJson(route, user);
    if (resource === "assignments") return fulfillJson(route, collection([mode === "lessons" ? { ...assignment, data: { ...assignment.data, started_at: null, srs_stage: 0 } } : assignment]));
    if (resource === "subjects") return fulfillJson(route, collection([vocabulary]));
    if (resource === String(assignment.id)) return fulfillJson(route, assignment);
    if (resource === "reviews" && route.request().method() === "POST") return fulfillJson(route, { id: 1, object: "review", data: { assignment_id: assignment.id }, resources_updated: {} });
    return fulfillJson(route, collection([]));
  });
}

test("reviews discard a saved partial session and begin with a fresh queue", async ({ page }) => {
  await mockCoreStudy(page);
  await page.addInitScript(({ sessionKey }) => {
    localStorage.setItem(sessionKey, JSON.stringify({
      savedAt: new Date().toISOString(), startedAt: new Date().toISOString(),
      questionIds: ["107:reading"], completed: { 107: ["meaning"] },
      errors: { 107: { meaning: 2, reading: 0 } }, submittedIds: [],
    }));
  }, { sessionKey });
  await page.goto("/reviews");
  await expect(page.locator("#study-prompt-title")).toHaveText("meaning");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Resume reviews?" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start Fresh" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue Session" })).toHaveCount(0);
});

for (const mode of ["reviews", "lessons"] as const) {
  test(`${mode} use a headerless quiz with a joined prompt and answer control`, async ({ page }, testInfo) => {
    await mockCoreStudy(page, mode);
    await page.goto(`/${mode}`);
    if (mode === "lessons") await page.getByRole("button", { name: "Start lesson review" }).click();
    const input = page.getByRole("textbox", { name: "Your answer" });
    await expect(input).toBeVisible();
    await expect(page.getByRole("button", { name: /subject details|Replay audio/ })).toHaveCount(0);
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("link", { name: mode === "reviews" ? "Exit reviews" : "Exit lesson quiz" })).toBeVisible();
    const promptAndInput = await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>("#review-answer")!;
      const prompt = document.querySelector<HTMLElement>("#study-prompt-title")!.parentElement!;
      const row = input.parentElement!;
      return {
        promptBottom: Math.round(prompt.getBoundingClientRect().bottom),
        rowTop: Math.round(row.getBoundingClientRect().top),
        promptLeft: Math.round(prompt.getBoundingClientRect().left),
        rowLeft: Math.round(row.getBoundingClientRect().left),
        promptWidth: Math.round(prompt.getBoundingClientRect().width),
        rowWidth: Math.round(row.getBoundingClientRect().width),
      };
    });
    expect(Math.abs(promptAndInput.promptBottom - promptAndInput.rowTop)).toBeLessThanOrEqual(1);
    expect(promptAndInput.promptLeft).toBe(promptAndInput.rowLeft);
    expect(promptAndInput.promptWidth).toBe(promptAndInput.rowWidth);
    const glyph = page.locator("#question-prompt > span");
    await expect(glyph).toHaveCSS("font-weight", "350");
    await expect(glyph).toHaveCSS("font-family", /Noto Sans JP/);
    await page.screenshot({ path: testInfo.outputPath(`${mode}-polished-quiz.png`), fullPage: true, scale: "css" });
  });
}

test("a review can be left immediately before any reading or meaning is answered", async ({ page }) => {
  await mockCoreStudy(page);
  await page.goto("/reviews");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
  await page.getByRole("link", { name: "Exit reviews" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("dialog", { name: "Leave reviews?" })).toHaveCount(0);
});

test("leaving an incomplete reading and meaning pair warns, can be cancelled, and starts fresh next time", async ({ page }, testInfo) => {
  const reviewSubmissions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/wanikani/reviews") reviewSubmissions.push(request.url());
  });
  await mockCoreStudy(page);
  await page.goto("/reviews");
  await page.getByRole("textbox", { name: "Your answer" }).fill("river");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("Correct", { exact: true })).toBeVisible();

  // The warning also covers a correct first side still showing its feedback.
  await page.getByRole("link", { name: "Exit reviews" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave reviews?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Completed reviews are saved.");
  await page.screenshot({ path: testInfo.outputPath("incomplete-pair-warning.png"), scale: "css" });
  await dialog.getByRole("button", { name: "Keep reviewing" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#study-prompt-title")).toHaveText("meaning");

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  await page.getByRole("link", { name: "Exit reviews" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Leave reviews", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(reviewSubmissions).toEqual([]);

  await page.goto("/reviews");
  await expect(page.locator("#study-prompt-title")).toHaveText("meaning");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Continue Session" })).toHaveCount(0);
});

test("refresh warns about an incomplete pair and then begins a fresh review", async ({ page }) => {
  await mockCoreStudy(page);
  await page.goto("/reviews");
  await page.getByRole("textbox", { name: "Your answer" }).fill("river");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  const unloadWarning = page.waitForEvent("dialog");
  const reloading = page.reload();
  const warning = await unloadWarning;
  expect(warning.type()).toBe("beforeunload");
  await warning.accept();
  await reloading;
  await expect(page.locator("#study-prompt-title")).toHaveText("meaning");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
});

for (const entry of ["dashboard", "login"] as const) {
  test(`browser Back after entering from ${entry} keeps an incomplete review mounted until leaving is confirmed`, async ({ page }) => {
    await mockCoreStudy(page);
    if (entry === "login") {
      let connected = false;
      await page.route("**/api/session/wanikani", (route) => {
        if (route.request().method() === "POST") connected = true;
        return connected ? fulfillJson(route, { user }) : route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Not signed in" }) });
      });
      await page.goto("/login");
      await page.getByLabel("API token", { exact: true }).fill("mock-wanikani-token-for-browser-test");
      await page.getByRole("button", { name: "Open Kakehashi" }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
    } else await page.goto("/dashboard");
    await page.getByRole("link", { name: "Start reviews", exact: true }).click();
    const input = page.getByRole("textbox", { name: "Your answer" });
    await input.fill("river");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("#study-prompt-title")).toHaveText("reading");
    await input.fill("か");

    // A guarded traversal intentionally never completes a Playwright navigation.
    await page.evaluate(() => window.history.back());
    const dialog = page.getByRole("dialog", { name: "Leave reviews?" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/reviews$/);
    await dialog.getByRole("button", { name: "Keep reviewing" }).click();
    await expect(dialog).toBeHidden();
    await expect(input).toHaveValue("か");
    await expect(page.locator("#study-prompt-title")).toHaveText("reading");

    await page.evaluate(() => window.history.back());
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Leave reviews", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
}
