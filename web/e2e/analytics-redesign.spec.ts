import { expect, test, type Page } from "@playwright/test";
import { analyticsChart, chartData, chartPixels, chartShapes, closeChartData, expectDrawn, interiorPoint, plotGeometry } from "./analytics-chart-helpers";
import { expectSelectOptionsFit } from "./analytics-layout-helpers";

type WidgetBox = { id: string; size: string; x: number; y: number; width: number; height: number };

async function openAnalytics(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|analytics)$/, { timeout: 30_000 });
  await page.goto("/analytics");
  await expect(page.getByRole("combobox", { name: "Dashboard preset" })).toBeVisible();
  await expect(page.locator("[data-analytics-grid][data-measured='true']")).toBeVisible();
}

async function deepDive(page: Page) {
  await page.getByRole("combobox", { name: "Dashboard preset" }).selectOption("deep-dive");
  await expect(page.locator("[data-widget]")).toHaveCount(18);
}

async function allCompact(page: Page) {
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Customize analytics", exact: true });
  for (const button of await editor.getByRole("button", { name: /^Compact / }).all()) {
    await button.click();
  }
  await editor.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("[data-widget][data-size='wide']")).toHaveCount(0);
}

async function geometry(page: Page) {
  return page.locator("[data-analytics-grid]").evaluate((grid) => {
    const box = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    return {
      width: box.width,
      top: box.top + scrollY,
      columns: Number(grid.getAttribute("data-columns")),
      gap: Number.parseFloat(style.columnGap),
      widgets: Array.from(grid.querySelectorAll<HTMLElement>(":scope > [data-widget]")).map((element) => {
        const rect = element.getBoundingClientRect();
        return { id: element.dataset.widget!, size: element.dataset.size!, x: rect.x, y: rect.y + scrollY, width: rect.width, height: rect.height };
      }),
    };
  });
}

function alignmentIssues(layout: Awaited<ReturnType<typeof geometry>>) {
  const issues: string[] = [];
  const rows: WidgetBox[][] = [];
  let pending: WidgetBox[] = [];
  for (const widget of layout.widgets) {
    if (layout.columns === 1 || widget.size === "wide") {
      if (pending.length) rows.push(pending);
      rows.push([widget]);
      pending = [];
    } else {
      pending.push(widget);
      if (pending.length === 2) { rows.push(pending); pending = []; }
    }
  }
  if (pending.length) rows.push(pending);
  let expectedTop = layout.top;
  for (const row of rows) {
    for (const widget of row) {
      if (Math.abs(widget.y - expectedTop) > 2) issues.push(`${widget.id}: row top differs by ${Math.round(widget.y - expectedTop)}px`);
      if (Math.abs(widget.height - row[0].height) > 2) issues.push(`${widget.id}: row bottom differs by ${Math.round(widget.height - row[0].height)}px`);
    }
    if (row.length === 2 && row[1].x < row[0].x + row[0].width + layout.gap - 2) issues.push(`${row[1].id}: column gap or order is incorrect`);
    expectedTop = row[0].y + row[0].height + layout.gap;
  }
  return issues;
}

