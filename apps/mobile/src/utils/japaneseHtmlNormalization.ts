export function stripFuriganaAndTags(html: string): string {
  if (!html) {
    return "";
  }

  return html
    // Remove furigana annotations first so ruby text does not pollute matching
    // e.g. <ruby>住<rt>す</rt></ruby>む -> 住む (not 住すむ)
    .replace(/<rt[^>]*>[\s\S]*?<\/rt>/g, "")
    .replace(/<rp[^>]*>[\s\S]*?<\/rp>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
