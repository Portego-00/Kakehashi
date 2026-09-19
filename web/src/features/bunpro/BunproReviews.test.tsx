import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BunproReviews } from "./BunproReviews";
import { BunproSettings } from "./BunproSettings";
import { BunproHomeButton } from "./BunproHomeButton";
import { BunproDetails } from "./BunproDetails";
import { BunproText } from "./BunproText";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { playAnswerFeedback } from "@/features/study/feedback-audio";
import { bunpro } from "./client";
import type { BunproReviewQueueItem } from "./model";
const session = vi.hoisted(() => ({ user: { data: { username: "Portego" } }, isDemo: false }));
vi.mock("@/lib/session", () => ({ useSession: () => session }));
vi.mock("@/features/settings/use-workspace-preferences", () => ({ useWebSettings: vi.fn() }));
vi.mock("@/features/study/feedback-audio", () => ({ playAnswerFeedback: vi.fn() }));
vi.mock("./client", () => ({ bunpro: vi.fn() }));
const item: BunproReviewQueueItem = { data: { id: "10", type: "review", attributes: { id: 10, reviewable_id: 20, reviewable_type: "GrammarPoint" }, relationships: { study_question: { data: { id: "30", type: "study_question" } }, reviewable: { data: { id: "20", type: "grammar_point" } } } }, included: [{ id: "30", type: "study_question", attributes: { content: "私(わたし)は学生____。", answer: "です", alternate_grammar: ["だ"], alternate_answers: { "でした": { en: "Use the present tense." } }, translation: "I am a student." } }, { id: "20", type: "grammar_point", attributes: { title: "です", slug: "desu", meaning: "To be" } }] };
function setup(ui = <BunproReviews />) { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>); }
beforeEach(() => { vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: true, showAnswerStopSubjectDetails: false } }); vi.mocked(playAnswerFeedback).mockClear(); session.user.data.username = "Portego"; session.isDemo = false; vi.mocked(bunpro).mockReset().mockImplementation(async (query) => query === "action=connection" ? { connected: true } : query.startsWith("action=queue") ? { review_session_id: 1, pending_attempt: [item], pending_wrapup: [] } : {}); });
afterEach(cleanup);
async function start() { setup(); fireEvent.click(await screen.findByRole("button", { name: "Start reviews" })); await screen.findByLabelText("Your answer"); }
it.each([["Grammar", "grammar"], ["Vocabulary", "vocab"], ["Grammar & vocabulary", "all"]])("loads %s reviews", async (label, mode) => { setup(); fireEvent.click(screen.getByLabelText(label)); fireEvent.click(await screen.findByRole("button", { name: "Start reviews" })); await screen.findByLabelText("Your answer"); expect(bunpro).toHaveBeenCalledWith(`action=queue&mode=${mode}`); });
it("accepts alternate answers, converts kana, and saves only on Continue", async () => { await start(); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "da" } }); expect(screen.getByLabelText("Your answer")).toHaveValue("だ"); fireEvent.click(screen.getByRole("button", { name: "Check" })); expect(screen.getByText("Correct")).toBeVisible(); expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findByText("Bunpro reviews complete"); const call = vi.mocked(bunpro).mock.calls.find(([, options]) => options?.method === "POST"); expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ correct: true, sessionId: 1, reviewId: "10" }); });
it("gives an alternate-answer hint without marking incorrect", async () => { await start(); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "でした" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); expect(screen.getByText("Use the present tense.")).toBeVisible(); expect(screen.queryByText("Incorrect")).not.toBeInTheDocument(); });
it("repeats a missed item without submitting it twice", async () => { await start(); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "ちがう" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findAllByText("Practice again"); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findByText("Bunpro reviews complete"); expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1); });
it("keeps the current answer when saving fails", async () => { await start(); vi.mocked(bunpro).mockRejectedValueOnce(new Error("Service unavailable")); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "ちがう" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findByRole("alert"); expect(screen.getByRole("button", { name: /^(Next|Next Question)$/ })).toBeEnabled(); expect(screen.queryAllByText("Practice again")).toHaveLength(0); });
it.each(["Learner", "demo-level-21"])("hides settings and the home button from %s", (username) => { session.user.data.username = username; setup(<><BunproSettings /><BunproHomeButton /></>); expect(screen.queryByText("Bunpro API key")).not.toBeInTheDocument(); expect(screen.queryByText("Bunpro reviews")).not.toBeInTheDocument(); expect(bunpro).not.toHaveBeenCalled(); });
it("validates and clears the API-key field after saving", async () => { setup(<BunproSettings />); fireEvent.change(screen.getByLabelText("Bunpro API key"), { target: { value: "private-key" } }); vi.mocked(bunpro).mockResolvedValueOnce({ connected: true }); fireEvent.click(screen.getByRole("button", { name: "Save" })); await waitFor(() => expect(screen.getByLabelText("Bunpro API key")).toHaveValue("")); expect(bunpro).toHaveBeenCalledWith("", expect.objectContaining({ body: JSON.stringify({ action: "connect", token: "private-key" }) })); });
it("preserves furigana and strips executable markup", () => { const { container } = render(<BunproText value={'<strong>私(わたし)</strong><script>alert(1)</script><a href="javascript:alert(1)">bad link</a><img src="x" onerror="alert(1)">'} />); expect(container.querySelector("ruby rt")).toHaveTextContent("わたし"); expect(container.querySelector("script, img, a")).toBeNull(); expect(screen.getByText("bad link")).toBeVisible(); });

