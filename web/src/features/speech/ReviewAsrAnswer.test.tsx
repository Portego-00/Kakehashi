import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReviewAsrAnswer } from "./ReviewAsrAnswer";
import { downloadReviewVoiceModel, hasReviewVoiceModel } from "./review-voice-assets";
import { readWebSettings } from "@/features/settings/settings";
import { listenForReviewAnswer } from "./review-recognition";
import { beginReviewPlayback } from "./review-playback";
import { setVoiceSessionActive } from "./review-voice-session";
const session = vi.hoisted(() => ({ user: { data: { username: "Portego" } }, isDemo: false, status: "authenticated" }));
vi.mock("@/lib/session", () => ({ useSession: () => session }));
vi.mock("./asr-model-assets", () => ({ supportsLocalAsr: () => true, LOCAL_ASR_CHANGED: "model-changed" }));
vi.mock("./review-voice-assets", () => ({ hasReviewVoiceModel: vi.fn(), downloadReviewVoiceModel: vi.fn() }));
vi.mock("./review-recognition", () => ({ listenForReviewAnswer: vi.fn() }));
vi.mock("./review-voice-reading", () => ({ resolveVoiceTranscript: async (text: string) => text }));
let captures: Parameters<typeof listenForReviewAnswer>[0][] = [];
const options = () => ({ questionKey: "q1", value: "", blocked: false, enabled: true, onTranscript: vi.fn(), onAnswer: vi.fn(), onStart: vi.fn(), isAcceptedAnswer: vi.fn(() => false) });
beforeEach(() => {
  session.user.data.username = "Portego"; session.isDemo = false; session.status = "authenticated";
  captures = []; setVoiceSessionActive(false); localStorage.clear();
  vi.mocked(hasReviewVoiceModel).mockResolvedValue(true);
  vi.mocked(downloadReviewVoiceModel).mockResolvedValue(undefined);
  vi.mocked(listenForReviewAnswer).mockImplementation(async capture => { captures.push(capture); capture.onReady(); await new Promise<void>(resolve => capture.signal.addEventListener("abort", () => resolve(), { once: true })); });
});
afterEach(() => { cleanup(); setVoiceSessionActive(false); vi.clearAllMocks(); vi.useRealTimers(); });
async function start() { await waitFor(() => expect(screen.getByRole("button", { name: "Start voice answers" })).toBeEnabled()); fireEvent.click(screen.getByRole("button", { name: "Start voice answers" })); await screen.findByRole("button", { name: "Pause voice answers" }); }
async function result(text: string, final: boolean, index = captures.length - 1) { await act(async () => captures[index].onResult(text, final, new Float32Array(16_000))); }
it("submits a finished spoken answer without another click, and keeps listening on the next question", async () => {
  const props = options(); const view = render(<ReviewAsrAnswer {...props} />); await start();
  await result("もり", true);
  expect(props.onTranscript).toHaveBeenCalledWith("もり"); expect(props.onAnswer).toHaveBeenCalledExactlyOnceWith("もり"); expect(captures[0].signal.aborted).toBe(true);
  view.rerender(<ReviewAsrAnswer {...props} questionKey="q2" value="" language="en" />);
  await waitFor(() => expect(captures).toHaveLength(2)); expect(captures[1].language).toBe("en");
  await result("forest", true); expect(props.onAnswer).toHaveBeenLastCalledWith("forest");
});
it("submits a stable accepted partial once and ignores its late final", async () => {
  const props = { ...options(), isAcceptedAnswer: vi.fn(() => true) }; render(<ReviewAsrAnswer {...props} />); await start(); vi.useFakeTimers();
  await result("rain", false); await act(async () => vi.advanceTimersByTime(500)); await result("rain", false);
  expect(props.onAnswer).not.toHaveBeenCalled(); await act(async () => vi.advanceTimersByTime(200));
  expect(props.onAnswer).toHaveBeenCalledExactlyOnceWith("rain"); await result("rain", true); expect(props.onAnswer).toHaveBeenCalledTimes(1);
});
it("waits for the longer answer when an accepted prefix changes", async () => {
  const props = { ...options(), isAcceptedAnswer: vi.fn(text => text === "rain") }; render(<ReviewAsrAnswer {...props} />); await start(); vi.useFakeTimers();
  await result("rain", false); await act(async () => vi.advanceTimersByTime(500)); await result("rainbow", false); await act(async () => vi.advanceTimersByTime(700));
  expect(props.onAnswer).not.toHaveBeenCalled(); await result("rainbow", true); expect(props.onAnswer).toHaveBeenCalledExactlyOnceWith("rainbow");
});
it.each(["question", "blocked", "typing"])("cancels the capture when %s changes and ignores late results", async reason => {
  const props = options(); const view = render(<ReviewAsrAnswer {...props} />); await start();
  view.rerender(<ReviewAsrAnswer {...props} questionKey={reason === "question" ? "q2" : "q1"} value={reason === "typing" ? "typed" : ""} blocked={reason === "blocked"} />);
  await result("もり", true, 0); expect(props.onAnswer).not.toHaveBeenCalled(); expect(captures[0].signal.aborted).toBe(true);
});
it("pauses listening during feedback and resumes for a repeated question", async () => {
  const props = options(); const view = render(<ReviewAsrAnswer {...props} />); await start(); await result("wrong", true);
  view.rerender(<ReviewAsrAnswer {...props} blocked />); view.rerender(<ReviewAsrAnswer {...props} />);
  await waitFor(() => expect(captures).toHaveLength(2));
});
it("stops the microphone when paused or unmounted", async () => {
  const view = render(<ReviewAsrAnswer {...options()} />); await start(); fireEvent.click(screen.getByRole("button", { name: "Pause voice answers" })); expect(captures[0].signal.aborted).toBe(true);
  await start(); view.unmount(); expect(captures[1].signal.aborted).toBe(true);
});
it.each([{ username: "OtherUser", demo: false }, { username: "Portego", demo: true }])("hides the trial for $username demo=$demo", ({ username, demo }) => { session.user.data.username = username; session.isDemo = demo; render(<ReviewAsrAnswer {...options()} />); expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(captures).toHaveLength(0); });
it("does not open the microphone while the setting is off", async () => { render(<ReviewAsrAnswer {...options()} enabled={false} />); expect(await screen.findByRole("button", { name: "Start voice answers" })).toBeDisabled(); expect(captures).toHaveLength(0); });

