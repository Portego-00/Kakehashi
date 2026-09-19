import { expect, type Locator } from "@playwright/test";

export async function expectSelectOptionsFit(selects: Locator) {
  await expect.poll(() => selects.evaluateAll((elements) => elements.flatMap((element) => {
    const select = element as HTMLSelectElement;
    const style = getComputedStyle(select);
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const textWidth = Math.max(...Array.from(select.options).map((option) => context.measureText(option.label).width));
    // Native Chromium arrows occupy space that scrollWidth does not report as text clipping.
    const required = textWidth + Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight) + 18;
    return required <= select.clientWidth + 1 ? [] : [{ label: select.getAttribute("aria-label") ?? select.labels?.[0]?.textContent?.trim(), required, available: select.clientWidth }];
  }))).toEqual([]);
}