it("shows detail tabs, structures, and custom examples without resources", async () => {
  vi.mocked(bunpro).mockResolvedValue({ data: { id: "20", type: "grammar_point", attributes: { title: "です", meaning: "To be", casual_structure: "Noun + だ", polite_structure: "Noun + です", nuance_translation: "A polite ending.", jmdict_data: { sense: [{ gloss: [{ lang: "eng", text: "Existence" }] }] }, accepted_answers: "is, am, are" } }, included: [...item.included!, { id: "40", type: "writeup", attributes: { body: '<p>About the copula.</p><ul class="writeup-examples--holder"><li data-study-question="30"></li></ul>' } }] });
  setup(<BunproDetails kind="grammar" slug="desu" />);
  expect(await screen.findByText("Noun + だ")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Polite" }));
  expect(screen.getByText("Noun + です")).toBeVisible();
  expect(screen.getByText("I am a student.")).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Examples" }));
  expect(screen.getByText("I am a student.")).toBeVisible();
  expect(screen.queryByRole("tab", { name: "Resources" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play example audio" })).toBeInTheDocument();
});

it("removes Show answer and unlocks Info only after checking", async () => {
  await start();
  expect(screen.queryByRole("button", { name: /show answer/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Info" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Audio" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(screen.getByRole("button", { name: "Info" })).toBeEnabled();
  expect(playAnswerFeedback).toHaveBeenCalledWith(true);
});
it("auto-advances according to the WaniKani pause settings and shows the confirmed Bunpro SRS change", async () => {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: false } });
  await start();
  vi.mocked(bunpro).mockResolvedValueOnce({ new_srs_stage: 4, next_review: "2099-01-01T00:00:00Z" });
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  await screen.findByText("Bunpro reviews complete");
  expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toHaveTextContent("Adept 1");
});
it("opens Bunpro details on a paused wrong answer when enabled", async () => {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnWrong: true, showAnswerStopSubjectDetails: true } });
  await start();
  vi.mocked(bunpro).mockResolvedValueOnce({ data: { id: "20", attributes: { title: "です", meaning: "To be" } }, included: [] });
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "ちがう" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await screen.findByRole("region", { name: "Bunpro item details" })).toBeVisible();
  expect(screen.getByRole("button", { name: /^(Next|Next Question)$/ })).toBeEnabled();
});
it("waits for autoplay to finish before advancing and respects the voice preference", async () => {
  const players: EventTarget[] = [];
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  vi.stubGlobal("Audio", class extends EventTarget { constructor(public src: string) { super(); players.push(this); } play = play; pause = pause; });
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: false, autoplayAudio: true, vocabularyAudioVoice: "both" } });
  vi.mocked(bunpro).mockImplementation(async (query) => query === "action=connection" ? { connected: true } : query.startsWith("action=queue") ? { review_session_id: 1, pending_attempt: [{ ...item, included: item.included!.map((resource) => resource.type === "study_question" ? { ...resource, attributes: { ...resource.attributes, female_audio_url: "https://audio.test/female.mp3", male_audio_url: "https://audio.test/male.mp3" } } : resource) }], pending_wrapup: [] } : {});
  try {
    await start();
    expect(screen.queryByRole("button", { name: "Audio" })).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: " " });
    expect(play).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(play).toHaveBeenCalledTimes(1);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
    expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
    await act(async () => { players[0].dispatchEvent(new Event("ended")); });
    expect(play).toHaveBeenCalledTimes(2);
    await act(async () => { players[1].dispatchEvent(new Event("ended")); });
    await screen.findByText("Bunpro reviews complete");
  } finally { vi.unstubAllGlobals(); }
});
it("renders the mobile Home review card and its grammar/vocab breakdown", async () => {
  vi.mocked(bunpro).mockImplementation(async (query) => query === "action=connection" ? { connected: true } : { total_due_grammar: 8, total_due_vocab: 12 });
  setup(<BunproHomeButton />);
  expect(await screen.findByLabelText("20 reviews due")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Choose Bunpro review type" }));
  expect(screen.getByRole("link", { name: "Bunpro Grammar Only reviews" })).toHaveAttribute("href", "/bunpro-reviews?mode=grammar");
  expect(screen.getByRole("link", { name: "Bunpro Vocab Only reviews" })).toHaveAttribute("href", "/bunpro-reviews?mode=vocab");
});
it("starts the type selected on the Home card directly", async () => {
  setup(<BunproReviews initialMode="vocab" />);
  await screen.findByLabelText("Your answer");
  expect(bunpro).toHaveBeenCalledWith("action=queue&mode=vocab");
  expect(vi.mocked(bunpro).mock.calls.filter(([query]) => query.startsWith("action=queue"))).toHaveLength(1);
});
it("respects disabled feedback sounds and stops automatic retries after a save failure", async () => {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: false, answerFeedbackSoundEnabled: false, autoplayAudio: false } });
  await start();
  vi.mocked(bunpro).mockRejectedValueOnce(new Error("Service unavailable"));
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  await screen.findByRole("alert");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 450)); });
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  expect(playAnswerFeedback).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /^(Next|Continue now)$/ })).toBeEnabled();
});

