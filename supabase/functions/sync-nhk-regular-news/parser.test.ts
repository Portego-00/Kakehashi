import {
  articleIdFromCanonicalUrl,
  canonicalArticleUrl,
  isSafeNhkImageUrl,
  isValidArticleId,
  type NhkFeedItem,
  nhkMarkdownToSafeHtml,
  normalizeFullArticle,
  parseNhkRss,
  summaryRow,
} from "./parser.ts";

const feedItem: NhkFeedItem = {
  id: "nd-20260822de45682",
  title: "台風の進路に注意",
  canonicalUrl: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
  guid: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
  publishedAt: "Sat, 22 Aug 2026 08:00:00 +0900",
  description: "強い雨に注意してください。",
};

describe("NHK regular news parser", () => {
  it("accepts NHK's brace-style opaque IDs but rejects path syntax", () => {
    const opaqueId = "nc-{article-uuid}";

    expect(isValidArticleId(opaqueId)).toBe(true);
    expect(canonicalArticleUrl(opaqueId)).toBe(
      "https://news.web.nhk/newsweb/na/nc-%7Barticle-uuid%7D",
    );
    expect(
      articleIdFromCanonicalUrl(
        "https://news.web.nhk/newsweb/na/nc-%7Barticle-uuid%7D",
      ),
    ).toBe(opaqueId);
    expect(isValidArticleId("../article")).toBe(false);
  });

  it("accepts only standard HTTPS NHK image origins", () => {
    expect(isSafeNhkImageUrl("https://img.web.nhk/news/lead.jpg")).toBe(true);
    expect(isSafeNhkImageUrl("https://img.web.nhk:444/news/lead.jpg")).toBe(
      false,
    );
    expect(isSafeNhkImageUrl("https://img.web.nhk.evil.test/lead.jpg")).toBe(
      false,
    );
  });

  it("parses RSS items by canonical opaque ID and decodes XML entities", () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title><![CDATA[雨 &amp; 風に注意]]></title>
          <link>https://news.web.nhk/newsweb/na/nd-20260822de45682?ignored=1</link>
          <guid>https://news.web.nhk/newsweb/na/nd-20260822de45682</guid>
          <pubDate>Sat, 22 Aug 2026 08:00:00 +0900</pubDate>
          <description><![CDATA[広い範囲で雨です。]]></description>
        </item>
        <item>
          <title>External story</title>
          <link>https://example.com/news/not-allowed</link>
          <pubDate>Sat, 22 Aug 2026 08:00:00 +0900</pubDate>
        </item>
      </channel></rss>`;

    expect(parseNhkRss(xml)).toEqual([
      {
        id: "nd-20260822de45682",
        title: "雨 & 風に注意",
        canonicalUrl: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
        guid: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
        publishedAt: "Sat, 22 Aug 2026 08:00:00 +0900",
        description: "広い範囲で雨です。",
      },
    ]);
  });

  it("converts NHK Markdown into a small inert HTML subset", () => {
    const result = nhkMarkdownToSafeHtml(`
概要です。<script>steal()</script>

:::nw--link-type4 {href=https://www.web.nhk/example}
![related](https://img.web.nhk/news/related.jpg)
関連リンク
:::

## 今後の見通し {id=anchor-1}

本文の第一段落です。\
続きです。

![](https://img.web.nhk/news/nd/example/story_l.jpg "現地の様子")

![bad](https://evil.example/tracker.jpg)
`);

    expect(result.html).toContain("<h2>今後の見通し</h2>");
    expect(result.html).toContain("本文の第一段落です。続きです。");
    expect(result.html).toContain(
      '<img src="https://img.web.nhk/news/nd/example/story_l.jpg" alt="現地の様子" />',
    );
    expect(result.html).not.toContain("script");
    expect(result.html).not.toContain("related.jpg");
    expect(result.html).not.toContain("evil.example");
    expect(result.imageUrls).toEqual([
      "https://img.web.nhk/news/nd/example/story_l.jpg",
    ]);
  });

  it("normalizes a full authorized response and prepends its lead image", () => {
    const longParagraph = "これは完全な記事本文を表すテスト用の文章です。"
      .repeat(12);
    const row = normalizeFullArticle(
      {
        id: feedItem.id,
        type: "NewsArticle",
        headline: "台風 接近のおそれ",
        canonical: canonicalArticleUrl(feedItem.id),
        datePublished: "2026-08-22T08:00:00+09:00",
        dateModified: "2026-08-22T09:30:00+09:00",
        image: {
          medium: {
            url: "https://imgu.web.nhk/news/u/news/nd/example/lead_l.jpg",
          },
        },
        detailedArticleBody: {
          noHtmlMarkedLead: "概要です。",
          noHtmlMarkedBody: `## 詳細\n\n${longParagraph}`,
        },
      },
      feedItem,
      "2026-08-22T01:00:00.000Z",
    );

    expect(row).toMatchObject({
      id: feedItem.id,
      title: "台風 接近のおそれ",
      canonical_url: canonicalArticleUrl(feedItem.id),
      image_url: "https://imgu.web.nhk/news/u/news/nd/example/lead_l.jpg",
      is_full_article: true,
      source_updated_at: "2026-08-22T00:30:00.000Z",
    });
    expect(row.content_html).toMatch(/^<img /);
    expect(row.content_html).toContain("<h2>詳細</h2>");
    expect(row.content_html).not.toMatch(/<script|onerror=|javascript:/i);
  });

  it("normalizes a complete breaking story stored entirely in the lead", () => {
    const shortCompleteStory =
      "これは短い速報記事ですが、公開ページに表示される本文はこの段落です。続報が入りしだい更新します。";
    const row = normalizeFullArticle(
      {
        id: feedItem.id,
        headline: "短い速報",
        canonical: canonicalArticleUrl(feedItem.id),
        datePublished: "2026-08-22T08:00:00+09:00",
        articleBody: shortCompleteStory,
        detailedArticleBody: {
          markedLead: shortCompleteStory,
          markedBody: "",
        },
      },
      feedItem,
    );

    expect(row.is_full_article).toBe(true);
    expect(row.content_html).toContain(shortCompleteStory);
  });

  it("does not publish a longer articleBody as a truncated lead", () => {
    const lead = "概要です。";
    const body = `本文固有の内容です。${
      "完全な記事本文が続きます。".repeat(18)
    }`;
    expect(() =>
      normalizeFullArticle(
        {
          id: feedItem.id,
          headline: "本文を持つ記事",
          canonical: canonicalArticleUrl(feedItem.id),
          datePublished: "2026-08-22T08:00:00+09:00",
          articleBody: body,
          detailedArticleBody: {
            markedLead: lead,
            markedBody: "",
          },
        },
        feedItem,
      )
    ).toThrow("did not match");
  });

  it("does not let a long lead promote an unrelated short articleBody", () => {
    expect(() =>
      normalizeFullArticle(
        {
          id: feedItem.id,
          canonical: canonicalArticleUrl(feedItem.id),
          articleBody: "別の短い本文です。",
          detailedArticleBody: {
            markedLead: "長い概要だけです。".repeat(30),
            markedBody: "",
          },
        },
        feedItem,
      )
    ).toThrow("did not match");
  });

  it("accepts harmless whitespace differences in a lead-only story", () => {
    const row = normalizeFullArticle(
      {
        id: feedItem.id,
        canonical: canonicalArticleUrl(feedItem.id),
        articleBody:
          "短い速報記事です。 続報が入りしだい、内容を更新する予定です。",
        detailedArticleBody: {
          markedLead:
            "短い速報記事です。\n\n続報が入りしだい、内容を更新する予定です。",
          markedBody: "",
        },
      },
      feedItem,
    );

    expect(row.is_full_article).toBe(true);
    expect(row.content_html).toContain("短い速報記事です。");
  });

  it("rejects a same-length but different lead-only body", () => {
    expect(() =>
      normalizeFullArticle(
        {
          id: feedItem.id,
          canonical: canonicalArticleUrl(feedItem.id),
          articleBody: "これは公開された短い本文です。続報をお待ちください。",
          detailedArticleBody: {
            markedLead: "これは公開された別の記事です。続報をお待ちください。",
            markedBody: "",
          },
        },
        feedItem,
      )
    ).toThrow("did not match");
  });

  it("trusts markedBody even when the plain articleBody differs", () => {
    const markedBody = "これは完全な記事本文を表すテスト用の文章です。".repeat(
      12,
    );
    const row = normalizeFullArticle(
      {
        id: feedItem.id,
        canonical: canonicalArticleUrl(feedItem.id),
        articleBody: "API が返した別形式のプレーンテキストです。",
        detailedArticleBody: {
          markedLead: "記事の概要です。",
          markedBody,
        },
      },
      feedItem,
    );

    expect(row.is_full_article).toBe(true);
    expect(row.content_html).toContain(markedBody.slice(0, 20));
  });

  it("does not mistake lead metadata for a complete article", () => {
    expect(() =>
      normalizeFullArticle(
        {
          id: feedItem.id,
          canonical: canonicalArticleUrl(feedItem.id),
          detailedArticleBody: {
            markedLead: "概要だけです。".repeat(20),
            markedBody: "",
          },
        },
        feedItem,
      )
    ).toThrow("body was empty");
  });

  it("rejects mismatched and summary-only detail payloads", () => {
    expect(() =>
      normalizeFullArticle(
        {
          id: "nd-wrong",
          canonical: canonicalArticleUrl(feedItem.id),
          detailedArticleBody: { noHtmlMarkedBody: "長い本文".repeat(80) },
        },
        feedItem,
      )
    ).toThrow("identity");

    expect(() =>
      normalizeFullArticle(
        {
          id: feedItem.id,
          canonical: canonicalArticleUrl(feedItem.id),
        },
        feedItem,
      )
    ).toThrow("full body");
  });

  it("creates an escaped summary row for restricted fallback data", () => {
    const row = summaryRow({
      ...feedItem,
      description: '<script>bad()</script><b>雨 & "風"</b>',
    });
    expect(row.is_full_article).toBe(false);
    expect(row.content_html).toBe("<p>雨 &amp; &quot;風&quot;</p>");
  });
});
