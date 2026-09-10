import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-08-27T10:00:00.000Z";

const user = {
  id: 1,
  object: "user",
  url: "",
  data_updated_at: now,
  data: {
    username: "review-enter-test",
    level: 2,
    profile_url: "",
    started_at: "2026-01-01T00:00:00.000Z",
    current_vacation_started_at: null,
    preferences: {},
    subscription: { active: true, type: "lifetime", max_level_granted: 60 },
  },
};

const vocabulary = {
  id: 7,
  object: "vocabulary",
  url: "",
  data_updated_at: now,
  data: {
    level: 2,
    created_at: "2026-01-01T00:00:00.000Z",
    slug: "川",
    document_url: "https://www.wanikani.com/vocabulary/%E5%B7%9D",
    hidden_at: null,
    characters: "川",
    meanings: [{ meaning: "River", primary: true, accepted_answer: true }],
    auxiliary_meanings: [],
    readings: [{ reading: "かわ", primary: true, accepted_answer: true }],
    meaning_mnemonic: "A river.",
    reading_mnemonic: "Read it as かわ.",
    component_subject_ids: [],
    context_sentences: [],
    parts_of_speech: ["noun"],
    pronunciation_audios: [{ url: "https://example.com/kawa.mp3", content_type: "audio/mpeg", metadata: {} }],
  },
};

const assignment = {
  id: 107,
  object: "assignment",
  url: "",
  data_updated_at: now,
  data: {
    subject_id: vocabulary.id,
    subject_type: vocabulary.object,
    srs_stage: 3,
    available_at: "2020-01-01T00:00:00.000Z",
    started_at: "2026-01-02T00:00:00.000Z",
    unlocked_at: "2026-01-01T00:00:00.000Z",
    passed_at: null,
    burned_at: null,
    resurrected_at: null,
    hidden: false,
    created_at: "2026-01-01T00:00:00.000Z",
  },
};

function collection(data: unknown[]) {
  return { object: "collection", url: "", pages: { next_url: null, previous_url: null, per_page: 1000 }, total_count: data.length, data_updated_at: now, data };
}

async function fulfillJson(route: Route, json: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
}

async function mockReview(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kakehashi-web:settings:review-enter-test:v1", JSON.stringify({
      study: { reviewQuestionOrderEnabled: true, reviewQuestionOrder: "meaning-first" },
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
    if (resource === "assignments") return fulfillJson(route, collection([assignment]));
    if (resource === "subjects") return fulfillJson(route, collection([vocabulary]));
    return fulfillJson(route, collection([]));
  });
}

async function setKeyboardViewport(page: Page, height: number, offsetTop = 0) {
  // Headless browsers have no OS keyboard; exercise its visual viewport events and resulting DOM geometry.
  await page.evaluate(({ height, offsetTop }) => {
    const viewport = window.visualViewport;
    if (!viewport) throw new Error("VisualViewport is required for this regression");
    Object.defineProperties(viewport, {
      height: { configurable: true, get: () => height },
      offsetTop: { configurable: true, get: () => offsetTop },
    });
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("scroll"));
  }, { height, offsetTop });
}

test("phone Enter keeps the same editable answer focused through feedback and the next question", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile keyboard continuity only");
  await mockReview(page);
  await page.goto("/reviews", { waitUntil: "domcontentloaded" });

  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("not river");
  const originalInput = await input.elementHandle();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(input).toBeEnabled();
  await expect(input).toBeEditable();
  await expect(input).toBeFocused();
  expect(await originalInput!.evaluate((element) => element === document.activeElement)).toBe(true);

  await page.keyboard.press("Enter");
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  expect(await originalInput!.evaluate((element) => element === document.activeElement)).toBe(true);
});

test("phone taps keep the answer focused when checking and advancing", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Touch keyboard continuity only");
  await mockReview(page);
  await page.goto("/reviews", { waitUntil: "domcontentloaded" });
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("not river");
  const originalInput = await input.elementHandle();
  await setKeyboardViewport(page, 390);
  await expect(page.locator("[data-mobile-review-keyboard]")).toHaveCount(1);
  await page.getByRole("button", { name: "Check Answer" }).tap();
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(input).toBeEditable();
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "Next Question" }).tap();
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  expect(await originalInput!.evaluate((element) => element === document.activeElement)).toBe(true);
});

