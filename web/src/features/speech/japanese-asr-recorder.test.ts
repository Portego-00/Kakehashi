import { afterEach, expect, it, vi } from "vitest";
import { recordJapaneseReading } from "./japanese-asr-recorder";

afterEach(() => vi.restoreAllMocks());
it("releases a microphone granted after cancellation without starting a recorder", async () => {
  let grant!: (stream: MediaStream) => void;
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(() => new Promise<MediaStream>(resolve => { grant = resolve; })) } });
  const controller = new AbortController();
  const listening = vi.fn();
  const capture = recordJapaneseReading(controller.signal, listening);
  controller.abort(); grant(stream);
  await expect(capture).rejects.toMatchObject({ name: "AbortError" });
  expect(stop).toHaveBeenCalledOnce(); expect(listening).not.toHaveBeenCalled();
});
it("does not request microphone access for an already cancelled question", async () => {
  const getUserMedia = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  const controller = new AbortController(); controller.abort();
  await expect(recordJapaneseReading(controller.signal, vi.fn())).rejects.toMatchObject({ name: "AbortError" });
  expect(getUserMedia).not.toHaveBeenCalled();
});
