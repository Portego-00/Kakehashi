jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  const toUri = (value: unknown) =>
    typeof value === "string"
      ? value
      : ((value as { uri?: string } | null)?.uri ?? "");
  const joinUri = (parts: unknown[]) => parts.map(toUri).join("/");

  class Directory {
    uri: string;

    constructor(...parts: unknown[]) {
      this.uri = joinUri(parts);
    }

    create() {}
  }

  class File {
    uri: string;

    constructor(...parts: unknown[]) {
      this.uri = joinUri(parts);
    }

    get exists() {
      return files.has(this.uri);
    }

    async text() {
      return files.get(this.uri) ?? "";
    }

    async write(value: string) {
      await Promise.resolve();
      files.set(this.uri, value);
    }
  }

  return {
    Directory,
    File,
    Paths: { cache: "cache" },
    __files: files,
  };
});

import { Directory, File, Paths } from "expo-file-system";
import {
  preserveCachedFullArticles,
  readCachedNews,
  saveNewsToCache,
} from "../NhkNewsCacheService";
import type { NewsItem } from "../NhkNewsService";

function cacheFile(name: string): File {
  return new File(new Directory(Paths.cache, "news"), name);
}

const easyArticle: NewsItem = {
  id: "easy:101",
  source: "easy",
  title: "やさしいニュース",
  link: "https://nhkeasier.com/story/101/",
  guid: "https://nhkeasier.com/story/101/",
  pubDate: "2026-08-21T12:00:00.000Z",
  imageUrl: null,
  audioUrl: null,
  contentHtml: "<p>やさしい本文</p>",
  isFullArticle: true,
};

const fullRegularArticle: NewsItem = {
  id: "regular:nd-20260822de45682",
  source: "regular",
  title: "通常ニュース",
  link: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
  guid: "https://news.web.nhk/newsweb/na/nd-20260822de45682",
  pubDate: "2026-08-22T12:00:00.000Z",
  imageUrl: "https://img.web.nhk/news/example.jpg",
  audioUrl: null,
  contentHtml: "<p>保存された通常ニュースの全文です。</p>",
  isFullArticle: true,
};

beforeEach(() => {
  const mockedModule = jest.requireMock("expo-file-system") as {
    __files: Map<string, string>;
  };
  mockedModule.__files.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("NHK news disk cache", () => {
  it("does not report a completed save before the disk write finishes", async () => {
    let finishWrite!: () => void;
    const pendingWrite = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    jest.spyOn(File.prototype, "write").mockReturnValueOnce(pendingWrite);
    let completed = false;
    const save = saveNewsToCache([easyArticle]).then(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(completed).toBe(false);
    finishWrite();
    await save;
    expect(completed).toBe(true);
  });

  it("propagates an asynchronous disk write failure", async () => {
    jest.spyOn(File.prototype, "write").mockRejectedValueOnce(new Error("disk full"));

    await expect(saveNewsToCache([easyArticle])).rejects.toThrow("disk full");
  });

  it("hydrates both source caches and upgrades the legacy Easy cache", async () => {
    const { id: _id, source: _source, ...legacyEasyArticle } = easyArticle;
    await cacheFile("news-cache.json").write(JSON.stringify([legacyEasyArticle]));
    await cacheFile("news-cache-regular.json").write(
      JSON.stringify([fullRegularArticle]),
    );

    await expect(readCachedNews("both")).resolves.toEqual([
      fullRegularArticle,
      easyArticle,
    ]);
  });

  it("keeps a saved full story when a refresh falls back to an RSS summary", () => {
    const summary = {
      ...fullRegularArticle,
      imageUrl: null,
      contentHtml: "<p>短い要約です。</p>",
      isFullArticle: false,
    };

    expect(preserveCachedFullArticles([summary], [fullRegularArticle])).toEqual(
      [
        {
          ...fullRegularArticle,
          title: summary.title,
          link: summary.link,
          pubDate: summary.pubDate,
          guid: summary.guid,
        },
      ],
    );
  });

  it("does not erase one provider's saved feed when only the other refreshes", async () => {
    await cacheFile("news-cache-regular.json").write(
      JSON.stringify([fullRegularArticle]),
    );

    await saveNewsToCache([easyArticle]);

    await expect(readCachedNews("both")).resolves.toEqual([
      fullRegularArticle,
      easyArticle,
    ]);
  });
});
