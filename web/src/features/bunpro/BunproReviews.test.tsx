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
it("gives an alternate-answer hint without marking incorrect", async () => { await start(); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "でした" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); expect(screen.getByText("Use the present tense.")).toBeVisible(); expect(screen.getByLabelText("Your answer").parentElement).toHaveAttribute("data-result", "warning"); expect(screen.getByText("Close — try another answer")).toBeVisible(); expect(screen.queryByText("Incorrect")).not.toBeInTheDocument(); });
it("repeats a missed item without submitting it twice", async () => { await start(); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "ちがう" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findAllByText("Retrying missed item"); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findByText("Bunpro reviews complete"); expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1); });
it("keeps the current answer when saving fails", async () => { await start(); vi.mocked(bunpro).mockRejectedValueOnce(new Error("Service unavailable")); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "ちがう" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findByRole("alert"); expect(screen.getByRole("button", { name: /^(Next|Next Question)$/ })).toBeEnabled(); expect(screen.queryAllByText("Retrying missed item")).toHaveLength(0); });
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
it("keeps answer controls available until Next and shows the confirmed Bunpro SRS change", async () => {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: false } });
  await start();
  vi.mocked(bunpro).mockResolvedValueOnce({ new_srs_stage: 4, next_review: "2099-01-01T00:00:00Z" });
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(screen.getByRole("button", { name: "Undo" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
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
it.each(["both", "male"] as const)("autoplays only the female voice with %s selected and keeps the answer until Next", async (vocabularyAudioVoice) => {
  const players: (EventTarget & { src: string })[] = [];
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  vi.stubGlobal("Audio", class extends EventTarget { constructor(public src: string) { super(); players.push(this); } play = play; pause = pause; });
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: false, autoplayAudio: true, vocabularyAudioVoice } });
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
    expect(play).toHaveBeenCalledTimes(1);
    expect(players[0].src).toBe("https://audio.test/female.mp3");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Bunpro reviews complete");
  } finally { vi.unstubAllGlobals(); }
});
it.each([false, true])("keeps sentence audio playing after Next (mixed: %s) and stops on exit", async (mixed) => {
  const pause = vi.fn();
  vi.stubGlobal("Audio", class extends EventTarget {
    constructor(public src: string) { super(); }
    play = vi.fn().mockResolvedValue(undefined);
    pause = pause;
  });
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: true, autoplayAudio: true, showAnswerStopSubjectDetails: false } });
  const voiced = { ...item, included: item.included!.map(resource => resource.type === "study_question" ? { ...resource, attributes: { ...resource.attributes, female_audio_url: "https://audio.test/female.mp3" } } : resource) };
  vi.mocked(bunpro).mockImplementation(async query => query === "action=connection" ? { connected: true } : query.startsWith("action=queue") ? { review_session_id: 1, pending_attempt: [voiced, { ...voiced, data: { ...item.data, id: "11" } }], pending_wrapup: [] } : {});
  const mixedBridge = mixed ? { active: true, report: vi.fn() } : undefined;
  const view = setup(<BunproReviews initialMode="grammar" mixed={mixedBridge} />);
  try {
    fireEvent.change(await screen.findByLabelText("Your answer"), { target: { value: "です" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByLabelText("Your answer")).toHaveValue(""));
    expect(pause).not.toHaveBeenCalled();
    view.unmount();
    expect(pause).toHaveBeenCalledTimes(1);
  } finally { view.unmount(); vi.unstubAllGlobals(); }
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
it("respects disabled feedback sounds and does not retry a save failure automatically", async () => {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: false, answerFeedbackSoundEnabled: false, autoplayAudio: false } });
  await start();
  vi.mocked(bunpro).mockRejectedValueOnce(new Error("Service unavailable"));
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
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

