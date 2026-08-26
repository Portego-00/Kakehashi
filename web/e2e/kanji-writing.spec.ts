import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const now = "2026-08-06T20:00:00.000Z";
const oneStrokeData = {
  strokes: ["M512,368C608,378 744,389 882,368C910,364 934,385 916,404C892,428 853,452 832,458C819,462 803,463 782,458C732,448 674,438 512,420C354,404 207,396 120,393C109,393 99,386 100,376C100,358 123,340 145,329C179,312 206,323 240,329C336,348 430,361 512,368Z"],
  medians: [[[106, 379], [202, 359], [795, 419], [918, 393]]],
};
const threeStrokeData = {
  strokes: [
    "M298,665C269,663 262,651 284,638C304,626 324,620 346,618C384,616 542,647 651,661C687,666 709,673 715,678C739,703 692,718 679,722C656,729 608,718 541,701C447,679 360,670 298,665Z",
    "M313,411C295,409 293,395 316,382C334,372 357,367 379,371C476,386 572,398 665,406C689,409 697,418 689,430C679,446 660,457 637,462C605,470 537,448 313,411Z",
    "M106,119C129,95 164,84 196,90C407,136 691,148 787,142C821,140 903,120 919,147C931,170 892,192 876,202C842,224 812,231 787,226C661,203 466,175 135,147C99,144 88,138 106,119Z",
  ],
  medians: [
    [[276, 655], [368, 645], [717, 692]],
    [[303, 402], [687, 425]],
    [[109, 132], [195, 121], [791, 185], [917, 162]],
  ],
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockWritingPractice(page: Page, fixture: {
  character: string;
  meaning: string;
  reading: string;
  strokeData: typeof oneStrokeData;
} = { character: "一", meaning: "One", reading: "いち", strokeData: oneStrokeData }) {
  const user = {
    id: 1,
    object: "user",
    url: "",
    data_updated_at: now,
    data: {
      username: "WritingTester",
      level: 1,
      profile_url: "",
      started_at: now,
      current_vacation_started_at: null,
      preferences: {},
      subscription: { active: true, type: "lifetime", max_level_granted: 60, period_ends_at: null },
    },
  };
  const subject = {
    id: 2,
    object: "kanji",
    url: "",
    data_updated_at: now,
    data: {
      level: 1,
      lesson_position: 1,
      spaced_repetition_system_id: 1,
      created_at: now,
      slug: fixture.character,
      document_url: `https://www.wanikani.com/kanji/${encodeURIComponent(fixture.character)}`,
      hidden_at: null,
      characters: fixture.character,
      meanings: [{ meaning: fixture.meaning, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: [{ reading: fixture.reading, primary: true, accepted_answer: true, type: "onyomi" }],
      component_subject_ids: [],
      amalgamation_subject_ids: [],
      visually_similar_subject_ids: [],
    },
  };
  const assignment = {
    id: 102,
    object: "assignment",
    url: "",
    data_updated_at: now,
    data: {
      subject_id: 2,
      subject_type: "kanji",
      srs_stage: 2,
      available_at: null,
      started_at: now,
      unlocked_at: now,
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: now,
    },
  };
  const collection = (data: unknown[]) => ({
    object: "collection",
    url: "",
    pages: { next_url: null, previous_url: null, per_page: 1000 },
    total_count: data.length,
    data_updated_at: now,
    data,
  });

  await page.route("**/api/session/wanikani", (route) => json(route, { user }));
  await page.route("**/api/wanikani/**", (route) => {
    const resource = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/api\/wanikani\//, ""));
    if (resource === "user") return json(route, user);
    if (resource === "subjects") return json(route, collection([subject]));
    if (resource === "assignments") return json(route, collection([assignment]));
    return json(route, collection([]));
  });
  await page.route("https://cdn.jsdelivr.net/**", (route) => json(route, fixture.strokeData));
}

async function drawGuidedMedian(page: Page, canvas: Locator, median: number[][], input: "mouse" | "touch") {
  const writerSvg = canvas.locator("[data-hanzi-writer-target] svg");
  const normalizedPoints = median.map(([rawX, rawY]) => ({
    x: 68.2666667 + 0.8666667 * rawX,
    y: 848.2666667 - 0.8666667 * rawY,
  }));
  const box = await writerSvg.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const points = normalizedPoints.map((point) => ({
    x: box.x + (point.x / 1024) * box.width,
    y: box.y + (point.y / 1024) * box.height,
  }));
  if (input === "touch") {
    await writerSvg.evaluate((node, touchPoints) => {
      const legacyDocument = document as Document & {
        createTouch(view: Window, target: EventTarget, identifier: number, pageX: number, pageY: number, screenX: number, screenY: number): Touch;
        createTouchList(...touches: Touch[]): TouchList;
      };
      const createTouch = (point: { x: number; y: number }) =>
        legacyDocument.createTouch(window, node, 1, point.x, point.y, point.x, point.y);
      const dispatch = (type: "touchstart" | "touchmove", point: { x: number; y: number }) => {
        const touch = createTouch(point);
        const touches = legacyDocument.createTouchList(touch);
        node.dispatchEvent(new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          changedTouches: touches,
          targetTouches: touches,
          touches,
        } as unknown as TouchEventInit));
      };
      dispatch("touchstart", touchPoints[0]);
      touchPoints.slice(1).forEach((point) => dispatch("touchmove", point));
      const changedTouches = legacyDocument.createTouchList(createTouch(touchPoints.at(-1)!));
      document.dispatchEvent(new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        changedTouches,
        targetTouches: legacyDocument.createTouchList(),
        touches: legacyDocument.createTouchList(),
      } as unknown as TouchEventInit));
    }, points);
    return;
  }

  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 6 });
  await page.mouse.up();
}

