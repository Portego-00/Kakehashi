import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-08-27T10:00:00.000Z";

const user = {
  id: 1,
  object: "user",
  url: "",
  data_updated_at: now,
  data: {
    username: "Portego",
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

async function mockReview(page: Page, characters = "川") {
  await page.addInitScript(() => {
    localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({
      study: { reviewQuestionOrderEnabled: true, reviewQuestionOrder: "meaning-first", showAddSynonymButton: false },
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
    if (resource === "subjects") return fulfillJson(route, collection([{ ...vocabulary, data: { ...vocabulary.data, characters } }]));
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
  await page.getByRole("button", { name: "Check" }).tap();
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(input).toBeEditable();
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "Next", exact: true }).tap();
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
      const controls = (document.querySelector<HTMLElement>('[aria-label="Answer controls"]') ?? document.querySelector<HTMLElement>('form'))!;
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
    const next = page.getByRole("button", { name: "Next", exact: true });
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
    await expect(page.getByRole("banner")).toBeHidden();
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
      controls: bounds("form"),
    };
  });
  await expect.poll(async () => (await input.boundingBox())?.height).toBe(56);
  await page.getByRole("region", { name: "meaning", exact: true }).evaluate(async (region) => {
    await Promise.all(region.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
  });
  const label = page.locator('label[for="review-answer"]');
  const labelBounds = await label.boundingBox();
  const inputBounds = await input.boundingBox();
  expect(Math.abs(labelBounds!.y + labelBounds!.height - inputBounds!.y)).toBeLessThanOrEqual(1);
  await expect(page.locator("[data-study-session=active]")).toBeVisible();
  await expect(page.getByRole("banner")).toBeHidden();
  const originalLayout = await layout();
  await setKeyboardViewport(page, 390, 80);
  await expect(page.locator("[data-mobile-review-keyboard]")).toHaveCount(0);
  expect(await layout()).toEqual(originalLayout);
  await page.screenshot({ path: testInfo.outputPath("desktop-review.png") });

  await page.keyboard.press("Enter");
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(input).not.toBeEditable();
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
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();

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

test("fresh reviews keep the light font and restore result controls and D/R shortcuts", async ({ page }) => {
  await mockReview(page);
  await page.addInitScript(() => {
    localStorage.setItem("kakehashi-core-session:portego:reviews", JSON.stringify({ savedAt: new Date().toISOString(), questionIds: ["107:reading"], completed: { 107: ["meaning"] }, errors: {}, submittedIds: [] }));
    const state = window as typeof window & { reviewAudioPlays?: number };
    state.reviewAudioPlays = 0;
    class MockAudio extends EventTarget { play() { state.reviewAudioPlays! += 1; return Promise.resolve(); } pause() {} }
    Object.defineProperty(window, "Audio", { configurable: true, value: MockAudio });
  });
  await page.goto("/reviews");
  await expect(page.locator("#study-prompt-title")).toHaveText("meaning");
  await expect(page.getByText("Continue Session", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Audio", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Show subject details/ })).toHaveCount(0);
  await page.locator("#study-prompt-title").click();
  await page.keyboard.press("r");
  await page.keyboard.press("Space");
  expect(await page.evaluate(() => (window as typeof window & { reviewAudioPlays: number }).reviewAudioPlays)).toBe(0);
  await page.screenshot({ path: `/tmp/review-reference-before-${test.info().project.name}.png`, animations: "disabled" });
  await expect(page.locator('[aria-label="Review prompt"] h2 > *').first()).toHaveCSS("font-weight", "350");
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("not river");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark Correct", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Add as synonym", exact: true })).toBeEnabled();
  await input.focus();
  await page.keyboard.press("d");
  await expect(page.getByRole("heading", { name: "Subject details", exact: true })).toBeVisible();
  await page.screenshot({ path: `/tmp/review-reference-details-${test.info().project.name}.png`, fullPage: true, animations: "disabled" });
  await page.keyboard.press("d");
  await expect(page.getByRole("button", { name: /Show subject details/ })).toHaveAttribute("aria-expanded", "false");
  const audioBefore = await page.evaluate(() => (window as typeof window & { reviewAudioPlays: number }).reviewAudioPlays);
  await page.keyboard.press("r");
  await expect.poll(() => page.evaluate(() => (window as typeof window & { reviewAudioPlays: number }).reviewAudioPlays)).toBe(audioBefore + 1);
  await page.getByRole("button", { name: "Mark Correct", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark Incorrect", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark Incorrect", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark Correct", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kakehashi-core-session:portego:reviews"))).toBeNull();
  await page.reload();
  await expect(page.locator("#study-prompt-title")).toHaveText("meaning");
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeVisible();
});


test("previous words stay on one line and details animate through intermediate heights", async ({ page }) => {
  await mockReview(page, "人種");
  await page.goto("/reviews");
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("wrong");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add as synonym" })).toBeVisible();
  await page.getByRole("button", { name: /Show subject details/ }).click();
  const heights = await page.locator('[id="study-item-details"]').evaluate((panel) => new Promise<number[]>((resolve) => {
    const wrapper = panel.parentElement!.parentElement!;
    const values: number[] = [];
    const start = performance.now();
    function sample() {
      values.push(Math.round(wrapper.getBoundingClientRect().height));
      if (performance.now() - start < 350) requestAnimationFrame(sample); else resolve(values);
    }
    sample();
  }));
  expect(new Set(heights).size).toBeGreaterThan(3);
  await page.getByRole("button", { name: "Mark Correct", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const previous = page.getByRole("link", { name: "Previous meaning answer: River, correct" });
  await expect(previous).toBeVisible();
  const character = previous.locator('[lang="ja"]');
  await expect(character).toHaveCSS("white-space", "nowrap");
  expect(await character.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/review-previous-fixed-${test.info().project.name}.png` });
});


test("answer feedback and secondary controls follow the input on the left", async ({ page }) => {
  await mockReview(page);
  await page.goto("/reviews");
  await expect(page.getByRole("button", { name: "Skip review" })).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer" }).fill("wrong");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const correct = page.getByText("Correct answer", { exact: true });
  const correction = page.getByRole("button", { name: "Mark Correct", exact: true });
  const details = page.getByRole("button", { name: /Show subject details/ });
  await expect(correct).toBeVisible();
  await expect(correction).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark Incorrect", exact: true })).toBeVisible();
  const inputBounds = await page.getByRole("textbox", { name: "Your answer" }).boundingBox();
  for (const target of [correct, page.getByRole("button", { name: "Mark Incorrect", exact: true }), details]) {
    const box = await target.boundingBox();
    expect(Math.abs(box!.x - inputBounds!.x)).toBeLessThan(3);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/review-hierarchy-${test.info().project.name}.png`, fullPage: true });
});


test("result button shortcuts and measured details expansion work together", async ({ page }) => {
  await mockReview(page);
  await page.goto("/reviews");
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("wrong");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark Incorrect", exact: true }).locator("kbd")).toHaveText("Enter");
  await expect(page.getByRole("button", { name: "Mark Correct", exact: true }).locator("kbd")).toHaveText("C");
  await expect(page.getByRole("button", { name: "Add as synonym" }).locator("kbd")).toHaveText("S");
  await input.focus();
  await page.keyboard.press("c");
  await expect(page.getByRole("button", { name: "Mark Incorrect", exact: true }).locator("kbd")).toHaveText("X");
  await page.keyboard.press("x");
  await expect(page.getByRole("button", { name: "Mark Incorrect", exact: true }).locator("kbd")).toHaveText("Enter");
  await page.locator("[data-review-details-reveal]").evaluate((node) => {
    (window as typeof window & { detailFrames?: Promise<number[]> }).detailFrames = new Promise((resolve) => {
      document.addEventListener("keydown", () => {
        const samples: number[] = [];
        const start = performance.now();
        function sample() { samples.push(Math.round(node.getBoundingClientRect().height)); if (performance.now() - start < 500) requestAnimationFrame(sample); else resolve(samples); }
        sample();
      }, { once: true });
    });
  });
  await page.keyboard.press("d");
  const heights = await page.evaluate(() => (window as typeof window & { detailFrames: Promise<number[]> }).detailFrames);
  expect(new Set(heights).size).toBeGreaterThan(4);
  await page.screenshot({path: `/tmp/review-motion-${test.info().project.name}.png`, fullPage: true});
  await page.keyboard.press("d");
  await page.keyboard.press("Enter");
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
});
