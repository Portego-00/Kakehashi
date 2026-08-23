import fetchMock from "jest-fetch-mock";
import { supabase } from "../../lib/supabase";
import {
  NhkNewsService,
  dedupeNewsItems,
  getRegularNews,
  isSafeNhkImageUrl,
  isSafeRegularArticleHtml,
  normalizeCachedNewsItems,
  normalizeOEmbedThumbnail,
  normalizeSupabaseRegularArticles,
  parseEasyRss,
  parseRegularRss,
  sourcesForPreference,
  type NewsItem,
} from "../NhkNewsService";

jest.mock("../../lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

const EASY_RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <item>
      <title>やさしいニュース</title>
      <link>https://nhkeasier.com/story/9892/</link>
      <description>&lt;img src="/media/jpg/easy.jpg"&gt;&lt;p&gt;本文です。&lt;/p&gt;&lt;audio src='/media/mp3/easy.mp3' controls&gt;&lt;/audio&gt;&lt;a href="/story/9892/"&gt;Permalink&lt;/a&gt;</description>
      <pubDate>Fri, 21 Aug 2026 20:15:00 +0900</pubDate>
      <guid>https://nhkeasier.com/story/9892/</guid>
    </item>
  </channel>
</rss>`;

const regularItemXml = ({
  id,
  title,
  date,
  description = "RSSに掲載された要約です。",
}: {
  id: string;
  title: string;
  date: string;
  description?: string;
}) => `
  <item>
    <title>${title}</title>
    <link>https://news.web.nhk/newsweb/na/${id}?utm_source=rss</link>
    <guid isPermaLink="true">https://news.web.nhk/newsweb/na/${id}</guid>
    <description>${description}</description>
    <pubDate>${date}</pubDate>
  </item>`;

const regularRss = (...items: string[]) => `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>${items.join("")} </channel></rss>`;

const REGULAR_RSS = regularRss(
  regularItemXml({
    id: "nd-20260822de45682",
    title: "通常のニュース",
    date: "Sat, 22 Aug 2026 21:13:00 +0900",
    description:
      "RSSの要約です。&lt;script&gt;doBadThing()&lt;/script&gt;&lt;b&gt;続報&lt;/b&gt;",
  }),
);

const SUPABASE_REGULAR_ROW = {
  id: "nd-20260822de45682",
  title: "通常のニュース（全文）",
  canonical_url:
    "https://news.web.nhk/newsweb/na/nd-20260822de45682",
  guid: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
  published_at: "2026-08-22T12:13:00.000Z",
  source_updated_at: "2026-08-22T12:20:00.000Z",
  image_url: "https://img.embed.nhk/news/u/news/nd/kiji/article_l.jpg",
  audio_url: null,
  content_html:
    '<img src="https://img.embed.nhk/news/u/news/nd/kiji/article_l.jpg" alt="現場の写真" /><h2>大雨に警戒</h2><p>関東では猛烈な雨が降り、川が増水しています。</p>',
  is_full_article: true,
  content_hash: "content-hash",
  scraped_at: "2026-08-22T12:21:00.000Z",
  last_seen_at: "2026-08-22T12:21:00.000Z",
  created_at: "2026-08-22T12:21:00.000Z",
};

const supabaseFromMock = supabase.from as unknown as jest.Mock;
const supabaseSelectMock = jest.fn();
const supabaseEqMock = jest.fn();
const supabaseOrderMock = jest.fn();
const supabaseLimitMock = jest.fn();
const supabaseAbortSignalMock = jest.fn();

function setSupabaseQueryResult(result: { data: unknown; error: unknown }) {
  supabaseAbortSignalMock.mockResolvedValue(result);
  supabaseLimitMock.mockReturnValue({ abortSignal: supabaseAbortSignalMock });
  supabaseOrderMock.mockReturnValue({ limit: supabaseLimitMock });
  supabaseEqMock.mockReturnValue({ order: supabaseOrderMock });
  supabaseSelectMock.mockReturnValue({ eq: supabaseEqMock });
  supabaseFromMock.mockReturnValue({ select: supabaseSelectMock });
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => body),
    json: jest.fn(async () => JSON.parse(body)),
  } as unknown as Response;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => JSON.stringify(body)),
    json: jest.fn(async () => body),
  } as unknown as Response;
}

function requestUrl(input: string | Request | URL | undefined): string {
  if (!input) return "";
  return typeof input === "string" ? input : input.toString();
}

describe("NHK news RSS parsers", () => {
  it("keeps the existing Easy article content and adds a source-qualified ID", () => {
    const [item] = parseEasyRss(EASY_RSS);

    expect(item).toMatchObject({
      id: "easy:9892",
      source: "easy",
      title: "やさしいニュース",
      link: "https://nhkeasier.com/story/9892/",
      imageUrl: "https://nhkeasier.com/media/jpg/easy.jpg",
      audioUrl: "https://nhkeasier.com/media/mp3/easy.mp3",
      isFullArticle: true,
    });
    expect(item.contentHtml).toContain(
      'href="https://nhkeasier.com/story/9892/"',
    );
  });

  it("creates a canonical, summary-only regular item without executable HTML", () => {
    const [item] = parseRegularRss(REGULAR_RSS);

    expect(item).toMatchObject({
      id: "regular:nd-20260822de45682",
      source: "regular",
      link: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
      guid: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
      imageUrl: null,
      audioUrl: null,
      isFullArticle: false,
    });
    expect(item.contentHtml).toContain("RSSの要約です。");
    expect(item.contentHtml).toContain("続報");
    expect(item.contentHtml).not.toContain("doBadThing");
    expect(item.contentHtml).not.toMatch(/<script|<iframe/i);
    expect(item.contentHtml).toBe("<p>RSSの要約です。 続報</p>");
  });

  it.each(["na-k1000000000", "nb-12345", "nc-{article-uuid}"])(
    "treats the regular article segment %s as an opaque stable ID",
    (articleId) => {
      const [item] = parseRegularRss(
        regularRss(
          regularItemXml({
            id: articleId,
            title: "別形式のニュースID",
            date: "Sat, 22 Aug 2026 20:00:00 +0900",
          }),
        ),
      );

      expect(item.id).toBe(`regular:${articleId}`);
      expect(item.link).toBe(
        `https://news.web.nhk/newsweb/na/${
          articleId.includes("{") ? encodeURIComponent(articleId) : articleId
        }`,
      );
    },
  );

  it("uses stable IDs when the same RSS articles are parsed again", () => {
    expect(parseEasyRss(EASY_RSS)[0].id).toBe(parseEasyRss(EASY_RSS)[0].id);
    expect(parseRegularRss(REGULAR_RSS)[0].id).toBe(
      parseRegularRss(REGULAR_RSS)[0].id,
    );
  });

  it("upgrades legacy Easy cache records for offline detail lookup", () => {
    const { id: _id, isFullArticle: _isFullArticle, source: _source, ...legacy } =
      parseEasyRss(EASY_RSS)[0];

    expect(normalizeCachedNewsItems([legacy], "easy")).toEqual([
      expect.objectContaining({
        id: "easy:9892",
        source: "easy",
        isFullArticle: true,
      }),
    ]);
  });

  it("restores opaque Standard IDs from cached canonical links", () => {
    const cached = {
      title: "通常ニュース",
      link: "https://news.web.nhk/newsweb/na/nc-%7Barticle-uuid%7D",
      pubDate: "Sat, 22 Aug 2026 20:00:00 +0900",
      guid: "https://news.web.nhk/newsweb/na/nc-%7Barticle-uuid%7D",
      imageUrl: null,
      audioUrl: null,
      contentHtml: "<p>要約</p>",
    };

    expect(normalizeCachedNewsItems([cached], "regular")).toEqual([
      expect.objectContaining({
        id: "regular:nc-{article-uuid}",
        source: "regular",
        isFullArticle: false,
      }),
    ]);
  });
});

describe("NHK oEmbed thumbnail validation", () => {
  const officialThumbnail =
    "https://img.embed.nhk/news/u/news/nd/kiji/example_l.jpg";

  it("accepts the official NHK thumbnail shape", () => {
    expect(normalizeOEmbedThumbnail({ thumbnail_url: officialThumbnail })).toBe(
      officialThumbnail,
    );
    expect(isSafeNhkImageUrl(officialThumbnail)).toBe(true);
  });

  it("rejects non-HTTPS and lookalike image hosts", () => {
    expect(
      normalizeOEmbedThumbnail({
        thumbnail_url: "https://img.embed.nhk.example/unsafe.jpg",
      }),
    ).toBeNull();
    expect(isSafeNhkImageUrl("http://img.embed.nhk/unsafe.jpg")).toBe(false);
  });
});

describe("Supabase Standard article normalization", () => {
  it("maps the fixed public-table contract to a full regular NewsItem", () => {
    expect(normalizeSupabaseRegularArticles([SUPABASE_REGULAR_ROW])).toEqual([
      {
        id: "regular:nd-20260822de45682",
        source: "regular",
        title: "通常のニュース（全文）",
        link: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
        guid: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
        pubDate: "2026-08-22T12:13:00.000Z",
        imageUrl:
          "https://img.embed.nhk/news/u/news/nd/kiji/article_l.jpg",
        audioUrl: null,
        contentHtml: SUPABASE_REGULAR_ROW.content_html,
        isFullArticle: true,
      },
    ]);
  });

  it("rejects mismatched canonical IDs and active or unsafe article markup", () => {
    expect(
      normalizeSupabaseRegularArticles([
        {
          ...SUPABASE_REGULAR_ROW,
          canonical_url:
            "https://news.web.nhk/newsweb/na/nd-another-article",
        },
      ]),
    ).toEqual([]);
    expect(
      normalizeSupabaseRegularArticles([
        {
          ...SUPABASE_REGULAR_ROW,
          content_html: '<p onclick="steal()">本文</p><script>steal()</script>',
        },
      ]),
    ).toEqual([]);
    expect(
      isSafeRegularArticleHtml(
        '<p>本文です。</p><img src="https://images.example.com/not-nhk.jpg" />',
      ),
    ).toBe(false);
  });
});

describe("NhkNewsService", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    supabaseFromMock.mockReset();
    supabaseSelectMock.mockReset();
    supabaseEqMock.mockReset();
    supabaseOrderMock.mockReset();
    supabaseLimitMock.mockReset();
    supabaseAbortSignalMock.mockReset();
    setSupabaseQueryResult({
      data: null,
      error: { message: "Supabase unavailable in fallback tests" },
    });
    NhkNewsService.setCachedItems([]);
  });

  it("queries full Standard articles from Supabase before using RSS", async () => {
    setSupabaseQueryResult({ data: [SUPABASE_REGULAR_ROW], error: null });

    const result = await getRegularNews();

    expect(result).toEqual([
      expect.objectContaining({
        id: "regular:nd-20260822de45682",
        contentHtml: SUPABASE_REGULAR_ROW.content_html,
        isFullArticle: true,
      }),
    ]);
    expect(supabaseFromMock).toHaveBeenCalledWith("nhk_regular_articles");
    expect(supabaseSelectMock).toHaveBeenCalledWith(
      "id,title,canonical_url,guid,published_at,image_url,audio_url,content_html,is_full_article",
    );
    expect(supabaseEqMock).toHaveBeenCalledWith("is_full_article", true);
    expect(supabaseOrderMock).toHaveBeenCalledWith("published_at", {
      ascending: false,
    });
    expect(supabaseLimitMock).toHaveBeenCalledWith(20);
    expect(supabaseAbortSignalMock).toHaveBeenCalledWith(
      expect.any(AbortSignal),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "an empty result",
      result: { data: [], error: null },
    },
    {
      name: "an unsafe row",
      result: {
        data: [
          {
            ...SUPABASE_REGULAR_ROW,
            content_html: "<iframe src='https://example.com'></iframe>",
          },
        ],
        error: null,
      },
    },
  ])("falls back to RSS/oEmbed for $name", async ({ result }) => {
    const thumbnail =
      "https://img.embed.nhk/news/u/news/nd/kiji/fallback_l.jpg";
    setSupabaseQueryResult(result);
    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input);
      return url.includes("/cat0.xml")
        ? textResponse(REGULAR_RSS)
        : jsonResponse({ thumbnail_url: thumbnail });
    });

    await expect(getRegularNews()).resolves.toEqual([
      expect.objectContaining({
        id: "regular:nd-20260822de45682",
        imageUrl: thumbnail,
        isFullArticle: false,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("enriches regular RSS cards only through official oEmbed", async () => {
    const thumbnail =
      "https://img.embed.nhk/news/u/news/nd/kiji/article_l.jpg";
    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url.includes("/cat0.xml")) return textResponse(REGULAR_RSS);
      if (url.startsWith("https://www.web.nhk/oembed?")) {
        return jsonResponse({ thumbnail_url: thumbnail });
      }
      return textResponse("not found", 404);
    });

    const [item] = await getRegularNews();

    expect(item.imageUrl).toBe(thumbnail);
    expect(item.isFullArticle).toBe(false);
    expect(item.contentHtml).toBe("<p>RSSの要約です。 続報</p>");

    const requestedUrls = fetchMock.mock.calls.map(([input]) =>
      requestUrl(input),
    );
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[0]).toBe(
      "https://news.web.nhk/n-data/conf/na/rss/cat0.xml",
    );
    expect(requestedUrls[1]).toContain("https://www.web.nhk/oembed?url=");
    expect(decodeURIComponent(requestedUrls[1])).toContain(item.link);
    expect(requestedUrls.some((url) => url.includes("/newsarticle/"))).toBe(
      false,
    );
    expect(requestedUrls.some((url) => url.includes("build_authorize"))).toBe(
      false,
    );
  });

  it("keeps RSS summaries usable when an individual oEmbed request fails", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input);
      return url.includes("/cat0.xml")
        ? textResponse(REGULAR_RSS)
        : textResponse("unavailable", 503);
    });

    await expect(getRegularNews()).resolves.toEqual([
      expect.objectContaining({
        id: "regular:nd-20260822de45682",
        imageUrl: null,
        isFullArticle: false,
      }),
    ]);
  });

  it("bounds concurrent oEmbed enrichment to four requests", async () => {
    const items = Array.from({ length: 7 }, (_, index) =>
      regularItemXml({
        id: `nd-20260822de${45000 + index}`,
        title: `通常ニュース ${index}`,
        date: `Sat, 22 Aug 2026 2${index}:00:00 +0900`,
      }),
    );
    let activeRequests = 0;
    let maximumActiveRequests = 0;

    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url.includes("/cat0.xml")) return textResponse(regularRss(...items));
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      activeRequests -= 1;
      return jsonResponse({ thumbnail_url: null });
    });

    await expect(getRegularNews()).resolves.toHaveLength(7);
    expect(maximumActiveRequests).toBe(4);
  });

  it("tolerates one feed failing, date-sorts the survivor, and caches it", async () => {
    const older = regularItemXml({
      id: "nd-20260821de45001",
      title: "古い通常ニュース",
      date: "Fri, 21 Aug 2026 09:00:00 +0900",
    });
    const newer = regularItemXml({
      id: "nd-20260822de45002",
      title: "新しい通常ニュース",
      date: "Sat, 22 Aug 2026 09:00:00 +0900",
    });
    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === "https://nhkeasier.com/feed/") {
        throw new Error("Easy feed offline");
      }
      if (url.includes("/cat0.xml")) {
        return textResponse(regularRss(older, newer, newer));
      }
      return jsonResponse({});
    });

    const result = await NhkNewsService.getNews("both");

    expect(result.map((item) => item.id)).toEqual([
      "regular:nd-20260822de45002",
      "regular:nd-20260821de45001",
    ]);
    expect(
      NhkNewsService.getItemById("nd-20260822de45002", "regular"),
    ).toBe(result[0]);
    expect(
      NhkNewsService.getItemById(
        encodeURIComponent("regular:nd-20260822de45002"),
      ),
    ).toBe(result[0]);
  });

  it("does not let an older request replace the latest cached source", async () => {
    let releaseEasyFeed: (() => void) | undefined;
    const easyFeedGate = new Promise<void>((resolve) => {
      releaseEasyFeed = resolve;
    });

    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === "https://nhkeasier.com/feed/") {
        await easyFeedGate;
        return textResponse(EASY_RSS);
      }
      if (url.includes("/cat0.xml")) return textResponse(REGULAR_RSS);
      return jsonResponse({});
    });

    const olderEasyRequest = NhkNewsService.getNews("easy");
    const latestRegularRequest = NhkNewsService.getNews("regular");
    const [regularItem] = await latestRegularRequest;

    releaseEasyFeed?.();
    await olderEasyRequest;

    expect(
      NhkNewsService.getItemById("nd-20260822de45682", "regular"),
    ).toBe(regularItem);
    expect(NhkNewsService.getItemById("9892", "easy")).toBeUndefined();
  });

  it("deduplicates source-qualified IDs without merging different sources", () => {
    const easy = parseEasyRss(EASY_RSS)[0];
    const regular = parseRegularRss(REGULAR_RSS)[0];
    const items: NewsItem[] = [easy, easy, regular, regular];

    expect(dedupeNewsItems(items).map((item) => item.id)).toEqual([
      "easy:9892",
      "regular:nd-20260822de45682",
    ]);
    expect(sourcesForPreference("both")).toEqual(["easy", "regular"]);
  });
});
