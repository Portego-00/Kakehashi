import { stripFuriganaAndTags } from "../japaneseHtmlNormalization";

describe("stripFuriganaAndTags", () => {
  it("removes ruby furigana while preserving surface text", () => {
    const html =
      "<p><ruby>住<rt>す</rt></ruby>む</p><p><ruby>思<rt>おも</rt></ruby>います</p><p><ruby>調<rt>しら</rt></ruby>べて</p>";

    expect(stripFuriganaAndTags(html)).toContain("住む");
    expect(stripFuriganaAndTags(html)).toContain("思います");
    expect(stripFuriganaAndTags(html)).toContain("調べて");
    expect(stripFuriganaAndTags(html)).not.toContain("住すむ");
    expect(stripFuriganaAndTags(html)).not.toContain("思おもいます");
    expect(stripFuriganaAndTags(html)).not.toContain("調しらべて");
  });

  it("handles rp tags and html entities", () => {
    const html =
      "<p><ruby>住<rp>(</rp><rt>す</rt><rp>)</rp></ruby>む&nbsp;&amp;&nbsp;safe</p>";

    expect(stripFuriganaAndTags(html)).toBe("住む & safe");
  });
});
