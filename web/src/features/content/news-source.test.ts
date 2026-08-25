import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseNewsContent, parseNewsRss } from "./news-source";

describe("NHK Easy RSS parsing", () => {
  it("keeps thumbnail and in-article images alongside clean Japanese text", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item>
      <title>日本のニュース</title>
      <link>https://nhkeasier.com/story/9876/</link>
      <guid>https://nhkeasier.com/story/9876/</guid>
      <pubDate>Mon, 17 Aug 2026 20:15:00 +0900</pubDate>
      <description><![CDATA[
        <img src="/media/jpg/story.jpg" alt="ニュースの写真">
        <p><ruby>日本<rt>にほん</rt></ruby>のニュースです。</p>
        <img src="media/jpg/detail.jpg">
      ]]></description>
    </item></channel></rss>`;

    expect(parseNewsRss(xml)).toEqual([expect.objectContaining({
      id: "9876",
      imageUrl: "https://nhkeasier.com/media/jpg/story.jpg",
      body: "日本のニュースです。",
      content: [
        { type: "image", url: "https://nhkeasier.com/media/jpg/story.jpg", alt: "ニュースの写真" },
        { type: "text", text: "日本のニュースです。" },
        { type: "image", url: "https://nhkeasier.com/story/9876/media/jpg/detail.jpg", alt: "Story illustration" },
      ],
    })]);
  });

  it("ignores unsupported image origins while retaining article paragraphs", () => {
    expect(parseNewsContent('<img src="https://example.com/tracker.png"><p>安全な本文です。</p>', "https://nhkeasier.com/story/1/")).toEqual([
      { type: "text", text: "安全な本文です。" },
    ]);
  });
});
