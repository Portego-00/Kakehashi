import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt = "", src }: { alt?: string; src: string }) => <span role="img" aria-label={alt} data-src={src} />,
}));
const study = vi.hoisted(() => ({
  dataset: null as { subjects: Subject[]; assignments: Assignment[] } | null,
  user: null as WKUser | null,
  status: "authenticated" as "authenticated" | "loading" | "anonymous",
}));
vi.mock("@/features/study/use-study-dataset", () => ({
  useStudyDataset: () => study,
}));
vi.mock("./JapaneseReader", () => ({
  JapaneseReader: ({ text, blocks, showFurigana, onShowFuriganaChange }: { text: string; blocks?: Array<{ type: string; furigana?: Array<{ start: number; end: number; reading: string }> }>; showFurigana?: boolean; onShowFuriganaChange?: (value: boolean) => void }) => <><div data-testid="japanese-reader" data-block-order={blocks?.map((block) => block.type).join(",")} data-show-furigana={String(showFurigana)} data-has-furigana={String(blocks?.some((block) => block.furigana?.length))}>{text}</div>{onShowFuriganaChange ? <button type="button" aria-pressed={showFurigana} aria-label="Furigana" onClick={() => onShowFuriganaChange(!showFurigana)}>Furigana</button> : null}</>,
}));
vi.mock("./useFirstContentReveal", () => ({
  useFirstContentReveal: () => ({ "data-first-reveal": "ready" }),
}));

import { NewsArticleView, NewsIndex } from "./news";
import { readLocal, writeLocal } from "./storage";
import type { NewsArticle } from "./types";

import type { Assignment, Subject, WKUser } from "@/types/wanikani";
import { DEMO_USER } from "@/features/demo/runtime";
import { testSubject, testAssignment } from "@/features/progress/analytics-test-fixtures";

const EASY_AUDIO_URL = "https://nhkeasier.com/media/mp3/easy.mp3";

