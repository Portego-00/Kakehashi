import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  clearNewsFeedCacheForTests,
  getNewsFeed,
  isSafeRegularArticleHtml,
  normalizeStoredRegularArticles,
  parseNewsContent,
  parseNewsRss,
  parseRegularNewsRss,
} from "./news-source";

const easyXml = `<?xml version="1.0"?><rss><channel><item>
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

const regularXml = `<?xml version="1.0"?><rss><channel><item>
  <title>通常のNHKニュース</title>
  <link>https://news.web.nhk/newsweb/na/20260825_regular</link>
  <guid>https://news.web.nhk/newsweb/na/20260825_regular</guid>
  <pubDate>Tue, 25 Aug 2026 10:00:00 +0900</pubDate>
  <description><![CDATA[<p>標準ニュースの要約です。</p>]]></description>
</item></channel></rss>`;

const storedRow = {
  id: "20260825_regular",
  title: "通常のNHKニュース",
  canonical_url: "https://news.web.nhk/newsweb/na/20260825_regular",
  guid: "https://news.web.nhk/newsweb/na/20260825_regular",
  published_at: "2026-08-25T01:00:00.000Z",
  image_url: "https://imgu.web.nhk/news/example/lead_l.jpg",
  content_html: '<img src="https://imgu.web.nhk/news/example/lead_l.jpg" alt="現場"><h2>詳しいニュース</h2><p>安全な本文です。</p>',
  is_full_article: true,
};

afterEach(() => {
  clearNewsFeedCacheForTests();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("NHK Easy RSS parsing", () => {
  it("keeps existing text and images while adding source-qualified identity", () => {
    expect(parseNewsRss(easyXml)).toEqual([expect.objectContaining({
      id: "easy:9876",
      source: "easy",
      isFullArticle: true,
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

describe("Standard NHK normalization", () => {
  it("creates a canonical summary-only article from official RSS", () => {
    expect(parseRegularNewsRss(regularXml)).toEqual([expect.objectContaining({
      id: "regular:20260825_regular",
      source: "regular",
      url: "https://news.web.nhk/newsweb/na/20260825_regular",
      isFullArticle: false,
      body: "標準ニュースの要約です。",
    })]);
  });

  it("maps a safe public-cache row to full ordered article content", () => {
    expect(normalizeStoredRegularArticles([storedRow])).toEqual([expect.objectContaining({
      id: "regular:20260825_regular",
      source: "regular",
      isFullArticle: true,
      imageUrl: storedRow.image_url,
      body: "詳しいニュース\n\n安全な本文です。",
      content: [
        { type: "image", url: storedRow.image_url, alt: "現場" },
        { type: "text", text: "詳しいニュース" },
        { type: "text", text: "安全な本文です。" },
      ],
    })]);
  });

  it("rejects mismatched identity, active markup, and image lookalikes", () => {
    expect(normalizeStoredRegularArticles([{ ...storedRow, canonical_url: "https://news.web.nhk/newsweb/na/different_id" }])).toEqual([]);
    expect(normalizeStoredRegularArticles([{ ...storedRow, content_html: "<p onclick=\"steal()\">本文です。</p>" }])).toEqual([]);
    expect(normalizeStoredRegularArticles([{ ...storedRow, image_url: "https://imgu.web.nhk.attacker.example/lead.jpg" }])).toEqual([]);
    expect(isSafeRegularArticleHtml('<img src="https://imgu.web.nhk.attacker.example/a.jpg"><p>本文です。</p>')).toBe(false);
  });

  it("preserves list, image, quote, and caption text in source order", () => {
    expect(parseNewsContent(
      '<p>最初です。</p><ul><li>一つ目</li><li>二つ目</li></ul><img src="https://img.web.nhk/news/a.jpg"><blockquote>引用です。</blockquote><figcaption>写真の説明</figcaption>',
      "https://news.web.nhk/newsweb/na/20260825_regular",
    )).toEqual([
      { type: "text", text: "最初です。" },
      { type: "text", text: "一つ目" },
      { type: "text", text: "二つ目" },
      { type: "image", url: "https://img.web.nhk/news/a.jpg", alt: "Story illustration" },
      { type: "text", text: "引用です。" },
      { type: "text", text: "写真の説明" },
    ]);
  });
});

describe("news source adapters", () => {
  it("prefers safe full Standard articles from the public Supabase cache", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    const remote = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([storedRow]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", remote);

    const feed = await getNewsFeed("regular");

    expect(feed.articles).toEqual([expect.objectContaining({ id: "regular:20260825_regular", isFullArticle: true })]);
    expect(remote).toHaveBeenCalledTimes(1);
    expect(String(remote.mock.calls[0]?.[0])).toContain("/rest/v1/nhk_regular_articles");
    expect(String(remote.mock.calls[0]?.[0])).toContain("is_full_article=eq.true");
  });

  it("falls back to official RSS and oEmbed when the full cache is unavailable", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("supabase.co")) return new Response(null, { status: 503 });
      if (url === "https://news.web.nhk/n-data/conf/na/rss/cat0.xml") return new Response(regularXml, { status: 200 });
      if (url.startsWith("https://www.web.nhk/oembed?")) return new Response(JSON.stringify({ thumbnail_url: "https://img.web.nhk/news/example/card.jpg" }), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    }));

    const feed = await getNewsFeed("regular");

    expect(feed.articles).toEqual([expect.objectContaining({
      id: "regular:20260825_regular",
      isFullArticle: false,
      imageUrl: "https://img.web.nhk/news/example/card.jpg",
    })]);
  });

  it("does not downgrade a cached full Standard article when only its RSS summary refreshes", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    let storedRequests = 0;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("supabase.co")) {
        storedRequests += 1;
        return storedRequests === 1
          ? new Response(JSON.stringify([storedRow]), { status: 200 })
          : new Response(null, { status: 503 });
      }
      if (url === "https://news.web.nhk/n-data/conf/na/rss/cat0.xml") return new Response(regularXml, { status: 200 });
      if (url.startsWith("https://www.web.nhk/oembed?")) return new Response(JSON.stringify({ thumbnail_url: "https://img.web.nhk/news/example/card.jpg" }), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    }));

    const full = await getNewsFeed("regular");
    const refreshed = await getNewsFeed("regular");

    expect(full.articles[0]).toEqual(expect.objectContaining({ isFullArticle: true, body: "詳しいニュース\n\n安全な本文です。" }));
    expect(refreshed.articles[0]).toEqual(expect.objectContaining({
      isFullArticle: true,
      body: "詳しいニュース\n\n安全な本文です。",
      imageUrl: "https://img.web.nhk/news/example/card.jpg",
    }));
  });

  it("combines a cached failed source with a live source without cross-contaminating them", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    let easyRequests = 0;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === "https://nhkeasier.com/feed/") {
        easyRequests += 1;
        return easyRequests === 1 ? new Response(easyXml, { status: 200 }) : new Response(null, { status: 503 });
      }
      if (url.includes("supabase.co")) return new Response(null, { status: 503 });
      if (url === "https://news.web.nhk/n-data/conf/na/rss/cat0.xml") return new Response(regularXml, { status: 200 });
      if (url.startsWith("https://www.web.nhk/oembed?")) return new Response(JSON.stringify({}), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    }));

    await getNewsFeed("easy");
    const combined = await getNewsFeed("both");

    expect(combined.source).toBe("server-cache");
    expect(combined.unavailableSources).toEqual(["easy"]);
    expect(combined.articles.map((article) => article.source).sort()).toEqual(["easy", "regular"]);
    expect(combined.articles.map((article) => article.id)).toEqual(expect.arrayContaining(["easy:9876", "regular:20260825_regular"]));
  });
});