test("guided kanji writing accepts a correctly drawn stroke", async ({ page }, testInfo) => {
  await mockWritingPractice(page);
  await page.goto("/study/kanji-writing");

  const lenient = page.getByRole("button", { name: "Lenient", exact: true });
  const veryStrict = page.getByRole("button", { name: "Very Strict" });
  await expect(lenient).toHaveAttribute("aria-pressed", "true");
  await veryStrict.click();
  await expect(veryStrict).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => {
    const stored = window.localStorage.getItem("kakehashi:study:v1:account:1:config:kanji-writing");
    return stored ? (JSON.parse(stored) as { strokeLeniency?: number }).strokeLeniency : null;
  })).toBe(0.8);

  await page.reload();
  await expect(page.getByRole("button", { name: "Very Strict" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Start session" }).click();

  const canvas = page.getByRole("img", { name: /Drawing area for One/ });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Stroke 1 of 1");

  const grid = page.getByRole("button", { name: "Grid" });
  const gridPath = canvas.locator('path[d="M512 0V1024M0 512H1024M0 0L1024 1024M1024 0L0 1024"]');
  await expect(grid).toHaveAttribute("aria-pressed", "true");
  await expect(gridPath).toHaveCount(1);
  await grid.click();
  await expect(grid).toHaveAttribute("aria-pressed", "false");
  await expect(gridPath).toHaveCount(0);

  await page.getByRole("button", { name: "Show outline" }).click();
  const sourcePath = canvas.locator("[data-guided-source-outline] path");
  await expect(sourcePath).toHaveAttribute("d", oneStrokeData.strokes[0]);
  await expect(sourcePath.locator("xpath=..")).toHaveAttribute(
    "transform",
    "translate(68.2666667 848.2666667) scale(0.8666667 -0.8666667)",
  );

  await drawGuidedMedian(page, canvas, oneStrokeData.medians[0], testInfo.project.name === "mobile" ? "touch" : "mouse");

  await expect(page.getByRole("status")).toContainText("Complete · no mistakes");
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
});

test("guided kanji writing rejects a later stroke out of order", async ({ page }, testInfo) => {
  await mockWritingPractice(page, {
    character: "三",
    meaning: "Three",
    reading: "さん",
    strokeData: threeStrokeData,
  });
  await page.goto("/study/kanji-writing");
  await page.getByRole("button", { name: "Start session" }).click();

  const canvas = page.getByRole("img", { name: /Drawing area for Three/ });
  await expect(page.getByRole("status")).toContainText("Stroke 1 of 3");

  const input = testInfo.project.name === "mobile" ? "touch" : "mouse";
  await drawGuidedMedian(page, canvas, threeStrokeData.medians[1], input);
  await expect(page.getByRole("status")).toContainText("Stroke 1 of 3 · Try that stroke again");
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);

  await page.setViewportSize(input === "touch" ? { height: 780, width: 430 } : { height: 760, width: 1_000 });
  await expect.poll(() => canvas.locator("[data-hanzi-writer-target] svg").evaluate((svg) =>
    Math.abs(Number(svg.getAttribute("width")) - svg.getBoundingClientRect().width),
  )).toBeLessThan(2);

  await drawGuidedMedian(page, canvas, threeStrokeData.medians[0], input);
  await expect(page.getByRole("status")).toContainText("Stroke 2 of 3");
});

test("freehand kanji writing submits and grades the drawing", async ({ page }) => {
  await mockWritingPractice(page);
  await page.goto("/study/kanji-writing");
  await page.getByRole("button", { name: "Freehand recall" }).click();
  await page.getByRole("button", { name: "Start session" }).click();

  const canvas = page.getByRole("img", { name: /Drawing area for One/ });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("status")).toContainText("submit it for grading");

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const screenPoint = (x: number, y: number) => ({
    x: box.x + (x / 1024) * box.width,
    y: box.y + (y / 1024) * box.height,
  });
  const start = screenPoint(106, 521);
  const end = screenPoint(918, 507);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("status")).toContainText("Correct");
  await expect(page.getByText(/Similarity \d+%/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay correct" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
});
