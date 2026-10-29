import { expect, test } from "@playwright/test";

const imageUrl = "https://note-permissions.example/bridge.svg";
const collection = (data: unknown[] = []) => ({ object: "collection", data, pages: { next_url: null }, total_count: data.length });

for (const { operation, status } of [{ operation: "create", status: 401 }, { operation: "update", status: 403 }]) {
  test(`explains missing ${operation} permission and retains the image draft for retry`, async ({ page }, testInfo) => {
    let denied = true;
    let note = operation === "update" ? "Original note" : "";
    let exists = operation === "update";
    const user = { id: 1, object: "user", data: { username: "NotePermissionsTest", level: 10, preferences: {}, subscription: { active: true, max_level_granted: 60 } } };
    const subject = { id: 7, object: "kanji", data_updated_at: "2026-10-29T10:00:00Z", data: {
      level: 1, slug: "橋", characters: "橋", meanings: [{ meaning: "Bridge", primary: true, accepted_answer: true }], readings: [{ reading: "はし", type: "kunyomi", primary: true, accepted_answer: true }],
      meaning_mnemonic: "A bridge connects two sides.", reading_mnemonic: "Remember はし.", component_subject_ids: [], amalgamation_subject_ids: [], visually_similar_subject_ids: [],
    } };
    const material = () => ({ id: 42, object: "study_material", data: { subject_id: 7, subject_type: "kanji", meaning_note: note, reading_note: "", meaning_synonyms: [], hidden: false } });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/session/wanikani") return route.fulfill({ json: { user } });
      if (path.endsWith("/user")) return route.fulfill({ json: user });
      if (path.endsWith("/subjects/7")) return route.fulfill({ json: subject });
      if (/\/study_materials(?:\/42)?$/.test(path) && ["PUT", "POST"].includes(route.request().method())) {
        if (denied) return route.fulfill({ status, json: { error: "Unauthorized. Nice try.", code: status } });
        note = route.request().postDataJSON().study_material.meaning_note;
        exists = true;
        return route.fulfill({ json: material() });
      }
      if (path.endsWith("/study_materials")) return route.fulfill({ json: collection(exists ? [material()] : []) });
      if (path.endsWith("/summary")) return route.fulfill({ json: { data: { lessons: [], reviews: [], next_reviews_at: null } } });
      return route.fulfill({ json: collection() });
    });
    await page.route(imageUrl, (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f6f1df"/><text x="100" y="130" text-anchor="middle" font-size="80">橋</text></svg>' }));
    await page.goto("/subjects/7");
    await page.getByRole("tab", { name: "Meaning", exact: true }).click();
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Meaning note", exact: true }) });
    await section.getByRole("button", { name: "Add image", exact: true }).click();
    await page.getByRole("textbox", { name: "Meaning note", exact: true }).fill("My bridge mnemonic");
    await page.getByLabel("Image URL").fill(imageUrl);
    await expect(page.getByRole("button", { name: "Add to note", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Add to note", exact: true }).click();
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Enable saving notes", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("study_materials:create");
    await expect(dialog).toContainText("study_materials:update");
    await expect(dialog.getByRole("link", { name: "Open API token settings" })).toHaveAttribute("href", "https://www.wanikani.com/settings/personal_access_tokens");
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath("note-permissions.png") });
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(page.getByRole("textbox", { name: "Meaning note", exact: true })).toHaveValue("My bridge mnemonic");
    await expect(section.getByRole("button", { name: "Open note image 1" })).toBeVisible();
    denied = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(section.getByRole("button", { name: "Edit meaning note" })).toBeVisible();
    expect(note).toBe(`My bridge mnemonic\n<img src="${imageUrl}">`);
  });
}
