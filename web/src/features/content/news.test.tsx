import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt = "", src }: { alt?: string; src: string }) => <span role="img" aria-label={alt} data-src={src} />,
}));
vi.mock("@/features/study/use-study-dataset", () => ({
  useStudyDataset: () => ({ dataset: null }),
}));
vi.mock("./JapaneseReader", () => ({
  JapaneseReader: ({ text, blocks }: { text: string; blocks?: Array<{ type: string }> }) => <div data-testid="japanese-reader" data-block-order={blocks?.map((block) => block.type).join(",")}>{text}</div>,
}));
vi.mock("./useFirstContentReveal", () => ({
  useFirstContentReveal: () => ({ "data-first-reveal": "ready" }),
}));

import { NewsArticleView, NewsIndex } from "./news";
import { readLocal, writeLocal } from "./storage";
import type { NewsArticle } from "./types";

const easyArticle: NewsArticle = {
  id: "easy:101",
  source: "easy",
  title: "やさしいニュース",
  publishedAt: "2026-08-25T08:00:00.000Z",
  url: "https://nhkeasier.com/story/101/",
  isFullArticle: true,
  imageUrl: "https://nhkeasier.com/media/jpg/easy.jpg",
  body: "やさしい本文です。",
  content: [{ type: "text", text: "やさしい本文です。" }],
};

const standardArticle: NewsArticle = {
  id: "regular:nd-101",
  source: "regular",
  title: "通常のニュース",
  publishedAt: "2026-08-25T09:00:00.000Z",
  url: "https://news.web.nhk/newsweb/na/nd-101",
  isFullArticle: true,
  imageUrl: "https://img.web.nhk/news/lead.jpg",
  body: "通常ニュースの本文です。続報もあります。",
  content: [
    { type: "image", url: "https://img.web.nhk/news/lead.jpg", alt: "現場" },
    { type: "text", text: "通常ニュースの本文です。" },
    { type: "image", url: "https://img.web.nhk/news/detail.jpg", alt: "続報" },
    { type: "text", text: "続報もあります。" },
  ],
};

function feed(articles: NewsArticle[], options?: { unavailableSources?: Array<"easy" | "regular"> }) {
  return {
    articles,
    updatedAt: "2026-08-25T10:00:00.000Z",
    source: "live" as const,
    ...options,
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("NHK News web source parity", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("defaults to Easy, persists source changes, and caches providers separately", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === "/news/feed?source=easy") return response(feed([easyArticle]));
      if (url === "/news/feed?source=regular") return response(feed([standardArticle]));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsIndex />);

    expect(screen.queryByRole("heading", { name: "NHK news" })).not.toBeInTheDocument();
    const filters = screen.getByRole("search", { name: "News filters" });
    expect(within(filters).getByRole("searchbox", { name: "Search articles" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: /Refresh/ })).toBeInTheDocument();
    const source = within(filters).getByRole("combobox", { name: "Source" });
    expect(source).toHaveValue("easy");
    const easyTitle = await screen.findByText(easyArticle.title);
    expect(easyTitle).toBeInTheDocument();
    const feedMeta = screen.getByText(
      /Updated .*Easy live feed.*Article rights remain with NHK/,
    );
    expect(
      easyTitle.compareDocumentPosition(feedMeta) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByLabelText("Easy source")).not.toBeInTheDocument();

    fireEvent.change(source, { target: { value: "regular" } });
    expect(await screen.findByText(standardArticle.title)).toBeInTheDocument();
    expect(source).toHaveValue("regular");
    expect(readLocal("news-source-preference", "easy")).toBe("regular");
    expect(readLocal<{ articles: NewsArticle[] } | null>("news-cache-easy", null)?.articles).toEqual([expect.objectContaining({ id: easyArticle.id })]);
    expect(readLocal<{ articles: NewsArticle[] } | null>("news-cache-regular", null)?.articles).toEqual([expect.objectContaining({ id: standardArticle.id })]);
    expect(fetchMock).toHaveBeenCalledWith("/news/feed?source=easy", { cache: "no-store" });
    expect(fetchMock).toHaveBeenCalledWith("/news/feed?source=regular", { cache: "no-store" });
  });

  it("shows source badges only for Both and retains a failed provider's saved articles", async () => {
    writeLocal("news-source-preference", "both");
    writeLocal("news-cache-regular", feed([standardArticle]));
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle], { unavailableSources: ["regular"] }))));

    render(<NewsIndex />);

    expect(await screen.findByText(easyArticle.title)).toBeInTheDocument();
    expect(screen.getByText(standardArticle.title)).toBeInTheDocument();
    expect(screen.getByLabelText("Easy source")).toBeInTheDocument();
    expect(screen.getByLabelText("Standard source")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Standard could not refresh. Showing its saved articles.");
  });

  it("fetches a source-qualified Standard detail and keeps its document boundary ordered with one reader", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => response(feed([standardArticle])));
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsArticleView articleId={standardArticle.id} />);

    const document = await screen.findByRole("region", { name: "Article document" });
    expect(within(document).getAllByTestId("japanese-reader")).toHaveLength(1);
    expect(within(document).getByTestId("japanese-reader")).toHaveAttribute("data-block-order", "image,text,image,text");
    expect(within(document).getByTestId("japanese-reader")).toHaveTextContent(standardArticle.body ?? "");
    expect(fetchMock).toHaveBeenCalledWith("/news/feed?source=regular", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("renders an explicit NHK summary fallback without starting article analysis", async () => {
    const summaryArticle: NewsArticle = {
      ...standardArticle,
      isFullArticle: false,
      body: "",
      summary: "RSSで配信された要約です。",
      content: [{ type: "text", text: "RSSで配信された要約です。" }],
    };
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([summaryArticle]))));

    render(<NewsArticleView articleId={encodeURIComponent(summaryArticle.id)} />);

    expect(await screen.findByText("NHK ONE News summary")).toBeInTheDocument();
    expect(screen.getByText(summaryArticle.summary ?? "")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open on NHK/ })).not.toHaveLength(0);
    expect(screen.queryByTestId("japanese-reader")).not.toBeInTheDocument();
  });
});
