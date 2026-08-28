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
  await page.route("**/api/session/wanikani", (route) => fulfillJson(route, { user }));
  await page.route("**/api/wanikani/**", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").pop();
    if (resource === "user") return fulfillJson(route, user);
    if (resource === "assignments") return fulfillJson(route, collection([assignment]));
    if (resource === "subjects") return fulfillJson(route, collection([vocabulary]));
    return fulfillJson(route, collection([]));
  });
}

test("Enter advances after the learner clicks review audio", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { __reviewAudioPlayCount?: number };
    state.__reviewAudioPlayCount = 0;
    class MockAudio extends EventTarget {
      constructor(readonly src = "") { super(); }
      play() {
        state.__reviewAudioPlayCount = (state.__reviewAudioPlayCount ?? 0) + 1;
        return Promise.resolve();
      }
    }
    Object.defineProperty(window, "Audio", { configurable: true, value: MockAudio });
  });
  await mockReview(page);
  await page.goto("/reviews");

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
