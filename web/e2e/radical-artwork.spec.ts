import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const now = "2026-10-25T00:00:00.000Z";
const stages = [0, 2, 5];
const collection = (data: unknown[] = []) => ({ object: "collection", data, pages: { next_url: null }, total_count: data.length });

// The reported radicals' WaniKani artwork, including their class-based strokes.
const artwork = [
  {
    name: "Yurt", id: 8787, level: 9,
    url: "https://files.wanikani.com/15z81qc4c77tmjeypri69yrtipgd",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><clipPath id="a"><path d="M140-149h800v309H140z" class="a"/></clipPath><clipPath id="b"><path d="M140 160h1072v362H140z" class="a"/></clipPath><style>.a,.b{fill:none}.b{stroke:var(--color-text, #000);stroke-linecap:square;stroke-miterlimit:2;stroke-width:68px}</style></defs><path d="M60 940c80-240 80-440 80-600V160l800-1" class="b"/><path d="M380 240v240h360V240" class="b"/><path d="M540 60v99" class="b" style="clip-path:url(#a)"/><path d="M140 340h800" class="b" style="clip-path:url(#b)"/></svg>',
  },
  {
    name: "Creeper", id: 8781, level: 13,
    url: "https://files.wanikani.com/nb178l9s3p19munbl7unsn8x00k6",
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><style>.a{fill:none;stroke:var(--color-text, #000);stroke-linecap:square;stroke-miterlimit:2;stroke-width:68px}</style></defs><path d="M100 300h800M160 460h680v280H160z" class="a"/></svg>',
  },
];

async function mockAccount(page: Page, radical: typeof artwork[number], includeTextControl = false) {
  const user = { id: 1, object: "user", data: { username: "RadicalArtworkTest", level: radical.level, preferences: {}, subscription: { active: true, max_level_granted: 60 } } };
  const imageSubjects = stages.map((stage, index) => ({
    id: radical.id + index * 10_000, object: "radical", data_updated_at: now,
    data: {
      level: radical.level, slug: `${radical.name.toLowerCase()}-${stage}`, hidden_at: null, characters: null,
      meanings: [{ meaning: `${radical.name} ${stage}`, primary: true, accepted_answer: true }], auxiliary_meanings: [],
      character_images: [{ url: radical.url, content_type: "image/svg+xml" }],
    },
  }));
  const subjects = includeTextControl ? [...imageSubjects, {
    ...imageSubjects[0], id: 900_000,
    data: { ...imageSubjects[0].data, slug: "ground", characters: "一", meanings: [{ meaning: "Ground", primary: true, accepted_answer: true }], character_images: [] },
  }] : imageSubjects;
  const assignments = subjects.map((subject, index) => ({
    id: subject.id, object: "assignment", data_updated_at: now,
    data: { subject_id: subject.id, subject_type: "radical", srs_stage: stages[index] ?? 2, hidden: false, unlocked_at: now, started_at: index ? now : null, passed_at: index === 2 ? now : null, available_at: null },
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session/wanikani") return route.fulfill({ json: { user } });
    if (path.endsWith("/user")) return route.fulfill({ json: user });
    if (path.endsWith("/subjects")) return route.fulfill({ json: collection(subjects) });
    if (path.endsWith("/assignments")) return route.fulfill({ json: collection(assignments) });
    if (path.endsWith("/summary")) return route.fulfill({ json: { data: { lessons: [], reviews: [], next_reviews_at: null } } });
    return route.fulfill({ json: collection() });
  });
  await page.route(radical.url, (route) => route.fulfill({ contentType: "image/svg+xml", body: radical.svg }));
}

for (const radical of artwork) {
  test(`${radical.name} shows a hover underline like character radicals`, async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, "Hover feedback is for a fine pointer.");
    await mockAccount(page, radical, true);
    await page.goto("/dashboard");
    await expect(page.getByRole("img", { name: `${radical.name} 2 radical`, exact: true }).first()).toBeVisible();
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", { name: `Switch to ${theme} theme`, exact: true });
      if (await toggle.count()) await toggle.click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const id of [900_000, ...stages.map((_, index) => radical.id + index * 10_000)]) {
        const link = page.locator(`a[href="/subjects/${id}"]`).first();
        const tile = link.locator('[class*="levelSubjectBlock"]');
        const image = tile.locator("img");
        if (await image.count()) await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
        await page.mouse.move(0, 0);
        const before = await sharp(await tile.screenshot({ animations: "disabled" })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        await link.hover();
        const hovered = await sharp(await tile.screenshot({ animations: "disabled" })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const color = await tile.evaluate((element) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d")!;
          context.fillStyle = getComputedStyle(element).color;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        });
        expect(hovered.info).toEqual(before.info);
        let underlinePixels = 0;
        for (let y = Math.floor(hovered.info.height * .55); y < hovered.info.height; y += 1) {
          for (let x = 0; x < hovered.info.width; x += 1) {
            const pixel = (y * hovered.info.width + x) * hovered.info.channels;
            const isInk = color.every((channel, index) => Math.abs(hovered.data[pixel + index] - channel) <= 2);
            const wasInk = color.every((channel, index) => Math.abs(before.data[pixel + index] - channel) <= 2);
            if (isInk && !wasInk) underlinePixels += 1;
          }
        }
        expect(underlinePixels, `${id === 900_000 ? "Character radical" : radical.name} should gain a visible underline on hover in ${theme}`).toBeGreaterThan(8);
      }
    }
    await page.setViewportSize({ width: 480, height: 760 });
    await page.locator(`a[href="/subjects/${radical.id + 10_000}"]`).first().hover();
    const widget = page.locator("section").filter({ has: page.getByRole("heading", { name: `Level ${radical.level} Progress`, exact: true }) }).last();
    await widget.screenshot({ path: testInfo.outputPath(`${radical.name.toLowerCase()}-hover-widget.png`), animations: "disabled" });
  });
  for (const path of ["/dashboard", "/progress"]) {
    test(`${radical.name} stays visible across theme changes in ${path}`, async ({ page }, testInfo) => {
      await mockAccount(page, radical);
      await page.goto(path);
      for (const theme of ["light", "dark", "light"]) {
        const themeButton = page.getByRole("button", { name: `Switch to ${theme} theme`, exact: true });
        if (await themeButton.count()) await themeButton.click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await page.evaluate(async () => {
          await Promise.allSettled(document.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map((animation) => animation.finished));
        });
        for (const stage of stages) {
          const image = page.getByRole("img", { name: `${radical.name} ${stage} radical`, exact: true }).first();
          await expect(image).toBeVisible();
          await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
          const box = await image.boundingBox();
          expect(box?.width).toBeGreaterThanOrEqual(20);
          expect(box?.height).toBeGreaterThanOrEqual(20);
          const alignment = await image.evaluate((element, dashboard) => {
            const tile = dashboard ? element.parentElement!.parentElement! : element.parentElement!;
            const imageBox = element.getBoundingClientRect();
            const tileBox = tile.getBoundingClientRect();
            return {
              horizontal: Math.abs(imageBox.x + imageBox.width / 2 - tileBox.x - tileBox.width / 2),
              vertical: Math.abs(imageBox.y + imageBox.height / 2 - tileBox.y - tileBox.height / 2),
            };
          }, path === "/dashboard");
          expect(alignment.horizontal, `${radical.name} should be horizontally centered in its tile`).toBeLessThanOrEqual(0.75);
          expect(alignment.vertical, `${radical.name} should be vertically centered in its tile`).toBeLessThanOrEqual(0.75);
          const expectedColor = await image.evaluate((element) => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const context = canvas.getContext("2d")!;
            context.fillStyle = getComputedStyle(element.parentElement!).color;
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
          });
          // A loaded image with a bounding box can still paint nothing or retain an old tint.
          const screenshot = await image.screenshot({ path: testInfo.outputPath(`${theme}-${stage}.png`), animations: "disabled" });
          const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          let paintedPixels = 0;
          for (let pixel = 0; pixel < data.length; pixel += info.channels) {
            if (expectedColor.every((channel, index) => Math.abs(data[pixel + index] - channel) <= 2)) paintedPixels += 1;
          }
          expect(paintedPixels, `${radical.name} stage ${stage} should be painted in its subject text color in ${theme}`).toBeGreaterThan(8);
        }
      }
    });
  }
}
