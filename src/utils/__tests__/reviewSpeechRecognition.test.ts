import { createReviewSpeechRecognition } from "../reviewSpeechRecognition";
import type { ReviewSpeechNativeModule } from "../../../modules/review-speech";

function harness() {
  let receive: Parameters<ReviewSpeechNativeModule["addListener"]>[1] | undefined;
  const legacy = { start: jest.fn(), stop: jest.fn(), abort: jest.fn() };
  const remove = jest.fn();
  const native = {
    getCapabilities: jest.fn(async (_locale: string) => ({ supported: true, reason: "" })),
    start: jest.fn(async (_id: number, _locale: string) => {}),
    stop: jest.fn(async (_id: number) => {}),
    abort: jest.fn(async (_id: number) => {}),
    addListener: jest.fn((_name: "speechEvent", listener: Parameters<ReviewSpeechNativeModule["addListener"]>[1]) => {
      receive = listener;
      return { remove };
    }),
  };
  const recognition = createReviewSpeechRecognition(legacy, native);
  return { recognition, legacy, native, remove, event: (sessionId: number, name: string, payload: unknown = null) => {
    receive?.({ sessionId, name, payload });
  } };
}

describe("review speech engine routing", () => {
  it("selects on-device SpeechTranscriber using the requested locale", async () => {
    const { recognition, native, legacy } = harness();
    const selection = await recognition.select("ja-JP");
    expect(selection).toEqual({ engine: "speech-transcriber", processing: "on-device" });
    recognition.start({ lang: "ja-JP" }, selection);
    expect(native.getCapabilities).toHaveBeenCalledWith("ja-JP");
    expect(native.start).toHaveBeenCalledWith(1, "ja-JP");
    expect(legacy.start).not.toHaveBeenCalled();
    expect(recognition.usesLegacy()).toBe(false);
  });

  it("falls back for an unsupported locale without claiming local processing", async () => {
    const { recognition, native, legacy } = harness();
    native.getCapabilities.mockResolvedValue({ supported: false, reason: "Unsupported language" });
    const selection = await recognition.select("ja-JP");
    recognition.start({ lang: "ja-JP" }, selection);
    expect(selection).toEqual({ engine: "legacy", processing: "system-selected", fallbackReason: "Unsupported language" });
    expect(legacy.start).toHaveBeenCalledWith({ lang: "ja-JP" });
    expect(native.start).not.toHaveBeenCalled();
  });

  it("works with an older binary that has no new native module", async () => {
    const legacy = { start: jest.fn(), stop: jest.fn(), abort: jest.fn() };
    const recognition = createReviewSpeechRecognition(legacy, null);
    const selection = await recognition.select("ja-JP");
    recognition.start({ lang: "ja-JP" }, selection);
    recognition.stop();
    recognition.abort();
    expect(selection.engine).toBe("legacy");
    expect(legacy.start).toHaveBeenCalledTimes(1);
    expect(legacy.stop).toHaveBeenCalledTimes(1);
    expect(legacy.abort).toHaveBeenCalledTimes(1);
  });

  it("does not let a delayed capability check reroute an active microphone", async () => {
    const { recognition, native } = harness();
    const local = await recognition.select("ja-JP");
    recognition.start({ lang: "ja-JP" }, local);
    native.getCapabilities.mockResolvedValue({ supported: false, reason: "Unavailable" });
    await recognition.select("en-US");
    recognition.abort();
    expect(native.abort).toHaveBeenCalledWith(1);
  });

  it("preserves partial/final ordering and ignores previous capture events", async () => {
    const { recognition, event, remove } = harness();
    const result = jest.fn();
    const ended = jest.fn();
    recognition.subscribe("result", result);
    recognition.subscribe("end", ended);
    const selection = await recognition.select("ja-JP");
    recognition.start({ lang: "ja-JP" }, selection);
    const partial = { isFinal: false, results: [{ transcript: "し", confidence: -1, segments: [] }] };
    const final = { isFinal: true, results: [{ transcript: "しき", confidence: -1, segments: [] }] };
    event(1, "result", partial);
    event(1, "result", final);
    event(1, "end");
    recognition.start({ lang: "ja-JP" }, selection);
    event(1, "result", final);
    event(1, "end");
    expect(result.mock.calls).toEqual([[partial], [final]]);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(recognition.usesLegacy()).toBe(false);
  });

  it("cancels model setup through the same native session and removes its listener on end", async () => {
    const { recognition, native, event, remove } = harness();
    const status = jest.fn();
    const result = jest.fn();
    const ended = jest.fn();
    recognition.subscribe("status", status);
    recognition.subscribe("result", result);
    recognition.subscribe("end", ended);
    recognition.start({ lang: "ja-JP" }, await recognition.select("ja-JP"));
    event(1, "status", { message: "Downloading speech model…" });
    recognition.abort();
    expect(native.abort).toHaveBeenCalledWith(1);
    event(1, "result", { isFinal: true, results: [{ transcript: "ねこ", confidence: -1, segments: [] }] });
    expect(result).not.toHaveBeenCalled();
    event(1, "end");
    event(1, "status", { message: "Starting microphone…" });
    expect(status).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("reports native start failure and ends once without silently switching to cloud", async () => {
    const { recognition, native, legacy } = harness();
    native.start.mockRejectedValue(new Error("Model unavailable offline"));
    const error = jest.fn();
    const end = jest.fn();
    recognition.subscribe("error", error);
    recognition.subscribe("end", end);
    recognition.start({ lang: "ja-JP" }, await recognition.select("ja-JP"));
    await Promise.resolve();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: "Model unavailable offline" }));
    expect(end).toHaveBeenCalledTimes(1);
    expect(legacy.start).not.toHaveBeenCalled();
  });

  it("routes stop to the new engine so buffered audio can finalize", async () => {
    const { recognition, native, legacy } = harness();
    recognition.start({ lang: "ja-JP" }, await recognition.select("ja-JP"));
    recognition.stop();
    expect(native.stop).toHaveBeenCalledWith(1);
    expect(native.abort).not.toHaveBeenCalled();
    expect(legacy.stop).not.toHaveBeenCalled();
  });
});
