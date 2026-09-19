import { expect, type Locator, type Page } from "@playwright/test";

export function analyticsChart(scope: Page | Locator, label: string) {
  return scope.getByRole("group", { name: label, exact: true }).and(scope.locator("[data-chart-kind]"));
}

export async function chartData(chart: Locator) {
  const disclosure = chart.locator('details:has(> summary:text-is("Chart data"))');
  if (!await disclosure.evaluate((element) => element.hasAttribute("open"))) await disclosure.locator("summary").click();
  const table = chart.getByRole("table", { name: `${await chart.getAttribute("aria-label")} data`, exact: true });
  await expect(table).toBeVisible();
  return table;
}

export async function closeChartData(chart: Locator) {
  const disclosure = chart.locator('details:has(> summary:text-is("Chart data"))');
  if (await disclosure.evaluate((element) => element.hasAttribute("open"))) await disclosure.locator("summary").click();
}

export function chartShapes(chart: Locator) {
  return chart.locator(".recharts-line-curve, .recharts-area-area, .recharts-rectangle, .recharts-sector");
}

export async function expectDrawn(chart: Locator) {
  await expect(chart.locator("[data-chart-plot] svg.recharts-surface")).toBeVisible();
  await expect.poll(() => chart.locator("[data-chart-plot]").evaluate((element) => {
    const plot = element.getBoundingClientRect();
    const svg = element.querySelector("svg.recharts-surface")!.getBoundingClientRect();
    return Math.max(Math.abs(plot.width - svg.width), Math.abs(plot.height - svg.height));
  }), { message: "The real SVG must resize to its available plot dimensions" }).toBeLessThanOrEqual(1);
  await expect.poll(() => chartShapes(chart).evaluateAll((elements) => elements.filter((element) => {
    if (!(element instanceof SVGGeometryElement)) return false;
    const style = getComputedStyle(element);
    return element.getTotalLength() > 5 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
  }).length)).toBeGreaterThan(0);
}

export async function plotGeometry(chart: Locator) {
  return chart.locator("[data-chart-plot]").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const shapes = Array.from(element.querySelectorAll<SVGGeometryElement>(".recharts-line-curve, .recharts-area-area, .recharts-rectangle, .recharts-sector")).filter((shape) => shape.getTotalLength() > 5);
    const boxes = shapes.map((shape) => shape.getBoundingClientRect());
    return {
      width: rect.width,
      height: rect.height,
      drawnWidth: boxes.length ? Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left)) : 0,
      drawnHeight: boxes.length ? Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top)) : 0,
      paths: shapes.map((shape) => shape.getAttribute("d")),
      colors: [...new Set(shapes.map((shape) => { const css = getComputedStyle(shape); return css.fill === "none" ? css.stroke : css.fill; }))],
    };
  });
}

export async function interiorPoint(shape: Locator) {
  return shape.evaluate((element) => {
    if (!(element instanceof SVGGeometryElement)) throw new Error("Expected a rendered SVG shape");
    const bounds = element.getBBox();
    const matrix = element.getScreenCTM();
    if (!matrix) throw new Error("SVG shape is not on screen");
    for (let row = 1; row < 10; row++) {
      for (let column = 1; column < 10; column++) {
        const point = new DOMPoint(bounds.x + bounds.width * column / 10, bounds.y + bounds.height * row / 10);
        const screen = point.matrixTransform(matrix);
        if (element.isPointInFill(point) && document.elementFromPoint(screen.x, screen.y) === element) return screen.toJSON();
      }
    }
    const point = element.getPointAtLength(element.getTotalLength() / 2);
    const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    if (document.elementFromPoint(screen.x, screen.y) !== element) throw new Error("The requested SVG shape has no unobstructed hit point");
    return screen.toJSON();
  });
}

export async function chartPixels(page: Page, chart: Locator) {
  const buffer = await chart.locator("[data-chart-plot]").screenshot();
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let chromaticPixels = 0;
    const colors = new Set<string>();
    for (let index = 0; index < pixels.length; index += 4) {
      const channels = [pixels[index], pixels[index + 1], pixels[index + 2]];
      if (pixels[index + 3] > 100 && Math.max(...channels) - Math.min(...channels) > 35) {
        chromaticPixels++;
        colors.add(channels.join(","));
      }
    }
    return { width: canvas.width, height: canvas.height, chromaticPixels, colors: colors.size };
  }, buffer.toString("base64"));
}