for (const { height, offsetTop } of [{ height: 390, offsetTop: 0 }, { height: 390, offsetTop: 80 }, { height: 333, offsetTop: 0 }, { height: 350, offsetTop: 80 }, { height: 320, offsetTop: 0 }]) {
  test(`phone review fits a ${height}px keyboard viewport with offset ${offsetTop}`, async ({ page, isMobile }, testInfo) => {
    test.skip(!isMobile, "Mobile visual viewport layout only");
    await mockReview(page);
    await page.goto("/reviews", { waitUntil: "domcontentloaded" });

    const input = page.getByRole("textbox", { name: "Your answer" });
    const fullHeight = await page.evaluate(() => window.visualViewport!.height);
    await input.fill("not river");
    await setKeyboardViewport(page, height, offsetTop);

    const geometry = async () => page.evaluate(() => {
      const prompt = document.querySelector<HTMLElement>('[aria-label="Review prompt"]')!;
      const controls = document.querySelector<HTMLElement>('[aria-label="Answer controls"]')!;
      const answer = document.querySelector<HTMLInputElement>("#review-answer")!;
      const answerRegion = answer.closest("form")!.parentElement!;
      const glyph = prompt.lastElementChild!;
      const viewport = window.visualViewport!;
      return {
        promptTop: Math.round(prompt.getBoundingClientRect().top - viewport.offsetTop),
        inputBottom: Math.round(answer.getBoundingClientRect().bottom - viewport.offsetTop),
        controlsBottom: Math.round(controls.getBoundingClientRect().bottom - viewport.offsetTop),
        viewportHeight: Math.round(viewport.height),
        answerOverflow: answerRegion.scrollHeight - answerRegion.clientHeight,
        glyphOverflow: glyph.scrollHeight - glyph.clientHeight,
        scrollY: Math.round(window.scrollY),
      };
    });
    await expect.poll(async () => (await geometry()).controlsBottom).toBeLessThanOrEqual(height);
    expect((await geometry()).promptTop).toBeGreaterThanOrEqual(0);
    await expect(input).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`phone-keyboard-${height}-${offsetTop}.png`), clip: { x: 0, y: offsetTop, width: 390, height }, scale: "css" });

    await page.keyboard.press("Enter");
    const next = page.getByRole("button", { name: "Next Question" });
    const feedback = page.getByRole("status").filter({ has: page.getByText("Incorrect", { exact: true }) });
    await expect(next).toBeVisible();
    await expect.poll(async () => {
      const bounds = await geometry();
      const nextBounds = await next.boundingBox();
      return bounds.promptTop >= 0 && Boolean(nextBounds && nextBounds.y + nextBounds.height <= offsetTop + bounds.viewportHeight);
    }).toBe(true);
    const feedbackBounds = await feedback.boundingBox();
    expect(feedbackBounds).not.toBeNull();
    expect(feedbackBounds!.y + feedbackBounds!.height).toBeLessThanOrEqual(offsetTop + height);
    expect((await geometry()).answerOverflow).toBeLessThanOrEqual(1);
    expect((await geometry()).glyphOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`phone-feedback-${height}-${offsetTop}.png`), clip: { x: 0, y: offsetTop, width: 390, height }, scale: "css" });

    await page.keyboard.press("Enter");
    await expect(page.locator("#study-prompt-title")).toHaveText("reading");
    await expect(input).toBeFocused();
    expect((await geometry()).scrollY).toBe(0);
    await setKeyboardViewport(page, fullHeight);
    await expect(page.locator("[data-mobile-review-keyboard]")).toHaveCount(0);
    await expect(page.getByRole("banner")).toBeVisible();
  });
}

test("desktop review retains its layout and submitted input behavior", async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, "Desktop layout baseline only");
  await mockReview(page);
  await page.goto("/reviews", { waitUntil: "domcontentloaded" });
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("not river");

  const layout = () => page.evaluate(() => {
    const bounds = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height].map(Math.round);
    };
    return {
      shell: bounds("main > div"),
      prompt: bounds('[aria-label="Review prompt"]'),
      input: bounds("#review-answer"),
      controls: bounds('[aria-label="Answer controls"]'),
    };
  });
  await expect.poll(async () => (await input.boundingBox())?.height).toBe(56);
  await page.getByRole("region", { name: "meaning", exact: true }).evaluate(async (region) => {
    await Promise.all(region.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
  });
  const originalLayout = await layout();
  await setKeyboardViewport(page, 390, 80);
  await expect(page.locator("[data-mobile-review-keyboard]")).toHaveCount(0);
  expect(await layout()).toEqual(originalLayout);
  await page.screenshot({ path: testInfo.outputPath("desktop-review.png") });

  await page.keyboard.press("Enter");
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(input).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  await expect(input).toBeFocused();
});

test("Enter advances after the learner clicks review audio", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { __reviewAudioPlayCount?: number };
    state.__reviewAudioPlayCount = 0;
    class MockAudio extends EventTarget {
      constructor(readonly src = "") { super(); }
      play() {
        if (this.src === "https://example.com/kawa.mp3") {
          state.__reviewAudioPlayCount = (state.__reviewAudioPlayCount ?? 0) + 1;
        }
        return Promise.resolve();
      }
    }
    Object.defineProperty(window, "Audio", { configurable: true, value: MockAudio });
  });
  await mockReview(page);
  await page.goto("/reviews", { waitUntil: "domcontentloaded" });

  await page.getByRole("textbox", { name: "Your answer" }).fill("not river");
  await page.getByRole("button", { name: "Check Answer" }).click();
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next Question" })).toBeVisible();

  const audio = page.getByRole("button", { name: "Audio", exact: true });
  await audio.click();
  await audio.focus();
  await expect(audio).toBeFocused();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __reviewAudioPlayCount?: number }).__reviewAudioPlayCount ?? 0)).toBe(1);

  await page.keyboard.press("Enter");

  await expect.poll(async () => ({
    prompt: await page.locator("#study-prompt-title").textContent(),
    audioPlays: await page.evaluate(() => (window as typeof window & { __reviewAudioPlayCount?: number }).__reviewAudioPlayCount ?? 0),
  }), { timeout: 1_000 }).toEqual({ prompt: "reading", audioPlays: 1 });
});