async function expectAligned(page: Page) {
  await expect(page.locator("[data-analytics-grid]")).toHaveAttribute("data-layout", "rows");
  await expect.poll(async () => alignmentIssues(await geometry(page))).toEqual([]);
  const layout = await geometry(page);
  expect(layout.widgets.every((box) => box.width > 200 && box.height > 80)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  return layout;
}

function displacement(before: WidgetBox[], after: WidgetBox[]) {
  return before.map((item) => {
    const next = after.find((candidate) => candidate.id === item.id)!;
    return { id: item.id, distance: Math.max(Math.abs(next.y - item.y), Math.abs(next.height - item.height)) };
  }).filter((item) => item.distance > 2);
}

test("accuracy level grouping exposes every level in compact and expanded views", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAnalytics(page);
  const accuracy = page.getByRole("region", { name: "Accuracy", exact: true });
  await accuracy.getByRole("button", { name: "Level", exact: true }).click();
  let chart = analyticsChart(accuracy, "Accuracy by level");
  await expect(chart).toHaveAttribute("data-chart-kind", "line");
  await expectDrawn(chart);
  let table = await chartData(chart);
  const count = await table.locator("tbody tr").count();
  expect(count).toBeGreaterThan(5);
  const labels = await table.locator("tbody tr").allTextContents();
  const pathCommands = await chart.locator(".recharts-line-curve").first().getAttribute("d");
  expect(pathCommands?.match(/[MLC]/g)?.length ?? 0).toBeGreaterThanOrEqual(count - 1);
  await table.locator("tbody tr").last().scrollIntoViewIfNeeded();
  await expect(table.locator("tbody tr").last()).toBeInViewport();
  await closeChartData(chart);
  await expect(accuracy.getByRole("button", { name: "Level", exact: true })).toHaveAttribute("aria-pressed", "true");
  await accuracy.getByRole("button", { name: "Expand Accuracy", exact: true }).click();
  chart = analyticsChart(page.locator("dialog:modal"), "Accuracy by level");
  await expectDrawn(chart);
  await expect((await chartData(chart)).locator("tbody tr")).toHaveCount(count);
  await closeChartData(chart);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 800 });
  chart = analyticsChart(accuracy, "Accuracy by level");
  await expectDrawn(chart);
  table = await chartData(chart);
  await expect.poll(() => table.locator("tbody tr").allTextContents()).toEqual(labels);
  await table.locator("tbody tr").last().scrollIntoViewIfNeeded();
  await expect(table.locator("tbody tr").last()).toBeInViewport();
  await closeChartData(chart);
  await expectAligned(page);
});

test("mixed and compact widgets retain aligned row edges at every width", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openAnalytics(page);
  await deepDive(page);
  for (const mode of ["mixed", "compact"]) {
    if (mode === "compact") await allCompact(page);
    for (const width of [1440, 1024, 768, 414, 375, 320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await expectAligned(page);
      expect(layout.widgets).toHaveLength(18);
      expect(layout.columns).toBe(layout.width >= 688 + layout.gap ? 2 : 1);
      await testInfo.attach(`rows-${mode}-${width}`, { body: JSON.stringify(layout, null, 2), contentType: "application/json" });
    }
  }
  await page.screenshot({ path: testInfo.outputPath("all-compact-1440.png"), fullPage: true });
});

