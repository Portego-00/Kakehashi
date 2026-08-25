import { StrictMode, createRef, useCallback, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YouTubePlayer, type YouTubePlayerHandle } from "./YouTubePlayer";

class MockPlayer {
  iframe: HTMLIFrameElement;
  constructor(element: HTMLElement, options: { videoId: string; events: { onReady: () => void } }) {
    this.iframe = document.createElement("iframe");
    this.iframe.dataset.videoId = options.videoId;
    element.replaceWith(this.iframe);
    window.setTimeout(options.events.onReady, 0);
  }
  destroy() { this.iframe.remove(); }
  getCurrentTime() { return 12; }
  getDuration() { return 240; }
  pauseVideo() {}
  playVideo() {}
  seekTo() {}
}

function Harness({ videoId }: { videoId: string }) {
  const [, setElapsed] = useState(0);
  const onPlayingChange = useCallback(() => undefined, []);
  const onTimeChange = useCallback((elapsed: number) => setElapsed(elapsed), []);
  return <YouTubePlayer videoId={videoId} title="Test player" onPlayingChange={onPlayingChange} onTimeChange={onTimeChange} />;
}

describe("YouTube player mount ownership", () => {
  beforeEach(() => {
    Object.defineProperty(window, "YT", { configurable: true, writable: true, value: { Player: MockPlayer } });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "YT");
  });

  it("keeps the iframe inside a React-owned host across Strict Mode updates", async () => {
    const { rerender } = render(<StrictMode><Harness videoId="video-one1" /></StrictMode>);
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 1)));
    expect(screen.getByLabelText("Test player").querySelector("iframe")?.dataset.videoId).toBe("video-one1");

    rerender(<StrictMode><Harness videoId="video-two2" /></StrictMode>);
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 1)));
    expect(screen.getByLabelText("Test player").querySelector("iframe")?.dataset.videoId).toBe("video-two2");
  });

  it("exposes playback controls without giving React ownership of the iframe", async () => {
    const ref = createRef<YouTubePlayerHandle>();
    render(<YouTubePlayer ref={ref} videoId="video-one1" title="Test player" onPlayingChange={() => undefined} onTimeChange={() => undefined} />);
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 1)));
    expect(() => { ref.current?.play(); ref.current?.seekTo(4_000); ref.current?.pause(); }).not.toThrow();
  });
});
