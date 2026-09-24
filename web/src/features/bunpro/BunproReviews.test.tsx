import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BunproReviews } from "./BunproReviews";
import { BunproSettings } from "./BunproSettings";
import { BunproHomeButton } from "./BunproHomeButton";
import { BunproDetails } from "./BunproDetails";
import { BunproLessons } from "./BunproLessons";
import { BunproText } from "./BunproText";
import { DEFAULT_WEB_SETTINGS, saveWebSettings } from "@/features/settings/settings";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { playAnswerFeedback } from "@/features/study/feedback-audio";
import { bunpro } from "./client";
import type { BunproReviewQueueItem } from "./model";
const session = vi.hoisted(() => ({ user: { data: { username: "Learner" } }, isDemo: false }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "system", setTheme: vi.fn() }) }));
vi.mock("@/lib/session", () => ({ useSession: () => session }));
vi.mock("@/features/settings/use-workspace-preferences", () => ({ useWebSettings: vi.fn() }));
vi.mock("@/features/study/feedback-audio", () => ({ playAnswerFeedback: vi.fn() }));
vi.mock("./client", () => ({ bunpro: vi.fn() }));
const item: BunproReviewQueueItem = { data: { id: "10", type: "review", attributes: { id: 10, ghost_count: 0, reviewable_id: 20, reviewable_type: "GrammarPoint" }, relationships: { study_question: { data: { id: "30", type: "study_question" } }, reviewable: { data: { id: "20", type: "grammar_point" } } } }, included: [{ id: "30", type: "study_question", attributes: { content: "私(わたし)は学生____。", answer: "です", alternate_grammar: ["だ"], alternate_answers: { "でした": { en: "Use the present tense." } }, translation: "I am a student." } }, { id: "20", type: "grammar_point", attributes: { title: "です", slug: "desu", meaning: "To be" } }] };
it("opens the first selected lesson review without loading the regular review queue", async () => {
  vi.mocked(bunpro).mockImplementation(async (query, options) => {
    if (query === "action=lesson-queue") return { data: [{ id: "1", attributes: { deck_id: 1, daily_goal: 2, batch_size: 1 } }], included: [{ id: "1", attributes: { title: "N5 Grammar", grammar_count: 100 } }] };
    if (query === "action=learn&deck=1") return { content: [20, 21].map(id => ({ data: { id: String(id), type: "grammar_point", attributes: { id, title: `Lesson ${id}` } }, included: [] })) };
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") {
      expect(JSON.parse(String(options.body))).toEqual({ action: "lesson-quiz", deckId: 1, reviewables: [["GrammarPoint", 20]] });
      return { review_session_id: 42, pending_attempt: [item], pending_wrapup: [] };
    }
    throw new Error(`Unexpected request: ${query}`);
  });
  setup(<BunproLessons initialDeck={1} />);
  await screen.findByRole("heading", { name: "Lesson 20" });
  fireEvent.click(screen.getByRole("button", { name: "Start Quiz" }));
  expect(await screen.findByLabelText("Your answer")).toBeVisible();
  expect(screen.getByText("I am a student.")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Lesson 20" })).not.toBeInTheDocument();
  expect(vi.mocked(bunpro).mock.calls.some(([query]) => query.startsWith("action=queue"))).toBe(false);
});
it("preserves the ghost review type when submitting an answer", async () => {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: true, showAnswerStopSubjectDetails: false, showReviewItemLevelAndSrsStage: true } });
  vi.mocked(bunpro).mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") return {};
    return { review_session_id: 1, pending_attempt: [{ ...item, data: { ...item.data, id: "14273034", type: "ghost_review", attributes: { ...item.data.attributes, streak: 0 } } }], pending_wrapup: [] };
  });
  setup(<BunproReviews initialMode="grammar" />);
  const input = await screen.findByLabelText("Your answer");
  expect(screen.getByText("Ghost review")).toBeVisible();
  expect(screen.getByText("Ghost 1")).toBeVisible();
  expect(screen.queryByText("Beginner 0")).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  const post = vi.mocked(bunpro).mock.calls.find(([, options]) => options?.method === "POST");
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ reviewId: "14273034", reviewType: "ghost_review" });
  expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
});