test("review workload gives the queue priority and keeps chart settings behind a deliberate action", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAnalytics(page);
  const workload = page.getByRole("region", { name: "Review workload", exact: true });
  const due = workload.locator('[data-primary="true"]');
  await expect(due.locator("dt")).toHaveText("Due now");
  const total = await due.locator("dd").innerText();
  const estimate = workload.locator("dl > div").filter({ has: page.locator("dt", { hasText: /^Queue estimate$/ }) });
  const estimateBefore = await estimate.locator("dd").innerText();
  expect(await due.locator("dd").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)))
    .toBeGreaterThan(await estimate.locator("dd").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)));
  await expect(workload.getByRole("spinbutton", { name: "Seconds per item", exact: true })).toHaveCount(0);
  const chart = analyticsChart(workload, "Currently scheduled reviews");
  await expectDrawn(chart);
  await expect((await chartData(chart)).locator("tbody tr")).toHaveCount(7);
  await closeChartData(chart);
  await workload.getByRole("button", { name: "Review chart options", exact: true }).click();
  await workload.getByRole("spinbutton", { name: "Seconds per item", exact: true }).fill("24");
  await expect(estimate.locator("dd")).not.toHaveText(estimateBefore);
  await expect(due.locator("dd")).toHaveText(total);
  await workload.getByRole("combobox", { name: "Scheduled SRS stage", exact: true }).selectOption("Guru");
  await workload.getByRole("button", { name: "Review chart options", exact: true }).click();
  await workload.getByRole("button", { name: "24 hours", exact: true }).click();
  await expect((await chartData(chart)).locator("tbody tr")).toHaveCount(24);
  await closeChartData(chart);
  const explanation = workload.locator("details").filter({ has: page.locator("summary", { hasText: "Scheduled reviews only" }) });
  await expect(explanation.locator("p")).not.toBeVisible();
  await explanation.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(explanation.locator("p")).toBeVisible();
  await expect(explanation).toContainText("not future repeat reviews");
  await explanation.locator("summary").press("Enter");
  await page.setViewportSize({ width: 320, height: 800 });
  await expectAligned(page);
  await expect.poll(async () => {
    const schedule = await workload.getByRole("group", { name: "Review schedule", exact: true }).boundingBox();
    const options = await workload.getByRole("button", { name: "Review chart options", exact: true }).boundingBox();
    return Math.abs(schedule!.y + schedule!.height / 2 - options!.y - options!.height / 2);
  }).toBeLessThanOrEqual(2);
  await workload.scrollIntoViewIfNeeded();
  await workload.screenshot({ path: testInfo.outputPath("workload-hierarchy-320.png") });
  await workload.getByRole("button", { name: "Expand Review workload", exact: true }).click();
  const expanded = page.locator("dialog:modal");
  await expect(expanded.getByRole("button", { name: "24 hours", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
  await expanded.getByRole("button", { name: "Review chart options", exact: true }).click();
  await expect(expanded.getByRole("spinbutton", { name: "Seconds per item", exact: true })).toHaveValue("24");
  await expect(expanded.getByRole("combobox", { name: "Scheduled SRS stage", exact: true })).toHaveValue("Guru");
  await page.keyboard.press("Escape");
});

test("expansion restores aligned row geometry, focus, scroll and coverage state", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAnalytics(page);
  await deepDive(page);
  await allCompact(page);
  const coverage = page.getByRole("region", { name: "Kanji coverage", exact: true });
  await coverage.getByRole("button", { name: "Joyo", exact: true }).click();
  await coverage.getByRole("button", { name: "Burned", exact: true }).click();
  for (const name of ["Accuracy", "Kanji coverage", "Review workload", "Difficult items", "Reading readiness"]) {
    const opener = page.getByRole("button", { name: `Expand ${name}`, exact: true });
    await opener.scrollIntoViewIfNeeded();
    await expectAligned(page);
    const before = await geometry(page);
    const scroll = await page.evaluate(() => scrollY);
    await opener.click();
    await expect(page.locator("dialog:modal")).toHaveCount(1);
    if (name === "Kanji coverage") await expect(page.locator("dialog:modal").getByRole("button", { name: "Joyo", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    await expect.poll(() => page.evaluate((prior) => Math.abs(scrollY - prior), scroll)).toBeLessThanOrEqual(2);
    await expectAligned(page);
    await expect.poll(async () => displacement(before.widgets, (await geometry(page)).widgets)).toEqual([]);
  }
  await expect(coverage.getByRole("button", { name: "Burned", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("default overview stays readable in both themes without oversized compact panels", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openAnalytics(page);
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", { name: `Switch to ${theme} theme`, exact: true });
      if (await toggle.count()) await toggle.click();
      const layout = await expectAligned(page);
      const oversized = layout.widgets.filter((box) => box.size === "compact" && box.height > (width > 800 ? 900 : 1200)).map((box) => ({ id: box.id, height: box.height }));
      expect(oversized).toEqual([]);
      const clipped = await page.locator("[data-widget] button, [data-widget] h2, [data-widget] label").evaluateAll((elements) => elements.filter((element) => {
        const box = element.getBoundingClientRect();
        if (!element.checkVisibility() || !box.width || !box.height || getComputedStyle(element).overflowX !== "visible") return false;
        return element.scrollWidth > element.clientWidth + 2;
      }).map((element) => element.textContent?.trim()));
      expect(clipped).toEqual([]);
      await expectSelectOptionsFit(page.getByRole("region", { name: "Analytics overview", exact: true }).getByRole("combobox"));
      await expect.poll(() => page.locator('[data-widget="levels"] a[data-passed="true"]').first().evaluate((element) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d")!;
        const luminance = (colors: string[]) => {
          context.clearRect(0, 0, 1, 1);
          for (const color of colors) {
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
          }
          const channels = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3)
            .map((value) => value / 255)
            .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        };
        const style = getComputedStyle(element);
        // Links can be transparent: composite their ancestors instead of painting
        // transparency over the previous foreground sample (which always yields 1:1).
        const backgrounds: string[] = [];
        for (let node: Element | null = element; node; node = node.parentElement) backgrounds.unshift(getComputedStyle(node).backgroundColor);
        const foreground = luminance([...backgrounds, style.color]);
        const background = luminance(backgrounds);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      })).toBeGreaterThanOrEqual(4.5);
      await page.evaluate(() => scrollTo(0, 0));
      expect(await page.locator("[data-analytics-grid]").evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(width > 800 ? 430 : width < 360 ? 720 : 680);
      await page.screenshot({ path: testInfo.outputPath(`overview-${width}-${theme}.png`), fullPage: true });
      await page.screenshot({ path: testInfo.outputPath(`overview-first-screen-${width}-${theme}.png`) });
    }
  }
});

test("activity totals follow the selected metric and chart paging retains the complete period", async ({ page }) => {
  test.setTimeout(90_000);
  await openAnalytics(page);
  await deepDive(page);
  await page.getByRole("combobox", { name: "Activity period", exact: true }).selectOption("365");
  const history = page.getByRole("region", { name: "Review history", exact: true });
  const primary = history.locator('[data-primary="true"]');
  await expect(primary.locator("dt")).toHaveText("Lessons in period");
  const lessons = await primary.locator("dd").innerText();
  await history.getByRole("button", { name: "Burns", exact: true }).click();
  await expect(primary.locator("dt")).toHaveText("Burns in period");
  await expect(primary.locator("dd")).not.toHaveText(lessons);
  await history.getByRole("button", { name: "Reviews", exact: true }).click();
  await expect(primary.locator("dt")).toHaveText("Reviews in period");
  const chart = analyticsChart(history, "reviews per day");
  await expectDrawn(chart);
  const table = await chartData(chart);
  const earlier = history.getByRole("button", { name: "Earlier reviews per day", exact: true });
  const later = history.getByRole("button", { name: "Later reviews per day", exact: true });
  await expect(later).toBeDisabled();
  const labels = new Set<string>();
  for (let index = 0; index < 13; index++) {
    for (const label of await table.locator("tbody tr").allTextContents()) {
      expect(labels.has(label)).toBe(false);
      labels.add(label);
    }
    if (index < 12) await earlier.click();
  }
  expect(labels.size).toBe(365);
  await expect(earlier).toBeDisabled();
  await expect(later).toBeEnabled();
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await later.click();
  await expect(table.locator("tbody tr")).toHaveCount(30);
  await closeChartData(chart);
  await expectAligned(page);
});

test("paired charts genuinely grow with their row and shrink when details close", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAnalytics(page);
  const accuracy = analyticsChart(page.getByRole("region", { name: "Accuracy", exact: true }), "Accuracy by type");
  const srs = analyticsChart(page.getByRole("region", { name: "SRS distribution", exact: true }), "SRS distribution");
  await expectDrawn(accuracy);
  await expectDrawn(srs);
  await expectAligned(page);
  const srsBefore = await plotGeometry(srs);
  await page.locator('[data-widget="srs"]').screenshot({ path: testInfo.outputPath("srs-before-accuracy-details.png") });
  await chartData(accuracy);
  await expectAligned(page);
  await expect.poll(async () => (await plotGeometry(srs)).height - srsBefore.height).toBeGreaterThan(20);
  await expectDrawn(srs);
  const srsAfter = await plotGeometry(srs);
  if (srsBefore.height + 20 < srsBefore.width) expect(srsAfter.drawnHeight).toBeGreaterThan(srsBefore.drawnHeight + 10);
  await page.locator('[data-widget="srs"]').screenshot({ path: testInfo.outputPath("srs-grown-with-accuracy.png") });
  await closeChartData(accuracy);
  await expect.poll(async () => Math.abs((await plotGeometry(srs)).height - srsBefore.height)).toBeLessThanOrEqual(2);

  await deepDive(page);
  await allCompact(page);
  const workload = analyticsChart(page.getByRole("region", { name: "Review workload", exact: true }), "Currently scheduled reviews");
  const forecast = analyticsChart(page.getByRole("region", { name: "Review forecast", exact: true }), "Daily review forecast");
  await expectDrawn(workload);
  await expectDrawn(forecast);
  await expectAligned(page);
  const before = await plotGeometry(workload);
  await page.locator('[data-widget="workload"]').screenshot({ path: testInfo.outputPath("workload-before-forecast-details.png") });
  await chartData(forecast);
  await expectAligned(page);
  await expect.poll(async () => (await plotGeometry(workload)).height - before.height).toBeGreaterThan(20);
  await expectDrawn(workload);
  await expect.poll(async () => (await plotGeometry(workload)).drawnHeight - before.drawnHeight).toBeGreaterThan(15);
  await page.locator('[data-widget="workload"]').screenshot({ path: testInfo.outputPath("workload-grown-with-forecast.png") });
  await closeChartData(forecast);
  await expect.poll(async () => Math.abs((await plotGeometry(workload)).height - before.height)).toBeLessThanOrEqual(2);
  await expectAligned(page);
});

test("meaningful Recharts types paint real data without clipped axes in both themes", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAnalytics(page);
  await deepDive(page);
  const accuracy = page.getByRole("region", { name: "Accuracy", exact: true });
  await expect(analyticsChart(accuracy, "Accuracy by type")).toHaveAttribute("data-chart-kind", "horizontal-bar");
  await expectDrawn(analyticsChart(accuracy, "Accuracy by type"));
  await accuracy.getByRole("button", { name: "Level", exact: true }).click();
  await page.getByRole("region", { name: "Burn progress", exact: true }).getByRole("button", { name: "Cumulative", exact: true }).click();
  const cases = [
    { widget: "Accuracy", label: "Accuracy by level", kind: "line" },
    { widget: "SRS distribution", label: "SRS distribution", kind: "donut" },
    { widget: "Review workload", label: "Currently scheduled reviews", kind: "bar" },
    { widget: "Review forecast", label: "Daily review forecast", kind: "area" },
    { widget: "Burn progress", label: "Recorded burns", kind: "area" },
    { widget: "Review history", label: "lessons per day", kind: "area" },
    { widget: "Retention", label: "Lifetime accuracy by current stage", kind: "horizontal-bar" },
  ];
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", { name: `Switch to ${theme} theme`, exact: true });
      if (await toggle.count()) await toggle.click();
      await expectAligned(page);
      for (const item of cases) {
        const chart = analyticsChart(page.getByRole("region", { name: item.widget, exact: true }), item.label);
        await expect(chart).toHaveAttribute("data-chart-kind", item.kind);
        await expectDrawn(chart);
        const pixels = await chartPixels(page, chart);
        expect(pixels.chromaticPixels, `${item.label}, ${width}px ${theme}`).toBeGreaterThan(70);
        expect(pixels.colors, `${item.label}, ${width}px ${theme}`).toBeGreaterThan(3);
        const geometry = await plotGeometry(chart);
        expect(geometry.width).toBeGreaterThan(150);
        expect(geometry.height).toBeGreaterThan(150);
        if (item.kind === "donut") expect(geometry.colors.length).toBe(5);
        if (item.widget === "Review workload") expect(geometry.colors.length).toBeGreaterThanOrEqual(4);
        const axisTicks = chart.locator(".recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value");
        if (item.kind !== "donut") expect(await axisTicks.count(), `${item.label} must render real axis labels`).toBeGreaterThanOrEqual(2);
        const clipped = await axisTicks.evaluateAll((ticks) => {
          const boxes = ticks.map((tick) => ({ label: tick.textContent, rect: tick.getBoundingClientRect(), plot: tick.closest("svg")!.getBoundingClientRect() })).filter((tick) => tick.rect.width > 0).sort((a, b) => a.rect.left - b.rect.left);
          return boxes.filter((tick, index) => tick.rect.left < tick.plot.left - 1 || tick.rect.right > tick.plot.right + 1 || index > 0 && tick.rect.left < boxes[index - 1].rect.right - 1).map((tick) => tick.label);
        });
        expect(clipped, `${item.label}, ${width}px ${theme}`).toEqual([]);
        const valueTicks = chart.locator(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value");
        if (item.kind !== "donut") expect(await valueTicks.count(), `${item.label} must render a real value axis`).toBeGreaterThanOrEqual(2);
        const clippedValues = await valueTicks.evaluateAll((ticks) => ticks.filter((tick) => {
          const bounds = tick.getBoundingClientRect();
          const svg = tick.closest("svg")!.getBoundingClientRect();
          return bounds.left < svg.left - 1 || bounds.right > svg.right + 1 || bounds.top < svg.top - 1 || bounds.bottom > svg.bottom + 1;
        }).map((tick) => tick.textContent));
        expect(clippedValues, `${item.label} value axis, ${width}px ${theme}`).toEqual([]);
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`recharts-${width}-${theme}.png`), fullPage: true });
    }
  }
});

