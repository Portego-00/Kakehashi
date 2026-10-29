import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { JapaneseVoiceWorkerRequest } from "./japanese-voice-protocol";

const engine = vi.hoisted(() => ({
  load: vi.fn(),
  synthesize: vi.fn(),
  sampleRate: 44_100,
}));

vi.mock("./supertonic-engine", () => ({
  SupertonicJapaneseEngine: { load: engine.load },
}));

let scope: {
  onmessage: ((event: MessageEvent<JapaneseVoiceWorkerRequest>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetModules();
  engine.load.mockReset().mockResolvedValue(engine);
  engine.synthesize.mockReset().mockResolvedValue(new Float32Array([0, 0.25, -0.25]));
  scope = { onmessage: null, postMessage: vi.fn() };
  vi.stubGlobal("self", scope);
});

afterEach(() => vi.unstubAllGlobals());

it("prepares the engine without synthesis and reuses it for the selected sentence", async () => {
  await import("./japanese-voice.worker");
  scope.onmessage?.({ data: { id: "prepare", type: "prepare" } } as MessageEvent<JapaneseVoiceWorkerRequest>);

  await waitFor(() => expect(scope.postMessage).toHaveBeenCalledWith({ id: "prepare", type: "ready" }, undefined));
  expect(engine.synthesize).not.toHaveBeenCalled();

  scope.onmessage?.({ data: { id: "play", type: "synthesize", text: "学校へ行きます。", speed: 0.82 } } as MessageEvent<JapaneseVoiceWorkerRequest>);

  await waitFor(() => expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "play", type: "audio", sampleRate: 44_100 }), expect.any(Array)));
  expect(engine.load).toHaveBeenCalledOnce();
  expect(engine.synthesize).toHaveBeenCalledWith("学校へ行きます。", expect.any(Function), 0.82);
});

it("retries engine loading after preparation fails", async () => {
  engine.load.mockRejectedValueOnce(new Error("GPU unavailable"));
  await import("./japanese-voice.worker");
  scope.onmessage?.({ data: { id: "prepare", type: "prepare" } } as MessageEvent<JapaneseVoiceWorkerRequest>);
  await waitFor(() => expect(scope.postMessage).toHaveBeenCalledWith({ id: "prepare", type: "error", message: "GPU unavailable" }, undefined));

  scope.onmessage?.({ data: { id: "retry", type: "prepare" } } as MessageEvent<JapaneseVoiceWorkerRequest>);
  await waitFor(() => expect(scope.postMessage).toHaveBeenCalledWith({ id: "retry", type: "ready" }, undefined));
  expect(engine.load).toHaveBeenCalledTimes(2);
});