it("submits a normal review and a ghost with the same ID independently", async () => {
  vi.mocked(bunpro).mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") return { updated_review: { id: "10", type: "review", attributes: { streak: 8 } } };
    return { review_session_id: 1, pending_attempt: [item, { ...item, data: { ...item.data, type: "ghost_review" } }], pending_wrapup: [] };
  });
  const report = vi.fn();
  const reportResults = vi.fn();
  const reportBunproProgression = vi.fn();
  setup(<BunproReviews initialMode="grammar" mixed={{ active: true, report, reportResults, reportBunproProgression }} />);
  await screen.findByLabelText("Your answer");
  for (let i = 0; i < 2; i++) {
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next" })); });
  }
  await screen.findByText("Bunpro reviews complete");
  const posts = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(String(options?.body)));
  expect(posts).toHaveLength(2);
  expect(posts.map(post => post.reviewType).sort()).toEqual(["ghost_review", "review"]);
  expect(posts[0]).toMatchObject({ loadedIds: [10], loadedGhostIds: [10], loadedSelfStudyIds: [] });
  expect(report.mock.calls.map(([head]) => head?.id)).toEqual(expect.arrayContaining(["10", "ghost_review:10"]));
  expect(reportResults.mock.calls.at(-1)?.[0].items.map((result: { id: string }) => result.id).sort()).toEqual(["bunpro:10", "bunpro:ghost_review:10"]);
  expect(reportBunproProgression).toHaveBeenCalledTimes(1);
});
function setup(ui = <BunproReviews />) { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>); }
beforeEach(() => { vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: true, showAnswerStopSubjectDetails: false } }); vi.mocked(playAnswerFeedback).mockClear(); session.user.data.username = "Learner"; session.isDemo = false; vi.mocked(bunpro).mockReset().mockImplementation(async (query) => query === "action=connection" ? { connected: true } : query.startsWith("action=queue") ? { review_session_id: 1, pending_attempt: [item], pending_wrapup: [] } : {}); });
afterEach(cleanup);
async function start() { setup(); fireEvent.click(await screen.findByRole("button", { name: "Start reviews" })); await screen.findByLabelText("Your answer"); }
it.each([
  ["____犬(いぬ)は、____人(ひと)のです。", 2],
  ["＿＿犬(いぬ)は、＿＿人(ひと)のです。", 2],
  ["____犬(いぬ)は、＿＿人(ひと)のです。____", 3],
])("fills every repeated answer slot while typing and after checking: %s", async (content, slots) => {
  const repeatedItem = { ...item, included: item.included!.map((resource) => resource.type === "study_question" ? { ...resource, attributes: { content, answer: "あの" } } : resource) };
  vi.mocked(bunpro).mockImplementation(async (query) => query === "action=connection" ? { connected: true } : query.startsWith("action=queue") ? { review_session_id: 1, pending_attempt: [repeatedItem], pending_wrapup: [] } : {});
  await start();
  const prompt = screen.getByLabelText("Bunpro review");
  const input = screen.getByLabelText("Your answer");
  fireEvent.change(input, { target: { value: "a" } });
  expect(within(prompt).getAllByText("あ")).toHaveLength(slots);
  fireEvent.change(input, { target: { value: "ano" } });
  expect(within(prompt).getAllByText("あの")).toHaveLength(slots);
  expect(prompt).not.toHaveTextContent(/_{2,}|＿{2,}/);
  expect(Array.from(prompt.querySelectorAll("ruby rt"), (reading) => reading.textContent)).toEqual(["いぬ", "ひと"]);
  fireEvent.change(input, { target: { value: "" } });
  expect(within(prompt).queryAllByText("あの")).toHaveLength(0);
  fireEvent.change(input, { target: { value: "sono" } });
  expect(within(prompt).getAllByText("その")).toHaveLength(slots);
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(within(prompt).getAllByText("あの")).toHaveLength(slots);
  expect(within(prompt).queryAllByText("その")).toHaveLength(0);
  expect(prompt.querySelectorAll('[data-correct="false"]')).toHaveLength(slots);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(within(prompt).queryAllByText("あの")).toHaveLength(0);
  fireEvent.change(input, { target: { value: "ano" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(within(prompt).getAllByText("あの")).toHaveLength(slots);
  expect(prompt.querySelectorAll('[data-correct="true"]')).toHaveLength(slots);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(screen.getAllByText("あの")).toHaveLength(slots);
});
it.each([["Grammar", "grammar"], ["Vocabulary", "vocab"], ["Grammar & vocabulary", "all"]])("loads %s reviews", async (label, mode) => { setup(); fireEvent.click(screen.getByLabelText(label)); fireEvent.click(await screen.findByRole("button", { name: "Start reviews" })); await screen.findByLabelText("Your answer"); expect(bunpro).toHaveBeenCalledWith(`action=queue&mode=${mode}`); });
it("accepts alternate answers, converts kana, and saves only on Continue", async () => { await start(); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "da" } }); expect(screen.getByLabelText("Your answer")).toHaveValue("だ"); fireEvent.click(screen.getByRole("button", { name: "Check" })); expect(screen.getByText("Correct")).toBeVisible(); expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findByText("Bunpro reviews complete"); const call = vi.mocked(bunpro).mock.calls.find(([, options]) => options?.method === "POST"); expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ correct: true, sessionId: 1, reviewId: "10" }); });
it("gives an alternate-answer hint without marking incorrect", async () => { await start(); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "でした" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); expect(screen.getByText("Use the present tense.")).toBeVisible(); expect(screen.getByLabelText("Your answer").parentElement).toHaveAttribute("data-result", "warning"); expect(screen.getByText("Close — try another answer")).toBeVisible(); expect(screen.queryByText("Incorrect")).not.toBeInTheDocument(); });
it("repeats a missed item without submitting it twice", async () => { await start(); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "ちがう" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findAllByText("Retrying missed item"); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findByText("Bunpro reviews complete"); expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1); });
it("keeps the current answer when the API key is rejected", async () => { await start(); vi.mocked(bunpro).mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 })); fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "ちがう" } }); fireEvent.click(screen.getByRole("button", { name: "Check" })); fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ })); await screen.findByRole("alert"); expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled(); expect(screen.queryByRole("button", { name: "Continue without saving" })).not.toBeInTheDocument(); expect(screen.queryAllByText("Retrying missed item")).toHaveLength(0); });
it.each(["Learner", "demo-level-21"])("hides settings and the home button in demo mode for %s", (username) => { session.user.data.username = username; session.isDemo = true; setup(<><BunproSettings /><BunproHomeButton /></>); expect(screen.queryByText("Bunpro API key")).not.toBeInTheDocument(); expect(screen.queryByText("Bunpro reviews")).not.toBeInTheDocument(); expect(bunpro).not.toHaveBeenCalled(); });
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
  expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toHaveTextContent("Adept 1");
});
it("waits for the correct retry before showing the saved stage without resubmitting the review", async () => {
  vi.mocked(bunpro).mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (query.startsWith("action=queue")) return { review_session_id: 1, pending_attempt: [{ ...item, data: { ...item.data, attributes: { ...item.data.attributes, streak: 7 } } }], pending_wrapup: [] };
    if (options?.method === "POST") return { updated_review: { id: "10", type: "review", attributes: { streak: 6 } } };
    return {};
  });
  await start();
  for (const answer of ["ちがう", "ちがう", "です"]) {
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: answer } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^(Next|Next Question)$/ }));
    if (answer !== "です") {
      await waitFor(() => expect(screen.getByLabelText("Your answer")).not.toHaveAttribute("readonly"));
      expect(screen.getAllByText("Retrying missed item").length).toBeGreaterThan(0);
      expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
    }
  }
  await screen.findByText("Bunpro reviews complete");
  const notice = screen.getByRole("status", { name: "Bunpro SRS progression" });
  expect(notice).toHaveTextContent("Seasoned 1");
  expect(notice).toHaveTextContent("Adept 3");
  expect(notice).toHaveTextContent("SRS down");
  const posts = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST");
  expect(posts).toHaveLength(1);
  expect(JSON.parse(String(posts[0][1]?.body))).toMatchObject({ reviewId: "10", reviewableId: 20, correct: false });
});
it("finishes a saved answer without inventing a stage or showing the generic saved popup", async () => {
  await start();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
  expect(screen.queryByText("Review saved")).not.toBeInTheDocument();
});
it("respects the hidden progression preference when Bunpro returns an updated stage", async () => {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: true, srsProgressionCardDisplayMode: "hidden" } });
  await start();
  vi.mocked(bunpro).mockResolvedValueOnce({ updated_review: { id: "10", type: "review", attributes: { streak: 4 } } });
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
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
it("respects disabled feedback sounds and does not retry an authentication failure automatically", async () => {
  vi.mocked(useWebSettings).mockReturnValue({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: false, answerFeedbackSoundEnabled: false, autoplayAudio: false } });
  await start();
  vi.mocked(bunpro).mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("alert");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 450)); });
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  expect(playAnswerFeedback).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
});