it("lets the learner undo, inspect alternatives, and correct a grade before saving", async () => {
  await start();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByLabelText("Your answer")).not.toHaveAttribute("readonly");
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Alternatives" }));
  expect(screen.getByRole("heading", { name: "Accepted answers" })).toBeVisible();
  expect(screen.getByText("Use the present tense.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Mark Correct" }));
  await screen.findByText("Bunpro reviews complete");
  expect(JSON.parse(String(vi.mocked(bunpro).mock.calls.find(([, o]) => o?.method === "POST")?.[1]?.body)).correct).toBe(true);
});
it("reveals grammar nuance progressively in lesson quizzes", async () => {
  const question = { ...item, included: item.included!.map((r) => r.type === "grammar_point" ? { ...r, attributes: { ...r.attributes, nuance: "丁寧な表現", nuance_translation: "A polite expression" } } : r) };
  setup(<BunproReviews lessonSession={{ review_session_id: 1, pending_attempt: [question], pending_wrapup: [], total_pending_attempt_count: 1, total_pending_wrapup_count: 0 }} />);
  expect(screen.queryByText("A polite expression")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hint level 2 of 4" }));
  expect(screen.getByText("A polite expression")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Hint level 3 of 4" }));
  expect(screen.getByText("丁寧な表現")).toBeVisible();
});

it("skips a question without grading it or revealing the next answer", async () => {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: true, allowSkippingReviews: true } });
  const second = { ...item, data: { ...item.data, id: "11" }, included: item.included!.map((r) => r.type === "study_question" ? { ...r, attributes: { ...r.attributes, content: "次の質問____。" } } : r) };
  setup(<BunproReviews lessonSession={{ review_session_id: 1, pending_attempt: [item, second], pending_wrapup: [], total_pending_attempt_count: 2, total_pending_wrapup_count: 0 }} />);
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(screen.getByLabelText("Your answer")).toHaveValue("");
  expect(screen.queryByText("Correct")).not.toBeInTheDocument();
  expect(vi.mocked(bunpro).mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(0);
});

