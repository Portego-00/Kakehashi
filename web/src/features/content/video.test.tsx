import { forwardRef, useImperativeHandle } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  fileHandles: new Map<string, FileSystemFileHandle>(),
  jpdbApiKey: "",
}));
const youtubePlayerMocks = vi.hoisted(() => ({
  pause: vi.fn(),
  play: vi.fn(),
  seekTo: vi.fn(),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({ integrations: { jpdbApiKey: fixtures.jpdbApiKey } }),
}));
vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { username: "video-test" } } }),
}));

vi.mock("./JapaneseReader", () => ({
  JapaneseReader: ({ text, analysisContext, inspectorMode, onSelectionChange }: { text: string; analysisContext?: { text: string; start: number }; inspectorMode?: string; onSelectionChange?: (open: boolean) => void }) => (
    <div data-testid="japanese-reader" data-analysis-text={analysisContext?.text} data-analysis-start={analysisContext?.start} data-inspector-mode={inspectorMode}>
      {text}
      <button type="button" onClick={() => onSelectionChange?.(true)}>Show subtitle word details</button>
      <button type="button" onClick={() => onSelectionChange?.(false)}>Close subtitle word details</button>
    </div>
  ),
}));
vi.mock("./YouTubePlayer", () => ({
  YouTubePlayer: forwardRef<{ pause(): void; play(): void; seekTo(milliseconds: number): void }, { videoId: string; title: string; onPlayingChange?: (playing: boolean) => void; onTimeChange?: (elapsedMs: number, durationMs: number) => void }>(function Player({ videoId, title, onPlayingChange, onTimeChange }, ref) {
    useImperativeHandle(ref, () => ({
      pause: () => { youtubePlayerMocks.pause(); onPlayingChange?.(false); },
      play: () => { youtubePlayerMocks.play(); onPlayingChange?.(true); },
      seekTo: youtubePlayerMocks.seekTo,
    }), [onPlayingChange]);
    return <div data-testid="youtube-player" aria-label={title}>{videoId}<button type="button" onClick={() => onTimeChange?.(3_500, 213_000)}>Advance video playback</button></div>;
  }),
}));
vi.mock("./mpeg-converter", () => ({
  transcodeMpegToMp4: vi.fn(async () => new Blob(["converted video"], { type: "video/mp4" })),
}));
vi.mock("./storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./storage")>();
  return {
    ...actual,
    loadFileHandle: vi.fn(async (id: string) => fixtures.fileHandles.get(id) ?? null),
    removeFileHandle: vi.fn(async (id: string) => { fixtures.fileHandles.delete(id); }),
    saveFileHandle: vi.fn(async (id: string, handle: FileSystemFileHandle) => { fixtures.fileHandles.set(id, handle); }),
  };
});

import { transcodeMpegToMp4 } from "./mpeg-converter";
import { loadFileHandle, loadLibrary, removeFileHandle, saveFileHandle, saveLibrary } from "./storage";
import type { ContentRecord } from "./types";
import { VideoWorkspace } from "./video";

const savedVideo: ContentRecord = {
  id: "video-saved",
  kind: "video",
  title: "日本語のビデオ",
  fileName: "lesson.mp4",
  mimeType: "video/mp4",
  assetIds: [],
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:00:00.000Z",
  progress: 0.35,
  text: "1\n00:00:01,000 --> 00:00:03,000\n♪ → 今日は晴れです。 ↵ ♫",
  metadata: {
    sourceType: "url",
    videoUrl: "https://media.example.com/lesson.mp4",
    currentTime: 12,
    duration: 120,
  },
};

function linkedLocalVideo(overrides: Partial<ContentRecord> = {}): ContentRecord {
  return {
    ...savedVideo,
    id: "video-linked",
    title: "Linked local video",
    fileName: "linked-video.mp4",
    mimeType: "video/mp4",
    assetIds: [],
    metadata: {
      sourceType: "local",
      fileSize: 11,
      lastModified: 1_777_777,
      linkedFileIds: JSON.stringify(["linked-video-file"]),
    },
    ...overrides,
  };
}

function localFileHandle(file: File, initialPermission: PermissionState = "granted") {
  let permission = initialPermission;
  return {
    kind: "file",
    name: file.name,
    getFile: vi.fn(async () => file),
    isSameEntry: vi.fn(async () => false),
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => {
      permission = "granted";
      return permission;
    }),
  } as unknown as FileSystemFileHandle & {
    getFile: ReturnType<typeof vi.fn>;
    queryPermission: ReturnType<typeof vi.fn>;
    requestPermission: ReturnType<typeof vi.fn>;
  };
}

