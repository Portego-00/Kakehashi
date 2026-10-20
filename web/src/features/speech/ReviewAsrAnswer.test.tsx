import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReviewAsrAnswer } from "./ReviewAsrAnswer";
import { recordJapaneseReading } from "./japanese-asr-recorder";
const session = vi.hoisted(() => ({ user: { data: { username: "Portego" } }, isDemo: false, status: "authenticated" }));
vi.mock("@/lib/session", () => ({ useSession: () => session }));
vi.mock("./japanese-asr-assets", () => ({ hasJapaneseAsr: async () => true, supportsJapaneseAsr: () => true, JAPANESE_ASR_CHANGED: "model-changed" }));
vi.mock("./english-asr-assets", () => ({ hasEnglishAsr: async () => true }));
vi.mock("./japanese-asr-recorder", () => ({ recordJapaneseReading: vi.fn() }));

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: { id: number; text?: string } }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn((message: { id: number; type: string }) => {
    if (message.type === "prepare") queueMicrotask(() => this.onmessage?.({ data: { id: message.id } }));
  });
  constructor() { FakeWorker.instances.push(this); }
}
beforeEach(() => {
  session.user.data.username = "Portego"; session.isDemo = false; session.status = "authenticated";
  FakeWorker.instances = []; vi.stubGlobal("Worker", FakeWorker);
  vi.mocked(recordJapaneseReading).mockImplementation(async (_signal, onListening) => new Promise(resolve => {
    onListening(() => resolve(new Float32Array(16_000)));
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const props = () => ({ questionKey: "q1", value: "", blocked: false, enabled: true, onTranscript: vi.fn() });

it("inserts the recognized kana and leaves submission to the answer form", async () => {
  const options = props(); render(<ReviewAsrAnswer {...options} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Record answer" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Record answer" }));
  fireEvent.click(await screen.findByRole("button", { name: "Stop recording" }));
  await waitFor(() => expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledTimes(2));
  const worker = FakeWorker.instances[0];
  const request = worker.postMessage.mock.calls[1][0];
  expect(request).not.toHaveProperty("answer");
  await act(async () => worker.onmessage?.({ data: { id: request.id, text: "もり" } }));
  expect(options.onTranscript).toHaveBeenCalledExactlyOnceWith("もり");
});
it.each(["question", "typing", "blocked"])("cancels pending inference after %s changes and ignores its late result", async reason => {
  const options = props(); const { rerender } = render(<ReviewAsrAnswer {...options} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Record answer" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Record answer" }));
  fireEvent.click(await screen.findByRole("button", { name: "Stop recording" }));
  await waitFor(() => expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledTimes(2));
  const worker = FakeWorker.instances[0]; const late = worker.onmessage!;
  rerender(<ReviewAsrAnswer {...options} questionKey={reason === "question" ? "q2" : "q1"} value={reason === "typing" ? "かわ" : ""} blocked={reason === "blocked"} />);
  act(() => late({ data: { id: 2, text: "もり" } }));
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(options.onTranscript).not.toHaveBeenCalled();
});
it("cleans up the microphone capture on unmount", async () => {
  const { unmount } = render(<ReviewAsrAnswer {...props()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Record answer" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Record answer" }));
  await screen.findByRole("button", { name: "Stop recording" });
  const signal = vi.mocked(recordJapaneseReading).mock.calls[0][0];
  unmount(); expect(signal.aborted).toBe(true);
});
it.each([{ username: "OtherUser", demo: false }, { username: "Portego", demo: true }])("hides the trial for $username demo=$demo", ({ username, demo }) => {
  session.user.data.username = username; session.isDemo = demo;
  render(<ReviewAsrAnswer {...props()} />);
  expect(screen.queryByRole("button", { name: "Record answer" })).not.toBeInTheDocument();
  expect(FakeWorker.instances).toHaveLength(0);
});

it("prepares the English model and starts editable voice entry before capture", async () => {
  const options = { ...props(), language: "en" as const, onStart: vi.fn() };
  render(<ReviewAsrAnswer {...options} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Record answer" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Record answer" }));
  await screen.findByRole("button", { name: "Stop recording" });
  expect(options.onStart).toHaveBeenCalledOnce();
  expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "prepare", language: "en" }), []);
  fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
  await waitFor(() => expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledTimes(2));
  const worker = FakeWorker.instances[0];
  await act(async () => worker.onmessage?.({ data: { id: 2, text: "forest" } }));
  expect(options.onTranscript).toHaveBeenCalledExactlyOnceWith("forest");
});
it("keeps the record button visible with instructions when the setting is off", async () => {
  render(<ReviewAsrAnswer {...props()} enabled={false} />);
  expect(await screen.findByRole("button", { name: "Record answer" })).toBeDisabled();
  await screen.findByText("Enable voice answers in Settings → Reviews.");
  expect(FakeWorker.instances).toHaveLength(0);
});
