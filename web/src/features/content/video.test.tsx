import { forwardRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./JapaneseReader", () => ({
  JapaneseReader: ({ text, analysisContext }: { text: string; analysisContext?: { text: string; start: number } }) => (
    <div data-testid="japanese-reader" data-analysis-text={analysisContext?.text} data-analysis-start={analysisContext?.start}>{text}</div>
  ),
}));
vi.mock("./YouTubePlayer", () => ({
  YouTubePlayer: forwardRef<HTMLDivElement, { videoId: string; title: string }>(function Player({ videoId, title }, ref) {
    return <div ref={ref} data-testid="youtube-player" aria-label={title}>{videoId}</div>;
  }),
}));
vi.mock("./mpeg-converter", () => ({
  transcodeMpegToMp4: vi.fn(async () => new Blob(["converted video"], { type: "video/mp4" })),
}));

import { transcodeMpegToMp4 } from "./mpeg-converter";
import { saveLibrary } from "./storage";
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

describe("video workspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("indexedDB", undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:https://kakehashi.local/video"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.mocked(transcodeMpegToMp4).mockClear();
  });

  it("starts on a home screen with previously watched videos", () => {
    saveLibrary("video", [savedVideo]);
    const { container } = render(<VideoWorkspace />);

    expect(screen.getByRole("heading", { name: "Jump back in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open 日本語のビデオ" })).toBeInTheDocument();
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("plays a selected local file without copying it into IndexedDB", async () => {
    const { container } = render(<VideoWorkspace />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*="video"]');
    expect(input).not.toBeNull();

    const file = new File(["video bytes"], "sample.webm", { type: "video/webm" });
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "blob:https://kakehashi.local/video"));
    expect(screen.queryByText(/IndexedDB storage/i)).not.toBeInTheDocument();
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

  it("recognizes YouTube URLs as playable video sources", async () => {
    render(<VideoWorkspace />);
    const urlInput = screen.getByRole("textbox", { name: "Video URL" });
    fireEvent.change(urlInput, { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.submit(urlInput.closest("form")!);

    expect(await screen.findByTestId("youtube-player")).toHaveTextContent("dQw4w9WgXcQ");
  });

  it("shows cleaned subtitle analysis inline like the song screen", async () => {
    saveLibrary("video", [savedVideo]);
    render(<VideoWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open 日本語のビデオ" }));

    expect(await screen.findByText("Study current subtitle")).toBeInTheDocument();
    expect(screen.getByTestId("japanese-reader")).toHaveTextContent("今日は晴れです。");
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
});
