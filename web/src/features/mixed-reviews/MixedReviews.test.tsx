import { useEffect, useEffectEvent, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MixedPreviousBadge } from "./MixedPreviousBadge";
import { MixedReviews } from "./MixedReviews";
import type { MixedBridge } from "./ordering";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import { bunpro } from "@/features/bunpro/client";
import { BunproProgression } from "@/features/bunpro/BunproProgression";
vi.mock("@/lib/session", () => ({ useSession: () => ({ user: { data: { username: "Learner" } }, isDemo: false }) }));
vi.mock("@/features/settings/use-workspace-preferences", () => ({ useWebSettings: () => ({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "ascendingSrsStage", autoplayAudio: false, answerFeedbackSoundEnabled: false, showAnswerStopSubjectDetails: false } }) }));
vi.mock("@/features/study/feedback-audio", () => ({ playAnswerFeedback: vi.fn() }));
vi.mock("@/features/core-study/CoreStudySession", () => ({ CoreStudySession: ({ mixed }: { mixed: MixedBridge }) => {
  const [step, setStep] = useState(0);
  const report = useEffectEvent(() => { mixed.reportResults?.({ items: Array.from({ length: step }, (_, i) => ({ id: `wk-result-${i}`, source: "wanikani", kind: "kanji", title: `川${i + 1}`, meaning: "River", correct: true, href: `/subjects/${i + 1}` })), durationMs: 10000, pendingCount: step === 2 ? 1 : 0 }); mixed.reportProgress?.({ completed: step, total: 2 }); mixed.report(step === 2 ? null : { id: `wk-${step}`, source: "wanikani", stage: 1, level: 1, available: 0, interval: 1, subjectType: "kanji", remaining: 2 - step }); });
  useEffect(() => { report(); }, [step]);
  return <>{mixed.active ? <MixedPreviousBadge answer={mixed.previous} animate={false} /> : null}<BunproProgression progression={mixed.bunproProgression ?? null} mode="normal" /><button onClick={() => { mixed.onAnswer?.({ id: `wk-${step}`, source: "wanikani", title: "川", correct: true }); setStep(step + 1); }}>{step === 2 ? "WK complete" : `Complete WK question ${step + 1}`}</button></>;
} }));
vi.mock("@/features/bunpro/client", () => ({ bunpro: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
it("interleaves both Bunpro queues and keeps each session's submission independent", async () => {
  let releaseQueues!: () => void;
  const queuesReady = new Promise<void>((resolve) => { releaseQueues = resolve; });
  vi.mocked(bunpro).mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      return { review: { data: { attributes: { streak: body.mode === "grammar" ? 3 : 4 } } } };
    }
    await queuesReady;
    const grammar = query.includes("grammar");
    const id = grammar ? "10" : "11";
    const kind = grammar ? "grammar_point" : "vocab";
    return { review_session_id: grammar ? 101 : 102, total_pending_attempt_count: 1, total_pending_wrapup_count: 0, pending_wrapup: [], pending_attempt: [{ data: { id, type: "review", attributes: { id: Number(id), ghost_count: 0, streak: grammar ? 2 : 3, reviewable_type: grammar ? "GrammarPoint" : "Vocab" }, relationships: { study_question: { data: { id: "30", type: "study_question" } }, reviewable: { data: { id: "20", type: kind } } } }, included: [{ id: "30", type: "study_question", attributes: { content: "これは____。", answer: grammar ? "です" : "ねこ" } }, { id: "20", type: kind, attributes: { title: grammar ? "です" : "猫", slug: grammar ? "desu" : "neko" } }] }] };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MixedReviews mode="all" /></QueryClientProvider>);
  await screen.findByRole("status", { name: "Loading mixed reviews" });
  expect(screen.queryByRole("button", { name: "Complete WK question 1" })).not.toBeInTheDocument();
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  releaseQueues();
  await screen.findByRole("button", { name: "Complete WK question 1" });
  random.mockReturnValue(0.6);
  fireEvent.click(screen.getByRole("button", { name: "Complete WK question 1" }));
  random.mockReturnValue(0);
  expect(screen.queryByRole("navigation", { name: "Active review service" })).not.toBeInTheDocument();
  expect(await screen.findByLabelText("Previous WaniKani answer: 川, correct")).toBeVisible();
  for (const answer of ["です", "ねこ"]) {
    await waitFor(() => expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "4"));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", answer === "です" ? "1" : "3");
    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: answer } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    if (answer === "です") {
      await screen.findByRole("button", { name: "Complete WK question 2" });
      expect(screen.getByLabelText("Previous Bunpro answer: です, correct")).toBeVisible();
      expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toHaveTextContent("Beginner 2");
      expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toHaveTextContent("Beginner 3");
      fireEvent.click(screen.getByRole("button", { name: "Complete WK question 2" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Check" })).toBeVisible());
      expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
    }
  }
  await screen.findByRole("heading", { name: "Mixed reviews complete" });
  expect(screen.getByText("4 subjects reviewed · 10s")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open です details" })).toHaveAttribute("href", "/bunpro/grammar/desu");
  expect(screen.getByRole("link", { name: "Open 猫 details" })).toHaveAttribute("href", "/bunpro/vocab/neko");
  expect(screen.getByRole("link", { name: "Open 川1 details" })).toHaveAttribute("href", "/subjects/1");
  expect(screen.queryByRole("heading", { name: "Bunpro reviews complete" })).not.toBeInTheDocument();
  expect(screen.getByText(/1 WaniKani submission/)).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toHaveTextContent("Adept 1");
  expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toBeVisible();
  const posts = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(String(options?.body)));
  expect(posts).toHaveLength(2);
  expect(posts[0]).toMatchObject({ reviewId: "10", sessionId: 101, mode: "grammar", correct: true });
  expect(posts[1]).toMatchObject({ reviewId: "11", sessionId: 102, mode: "vocab", correct: true });
});

it("shows a missed Bunpro item's saved stage only after its correct retry, across Bunpro lanes, then expires", async () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0.6);
  vi.mocked(bunpro).mockReset().mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") return { review: { data: { attributes: { streak: 2 } } } };
    const grammar = query.includes("grammar");
    const id = grammar ? "10" : "11";
    const kind = grammar ? "grammar_point" : "vocab";
    return { review_session_id: grammar ? 101 : 102, total_pending_attempt_count: 1, pending_wrapup: [], pending_attempt: [{ data: { id, type: "review", attributes: { id: Number(id), ghost_count: 0, streak: 3, reviewable_type: grammar ? "GrammarPoint" : "Vocab" }, relationships: { study_question: { data: { id: "30", type: "study_question" } }, reviewable: { data: { id: "20", type: kind } } } }, included: [{ id: "30", type: "study_question", attributes: { content: "これは____。", answer: grammar ? "です" : "ねこ" } }, { id: "20", type: kind, attributes: { title: grammar ? "です" : "猫", slug: grammar ? "desu" : "neko" } }] }] };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MixedReviews mode="all" /></QueryClientProvider>);
  fireEvent.change(await screen.findByRole("textbox", { name: "Your answer" }), { target: { value: "ちがう" } });
  random.mockReturnValue(0);
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Complete WK question 1" }));
  fireEvent.click(await screen.findByRole("button", { name: "Complete WK question 2" }));
  await screen.findAllByText("Retrying missed item");
  expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();

  random.mockReturnValue(0.9);
  vi.useFakeTimers();
  fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next" })); });
  expect(screen.getByLabelText("Previous Bunpro answer: です, correct")).toBeVisible();
  expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toHaveTextContent("Beginner 3");
  expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toHaveTextContent("Beginner 2");
  expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toHaveTextContent("SRS down");
  expect(screen.getByRole("status", { name: "Bunpro SRS progression" })).toBeVisible();
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
  expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
});

