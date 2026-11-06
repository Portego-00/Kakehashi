import { expect, test } from "@playwright/test";

const imageUrl = "https://note-images.example/bridge.svg";
const collection = (data: unknown[] = []) => ({ object: "collection", data, pages: { next_url: null }, total_count: data.length });

test("note images survive saves, fit the screen, zoom, and can be removed", async ({ page, browserName }, testInfo) => {
  let note = "Remember the bridge.";
  const user = { id: 1, object: "user", data: { username: "NoteImageTest", level: 10, preferences: {}, subscription: { active: true, max_level_granted: 60 } } };
  const subject = { id: 7, object: "kanji", data_updated_at: "2026-10-25T10:00:00Z", data: {
    level: 1, slug: "橋", characters: "橋", meanings: [{ meaning: "Bridge", primary: true, accepted_answer: true }], readings: [{ reading: "はし", type: "kunyomi", primary: true, accepted_answer: true }],
    meaning_mnemonic: "A bridge connects two sides.", reading_mnemonic: "Remember はし.", component_subject_ids: [], amalgamation_subject_ids: [], visually_similar_subject_ids: [],
  } };
  const material = () => ({ id: 42, object: "study_material", data: { subject_id: 7, subject_type: "kanji", meaning_note: note, reading_note: "", meaning_synonyms: [], hidden: false } });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/session/wanikani") return route.fulfill({ json: { user } });
    if (path.endsWith("/user")) return route.fulfill({ json: user });
    if (path.endsWith("/subjects/7")) return route.fulfill({ json: subject });
    if (path.endsWith("/study_materials/42") && route.request().method() === "PUT") {
      note = route.request().postDataJSON().study_material.meaning_note;
      return route.fulfill({ json: material() });
    }
    if (path.endsWith("/study_materials")) return route.fulfill({ json: collection([material()]) });
    if (path.endsWith("/summary")) return route.fulfill({ json: { data: { lessons: [], reviews: [], next_reviews_at: null } } });
    return route.fulfill({ json: collection() });
  });
  // An unusually tall reference verifies that the preview uses containment.
  await page.route(imageUrl, (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="1200"><rect width="240" height="1200" fill="#f6f1df"/><path d="M20 900V300Q120 100 220 300V900M20 900H220M20 300H220" fill="none" stroke="#774f2e" stroke-width="12"/><text x="120" y="1060" font-size="80" text-anchor="middle" fill="#333">橋</text></svg>' }));
  await page.goto("/subjects/7");
  await page.getByRole("tab", { name: "Meaning", exact: true }).click();
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Meaning note", exact: true }) });
  await section.getByRole("button", { name: "Add image" }).click();
  await page.getByLabel("Image URL").fill(imageUrl);
  await expect(page.getByRole("button", { name: "Add to note", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Add to note", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Meaning note", exact: true })).toHaveValue("Remember the bridge.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(section.getByRole("button", { name: "Edit meaning note" })).toBeVisible();
  expect(note).toContain(`<img src="${imageUrl}">`);
  const thumbnail = section.getByRole("img", { name: "Note image", exact: true });
  await expect(thumbnail).toHaveCSS("object-fit", "contain");
  const box = await thumbnail.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(180);
  await page.screenshot({ path: testInfo.outputPath("note-images.png"), fullPage: true });
  await section.getByRole("button", { name: "Open note image 1" }).click();
  const viewer = page.getByRole("dialog", { name: "Note image", exact: true });
  await expect(viewer).toBeVisible();
  const viewerBox = await viewer.boundingBox();
  const viewport = page.viewportSize()!;
  expect(viewerBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(viewerBox!.height).toBeLessThanOrEqual(viewport.height);
  await expect(viewer.getByRole("button", { name: /Zoom in|Zoom out|Reset zoom/ })).toHaveCount(0);
  const imageViewport = viewer.getByRole("group", { name: "Image zoom and pan" });
  const area = (await imageViewport.boundingBox())!;
  const x = area.x + area.width / 2;
  const y = area.y + area.height / 2;
  await expect.poll(() => viewer.getByAltText("Expanded note image").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const session = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
  if (session) await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const fingers = (distance: number) => [{ id: 1, x: x - distance / 2, y }, { id: 2, x: x + distance / 2, y }];
  const touch = async (type: "touchStart" | "touchMove" | "touchEnd", distance: number) => {
    if (session) {
      await session.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : fingers(distance) });
    } else {
      // WebKit automation has no multi-touch injection API; exercise its touch
      // event path in the browser with the same contact positions instead.
      await imageViewport.evaluate((element, { type, distance, x, y }) => {
        const event = new Event(type.toLowerCase(), { bubbles: true, cancelable: true });
        Object.defineProperty(event, "touches", { value: type === "touchEnd" ? [] : [{ identifier: 1, clientX: x - distance / 2, clientY: y }, { identifier: 2, clientX: x + distance / 2, clientY: y }] });
        element.dispatchEvent(event);
      }, { type, distance, x, y });
    }
  };
  await touch("touchStart", 80);
  await touch("touchMove", 160);
  await expect(viewer.getByLabel("Image zoom", { exact: true })).toHaveText("200%");
  await touch("touchMove", 80);
  await expect(viewer.getByLabel("Image zoom", { exact: true })).toHaveText("100%");
  await touch("touchEnd", 0);
  await session?.detach();
  await page.screenshot({ path: testInfo.outputPath("note-image-viewer.png") });
  await viewer.getByRole("button", { name: "Remove image", exact: true }).click();
  await expect(viewer).not.toBeVisible();
  await expect(section.getByRole("img", { name: "Note image", exact: true })).toHaveCount(0);
  expect(note).toBe("Remember the bridge.");
});
