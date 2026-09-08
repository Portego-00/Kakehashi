/** Stable public samples; personal file handles never enter the demo database. */
export const DEMO_MANGA_ID = "demo-frieren-opening";
export const DEMO_MANGA_PAGE_COUNT = 14;
export const DEMO_BOOK_TEXT_ASSET = "demo-book-rainy-afternoon";

export const DEMO_ASSET_URLS: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(Array.from({ length: DEMO_MANGA_PAGE_COUNT }, (_, index) => [
    `${DEMO_MANGA_ID}-page-${index + 1}`,
    `/demo/frieren/page-${String(index + 1).padStart(2, "0")}.jpg`,
  ])),
  [DEMO_BOOK_TEXT_ASSET]: "/demo/rainy-afternoon.txt",
});
