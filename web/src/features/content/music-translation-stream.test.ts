import { describe, expect, it, vi } from "vitest";
import {
  readMusicTranslationResponse,
} from "./music-translation-stream";

function controlledStreamResponse() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  return {
    response: new Response(new ReadableStream<Uint8Array>({
      start(streamController) { controller = streamController; },
    }), { headers: { "content-type": "application/x-ndjson; charset=utf-8" } }),
    write(bytes: Uint8Array) { controller?.enqueue(bytes); },
    close() { controller?.close(); },
  };
}

describe("music translation response reader", () => {
  it("delivers complete UTF-8 translation frames as soon as each frame arrives", async () => {
    const stream = controlledStreamResponse();
    const encoder = new TextEncoder();
    const firstFrame = encoder.encode(`${JSON.stringify({
      type: "translation",
      source: "猫",
      translation: "A cat.",
    })}\n`);
    const translations = vi.fn();
    const reading = readMusicTranslationResponse(stream.response, translations);

    stream.write(firstFrame.slice(0, 17));
    stream.write(firstFrame.slice(17));
    await vi.waitFor(() => expect(translations).toHaveBeenCalledWith({ source: "猫", translation: "A cat." }));

    stream.write(encoder.encode(`${JSON.stringify({ type: "complete" })}\n`));
    stream.close();
    await expect(reading).resolves.toEqual({ warning: null, code: null });
  });

  it("preserves safe terminal errors and rejects truncated streams", async () => {
    const encoder = new TextEncoder();
    const failed = controlledStreamResponse();
    const failedReading = readMusicTranslationResponse(failed.response, vi.fn());
    failed.write(encoder.encode(`${JSON.stringify({
      type: "error",
      error: "JPDB rate limit reached.",
      code: "too_many_requests",
    })}\n`));
    failed.close();

    await expect(failedReading).rejects.toMatchObject({
      message: "JPDB rate limit reached.",
      code: "too_many_requests",
    });

    const truncated = controlledStreamResponse();
    const truncatedReading = readMusicTranslationResponse(truncated.response, vi.fn());
    truncated.write(encoder.encode(`${JSON.stringify({ type: "translation", source: "猫", translation: "Cat." })}\n`));
    truncated.close();
    await expect(truncatedReading).rejects.toThrow("ended before it finished");
  });

  it("keeps compatibility with the previous JSON response shape", async () => {
    const translations = vi.fn();
    const completion = await readMusicTranslationResponse(new Response(JSON.stringify({
      translations: [{ source: "猫", translation: "Cat." }],
      warning: "Partial result.",
      code: "too_many_requests",
    }), { headers: { "content-type": "application/json" } }), translations);

    expect(translations).toHaveBeenCalledWith({ source: "猫", translation: "Cat." });
    expect(completion).toEqual({ warning: "Partial result.", code: "too_many_requests" });
  });
});