test("real chart surfaces support touch and keyboard selection with reduced motion", async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 375, height: 1000 }, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  try {
    await openAnalytics(page);
    const workload = page.getByRole("region", { name: "Review workload", exact: true });
    const chart = analyticsChart(workload, "Currently scheduled reviews");
    await expectDrawn(chart);
    const svg = chart.locator("[data-chart-plot] svg.recharts-surface");
    await expect(svg).toHaveAttribute("role", "application");
    await svg.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(workload.getByRole("button", { name: "Clear selection", exact: true })).toBeVisible();
    await expect.poll(() => chart.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return Array.from(element.children).filter((child) => child.checkVisibility()).every((child) => child.getBoundingClientRect().bottom <= bounds.bottom + 1);
    }), { message: "Selected chart must contain its plot without covering the drilldown" }).toBe(true);
    await workload.getByRole("button", { name: "Clear selection", exact: true }).click();
    await chart.scrollIntoViewIfNeeded();
    const shapes = chartShapes(chart);
    const hitIndex = await shapes.evaluateAll((elements) => elements.findIndex((element) => element.getBoundingClientRect().width > 5 && element.getBoundingClientRect().height > 5));
    expect(hitIndex).toBeGreaterThanOrEqual(0);
    const hit = await interiorPoint(shapes.nth(hitIndex));
    await page.touchscreen.tap(hit.x, hit.y);
    await expect(workload.getByRole("button", { name: "Clear selection", exact: true })).toBeVisible();
    await workload.getByRole("button", { name: "Clear selection", exact: true }).click();
    const before = await plotGeometry(chart);
    await page.waitForTimeout(400);
    expect((await plotGeometry(chart)).paths).toEqual(before.paths);
    const srs = page.getByRole("region", { name: "SRS distribution", exact: true });
    const donut = analyticsChart(srs, "SRS distribution");
    await expectDrawn(donut);
    await donut.scrollIntoViewIfNeeded();
    const sector = await interiorPoint(donut.locator(".recharts-sector").first());
    await page.touchscreen.tap(sector.x, sector.y);
    await expect(srs.getByRole("textbox", { name: "Search items", exact: true })).toBeVisible();
    await expect(srs.getByRole("table")).toBeVisible();
    await srs.getByRole("button", { name: /^Apprentice:/ }).click();
    await expect(srs.getByRole("textbox", { name: "Search items", exact: true })).toHaveCount(0);
    await donut.getByRole("application", { name: "SRS distribution", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(srs.getByRole("textbox", { name: "Search items", exact: true })).toBeVisible();
    await expect(srs.getByRole("table")).toBeVisible();
    await deepDive(page);
    const forecastWidget = page.getByRole("region", { name: "Review forecast", exact: true });
    const forecast = analyticsChart(forecastWidget, "Daily review forecast");
    await expectDrawn(forecast);
    await forecast.locator(".recharts-area-area").first().scrollIntoViewIfNeeded();
    const areaPoint = await interiorPoint(forecast.locator(".recharts-area-area").first());
    await page.touchscreen.tap(areaPoint.x, areaPoint.y);
    await expect(forecastWidget.getByRole("button", { name: "Close forecast detail", exact: true })).toBeVisible();
    await expect(forecastWidget.getByRole("combobox", { name: "Selected forecast period", exact: true })).toBeVisible();
    await forecastWidget.getByRole("button", { name: "Close forecast detail", exact: true }).click();
    await expect(forecastWidget.getByRole("combobox", { name: "Selected forecast period", exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("recharts-touch-375.png") });
  } finally {
    await context.close();
  }
});