function studySettings(study: Partial<typeof DEFAULT_WEB_SETTINGS.study>) {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: true, autoplayAudio: false, showAnswerStopSubjectDetails: false, ...study } });
}
it.each([false, true])("uses reading Anki settings with custom keys %s", async (customKeys) => {
  const studyShortcuts = { ...DEFAULT_WEB_SETTINGS.study.studyShortcuts, ...(customKeys ? { progress: " ", markCorrect: "j" } : {}) };
  studySettings({ studyShortcuts, ankiMode: "reading", ankiShowOtherAcceptedAnswersAndUserSynonyms: true });
  setup(<BunproReviews initialMode="grammar" />);
  await screen.findByRole("button", { name: "Reveal answer" });
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByTestId("anki-answer-preview")).toHaveAttribute("data-visibility", "blurred");
  fireEvent.keyDown(document.body, { key: studyShortcuts.progress });
  expect(screen.getByRole("button", { name: "Correct" }).querySelector("kbd")).toHaveTextContent(customKeys ? "J" : "2");
  expect(screen.getByTestId("anki-answer-content")).toHaveTextContent("だ");
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  fireEvent.keyDown(document.body, { key: studyShortcuts.markCorrect });

  await screen.findByText("Bunpro reviews complete");
  expect(JSON.parse(String(vi.mocked(bunpro).mock.calls.find(([, options]) => options?.method === "POST")?.[1]?.body))).toMatchObject({ reviewId: "10", correct: true });
});
it("supports buttonless Anki grading and disables keyboard grading when configured", async () => {
  studySettings({ ankiMode: "both", ankiButtonlessMode: true, keyboardShortcuts: false });
  setup(<BunproReviews initialMode="grammar" />);
  fireEvent.click(await screen.findByRole("button", { name: "Reveal answer" }));
  fireEvent.keyDown(document.body, { key: "2" });
  expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tap left: mark wrong" }));
  await screen.findByRole("button", { name: "Reveal answer" });
  expect(JSON.parse(String(vi.mocked(bunpro).mock.calls.find(([, options]) => options?.method === "POST")?.[1]?.body))).toMatchObject({ correct: false });
});
it("keeps grammar typed in meaning-only Anki mode and applies Jitai and control settings", async () => {
  studySettings({ ankiMode: "meaning", jitaiEnabled: true, jitaiSelectedFontIds: ["mincho"], allowSkippingReviews: false, reviewSearchButtonEnabled: false, voiceAnswers: true });
  await start();
  expect(screen.getByRole("textbox")).toBeVisible();
  expect(screen.getByRole("main").style.getPropertyValue("--jitai-font")).toContain("Yu Mincho");
  expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Search this item" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Answer with voice" })).toBeVisible();
});
it("automatically advances a correct answer when pause is disabled", async () => {
  studySettings({ pauseOnCorrect: false });
  await start();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  await screen.findByText("Bunpro reviews complete");
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});
it("does not auto-advance an inactive mixed queue", async () => {
  studySettings({ pauseOnCorrect: false });
  setup(<BunproReviews initialMode="grammar" mixed={{ active: false, report: vi.fn() }} />);
  fireEvent.change(await screen.findByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
});
it("applies the batch limit and SRS order without refilling beyond the batch", async () => {
  studySettings({ reviewBatchSizeEnabled: true, reviewBatchSize: 2, reviewOrder: "ascendingSrsStage" });
  const rows = [3, 1, 2].map(stage => ({ ...item, data: { ...item.data, id: String(stage), attributes: { ...item.data.attributes, streak: stage } } }));
  vi.mocked(bunpro).mockImplementation(async query => query === "action=connection" ? { connected: true } : query.startsWith("action=queue") ? { review_session_id: 1, pending_attempt: rows, total_pending_attempt_count: 100 } : { pending_attempt: rows });
  await start();
  for (let i = 0; i < 2; i++) {
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    if (!i) await waitFor(() => expect(screen.getByLabelText("Your answer")).toHaveValue(""));
  }
  await screen.findByText("Bunpro reviews complete");
  const posts = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(String(options?.body)));
  expect(posts.map(post => post.reviewId)).toEqual(["1", "2"]);
  expect(posts.every(post => post.requestMore === false)).toBe(true);
});
it("uses meaning Anki for English vocabulary answers without exposing translation first", async () => {
  studySettings({ ankiMode: "meaning" });
  const vocab = { ...item, data: { ...item.data, attributes: { ...item.data.attributes, reviewable_type: "Vocab" }, relationships: { ...item.data.relationships, reviewable: { data: { id: "20", type: "vocab" } } } }, included: item.included!.map(resource => resource.type === "study_question" ? { ...resource, attributes: { content: "外側", answer: "outside", translation: "outside" } } : { ...resource, type: "vocab", attributes: { title: "外側", kana: "そとがわ", meaning: "outside" } }) };
  vi.mocked(bunpro).mockImplementation(async query => query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [vocab] });
  setup(<BunproReviews initialMode="vocab" />);
  const reveal = await screen.findByRole("button", { name: "Reveal answer" });
  expect(screen.getByText("outside").closest("[aria-hidden=true]")).toBeInTheDocument();
  fireEvent.click(reveal);
  expect(screen.getByTestId("anki-answer-content")).toHaveTextContent("Expected meaningoutside");
});
it("wraps up after the configured number without loading additional items", async () => {
  studySettings({ reviewWrapUpSize: 1, reviewOrder: "ascendingSrsStage" });
  const rows = [1, 2, 3].map(stage => ({ ...item, data: { ...item.data, id: String(stage), attributes: { ...item.data.attributes, streak: stage } } }));
  vi.mocked(bunpro).mockImplementation(async query => query === "action=connection" ? { connected: true } : query.startsWith("action=queue") ? { review_session_id: 1, pending_attempt: rows } : { pending_attempt: rows });
  await start();
  fireEvent.click(screen.getByRole("button", { name: "Wrap Up 1" }));
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

it("advances mixed reviews after a successful null submission response", async () => {
  const report = vi.fn();
  const onAnswer = vi.fn();
  setup(<BunproReviews initialMode="all" mixed={{ active: true, report, onAnswer }} />);
  await screen.findByLabelText("Your answer");
  vi.mocked(bunpro).mockImplementation(async (query, options) => options?.method === "POST" ? null : query === "action=connection" ? { connected: true } : {});
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ bunproSubject: { kind: "grammar", slug: "desu" } }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

it("shows matching keycaps and supports corrections, alternatives, and undo from the answered input", async () => {
  await start();
  const input = screen.getByLabelText("Your answer");
  fireEvent.change(input, { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  for (const [button, key] of [["Undo", "U"], ["Info", "D"], ["Alternatives", "A"], ["Mark Incorrect", "1"]]) {
    expect(screen.getByRole("button", { name: button }).querySelector("kbd")).toHaveTextContent(key);
  }
  fireEvent.keyDown(input, { key: "a" });
  expect(screen.getByRole("heading", { name: "Accepted answers" })).toBeVisible();
  fireEvent.keyDown(input, { key: "u" });
  expect(input).toHaveValue("");
  fireEvent.change(input, { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.keyDown(input, { key: "x" });
  await screen.findByText("Retrying missed item");
  expect(screen.getByRole("button", { name: "Check" })).toBeVisible();
  expect(JSON.parse(String(vi.mocked(bunpro).mock.calls.find(([, o]) => o?.method === "POST")?.[1]?.body)).correct).toBe(false);
});

it("counts a missed review only after its retry is answered correctly", async () => {
  await start();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "ちがう" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Retrying missed item");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

it("starts closing details while saving instead of waiting for Bunpro", async () => {
  await start();
  vi.mocked(bunpro).mockResolvedValueOnce({ data: { id: "20", attributes: { title: "です", meaning: "To be" } }, included: [] });
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Info" }));
  await screen.findByRole("region", { name: "Bunpro item details" });
  let finish!: (value: unknown) => void;
  vi.mocked(bunpro).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(document.querySelector("[data-review-details-reveal]")).toHaveAttribute("data-open", "false");
  await act(async () => finish(null));
});


it.each([true, false])("plays feedback for a corrected grade (%s) before advancing", async (correct) => {
  await start();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: correct ? "wrong" : "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(playAnswerFeedback).toHaveBeenLastCalledWith(!correct);
  fireEvent.click(screen.getByRole("button", { name: correct ? "Mark Correct" : "Mark Incorrect" }));
  expect(playAnswerFeedback).toHaveBeenLastCalledWith(correct);
  expect(playAnswerFeedback).toHaveBeenCalledTimes(2);
  if (correct) await screen.findByText("Bunpro reviews complete");
  else await screen.findByText("Retrying missed item");
});
it("shows and accepts typing in the next question before the previous save returns", async () => {
  let finish!: (value: unknown) => void;
  const second = { ...item, data: { ...item.data, id: "11" } };
  vi.mocked(bunpro).mockImplementation(async (query, options) => options?.method === "POST" ? new Promise(resolve => { finish = resolve; }) : query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [item, second] });
  setup(<BunproReviews initialMode="grammar" />);
  const firstInput = await screen.findByLabelText("Your answer");
  fireEvent.change(firstInput, { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByLabelText("Your answer")).not.toBe(firstInput);
  expect(screen.getByLabelText("Your answer")).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "だ" } });
  await act(async () => { finish(null); });
  expect(screen.getByLabelText("Your answer")).toHaveValue("だ");
});
it.each(["です", "ちがう"])("reports the next mixed question immediately after %s without replaying the badge on save", async answer => {
  let finish!: (value: unknown) => void;
  const report = vi.fn(); const onAnswer = vi.fn();
  const second = { ...item, data: { ...item.data, id: "11" } };
  vi.mocked(bunpro).mockImplementation(async (query, options) => options?.method === "POST" ? new Promise(resolve => { finish = resolve; }) : query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [item, second] });
  setup(<BunproReviews initialMode="grammar" mixed={{ active: true, report, onAnswer }} />);
  await screen.findByLabelText("Your answer");
  const firstId = report.mock.calls.at(-1)?.[0]?.id;
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: answer } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(report.mock.calls.at(-1)?.[0]?.id).not.toBe(firstId);
  expect(onAnswer).toHaveBeenCalledTimes(1);
  await act(async () => { finish(null); });
  expect(onAnswer).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", answer === "です" ? "1" : "0");
});
it("restores an unsaved answer on failure and preserves typing in the next question for retry", async () => {
  let fail!: (error: Error) => void;
  let attempts = 0;
  const reportError = vi.fn();
  const second = { ...item, data: { ...item.data, id: "11" } };
  vi.mocked(bunpro).mockImplementation(async (query, options) => options?.method === "POST" ? ++attempts === 1 ? new Promise((_, reject) => { fail = reject; }) : null : query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [item, second] });
  setup(<BunproReviews initialMode="grammar" mixed={{ active: true, report: vi.fn(), reportError }} />);
  await screen.findByLabelText("Your answer");
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "だ" } });
  await act(async () => { fail(new Error("Not saved")); });
  expect(screen.getByRole("alert")).toHaveTextContent("Not saved");
  expect(screen.getByLabelText("Your answer")).toHaveValue("です");
  expect(reportError).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Check" })).toBeEnabled());
  expect(screen.getByLabelText("Your answer")).toHaveValue("だ");
  expect(attempts).toBe(2);
});
