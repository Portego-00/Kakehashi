import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update("mixed-layout-test-session-secret-32-characters").digest(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

const rows = [
  ["る<sup>1</sup>", "見（み）", "る", "て"],
  ["る<sup>5</sup>", "座（すわ）", "る", "って"],
  ["う", "歌（うた）", "う", "って"], ["つ", "打（う）", "つ", "って"],
  ["く", "歩（ある）", "く", "いて"], ["ぐ", "泳（およ）", "ぐ", "いで"],
  ["ぬ", "死（し）", "ぬ", "んで"], ["ぶ", "飛（と）", "ぶ", "んで"],
  ["む", "休（やす）", "む", "んで"], ["す", "話（はな）", "す", "して"],
];
const structure = "Examples:<br>" + rows.map(([ending, stem, removed, replacement], i) =>
  `<span class="gp-popout">［${ending}］Verb</span> ￫ ${stem}<del>${removed}</del> + <strong>${replacement}</strong>${[0, 3, 5, 8, 9].includes(i) ? "<br><br>" : "<br>"}`,
).join("") + 'Exceptions:<br>行（い）く ￫ <span class="chui">行（い）って</span><br><span class="gp-popout">する</span> ￫ <span class="chui">して</span><br><span class="gp-popout">くる</span> ￫ <span class="chui">きて</span>';
const grammar = {
  data: { id: "416", type: "grammar_point", attributes: {
    id: 416, title: "Verb + て", furigana: "～て (Conjunction)", slug: "verb-て", level: "JLPT5",
    meaning: "And, Then (Linking events)", casual_structure: structure,
    part_of_speech_translation: "Verb", word_type_translation: "Conjunctive Particle", register_translation: "Standard",
  } },
  included: [
    { id: "59", type: "writeup", attributes: { body: '<p>The <span data-gp-id="416">て</span> form connects a <span data-gp-id="12">る-Verb</span> to another action.</p><section class="caution"><h4>Caution</h4><p>There are several irregular verbs when it comes to <span data-gp-id="416">て</span> form conjugation.</p><ul class="writeup-examples--holder"><li data-study-question="183777"></li><li data-study-question="183778"></li><li data-study-question="183779"></li></ul></section>' } },
    { id: "183777", type: "study_question", attributes: { question_type: "readonly", content: "学校（がっこう）に行（い）って勉強（べんきょう）をする。", translation: 'I <strong>go</strong> to school,<strong> then</strong> study.', extra_info: "行（い）く's conjugation with て" } },
    { id: "183778", type: "study_question", attributes: { question_type: "readonly", content: "ダイエットをして痩（や）せる。", translation: 'To <strong>go on</strong> a diet,<strong> then</strong> lose weight.', extra_info: "する's conjugation with て" } },
    { id: "183779", type: "study_question", attributes: { question_type: "readonly", content: "公園（こうえん）に来（き）て遊（あそ）ぶ。", translation: 'To <strong>come to</strong> the park,<strong> then</strong> play.', extra_info: "来（く）る's conjugation with て" } },
  ],
};

test("matches Bunpro structure formatting, retains example notes, and links supported conjugation practice", async ({ page }, testInfo) => {
  await page.context().addCookies([
    { name: "kakehashi_wk_session", value: seal("mixed-layout-test-token"), url: "http://127.0.0.1:3101" },
    { name: "kakehashi_bunpro", value: seal(JSON.stringify({ owner: "1", token: "bunpro-layout-test-token" })), url: "http://127.0.0.1:3101" },
  ]);
  await page.route("**/api/session/wanikani", route => route.fulfill({ json: { user: { id: 1, object: "user", data: { username: "Portego", level: 2, preferences: {}, subscription: { active: true, max_level_granted: 60 } } } } }));
  await page.route("**/api/wanikani/**", route => route.fulfill({ json: { object: "collection", pages: { next_url: null }, data: [] } }));
  await page.route(/\/api\/bunpro(?:\?.*)?$/, route => {
    const action = new URL(route.request().url()).searchParams.get("action");
    const json = action === "lesson-queue" ? { data: [{ id: "1", attributes: { deck_id: 1, daily_goal: 2, batch_size: 2 } }], included: [{ id: "1", attributes: { title: "N5 Grammar", grammar_count: 100 } }] }
      : action === "learn" ? { content: [grammar, { data: { id: "100", type: "vocab", attributes: { title: "猫", slug: "cat", meaning: "Cat" } }, included: [] }] } : { connected: true };
    return route.fulfill({ json });
  });
  await page.goto("/bunpro-lessons?deck=1");
  await expect(page.getByRole("heading", { name: "Verb + て", exact: true })).toBeVisible();
  const structurePanel = page.locator("section").filter({ has: page.getByRole("heading", { name: "Structure", exact: true }) }).last();
  await expect(structurePanel.locator("sup").first()).toHaveText("1");
  await expect(structurePanel.getByText("する", { exact: true })).toHaveCSS("color", "rgb(69, 69, 69)");
  await expect(structurePanel.locator("strong").first()).toHaveCSS("color", "rgb(198, 73, 73)");
  await expect(structurePanel.locator("strong").first()).toHaveCSS("font-weight", "600");
  await expect(structurePanel.locator("[data-bunpro-caution]").first()).toHaveCSS("color", "rgb(251, 156, 4)");
  expect(await structurePanel.locator("del").first().evaluate(el => {
    const s = getComputedStyle(el, "::after"); return { top: s.borderTopColor, bottom: s.borderBottomColor };
  })).toEqual({ top: "rgb(232, 41, 53)", bottom: "rgb(232, 41, 53)" });
  await expect(structurePanel.locator("rt").first()).toHaveCSS("opacity", "0");
  await expect(page.getByRole("heading", { name: "Caution", exact: true })).toHaveCSS("color", "rgb(251, 156, 4)");
  const examples = page.locator("article");
  await expect(examples.first().getByText("く's conjugation with て", { exact: false })).toBeVisible();
  await expect(examples.nth(1).getByText("する's conjugation with て", { exact: false })).toBeVisible();
  await expect(examples.nth(2).getByText("る's conjugation with て", { exact: false })).toBeVisible();
  await expect(examples.first().getByText("go", { exact: true })).toHaveCSS("color", "rgb(198, 73, 73)");
  const practice = page.getByRole("complementary", { name: "Conjugation practice" });
  await expect(practice.getByRole("link")).toHaveAttribute("href", "https://kaijugation.bunpro.jp/create/416/verb-%E3%81%A6");
  await expect(practice.getByRole("link")).toHaveAttribute("target", "_blank");
  await page.getByRole("heading", { name: "About Verb + て" }).scrollIntoViewIfNeeded();
  const about = page.locator("section").filter({ has: page.getByRole("heading", { name: "About Verb + て" }) }).last();
  await about.screenshot({ path: testInfo.outputPath("conjugation-notes.png") });
  await practice.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await practice.screenshot({ path: testInfo.outputPath("kaijugation-practice.png") });
  await page.screenshot({ path: testInfo.outputPath("bunpro-details.png"), fullPage: true });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "猫", exact: true })).toBeVisible();
  await expect(practice).toHaveCount(0);
});