describe("video workspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fixtures.fileHandles.clear();
    fixtures.jpdbApiKey = "";
    vi.stubGlobal("indexedDB", undefined);
    Object.defineProperty(window, "showOpenFilePicker", { configurable: true, value: undefined });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:https://kakehashi.local/video"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.mocked(transcodeMpegToMp4).mockClear();
    vi.mocked(loadFileHandle).mockClear();
    vi.mocked(removeFileHandle).mockClear();
    vi.mocked(saveFileHandle).mockClear();
    youtubePlayerMocks.pause.mockClear();
    youtubePlayerMocks.play.mockClear();
    youtubePlayerMocks.seekTo.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("starts on a home screen with previously watched videos", () => {
    saveLibrary("video", [savedVideo]);
    render(<VideoWorkspace />);

    expect(screen.getByRole("heading", { name: "Jump back in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open 日本語のビデオ" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Playback for 日本語のビデオ")).not.toBeInTheDocument();
  });

  it("keeps saved-video metadata compact and thumbnail overlays together", () => {
    saveLibrary("video", [savedVideo]);
    render(<VideoWorkspace />);

    const shelf = screen.getByRole("region", { name: "Jump back in" });
    const card = within(shelf).getByRole("button", { name: "Open 日本語のビデオ" });
    const thumbnail = card.querySelector<HTMLElement>("[data-video-thumbnail]");
    const progress = card.querySelector<HTMLElement>("[data-video-progress]");

    expect(thumbnail).toContainElement(progress);
    expect(within(card).getByText("2:00")).toBeInTheDocument();
    expect(card.querySelector('[data-video-source="url"]')).toBeInTheDocument();
    expect(card).toHaveTextContent("media.example.com");
    expect(card).toHaveTextContent("35% watched");
    expect(within(shelf).getByRole("button", { name: "Remove 日本語のビデオ" })).toBeInTheDocument();
  });

  it("formats long thumbnail durations like a video library", () => {
    saveLibrary("video", [{
      ...savedVideo,
      metadata: { ...savedVideo.metadata, duration: 6_931 },
    }]);
    render(<VideoWorkspace />);

    expect(within(screen.getByRole("button", { name: "Open 日本語のビデオ" })).getByText("1:55:31")).toBeInTheDocument();
  });

  it("shows real previews for saved YouTube and direct URL videos", async () => {
    const youtubeVideo: ContentRecord = {
      ...savedVideo,
      id: "video-youtube",
      title: "YouTube lesson",
      fileName: "https://youtu.be/dQw4w9WgXcQ",
      mimeType: "video/youtube",
      metadata: {
        sourceType: "youtube",
        videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      },
    };
    const directVideo: ContentRecord = {
      ...savedVideo,
      id: "video-direct",
      title: "Direct lesson",
      metadata: {
        sourceType: "url",
        videoUrl: "https://media.example.com/direct-lesson.mp4",
      },
    };
    saveLibrary("video", [youtubeVideo, directVideo]);

    render(<VideoWorkspace />);

    const youtubeCard = screen.getByRole("button", { name: "Open YouTube lesson" });
    const youtubeThumbnail = youtubeCard.querySelector("img")!;
    expect(youtubeThumbnail).toHaveAttribute("src", "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
    expect(youtubeThumbnail).toHaveAttribute("alt", "");
    fireEvent.load(youtubeThumbnail);
    await waitFor(() => expect(youtubeCard.querySelector("img")).toHaveAttribute("data-ready", "true"));
    const directCard = screen.getByRole("button", { name: "Open Direct lesson" });
    const directThumbnail = directCard.querySelector("video")!;
    expect(directThumbnail).toHaveAttribute("src", "https://media.example.com/direct-lesson.mp4");
    expect(directThumbnail).toHaveAttribute("preload", "metadata");
    expect(directThumbnail).not.toHaveAttribute("controls");
    expect(directThumbnail).toHaveAttribute("aria-hidden", "true");
    fireEvent.loadedData(directThumbnail);
    await waitFor(() => expect(directCard.querySelector("video")).toHaveAttribute("data-ready", "true"));
  });

  it("falls back to the film icon when a saved preview cannot load", () => {
    const youtubeVideo: ContentRecord = {
      ...savedVideo,
      id: "video-youtube",
      title: "Unavailable YouTube lesson",
      metadata: {
        sourceType: "youtube",
        youtubeId: "dQw4w9WgXcQ",
      },
    };
    saveLibrary("video", [youtubeVideo]);
    render(<VideoWorkspace />);

    const card = screen.getByRole("button", { name: "Open Unavailable YouTube lesson" });
    const thumbnail = card.querySelector("img")!;
    expect(thumbnail).toBeInTheDocument();
    fireEvent.error(thumbnail);
    expect(card.querySelector("img")).not.toBeInTheDocument();
    expect(card.querySelector("svg")).toBeInTheDocument();
  });

  it("restores a linked local video after a fresh mount", async () => {
    const record = linkedLocalVideo();
    const file = new File(["video bytes"], "linked-video.mp4", { type: "video/mp4" });
    const handle = localFileHandle(file);
    fixtures.fileHandles.set("linked-video-file", handle);
    saveLibrary("video", [record]);

    const firstView = render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open Linked local video" }));
    await waitFor(() => expect(firstView.container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/video"));
    firstView.unmount();

    const secondView = render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open Linked local video" }));
    await waitFor(() => expect(secondView.container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/video"));
    expect(handle.getFile).toHaveBeenCalledTimes(2);
  });

  it("offers an access action when a linked video needs permission", async () => {
    const record = linkedLocalVideo();
    const file = new File(["video bytes"], "linked-video.mp4", { type: "video/mp4" });
    const handle = localFileHandle(file, "prompt");
    fixtures.fileHandles.set("linked-video-file", handle);
    saveLibrary("video", [record]);

    const { container } = render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open Linked local video" }));

    expect(await screen.findByText("Allow access to this video")).toBeInTheDocument();
    expect(loadLibrary("video").map((video) => video.id)).toEqual([record.id]);
    fireEvent.click(screen.getByRole("button", { name: "Allow access" }));

    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/video"));
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: "read" });
  });

  it("reconnects a missing linked video and persists the replacement handle", async () => {
    const record = linkedLocalVideo();
    const replacement = new File(["replacement video"], "replacement.mp4", { type: "video/mp4" });
    const replacementHandle = localFileHandle(replacement);
    vi.stubGlobal("indexedDB", {});
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: vi.fn(async () => [replacementHandle]),
    });
    saveLibrary("video", [record]);

    const { container } = render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open Linked local video" }));
    expect(await screen.findByText("Reconnect the original video")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reconnect file"));

    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/video"));
    const replacementId = JSON.parse(String(loadLibrary("video")[0].metadata?.linkedFileIds))[0] as string;
    expect(replacementId).not.toBe("linked-video-file");
    expect(saveFileHandle).toHaveBeenCalledWith(replacementId, replacementHandle);
    expect(removeFileHandle).toHaveBeenCalledWith("linked-video-file");
    expect(loadLibrary("video")[0].fileName).toBe("replacement.mp4");
  });

  it("keeps the previous video link when replacement metadata cannot be saved", async () => {
    const record = linkedLocalVideo();
    const replacement = new File(["replacement video"], "replacement.mp4", { type: "video/mp4" });
    const replacementHandle = localFileHandle(replacement);
    vi.stubGlobal("indexedDB", {});
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: vi.fn(async () => [replacementHandle]),
    });
    saveLibrary("video", [record]);

    render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open Linked local video" }));
    await screen.findByText("Reconnect the original video");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: "Reconnect file" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Browser storage is full or unavailable.");
    const freshId = vi.mocked(saveFileHandle).mock.calls.at(-1)?.[0];
    expect(freshId).toBeTruthy();
    expect(freshId).not.toBe("linked-video-file");
    expect(removeFileHandle).toHaveBeenCalledWith(freshId);
    expect(JSON.parse(String(loadLibrary("video")[0].metadata?.linkedFileIds))).toEqual(["linked-video-file"]);
    setItem.mockRestore();
  });

  it("keeps history and offers retry when a linked file is temporarily unavailable", async () => {
    const record = linkedLocalVideo();
    const file = new File(["video bytes"], "linked-video.mp4", { type: "video/mp4" });
    const handle = localFileHandle(file);
    handle.queryPermission.mockRejectedValueOnce(new Error("File service unavailable"));
    fixtures.fileHandles.set("linked-video-file", handle);
    saveLibrary("video", [record]);

    const { container } = render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open Linked local video" }));

    expect(await screen.findByText("This video is temporarily unavailable")).toBeInTheDocument();
    expect(loadLibrary("video").map((video) => video.id)).toEqual([record.id]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/video"));
  });

  it("plays a selected local file without copying it into IndexedDB", async () => {
    const { container } = render(<VideoWorkspace />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*="video"]');
    expect(input).not.toBeNull();
    expect(input?.multiple).toBe(true);

    const file = new File(["video bytes"], "sample.webm", { type: "video/webm" });
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/video"));
    expect(screen.queryByText(/IndexedDB storage/i)).not.toBeInTheDocument();
  });

  it("keeps an unsupported-picker import as a session-only fallback", async () => {
    const firstView = render(<VideoWorkspace />);
    const input = firstView.container.querySelector<HTMLInputElement>('input[type="file"][accept*="video"]')!;
    const file = new File(["video bytes"], "session-only.webm", { type: "video/webm" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(firstView.container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/video"));
    expect(saveFileHandle).not.toHaveBeenCalled();
    expect(loadLibrary("video")[0].metadata?.linkedFileIds).toBeUndefined();
    firstView.unmount();

    const secondView = render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open session-only" }));
    expect(await screen.findByText("Select the original video file")).toBeInTheDocument();
    expect(secondView.container.querySelector("video")).not.toBeInTheDocument();
    expect(loadLibrary("video").map((record) => record.title)).toEqual(["session-only"]);
  });

  it("falls back to session-only playback when a selected handle cannot be persisted", async () => {
    const file = new File(["video bytes"], "storage-fallback.mp4", { type: "video/mp4" });
    const handle = localFileHandle(file);
    vi.stubGlobal("indexedDB", {});
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: vi.fn(async () => [handle]),
    });
    vi.mocked(saveFileHandle).mockRejectedValueOnce(new Error("Handle storage unavailable"));

    const { container } = render(<VideoWorkspace />);
    fireEvent.click(screen.getByText("Choose local video"));

    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/video"));
    expect(loadLibrary("video")[0].metadata?.linkedFileIds).toBeUndefined();
    expect(loadLibrary("video")[0].assetIds).toEqual([]);
  });

  it("imports multiple local videos dropped onto the page and opens the first", async () => {
    saveLibrary("video", [savedVideo]);
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce("blob:https://kakehashi.local/first-video")
      .mockReturnValueOnce("blob:https://kakehashi.local/second-video");
    const { container, unmount } = render(<VideoWorkspace />);
    expect(screen.getByText("Choose local video")).toBeInTheDocument();
    expect(screen.queryByText("Drop to import videos")).not.toBeInTheDocument();

    const file = new File(["video bytes"], "dropped-video.mp4", { type: "video/mp4" });
    const secondFile = new File(["other video bytes"], "second-video.webm", { type: "video/webm" });
    fireEvent.dragEnter(window, { dataTransfer: { files: [file], types: ["Files"] } });
    expect(screen.getByText("Drop to import videos")).toBeInTheDocument();

    fireEvent.drop(window, { dataTransfer: { files: [file, secondFile], types: ["Files"] } });

    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/first-video"));
    expect(screen.getByRole("heading", { name: "dropped-video" })).toBeInTheDocument();
    expect(loadLibrary("video").map((record) => record.title)).toEqual(["dropped-video", "second-video", "日本語のビデオ"]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Back to videos" }));
    fireEvent.click(screen.getByRole("button", { name: "Open second-video" }));
    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/second-video"));

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:https://kakehashi.local/first-video");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:https://kakehashi.local/second-video");
  });

  it("imports multiple local videos selected from the file picker", async () => {
    const { container } = render(<VideoWorkspace />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*="video"]')!;
    const first = new File(["first video"], "episode-01.mp4", { type: "video/mp4" });
    const second = new File(["second video"], "episode-02.webm", { type: "video/webm" });

    fireEvent.change(input, { target: { files: [first, second] } });

    await waitFor(() => expect(container.querySelector("video")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "episode-01" })).toBeInTheDocument();
    expect(loadLibrary("video").map((record) => record.title)).toEqual(["episode-01", "episode-02"]);
  });

  it("persists one aligned file handle for each video selected from the supported picker", async () => {
    const first = new File(["first video"], "episode-01.mp4", { type: "video/mp4" });
    const second = new File(["second video"], "episode-02.webm", { type: "video/webm" });
    const firstHandle = localFileHandle(first);
    const secondHandle = localFileHandle(second);
    vi.stubGlobal("indexedDB", {});
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: vi.fn(async () => [firstHandle, secondHandle]),
    });

    const { container } = render(<VideoWorkspace />);
    fireEvent.click(screen.getByText("Choose local video"));

    await waitFor(() => expect(container.querySelector("video")).toBeInTheDocument());
    const records = loadLibrary("video");
    expect(records.map((record) => record.title)).toEqual(["episode-01", "episode-02"]);
    expect(records.map((record) => record.assetIds)).toEqual([[], []]);
    const linkedIds = records.map((record) => JSON.parse(String(record.metadata?.linkedFileIds))[0] as string);
    expect(new Set(linkedIds).size).toBe(2);
    expect(saveFileHandle).toHaveBeenNthCalledWith(1, linkedIds[0], firstHandle);
    expect(saveFileHandle).toHaveBeenNthCalledWith(2, linkedIds[1], secondHandle);
  });

  it("rejects non-video files dropped onto the import area", () => {
    render(<VideoWorkspace />);
    const file = new File(["notes"], "notes.txt", { type: "text/plain" });

    fireEvent.drop(window, { dataTransfer: { files: [file], types: ["Files"] } });

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a supported video file");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("converts an unsupported local MPEG in the browser and plays the result", async () => {
    const createObjectUrl = vi.mocked(URL.createObjectURL);
    createObjectUrl.mockReturnValueOnce("blob:https://kakehashi.local/original-mpeg");
    createObjectUrl.mockReturnValueOnce("blob:https://kakehashi.local/converted-mp4");
    const { container } = render(<VideoWorkspace />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*="video"]');
    const file = new File(["mpeg bytes"], "archive.mpeg", { type: "video/mpeg" });
    fireEvent.change(input!, { target: { files: [file] } });

    const player = await screen.findByLabelText("Playback for archive");
    expect(player).toHaveAttribute("src", "blob:https://kakehashi.local/original-mpeg");
    fireEvent.error(player);

    await waitFor(() => expect(transcodeMpegToMp4).toHaveBeenCalledWith(file, expect.any(Function)));
    await waitFor(() => expect(player).toHaveAttribute("src", "blob:https://kakehashi.local/converted-mp4"));
    expect(screen.queryByText("This browser could not play the selected video format.")).not.toBeInTheDocument();
  });

  it("adds a direct video URL to history and plays it in place", async () => {
    render(<VideoWorkspace />);
    const urlInput = screen.getByRole("textbox", { name: "Video URL" });
    fireEvent.change(urlInput, { target: { value: "https://media.example.com/show/episode-01.mp4" } });
    fireEvent.submit(urlInput.closest("form")!);

    const player = await screen.findByLabelText("Playback for episode-01");
    expect(player).toHaveAttribute("src", "https://media.example.com/show/episode-01.mp4");
    expect(screen.getByRole("button", { name: "Back to videos" })).toBeInTheDocument();
  });

  it("uses the music-player controls for native video playback", () => {
    saveLibrary("video", [savedVideo]);
    render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open 日本語のビデオ" }));

    const player = screen.getByLabelText("Playback for 日本語のビデオ") as HTMLVideoElement;
    const play = vi.fn(async () => undefined);
    const pause = vi.fn();
    Object.defineProperties(player, {
      play: { configurable: true, value: play },
      pause: { configurable: true, value: pause },
    });
    const seekSlider = screen.getByRole("slider", { name: "Seek video" });
    expect(seekSlider).toHaveAttribute("aria-valuetext", "0:12 of 2:00");

    fireEvent.change(seekSlider, { target: { value: "60000" } });
    expect(player.currentTime).toBe(60);
    expect(seekSlider).toHaveAttribute("aria-valuetext", "1:00 of 2:00");
    fireEvent.click(screen.getByRole("button", { name: "Play video" }));
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.play(player);
    fireEvent.click(screen.getByRole("button", { name: "Pause video" }));
    expect(pause).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Restart video" }));
    expect(player.currentTime).toBe(0);
  });

  it("saves pasted plain or timed text with a video", () => {
    saveLibrary("video", [savedVideo]);
    render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open 日本語のビデオ" }));

    fireEvent.click(screen.getByRole("button", { name: "Paste transcript" }));
    const plainEditor = screen.getByRole("textbox", { name: "Custom transcript" });
    expect(plainEditor).toHaveValue(savedVideo.text);
    fireEvent.change(plainEditor, { target: { value: "一行目\n二行目" } });
    expect(screen.getByText("Detected: Plain text · 2 lines")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save transcript" }));

    expect(screen.getByText("2 plain lines")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Seek to/ })).not.toBeInTheDocument();
    expect(loadLibrary("video")[0]).toEqual(expect.objectContaining({
      text: "一行目\n二行目",
      metadata: expect.objectContaining({ transcriptFormat: "plain", transcriptSource: "custom" }),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Paste transcript" }));
    const timedEditor = screen.getByRole("textbox", { name: "Custom transcript" });
    fireEvent.change(timedEditor, { target: { value: "[00:01.00]最初\n[00:03.00]次" } });
    expect(screen.getByText("Detected: LRC · 2 timed lines")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save transcript" }));

    expect(screen.getByText("2 synchronized cues")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seek to 0:01" })).toBeInTheDocument();
    expect(loadLibrary("video")[0].metadata).toEqual(expect.objectContaining({ transcriptFormat: "lrc", transcriptSource: "custom" }));
  });

  it("uses icon controls and translates transcript lines with JPDB", async () => {
    fixtures.jpdbApiKey = "configured-jpdb-key";
    saveLibrary("video", [savedVideo]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === "/video/translate") {
        return new Response(JSON.stringify({
          translations: [{ source: "今日は晴れです。", translation: "It is sunny today." }],
        }), { headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open 日本語のビデオ" }));

    expect(screen.getByRole("button", { name: "Paste transcript" })).not.toHaveTextContent("Paste transcript");
    expect(screen.getByRole("button", { name: "Import transcript file" })).not.toHaveTextContent("Import transcript file");
    const translationToggle = screen.getByRole("button", { name: "English transcript translations" });
    expect(translationToggle).toBeEnabled();
    expect(translationToggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(translationToggle);

    expect(await screen.findByText("It is sunny today.")).toBeInTheDocument();
    expect(translationToggle).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).toHaveBeenCalledWith("/video/translate", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        lines: ["今日は晴れです。"],
        cachedTranslations: [],
        apiKey: "configured-jpdb-key",
      }),
    }));

    fireEvent.click(translationToggle);
    expect(screen.queryByText("It is sunny today.")).not.toBeInTheDocument();
  });

  it("links to JPDB settings when transcript translation is unavailable", () => {
    saveLibrary("video", [savedVideo]);
    render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open 日本語のビデオ" }));

    expect(screen.getByRole("button", { name: "English transcript translations" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Add a JPDB key in Settings" })).toHaveAttribute("href", "/settings#jpdb-api-key");
  });

  it("recognizes YouTube URLs as playable video sources", async () => {
    render(<VideoWorkspace />);
    const urlInput = screen.getByRole("textbox", { name: "Video URL" });
    fireEvent.change(urlInput, { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.submit(urlInput.closest("form")!);

    expect(await screen.findByTestId("youtube-player")).toHaveTextContent("dQw4w9WgXcQ");
  });

  it("automatically imports and saves timed captions for a YouTube URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      title: "日本語レッスン",
      language: "ja",
      transcript: "[00:01.00]こんにちは。\n[00:04.00]また明日。",
      cueCount: 2,
    }), { headers: { "content-type": "application/json" } }));
    render(<VideoWorkspace />);
    const urlInput = screen.getByRole("textbox", { name: "Video URL" });
    fireEvent.change(urlInput, { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.submit(urlInput.closest("form")!);

    expect(await screen.findByRole("heading", { name: "日本語レッスン" })).toBeInTheDocument();
    expect(screen.getByText("2 synchronized cues")).toBeInTheDocument();
    expect(await screen.findByTestId("japanese-reader")).toHaveTextContent("こんにちは。");
    expect(fetchMock).toHaveBeenCalledWith("/video/transcript", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ videoId: "dQw4w9WgXcQ", language: "ja" }),
    }));
    expect(loadLibrary("video")[0]).toEqual(expect.objectContaining({
      title: "日本語レッスン",
      text: "[00:01.00]こんにちは。\n[00:04.00]また明日。",
      metadata: expect.objectContaining({ transcriptSource: "youtube", transcriptLanguage: "ja" }),
    }));
    fetchMock.mockRestore();
  });

  it("connects the music-player controls to YouTube playback", async () => {
    render(<VideoWorkspace />);
    const urlInput = screen.getByRole("textbox", { name: "Video URL" });
    fireEvent.change(urlInput, { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.submit(urlInput.closest("form")!);

    fireEvent.click(await screen.findByRole("button", { name: "Advance video playback" }));
    const seekSlider = screen.getByRole("slider", { name: "Seek video" });
    expect(seekSlider).toHaveAttribute("aria-valuetext", "0:03 of 3:33");
    fireEvent.change(seekSlider, { target: { value: "60000" } });
    expect(youtubePlayerMocks.seekTo).toHaveBeenLastCalledWith(60_000);
    fireEvent.click(screen.getByRole("button", { name: "Play video" }));
    expect(youtubePlayerMocks.play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Pause video" }));
    expect(youtubePlayerMocks.pause).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Restart video" }));
    expect(youtubePlayerMocks.seekTo).toHaveBeenLastCalledWith(0);
  });

  it("shows cleaned subtitle analysis inline like the song screen", async () => {
    saveLibrary("video", [savedVideo]);
    render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open 日本語のビデオ" }));

    expect(screen.queryByText("Study current subtitle")).not.toBeInTheDocument();
    expect(screen.queryByText("Select a highlighted word")).not.toBeInTheDocument();
    expect(await screen.findByTestId("japanese-reader")).toHaveTextContent("今日は晴れです。");
    expect(screen.getByTestId("japanese-reader")).toHaveAttribute("data-inspector-mode", "floating");
    expect(screen.getByTestId("japanese-reader")).not.toHaveTextContent(/[♪♫→↵]/);
  });

  it("gives the active subtitle a stable transcript-level JPDB context", async () => {
    saveLibrary("video", [{
      ...savedVideo,
      text: "1\n00:00:01,000 --> 00:00:03,000\n学校へ行く。\n\n2\n00:00:03,000 --> 00:00:05,000\n猫もいる。",
      metadata: { ...savedVideo.metadata, currentTime: 1.5 },
    }]);
    render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open 日本語のビデオ" }));

    const reader = await screen.findByTestId("japanese-reader");
    expect(reader).toHaveTextContent("学校へ行く。");
    expect(reader).toHaveAttribute("data-analysis-text", "学校へ行く。\n\n猫もいる。");
    expect(reader).toHaveAttribute("data-analysis-start", "0");

    const player = screen.getByLabelText("Playback for 日本語のビデオ");
    Object.defineProperties(player, {
      currentTime: { configurable: true, value: 3.5 },
      duration: { configurable: true, value: 120 },
    });
    fireEvent.timeUpdate(player);

    expect(await screen.findByTestId("japanese-reader")).toHaveTextContent("猫もいる。");
    expect(screen.getByTestId("japanese-reader")).toHaveAttribute("data-analysis-text", "学校へ行く。\n\n猫もいる。");
    expect(screen.getByTestId("japanese-reader")).toHaveAttribute("data-analysis-start", "8");
  });

  it("keeps selected subtitle details mounted while playback autoscrolls", async () => {
    saveLibrary("video", [{
      ...savedVideo,
      text: "1\n00:00:01,000 --> 00:00:03,000\n学校へ行く。\n\n2\n00:00:03,000 --> 00:00:05,000\n猫もいる。",
      metadata: { ...savedVideo.metadata, currentTime: 1.5 },
    }]);
    render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open 日本語のビデオ" }));
    expect(await screen.findByTestId("japanese-reader")).toHaveTextContent("学校へ行く。");
    fireEvent.click(screen.getByRole("button", { name: "Show subtitle word details" }));

    const player = screen.getByLabelText("Playback for 日本語のビデオ");
    Object.defineProperties(player, {
      currentTime: { configurable: true, value: 3.5 },
      duration: { configurable: true, value: 120 },
    });
    fireEvent.timeUpdate(player);

    expect(screen.getByTestId("japanese-reader")).toHaveTextContent("学校へ行く。");
    expect(screen.getByTestId("japanese-reader")).toHaveAttribute("data-analysis-start", "0");
    expect(screen.getByText("猫もいる。", { exact: true }).closest("article")).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Close subtitle word details" }));
    expect(screen.getByTestId("japanese-reader")).toHaveTextContent("猫もいる。");
    expect(screen.getByTestId("japanese-reader")).toHaveAttribute("data-analysis-start", "8");
  });
});