it("keeps cards hidden when the key is absent or revoked", async () => {
  vi.mocked(bunpro).mockResolvedValue({ connected: false });
  setup(<BunproHomeButton />);
  await waitFor(() => expect(bunpro).toHaveBeenCalled());
  expect(screen.queryByRole("region", { name: "Bunpro study" })).not.toBeInTheDocument();
  expect(vi.mocked(bunpro).mock.calls).toHaveLength(1);
});
it("uses the supplied lesson session and returns to lessons after its quiz", async () => {
  const continueLessons = vi.fn();
  setup(<BunproReviews lessonSession={{ total_pending_attempt_count: 1, total_pending_wrapup_count: 0, review_session_id: 9, pending_attempt: [item], pending_wrapup: [] }} onContinueLessons={continueLessons} />);
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Lesson quiz complete");
  const submit = vi.mocked(bunpro).mock.calls.find(([, options]) => options?.method === "POST");
  expect(JSON.parse(String(submit?.[1]?.body))).toMatchObject({ context: "learn", sessionId: 9, reviewId: "10" });
  expect(vi.mocked(bunpro).mock.calls.some(([query]) => query.startsWith("action=queue"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Continue lessons" }));
  expect(continueLessons).toHaveBeenCalledOnce();
});


it.each([["grammar", 58], ["vocab", 1434]] as const)("shows the reported %s total, not the loaded batch size", async (mode, total) => {
  vi.mocked(bunpro).mockImplementation(async query => query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [item], pending_wrapup: [], total_pending_attempt_count: total, total_pending_wrapup_count: 0 });
  setup(<BunproReviews initialMode={mode} />);
  await screen.findByLabelText("Your answer");
  expect(screen.getByRole("progressbar", { name: "Review progress" })).toHaveAttribute("aria-valuemax", String(total));
});

it("loads another page when the first batch runs out, without losing progress", async () => {
  const second = { ...item, data: { ...item.data, id: "11" } };
  let pages = 0;
  vi.mocked(bunpro).mockImplementation(async query => query === "action=connection" ? { connected: true } : query.startsWith("action=queue") ? { review_session_id: ++pages, pending_attempt: [pages === 1 ? item : second], pending_wrapup: [], total_pending_attempt_count: pages === 1 ? 2 : 1, total_pending_wrapup_count: 0 } : {});
  setup(<BunproReviews initialMode="grammar" />);
  await screen.findByLabelText("Your answer");
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(screen.getByRole("progressbar", { name: "Review progress" })).toHaveAttribute("aria-valuenow", "1"));
  expect(pages).toBe(2);
  expect(screen.queryByText("Bunpro reviews complete")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(2);
});
it("retries a failed refill without submitting the saved answer twice", async () => {
  let pages = 0;
  vi.mocked(bunpro).mockImplementation(async query => {
    if (query === "action=connection") return { connected: true };
    if (query.startsWith("action=queue")) {
      pages++;
      if (pages === 2) throw new Error("Batch unavailable");
      return { review_session_id: pages, pending_attempt: pages === 1 ? [item] : [], pending_wrapup: [], total_pending_attempt_count: pages === 1 ? 2 : 0, total_pending_wrapup_count: 0 };
    }
    return {};
  });
  setup(<BunproReviews initialMode="grammar" />);
  await screen.findByLabelText("Your answer");
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});
it("shuffles the provider's ordering when starting a session", async () => {
  const second = { ...item, data: { ...item.data, id: "11" }, included: item.included!.map(resource => resource.type === "study_question" ? { ...resource, attributes: { ...resource.attributes, translation: "Second question" } } : resource) };
  vi.mocked(bunpro).mockImplementation(async query => query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [item, second], pending_wrapup: [] });
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  try { setup(<BunproReviews initialMode="grammar" />); expect(await screen.findByText("Second question")).toBeVisible(); }
  finally { random.mockRestore(); }
});
it("marks only the next configured batch and keeps collapsed links inaccessible", async () => {
  vi.mocked(bunpro).mockImplementation(async query => query === "action=connection" ? { connected: true } : query === "action=lesson-queue" ? { data: [{ id: "1", attributes: { deck_id: 1, daily_goal: 4, batch_size: 2 } }], included: [{ id: "1", attributes: { title: "N5 Grammar", grammar_count: 100 } }] } : {});
  setup(<BunproHomeButton />);
  const progress = await screen.findByRole("progressbar", { name: "Daily lesson goal" });
  await waitFor(() => expect(progress.querySelectorAll('[data-next="true"]')).toHaveLength(2));
  expect(screen.queryByRole("link", { name: /N5 Grammar/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose Bunpro lesson deck" }));
  expect(screen.getByRole("link", { name: /N5 Grammar/ })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("button", { name: "Choose Bunpro lesson deck" }), { key: "Escape" });
  expect(screen.queryByRole("link", { name: /N5 Grammar/ })).not.toBeInTheDocument();
});