const easyArticle: NewsArticle = {
  id: "easy:101",
  source: "easy",
  title: "やさしいニュース",
  publishedAt: "2026-08-25T08:00:00.000Z",
  url: "https://nhkeasier.com/story/101/",
  isFullArticle: true,
  imageUrl: "https://nhkeasier.com/media/jpg/easy.jpg",
  audioUrl: EASY_AUDIO_URL,
  body: "やさしい本文です。",
  content: [{ type: "text", text: "やさしい本文です。", furigana: [{ start: 4, end: 6, reading: "ほんぶん" }] }],
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
  beforeEach(() => {
    window.localStorage.clear();
    study.dataset = null;
    study.user = DEMO_USER;
    study.status = "authenticated";
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });


  it("restores known percentages immediately on reopening while study data is still loading", async () => {
    const article = { ...easyArticle, title: "日本", body: "日本" };
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([article]))));
    study.dataset = {
      subjects: [testSubject(1, "kanji", { characters: "日" })],
      assignments: [testAssignment(1, { srs_stage: 5 })],
    };
    const first = render(<NewsIndex />);
    expect(await screen.findByText("50% Known")).toBeInTheDocument();
    first.unmount();
    study.dataset = null;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<NewsIndex />);
    expect(screen.getByText("50% Known")).toBeInTheDocument();
    expect(screen.queryByText("… Known")).not.toBeInTheDocument();
  });

  it("uses cached kanji for new stories and replaces it when fresh progress arrives", async () => {
    writeLocal("news-known-kanji-v1:demo-level-21", ["日"]);
    const article = { ...easyArticle, title: "日本", body: "日本" };
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([article]))));
    const view = render(<NewsIndex />);
    expect(await screen.findByText("50% Known")).toBeInTheDocument();

    study.dataset = {
      subjects: [testSubject(1, "kanji", { characters: "日" }), testSubject(2, "kanji", { characters: "本" })],
      assignments: [testAssignment(1, { srs_stage: 5 }), testAssignment(2, { srs_stage: 5 })],
    };
    view.rerender(<NewsIndex />);
    expect(screen.getByText("100% Known")).toBeInTheDocument();
    expect(readLocal("news-known-kanji-v1:demo-level-21", null)).toEqual(["日", "本"]);

    // A reset to zero known kanji must replace the saved progress too.
    study.dataset = { subjects: study.dataset.subjects, assignments: [] };
    view.rerender(<NewsIndex />);
    expect(screen.getByText("0% Known")).toBeInTheDocument();
    view.unmount();
    study.dataset = null;
    render(<NewsIndex />);
    expect(screen.getByText("0% Known")).toBeInTheDocument();
  });

  it("never shows another account’s cached percentages or uses them before authentication", async () => {
    writeLocal("news-known-kanji-v1:demo-level-21", ["本", "文"]);
    writeLocal("news-cache-easy", feed([easyArticle]));
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle]))));
    const view = render(<NewsIndex />);
    expect(screen.getByText("100% Known")).toBeInTheDocument();
    study.user = { ...DEMO_USER, data: { ...DEMO_USER.data, username: "another-account" } };
    view.rerender(<NewsIndex />);
    expect(screen.getByText("… Known")).toBeInTheDocument();
    study.user = DEMO_USER;
    study.status = "loading";
    view.rerender(<NewsIndex />);
    expect(screen.getByText("… Known")).toBeInTheDocument();
    study.status = "authenticated";
    view.rerender(<NewsIndex />);
    expect(screen.getByText("100% Known")).toBeInTheDocument();
  });

  it("ignores malformed kanji caches and keeps live scores working if storage fails", async () => {
    writeLocal("news-known-kanji-v1:demo-level-21", [42]);
    writeLocal("news-cache-easy", feed([easyArticle]));
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle]))));
    const view = render(<NewsIndex />);
    expect(screen.getByText("… Known")).toBeInTheDocument();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage full"); });
    study.dataset = { subjects: [], assignments: [] };
    view.rerender(<NewsIndex />);
    expect(screen.getByText("0% Known")).toBeInTheDocument();
  });

  it("persists manual read status, filters unread stories, and allows undo without navigating", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle, { ...easyArticle, id: "easy:102", title: "新しいニュース" }]))));
    const first = render(<NewsIndex />);
    const mark = await screen.findByRole("button", { name: `Mark as read: ${easyArticle.title}` });
    fireEvent.click(mark);
    expect(screen.getByRole("button", { name: `Mark unread: ${easyArticle.title}` })).toHaveAttribute("aria-pressed", "true");
    expect(readLocal("news-read-history", [])).toEqual([easyArticle.id]);
    fireEvent.click(screen.getByRole("button", { name: "Unread (1)" }));
    expect(screen.queryByText(easyArticle.title)).not.toBeInTheDocument();
    expect(screen.getByText("新しいニュース")).toBeInTheDocument();
    first.unmount();
    render(<NewsIndex />);
    fireEvent.click(await screen.findByRole("button", { name: `Mark unread: ${easyArticle.title}` }));
    expect(screen.getByRole("button", { name: "Unread (2)" })).toBeInTheDocument();
    expect(readLocal("news-read-history", [])).toEqual([]);
  });

  it("marks resolved articles read once and preserves a manual unread change after refresh", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle]))));
    const first = render(<NewsArticleView articleId={easyArticle.id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark unread" }));
    expect(readLocal("news-read-history", [])).toEqual([]);
    expect(screen.getByRole("button", { name: "Mark as read" })).toBeInTheDocument();
    first.unmount();
    render(<NewsIndex />);
    expect(await screen.findByRole("button", { name: `Mark as read: ${easyArticle.title}` })).toBeInTheDocument();
  });

  it("shows an all-caught-up state and restores read cards when leaving the filter", async () => {
    writeLocal("news-read-history", [easyArticle.id]);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle]))));
    render(<NewsIndex />);
    await screen.findByText(easyArticle.title);
    fireEvent.click(screen.getByRole("button", { name: "Unread (0)" }));
    expect(screen.getByText("You’re all caught up")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All stories" }));
    expect(screen.getByText(easyArticle.title)).toBeInTheDocument();
  });

  it("updates read status from other tabs and reports failed saves", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle]))));
    render(<NewsIndex />);
    await screen.findByText(easyArticle.title);
    writeLocal("news-read-history", [easyArticle.id]);
    fireEvent(window, new StorageEvent("storage", { key: "kakehashi:content:v1:news-read-history" }));
    expect(screen.getByRole("button", { name: `Mark unread: ${easyArticle.title}` })).toBeInTheDocument();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage full"); });
    fireEvent.click(screen.getByRole("button", { name: `Mark unread: ${easyArticle.title}` }));
    expect(screen.getByRole("status")).toHaveTextContent("Could not save read status");
    expect(screen.getByRole("button", { name: `Mark unread: ${easyArticle.title}` })).toHaveAttribute("aria-pressed", "true");
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
    expect(readLocal<{ articles: NewsArticle[] } | null>("news-cache-easy", null)?.articles).toEqual([expect.objectContaining({ id: easyArticle.id, audioUrl: EASY_AUDIO_URL, content: easyArticle.content })]);
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
    expect(within(document).getByRole("button", { name: "Furigana" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).toHaveBeenCalledWith("/news/feed?source=regular", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
  });

  it("defaults furigana on and persists the reader toggle across article mounts", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle]))));

    const first = render(<NewsArticleView articleId={easyArticle.id} />);
    const reader = await screen.findByTestId("japanese-reader");
    expect(reader).toHaveAttribute("data-has-furigana", "true");
    expect(reader).toHaveAttribute("data-show-furigana", "true");
    const hide = screen.getByRole("button", { name: "Furigana" });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(hide);
    expect(reader).toHaveAttribute("data-show-furigana", "false");
    expect(readLocal("news-show-furigana", true)).toBe(false);

    first.unmount();
    render(<NewsArticleView articleId={easyArticle.id} />);
    const restored = await screen.findByTestId("japanese-reader");
    await waitFor(() => expect(restored).toHaveAttribute("data-show-furigana", "false"));
    expect(screen.getByRole("button", { name: "Furigana" })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders a floating Easy audio player with playback and seeking controls", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle]))));

    const { container } = render(<NewsArticleView articleId={easyArticle.id} />);

    const player = await screen.findByRole("region", { name: "Article audio player" });
    expect(within(player).getByText("NHK Easy audio")).toBeInTheDocument();
    expect(within(player).getByText(easyArticle.title)).toBeInTheDocument();

    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute("src", EASY_AUDIO_URL);
    expect(audio).not.toHaveAttribute("controls");
    expect(audio).toHaveAttribute("preload", "metadata");

    Object.defineProperties(audio!, {
      duration: { configurable: true, value: 125 },
      currentTime: { configurable: true, writable: true, value: 35 },
    });
    fireEvent.loadedMetadata(audio!);
    fireEvent.timeUpdate(audio!);

    expect(await within(player).findByText("0:35 / 2:05")).toBeInTheDocument();
    const progress = within(player).getByRole("slider", { name: "Audio progress" });
    expect(progress).toHaveValue("35");
    expect(progress).toHaveAttribute("max", "125");

    fireEvent.change(progress, { target: { value: "100" } });
    expect(audio!.currentTime).toBe(100);
    fireEvent.click(within(player).getByRole("button", { name: "Forward 10 seconds" }));
    expect(audio!.currentTime).toBe(110);
    audio!.currentTime = 123;
    fireEvent.click(within(player).getByRole("button", { name: "Forward 10 seconds" }));
    expect(audio!.currentTime).toBe(125);
    fireEvent.click(within(player).getByRole("button", { name: "Rewind 10 seconds" }));
    expect(audio!.currentTime).toBe(115);

    fireEvent.click(within(player).getByRole("button", { name: "Play article audio" }));
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    fireEvent.click(within(player).getByRole("button", { name: "Pause article audio" }));
    expect(pause).toHaveBeenCalledOnce();

    fireEvent.click(within(player).getByRole("button", { name: "Mute article audio" }));
    expect(audio!.muted).toBe(true);
    expect(within(player).getByRole("button", { name: "Unmute article audio" })).toBeInTheDocument();
  });

  it("offers the direct Easy audio link when browser playback fails", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response(feed([easyArticle]))));

    const { container } = render(<NewsArticleView articleId={easyArticle.id} />);
    const player = await screen.findByRole("region", { name: "Article audio player" });
    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();

    fireEvent.error(audio!);
    expect(within(player).getByRole("alert")).toHaveTextContent("Audio could not be played.");
    expect(within(player).getByRole("link", { name: "Open audio" })).toHaveAttribute("href", EASY_AUDIO_URL);
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
    expect(screen.queryByRole("region", { name: "Article audio player" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("japanese-reader")).not.toBeInTheDocument();
  });
});