it("ignores a delayed Bunpro progression once a later WaniKani answer has been completed", async () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  let resolveSubmission!: (response: unknown) => void;
  const submission = new Promise((resolve) => { resolveSubmission = resolve; });
  vi.mocked(bunpro).mockReset().mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") return submission;
    return { review_session_id: 101, total_pending_attempt_count: 2, pending_wrapup: [], pending_attempt: ["10", "11"].map(id => ({ data: { id, type: "review", attributes: { id: Number(id), ghost_count: 0, streak: 2, reviewable_type: "GrammarPoint" }, relationships: { study_question: { data: { id: "30", type: "study_question" } }, reviewable: { data: { id: "20", type: "grammar_point" } } } }, included: [{ id: "30", type: "study_question", attributes: { content: "これは____。", answer: "です" } }, { id: "20", type: "grammar_point", attributes: { title: "です", slug: "desu" } }] })) };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MixedReviews mode="grammar" /></QueryClientProvider>);
  await screen.findByRole("button", { name: "Complete WK question 1" });
  random.mockReturnValue(0.6);
  fireEvent.click(screen.getByRole("button", { name: "Complete WK question 1" }));
  random.mockReturnValue(0);
  fireEvent.change(await screen.findByRole("textbox", { name: "Your answer" }), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Complete WK question 2" }));
  expect(await screen.findByLabelText("Previous WaniKani answer: 川, correct")).toBeVisible();
  const post = vi.mocked(bunpro).mock.calls.find(([, options]) => options?.method === "POST");
  const submittedId = JSON.parse(String(post?.[1]?.body)).reviewId;
  await act(async () => { resolveSubmission({ updated_review: { data: { id: submittedId, type: "review", attributes: { streak: 3 } } } }); });
  fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "です" } });
  expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
  expect(screen.getByLabelText("Previous WaniKani answer: 川, correct")).toBeVisible();
  expect(screen.queryByRole("status", { name: "Bunpro SRS progression" })).not.toBeInTheDocument();
});

