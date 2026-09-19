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

it("shows mobile-style detail tabs, structures, writeup examples, and vocabulary resources", async () => {
  vi.mocked(bunpro).mockResolvedValue({ data: { id: "20", type: "grammar_point", attributes: { title: "です", meaning: "To be", casual_structure: "Noun + だ", polite_structure: "Noun + です", nuance_translation: "A polite ending.", jmdict_data: { sense: [{ gloss: [{ lang: "eng", text: "Existence" }] }] }, accepted_answers: "is, am, are" } }, included: [...item.included!, { id: "40", type: "writeup", attributes: { body: '<p>About the copula.</p><ul class="writeup-examples--holder"><li data-study-question="30"></li></ul>' } }] });
  setup(<BunproDetails kind="grammar" slug="desu" />);
  expect(await screen.findByText("Noun + だ")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Casual" }));
  expect(screen.getByText("Noun + です")).toBeVisible();
  expect(screen.getByText("I am a student.")).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Examples" }));
  expect(screen.getByText("I am a student.")).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Resources" }));
  expect(screen.getByText("Existence")).toBeVisible();
  expect(screen.getByText(/is, am, are/)).toBeVisible();
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
  expect(screen.getByRole("link", { name: "Bunpro Grammar reviews" })).toHaveAttribute("href", "/bunpro-reviews?mode=grammar");
  expect(screen.getByRole("link", { name: "Bunpro Vocab reviews" })).toHaveAttribute("href", "/bunpro-reviews?mode=vocab");
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
