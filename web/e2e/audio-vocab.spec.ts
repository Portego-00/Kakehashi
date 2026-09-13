import { expect, test, type Page } from "@playwright/test";

async function mockAudioVocabularyData(page: Page) {
  const now = "2026-09-03T10:00:00Z";
  const user = {
    id: 1,
    object: "user",
    data_updated_at: now,
    data: {
      username: "AudioTester",
      level: 8,
      preferences: {},
      subscription: { active: true, max_level_granted: 60 },
    },
  };
  const subject = {
    id: 100,
    object: "vocabulary",
    data_updated_at: now,
    data: {
      level: 8,
      slug: "数字",
      characters: "数字",
      hidden_at: null,
      meanings: [{ meaning: "Numeral", primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: [{ reading: "すうじ", primary: true, accepted_answer: true }],
      context_sentences: [
        { ja: "数字を書いてください。", en: "Please write the number." },
      ],
      pronunciation_audios: [
        {
          url: "https://example.com/suuji.wav",
          content_type: "audio/wav",
          metadata: { gender: "female", pronunciation: "すうじ" },
        },
      ],
    },
  };
  const assignment = {
    id: 101,
    object: "assignment",
    data_updated_at: now,
    data: {
      subject_id: 100,
      subject_type: "vocabulary",
      srs_stage: 3,
      started_at: now,
      unlocked_at: now,
      hidden: false,
    },
  };
  const collection = (data: unknown[]) => ({
    object: "collection",
    pages: { next_url: null },
    total_count: data.length,
    data_updated_at: now,
    data,
  });
  await page.route("**/api/session/wanikani", (route) =>
    route.fulfill({ json: { user } }),
  );
  await page.route("**/api/subjects/lists", (route) =>
    route.fulfill({ json: { lists: [] } }),
  );
  await page.route("**/api/subjects/enrichments", (route) =>
    route.fulfill({ json: { pitchAccents: [], patterns: [] } }),
  );
  await page.route("**/api/wanikani/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith("/subjects")
        ? collection([subject])
        : path.endsWith("/assignments")
          ? collection([assignment])
          : path.endsWith("/user")
            ? user
            : collection([]),
    });
  });
  // A short PCM recording keeps the browser's real audio element in this test.
  const wav = Buffer.alloc(16044);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(16036, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page.route("https://example.com/suuji.wav", (route) =>
    route.fulfill({ body: wav, contentType: "audio/wav" }),
  );
}

test("audio vocab uses typed meanings, resumes, and completes without repeats", async ({
  page,
}, testInfo) => {
  await mockAudioVocabularyData(page);
  await page.goto("/study");
  await page.getByRole("link", { name: /Audio vocab/ }).click();
  await expect(
    page.getByRole("heading", { name: "Audio vocab", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(
    page.getByRole("heading", { name: "What does this word mean?" }),
  ).toBeVisible();
  await expect(page.getByText("Numeral", { exact: true })).toHaveCount(0);
  await expect(page.getByText("数字", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Play vocabulary audio slowly", exact: true })
    .click();
  await expect(page.locator("audio")).toHaveJSProperty("playbackRate", 0.75);
  await page.screenshot({
    path: `/tmp/kakehashi-audio-vocab-${testInfo.project.name}-typed-question.png`,
    animations: "disabled",
    fullPage: true,
    style: "nextjs-portal { visibility: hidden; }",
  });
  await expect(
    page.getByRole("textbox", { name: "Vocabulary Meaning" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal answer" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Pause and exit session" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Resume saved session/ }).click();
  await expect(page.getByText("Numeral", { exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Vocabulary Meaning" }).fill("dog");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(page.getByText("Numeral", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `/tmp/kakehashi-audio-vocab-${testInfo.project.name}-typed-answer.png`,
    animations: "disabled",
    fullPage: true,
    style: "nextjs-portal { visibility: hidden; }",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Show subject details/ }).click();
  const details = page.getByRole("region", { name: "Subject details" });
  await expect(
    details.locator("header").getByText("数字", { exact: true }),
  ).toBeVisible();
  await details.screenshot({
    path: `/tmp/kakehashi-subject-details-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  await details.getByRole("tab", { name: "Reading", exact: true }).click();
  await expect(
    details.locator("header").getByText("数字", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Session results" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to setup" }).click();
  await expect(
    page.getByRole("button", { name: /Resume saved session/ }),
  ).toHaveCount(0);
});

test("context audio speaks the target word and sentence, survives resume, and accepts the word meaning", async ({
  page,
}, testInfo) => {
  await mockAudioVocabularyData(page);
  // Speech is mocked so this checks browser wiring and lifecycle, not voice output.
  await page.addInitScript(() => {
    const speechState = {
      utterances: [] as { text: string; rate: number; lang: string }[],
      cancellations: 0,
    };
    Object.assign(window, { __audioVocabSpeech: speechState });
    class TestUtterance {
      lang = "";
      rate = 1;
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      constructor(public text: string) {}
    }
    let active: TestUtterance | null = null;
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: TestUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ lang: "ja-JP", name: "Test Japanese" }],
        cancel: () => {
          speechState.cancellations += 1;
          active?.onerror?.({ error: "canceled" });
          active = null;
        },
        speak: (utterance: TestUtterance) => {
          active = utterance;
          speechState.utterances.push({
            text: utterance.text,
            rate: utterance.rate,
            lang: utterance.lang,
          });
          utterance.onstart?.();
        },
      },
    });
  });
  const readSpeechState = () =>
    page.evaluate(
      () =>
        (
          window as typeof window & {
            __audioVocabSpeech: {
              utterances: { text: string; rate: number; lang: string }[];
              cancellations: number;
            };
          }
        ).__audioVocabSpeech,
    );

  await page.goto("/study/audio-vocab");
  await page
    .getByRole("button", { name: "Context sentences", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Context sentences", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Vocabulary Meaning" }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readSpeechState()).utterances)
    .toEqual([
      { text: "すうじ。数字を書いてください。", rate: 1, lang: "ja-JP" },
    ]);
  await expect(
    page.getByText("Listen to the word, then its sentence."),
  ).toBeVisible();
  for (const hiddenText of [
    "数字",
    "すうじ",
    "Numeral",
    "数字を書いてください。",
    "Please write the number.",
  ]) {
    await expect(page.getByText(hiddenText, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator("audio")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Play vocabulary audio slowly", exact: true })
    .click();
  await expect
    .poll(async () => (await readSpeechState()).utterances.at(-1)?.rate)
    .toBe(0.75);
  const cancellationsBeforeExit = (await readSpeechState()).cancellations;
  await page.getByRole("button", { name: "Pause and exit session" }).click();
  await expect
    .poll(async () => (await readSpeechState()).cancellations)
    .toBe(cancellationsBeforeExit + 1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Context sentences", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Resume saved session/ }).click();
  await expect
    .poll(async () => (await readSpeechState()).utterances)
    .toEqual([
      { text: "すうじ。数字を書いてください。", rate: 1, lang: "ja-JP" },
    ]);
  await expect(page.getByText("数字", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: `/tmp/kakehashi-audio-vocab-${testInfo.project.name}-sentence-question.png`,
    animations: "disabled",
    fullPage: true,
    style: "nextjs-portal { visibility: hidden; }",
  });
  await page
    .getByRole("textbox", { name: "Vocabulary Meaning" })
    .fill("Numeral");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Session results" }),
  ).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "数字 responses" })
      .getByText("Correct", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Back to setup" }).click();
  await expect(
    page.getByRole("button", { name: /Resume saved session/ }),
  ).toHaveCount(0);
});