it("shows an isolated Bunpro save error and continues mixed reviews only when requested", async () => {
  const random = vi.spyOn(Math, "random").mockReturnValue(0);
  let rejectSubmission!: (error: Error) => void;
  const submission = new Promise((_, reject) => { rejectSubmission = reject; });
  vi.mocked(bunpro).mockReset().mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") return submission;
    return { review_session_id: 101, total_pending_attempt_count: 2, pending_wrapup: [], pending_attempt: ["10", "11"].map(id => ({ data: { id, type: "review", attributes: { id: Number(id), ghost_count: 0, streak: 2, reviewable_type: "GrammarPoint" }, relationships: { study_question: { data: { id: "30", type: "study_question" } }, reviewable: { data: { id: "20", type: "grammar_point" } } } }, included: [{ id: "30", type: "study_question", attributes: { content: "これは____。", answer: "です" } }, { id: "20", type: "grammar_point", attributes: { title: "です", slug: "desu" } }] })) };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MixedReviews mode="grammar" /></QueryClientProvider>);
  await screen.findByRole("button", { name: "Complete WK question 1" });
  random.mockReturnValue(0.6);
  fireEvent.click(screen.getByRole("button", { name: "Complete WK question 1" }));
  random.mockReturnValue(0);
  fireEvent.change(await screen.findByRole("textbox", { name: "Your answer" }), { target: { value: "です" } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("button", { name: "Complete WK question 2" });
  await act(async () => { rejectSubmission(new Error("Bunpro request failed (500).")); });

  expect(await screen.findByRole("alert")).toHaveTextContent("Bunpro request failed (500).");
  expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("です");
  expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Complete WK question 2" })).not.toBeInTheDocument();

  await continueMixedWithoutSaving();

  expect(screen.getByRole("button", { name: "Complete WK question 2" })).toBeVisible();
  expect(screen.getByText(/could not confirm saving 1 answer/)).toBeVisible();
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

function mockMixedSaveResults(results: Array<"saved" | "failed" | 401 | 403>) {
  let postIndex = 0;
  vi.spyOn(Math, "random").mockReturnValue(0.9);
  vi.mocked(bunpro).mockReset().mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") {
      const result = results[postIndex++];
      if (result === "failed") throw new Error("Bunpro request failed (500).");
      if (typeof result === "number") throw Object.assign(new Error("Bunpro rejected this API key."), { status: result });
      return { review: { data: { attributes: { streak: 4 } } } };
    }
    const grammar = query.includes("grammar");
    const kind = grammar ? "grammar_point" : "vocab";
    const answers = grammar ? ["です", "ます", "ある", "いる"] : ["ねこ", "いぬ", "とり", "うし"];
    return {
      review_session_id: grammar ? 101 : 102,
      total_pending_attempt_count: answers.length,
      pending_wrapup: [],
      pending_attempt: answers.map((answer, index) => {
        const id = String((grammar ? 10 : 20) + index);
        return {
          data: { id, type: "review", attributes: { id: Number(id), ghost_count: 0, streak: index + 1, reviewable_type: grammar ? "GrammarPoint" : "Vocab" }, relationships: { study_question: { data: { id: `question-${id}`, type: "study_question" } }, reviewable: { data: { id: `subject-${id}`, type: kind } } } },
          included: [{ id: `question-${id}`, type: "study_question", attributes: { content: "これは____。", answer } }, { id: `subject-${id}`, type: kind, attributes: { title: answer, slug: `subject-${id}` } }],
        };
      }),
    };
  });
}