it("keeps cards hidden when the key is absent or revoked", async () => {
  vi.mocked(bunpro).mockResolvedValue({ connected: false });
  setup(<BunproHomeButton />);
  await waitFor(() => expect(bunpro).toHaveBeenCalled());
  expect(screen.queryByRole("region", { name: "Bunpro study" })).not.toBeInTheDocument();
  expect(vi.mocked(bunpro).mock.calls).toHaveLength(1);
});
it("keeps missed lessons unsaved until a correct retry completes them", async () => {
  setup(<BunproReviews lessonSession={{ review_session_id: 9, pending_attempt: [item], pending_wrapup: [], total_pending_attempt_count: 1, total_pending_wrapup_count: 0 }} />);
  for (let attempt = 0; attempt < 2; attempt++) {
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "違う" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next" })); });
    expect(screen.getByRole("progressbar", { name: "Review progress" })).toHaveAttribute("aria-valuenow", "0");
    expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  }
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Lesson quiz complete");
  const submissions = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST");
  expect(submissions).toHaveLength(1);
  expect(JSON.parse(String(submissions[0][1]?.body))).toMatchObject({ correct: true, context: "learn", sessionId: 9, reviewId: "10" });
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
it("restores an unsaved answer on authentication failure and preserves typing in the next question for retry", async () => {
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
  await act(async () => { fail(Object.assign(new Error("Unauthorized"), { status: 401 })); });
  expect(screen.getByRole("alert")).toHaveTextContent("API key was rejected");
  expect(screen.getByLabelText("Your answer")).toHaveValue("です");
  expect(reportError).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Check" })).toBeEnabled());
  expect(screen.getByLabelText("Your answer")).toHaveValue("だ");
  expect(attempts).toBe(2);
});

it("shows a delayed save failure and preserves the next draft when the user chooses to continue", async () => {
  let fail!: (error: Error) => void;
  const reportError = vi.fn();
  const reportResults = vi.fn();
  const second = { ...item, data: { ...item.data, id: "11" } };
  vi.mocked(bunpro).mockImplementation(async (query, options) => options?.method === "POST" ? new Promise((_, reject) => { fail = reject; }) : query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [item, second] });
  setup(<BunproReviews initialMode="grammar" mixed={{ active: true, report: vi.fn(), reportError, reportResults }} />);
  fireEvent.change(await screen.findByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  const nextInput = screen.getByLabelText("Your answer");
  fireEvent.change(nextInput, { target: { value: "だ" } });
  await act(async () => { fail(new Error("Bunpro request failed (500).")); });
  expect(screen.getByRole("alert")).toHaveTextContent("Bunpro request failed (500).");
  expect(screen.getByLabelText("Your answer")).toHaveValue("です");
  expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(reportError).toHaveBeenLastCalledWith(true);
  expect(reportResults.mock.calls.at(-1)?.[0].items).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Continue without saving" }));
  await waitFor(() => expect(screen.getByLabelText("Your answer")).toHaveValue("だ"));
  expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  expect(reportError).toHaveBeenLastCalledWith(false);
  expect(reportResults.mock.calls.at(-1)?.[0].items).toEqual([expect.objectContaining({ correct: true, saveFailed: true, stage: undefined })]);
  expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

it("finishes only after the user continues past a save failure and marks the answer as unconfirmed", async () => {
  await start();
  vi.mocked(bunpro).mockRejectedValueOnce(new Error("Bunpro request failed (500)."));
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Bunpro request failed (500).");
  expect(screen.queryByText("Bunpro reviews complete")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Your answer")).toHaveValue("です");
  fireEvent.click(screen.getByRole("button", { name: "Continue without saving" }));
  await screen.findByText("Bunpro reviews complete");
  expect(screen.getByText(/could not confirm saving 1 answer/)).toBeVisible();
  expect(screen.getByText("Save not confirmed")).toBeVisible();
  expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

it("retries a failed save explicitly and records one confirmed result after success", async () => {
  await start();
  vi.mocked(bunpro)
    .mockRejectedValueOnce(new Error("Bunpro request failed (500)."))
    .mockResolvedValueOnce({ updated_review: { id: "10", type: "review", attributes: { streak: 4 } } });
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Bunpro request failed (500).");
  expect(screen.getByRole("button", { name: "Continue without saving" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));

  await screen.findByText("Bunpro reviews complete");
  expect(screen.getByLabelText("1 correct and 0 missed")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Continue without saving" })).not.toBeInTheDocument();
  expect(screen.queryByText(/could not confirm saving/)).not.toBeInTheDocument();
  expect(screen.queryByText("Save not confirmed")).not.toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toHaveTextContent("Adept 1");
  const posts = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(String(options?.body)));
  expect(posts).toHaveLength(2);
  expect(posts[1]).toEqual(posts[0]);
  expect(posts[1]).toMatchObject({ reviewId: "10", correct: true });
});

it("requires an explicit choice after a self-assessed answer fails to save", async () => {
  studySettings({ ankiMode: "reading" });
  setup(<BunproReviews initialMode="grammar" />);
  fireEvent.click(await screen.findByRole("button", { name: "Reveal answer" }));
  vi.mocked(bunpro).mockRejectedValueOnce(new Error("Bunpro request failed (500)."));
  fireEvent.click(screen.getByRole("button", { name: "Correct" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Bunpro request failed (500).");
  expect(screen.getByLabelText("Bunpro review")).toHaveTextContent("です");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByText("Bunpro reviews complete")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Continue without saving" }));

  await screen.findByText("Bunpro reviews complete");
  expect(screen.getByLabelText("1 correct and 0 missed")).toBeVisible();
  expect(screen.getByText("Save not confirmed")).toBeVisible();
  const posts = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST");
  expect(posts).toHaveLength(1);
  expect(JSON.parse(String(posts[0][1]?.body))).toMatchObject({ reviewId: "10", correct: true });
});

it("waits for an explicit choice after a save failure even when answers advance automatically", async () => {
  studySettings({ pauseOnCorrect: false, pauseOnWrong: false, answerStopBehavior: "never" });
  await start();
  vi.mocked(bunpro).mockRejectedValueOnce(new Error("Bunpro request failed (500)."));
  vi.useFakeTimers();
  try {
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(screen.getByRole("alert")).toHaveTextContent("Bunpro request failed (500).");
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });

    expect(screen.getByLabelText("Your answer")).toHaveValue("です");
    expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue without saving" })).toBeEnabled();
    expect(screen.queryByText("Bunpro reviews complete")).not.toBeInTheDocument();
    expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Continue without saving" })); });

    expect(screen.getByText("Bunpro reviews complete")).toBeVisible();
    expect(screen.getByText("Save not confirmed")).toBeVisible();
    expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});

it("keeps the first wrong grade after a failed save without submitting the practice retry", async () => {
  await start();
  vi.mocked(bunpro).mockRejectedValueOnce(new TypeError("Failed to fetch"));
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "ちがう" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Continue without saving" }));
  await screen.findByText("Retrying missed item");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(screen.getByText(/could not confirm saving 1 answer/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(screen.getByLabelText("0 correct and 1 missed")).toBeVisible();
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

it.each([2, 3])("excludes an unconfirmed answer when refilling a queue with %s pending reviews", async (pendingTotal) => {
  let pages = 0;
  let posts = 0;
  const second = { ...item, data: { ...item.data, id: "11" } };
  vi.mocked(bunpro).mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") {
      if (++posts === 1) throw new Error("Bunpro request failed (500).");
      return {};
    }
    pages++;
    return { review_session_id: pages, pending_attempt: pages === 1 ? [item] : pages === 2 ? [item, second] : [item], total_pending_attempt_count: pages <= 2 ? pendingTotal : 1 };
  });
  setup(<BunproReviews initialMode="grammar" />);
  for (let i = 0; i < 2; i++) {
    fireEvent.change(await screen.findByLabelText("Your answer"), { target: { value: "です" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    if (!i) {
      fireEvent.click(await screen.findByRole("button", { name: "Continue without saving" }));
      await waitFor(() => expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1"));
    }
  }
  await screen.findByText("Bunpro reviews complete");
  expect(posts).toBe(2);
  expect(screen.getByText(/could not confirm saving 1 answer/)).toBeVisible();
});

it("starts a fresh failure count when a new standalone review session begins", async () => {
  const second = { ...item, data: { ...item.data, id: "11" } };
  vi.mocked(bunpro).mockImplementation(async (query, options) => {
    if (options?.method === "POST") throw new Error("Bunpro request failed (500).");
    return query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [item, second] };
  });
  await start();
  for (let i = 0; i < 2; i++) {
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continue without saving" }));
    if (!i) await waitFor(() => expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1"));
  }
  await screen.findByText("Bunpro reviews complete");
  fireEvent.click(screen.getByRole("button", { name: "Check for more" }));
  fireEvent.click(screen.getByRole("button", { name: "Start reviews" }));
  fireEvent.change(await screen.findByLabelText("Your answer"), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Continue without saving" }));
  await waitFor(() => expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});


it("changes settings without restarting Bunpro or losing its answer", async () => {
  const actual = await vi.importActual<typeof import("@/features/settings/use-workspace-preferences")>("@/features/settings/use-workspace-preferences");
  vi.mocked(useWebSettings).mockImplementation(actual.useWebSettings);
  saveWebSettings(localStorage, "Learner", { ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, pauseOnCorrect: true, showAnswerStopSubjectDetails: false, autoplayAudio: false } });
  await start();
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "desu" } });
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  fireEvent.change(screen.getByLabelText("Review subject order"), { target: { value: "lowestLevelFirst" } });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByLabelText("Your answer")).toHaveValue("です");
  expect(vi.mocked(bunpro).mock.calls.filter(([query]) => query.startsWith("action=queue"))).toHaveLength(1);
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  fireEvent.change(screen.getByLabelText("Anki mode"), { target: { value: "both" } });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByText("Correct", { exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Bunpro reviews complete");
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  localStorage.clear();
});


it("reports all pending Bunpro reviews when only part of the queue is loaded", async () => {
  vi.mocked(bunpro).mockImplementation(async (query) => query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [item], pending_wrapup: [], total_pending_attempt_count: 8 });
  const report = vi.fn();
  setup(<BunproReviews initialMode="grammar" mixed={{ active: true, report }} />);
  await screen.findByLabelText("Your answer");
  expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ source: "bunpro", remaining: 8 }));
});


it("retries a missed Bunpro question within 2–10 questions without resubmitting it", async () => {
  const items = Array.from({ length: 20 }, (_, index) => ({ ...item, data: { ...item.data, id: String(10 + index), attributes: { ...item.data.attributes, id: 10 + index } } }));
  vi.mocked(bunpro).mockImplementation(async (query, options) => query === "action=connection" ? { connected: true } : options?.method === "POST" ? {} : { review_session_id: 1, pending_attempt: items, pending_wrapup: [] });
  const report = vi.fn();
  setup(<BunproReviews initialMode="grammar" mixed={{ active: true, report }} />);
  await screen.findByLabelText("Your answer");
  const missed = report.mock.calls.at(-1)?.[0].id;
  const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
  try {
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next" })); });
    let gap = 0;
    while (report.mock.calls.at(-1)?.[0]?.id !== missed && gap <= 10) {
      fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "です" } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next" })); });
      gap++;
    }
    expect(gap).toBeGreaterThanOrEqual(2);
    expect(gap).toBeLessThanOrEqual(10);
    expect(report.mock.calls.at(-1)?.[0]?.id).toBe(missed);
    expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST" && JSON.parse(String(options.body)).reviewId === missed)).toHaveLength(1);
  } finally { random.mockRestore(); }
});


it("keeps a promoted mixed retry in place when a background Bunpro save finishes", async () => {
  let resolveSave!: (value: unknown) => void;
  const save = new Promise(resolve => { resolveSave = resolve; });
  const items = Array.from({ length: 4 }, (_, index) => ({ ...item, data: { ...item.data, id: String(10 + index), attributes: { ...item.data.attributes, id: 10 + index } } }));
  vi.mocked(bunpro).mockImplementation(async (query, options) => query === "action=connection" ? { connected: true } : options?.method === "POST" ? save : { review_session_id: 1, pending_attempt: items, pending_wrapup: [] });
  const report = vi.fn();
  setup(<BunproReviews initialMode="grammar" mixed={{ active: true, report }} />);
  await screen.findByLabelText("Your answer");
  const missed = report.mock.calls.at(-1)?.[0].id;
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(report.mock.calls.at(-1)?.[0]?.id).not.toBe(missed));
  act(() => { report.mock.calls.at(-1)?.[0].activate(missed); });
  expect(report.mock.calls.at(-1)?.[0]?.id).toBe(missed);
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "で" } });
  await act(async () => { resolveSave({}); });
  expect(report.mock.calls.at(-1)?.[0]?.id).toBe(missed);
  expect(screen.getByLabelText("Your answer")).toHaveValue("で");
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});


it.each(["ちあん", "です"])("shows finalized kana after checking a Bunpro answer against %s", async expected => {
  const questionItem = { ...item, included: item.included!.map(resource => resource.type === "study_question" ? { ...resource, attributes: { ...resource.attributes, answer: expected } } : resource) };
  vi.mocked(bunpro).mockImplementation(async query => query === "action=connection" ? { connected: true } : { review_session_id: 1, pending_attempt: [questionItem], pending_wrapup: [] });
  await start();
  const input = screen.getByLabelText("Your answer");
  fireEvent.change(input, { target: { value: "chian" } });
  expect(input).toHaveValue("ちあn");
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(input).toHaveValue("ちあん");
  expect(screen.getByText(expected === "ちあん" ? "Correct" : "Incorrect", { exact: true })).toBeVisible();
});