it("pauses for the app's own detached audio and resumes without another activation", async () => {
  render(<ReviewAsrAnswer {...options()} />); await start();
  let finish!: () => void;
  act(() => { finish = beginReviewPlayback(); });
  expect(captures[0].signal.aborted).toBe(true);
  await result("audio from app", true, 0);
  act(() => finish());
  await waitFor(() => expect(captures).toHaveLength(2));
});
it("closes the microphone in a hidden tab and resumes when visible", async () => {
  const props = options(); render(<ReviewAsrAnswer {...props} />); await start();
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  fireEvent(document, new Event("visibilitychange"));
  expect(captures[0].signal.aborted).toBe(true);
  await result("late answer", true, 0); expect(props.onAnswer).not.toHaveBeenCalled();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  fireEvent(document, new Event("visibilitychange"));
  await waitFor(() => expect(captures).toHaveLength(2));
});

it("resumes for an ungraded try-again result and can be manually rearmed", async () => {
  const props = options(); render(<ReviewAsrAnswer {...props} />); await start();
  vi.useFakeTimers();
  await result("alternate reading", true);
  await act(async () => vi.advanceTimersByTime(1_200));
  expect(captures).toHaveLength(2);
  await result("another reading", true);
  fireEvent.click(screen.getByRole("button", { name: "Pause voice answers" }));
  fireEvent.click(screen.getByRole("button", { name: "Start voice answers" }));
  expect(captures).toHaveLength(3);
});

it("downloads and enables voice answers in place without starting the microphone or changing the draft", async () => {
  vi.mocked(hasReviewVoiceModel).mockResolvedValue(false);
  let complete!: () => void;
  vi.mocked(downloadReviewVoiceModel).mockImplementation(async (progress) => {
    progress(42);
    await new Promise<void>(resolve => { complete = resolve; });
  });
  const props = options();
  const view = render(<ReviewAsrAnswer {...props} enabled={undefined} value="typed draft" />);
  fireEvent.click(await screen.findByRole("button", { name: "Download and enable · 241 MB" }));
  expect(await screen.findByRole("progressbar", { name: "Speech recognition model download" })).toHaveAttribute("value", "42");
  expect(screen.getByRole("button", { name: "Downloading… 42%" })).toBeDisabled();
  view.rerender(<ReviewAsrAnswer {...props} enabled={undefined} questionKey="q2" value="next draft" />);
  expect(downloadReviewVoiceModel).toHaveBeenCalledOnce();
  await act(async () => complete());
  expect(await screen.findByRole("button", { name: "Start voice answers" })).toBeEnabled();
  expect(readWebSettings(localStorage, "Portego").study.reviewAsrEnabled).toBe(true);
  expect(props.onTranscript).not.toHaveBeenCalled(); expect(props.onAnswer).not.toHaveBeenCalled();
  expect(listenForReviewAnswer).not.toHaveBeenCalled();
});
it("shows a failed download and lets the learner retry from the review button", async () => {
  vi.mocked(hasReviewVoiceModel).mockResolvedValue(false);
  vi.mocked(downloadReviewVoiceModel).mockRejectedValueOnce(new Error("Connection lost. Try again."));
  render(<ReviewAsrAnswer {...options()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Download and enable · 241 MB" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost. Try again.");
  fireEvent.click(screen.getByRole("button", { name: "Download and enable · 241 MB" }));
  expect(await screen.findByRole("button", { name: "Start voice answers" })).toBeEnabled();
  expect(downloadReviewVoiceModel).toHaveBeenCalledTimes(2);
});
it.each(["cancel", "unmount"])("aborts an in-review download on %s", async action => {
  vi.mocked(hasReviewVoiceModel).mockResolvedValue(false);
  let signal!: AbortSignal;
  vi.mocked(downloadReviewVoiceModel).mockImplementation(async (_progress, incoming) => {
    signal = incoming;
    await new Promise<void>((_resolve, reject) => incoming.addEventListener("abort", () => reject(incoming.reason), { once: true }));
  });
  const view = render(<ReviewAsrAnswer {...options()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Download and enable · 241 MB" }));
  if (action === "cancel") fireEvent.click(screen.getByRole("button", { name: "Cancel download" })); else view.unmount();
  expect(signal.aborted).toBe(true);
  if (action === "cancel") { expect(await screen.findByRole("button", { name: "Download and enable · 241 MB" })).toBeEnabled(); expect(screen.queryByRole("alert")).toBeNull(); }
});