async function submitMixedBunproAnswer(answer: string) {
  fireEvent.change(await screen.findByRole("textbox", { name: "Your answer" }), { target: { value: answer } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  vi.mocked(Math.random).mockReturnValue(["ねこ", "いぬ", "とり", "うし"].includes(answer) ? 0.5 : 0.99);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next" })); });
}

async function continueMixedWithoutSaving() {
  const postsBefore = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST").length;
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Continue without saving" })); });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(postsBefore);
}

it("removes the continue option on the third failed save across both Bunpro lanes and preserves the answer for retry", async () => {
  mockMixedSaveResults(["failed", "failed", "failed", "saved"]);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MixedReviews mode="all" /></QueryClientProvider>);

  for (const answer of ["ねこ", "です"]) {
    await submitMixedBunproAnswer(answer);
    expect(screen.getByRole("alert")).toHaveTextContent("Bunpro request failed (500).");
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue(answer);
    expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
    await continueMixedWithoutSaving();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  }
  expect(screen.getByText(/could not confirm saving 2 answers/)).toBeVisible();

  await submitMixedBunproAnswer("いぬ");

  expect(await screen.findByRole("alert")).toHaveTextContent("paused after 3 consecutive save failures");
  expect(screen.getByRole("alert")).toHaveTextContent("Your current answer is kept on screen.");
  expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("いぬ");
  expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveAttribute("readonly");
  expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Continue without saving" })).not.toBeInTheDocument();
  const postsBeforeRetry = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(String(options?.body)));
  expect(postsBeforeRetry.map(post => post.mode)).toEqual(["vocab", "grammar", "vocab"]);
  expect(postsBeforeRetry.map(post => post.reviewId)).toEqual(["20", "10", "21"]);

  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry save" })); });

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  const postsAfterRetry = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(String(options?.body)));
  expect(postsAfterRetry).toHaveLength(4);
  expect(postsAfterRetry[3]).toMatchObject({ reviewId: "21", mode: "vocab", correct: true });
});

it.each([401, 403] as const)("pauses immediately for HTTP %i while keeping the submitted mixed answer visible", async (status) => {
  mockMixedSaveResults([status]);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MixedReviews mode="all" /></QueryClientProvider>);

  await submitMixedBunproAnswer("ねこ");

  expect(await screen.findByRole("alert")).toHaveTextContent("API key was rejected");
  expect(screen.getByRole("alert")).toHaveTextContent("Settings");
  expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("ねこ");
  expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Continue without saving" })).not.toBeInTheDocument();
  expect(vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

it("resets consecutive failures for both Bunpro lanes when either lane saves successfully", async () => {
  mockMixedSaveResults(["failed", "failed", "saved", "failed", "failed", "failed"]);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MixedReviews mode="all" /></QueryClientProvider>);

  for (const answer of ["ねこ", "です", "いぬ", "ます", "とり"]) {
    await submitMixedBunproAnswer(answer);
    if (answer !== "いぬ") {
      expect(screen.getByRole("alert")).toHaveTextContent("Bunpro request failed (500).");
      expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue(answer);
      await continueMixedWithoutSaving();
    }
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  }
  expect(screen.getByText(/could not confirm saving 4 answers/)).toBeVisible();

  await submitMixedBunproAnswer("ある");

  expect(await screen.findByRole("alert")).toHaveTextContent("paused after 3 consecutive save failures");
  expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("ある");
  expect(screen.queryByRole("button", { name: "Continue without saving" })).not.toBeInTheDocument();
  const posts = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(String(options?.body)));
  expect(posts.map(post => post.mode)).toEqual(["vocab", "grammar", "vocab", "grammar", "vocab", "grammar"]);
  expect(posts.map(post => post.correct)).toEqual([true, true, true, true, true, true]);
});
