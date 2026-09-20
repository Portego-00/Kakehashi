import { useEffect, useEffectEvent, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MixedPreviousBadge } from "./MixedPreviousBadge";
import { MixedReviews } from "./MixedReviews";
import type { MixedBridge } from "./ordering";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import { bunpro } from "@/features/bunpro/client";
vi.mock("@/lib/session", () => ({ useSession: () => ({ user: { data: { username: "Portego" } }, isDemo: false }) }));
vi.mock("@/features/settings/use-workspace-preferences", () => ({ useWebSettings: () => ({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "ascendingSrsStage", autoplayAudio: false, answerFeedbackSoundEnabled: false, showAnswerStopSubjectDetails: false } }) }));
vi.mock("@/features/study/feedback-audio", () => ({ playAnswerFeedback: vi.fn() }));
vi.mock("@/features/core-study/CoreStudySession", () => ({ CoreStudySession: ({ mixed }: { mixed: MixedBridge }) => {
  const [step, setStep] = useState(0);
  const report = useEffectEvent(() => { mixed.reportProgress?.({ completed: step, total: 2 }); mixed.report(step === 2 ? null : { id: `wk-${step}`, source: "wanikani", stage: 1, level: 1, available: 0, interval: 1, subjectType: "kanji" }); });
  useEffect(() => { report(); }, [step]);
  return <>{mixed.active ? <MixedPreviousBadge answer={mixed.previous} animate={false} /> : null}<button onClick={() => { mixed.onAnswer?.({ id: `wk-${step}`, source: "wanikani", title: "川", correct: true }); setStep(step + 1); }}>{step === 2 ? "WK complete" : `Complete WK question ${step + 1}`}</button></>;
} }));
vi.mock("@/features/bunpro/client", () => ({ bunpro: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("interleaves both Bunpro queues and keeps each session's submission independent", async () => {
  let releaseQueues!: () => void;
  const queuesReady = new Promise<void>((resolve) => { releaseQueues = resolve; });
  vi.mocked(bunpro).mockImplementation(async (query, options) => {
    if (query === "action=connection") return { connected: true };
    if (options?.method === "POST") return {};
    await queuesReady;
    const grammar = query.includes("grammar");
    const id = grammar ? "10" : "11";
    const kind = grammar ? "grammar_point" : "vocab";
    return { review_session_id: grammar ? 101 : 102, total_pending_attempt_count: 1, total_pending_wrapup_count: 0, pending_wrapup: [], pending_attempt: [{ data: { id, type: "review", attributes: { id: Number(id), streak: grammar ? 2 : 3, reviewable_type: grammar ? "GrammarPoint" : "Vocab" }, relationships: { study_question: { data: { id: "30", type: "study_question" } }, reviewable: { data: { id: "20", type: kind } } } }, included: [{ id: "30", type: "study_question", attributes: { content: "これは____。", answer: grammar ? "です" : "ねこ" } }, { id: "20", type: kind, attributes: { title: grammar ? "です" : "猫", slug: grammar ? "desu" : "neko" } }] }] };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MixedReviews mode="all" /></QueryClientProvider>);
  await screen.findByRole("status", { name: "Loading mixed reviews" });
  expect(screen.queryByRole("button", { name: "Complete WK question 1" })).not.toBeInTheDocument();
  vi.spyOn(Math, "random").mockReturnValue(0);
  releaseQueues();
  fireEvent.click(await screen.findByRole("button", { name: "Complete WK question 1" }));
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
      fireEvent.click(screen.getByRole("button", { name: "Complete WK question 2" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Check" })).toBeVisible());
    }
  }
  await screen.findByRole("heading", { name: "Mixed reviews complete" });
  const posts = vi.mocked(bunpro).mock.calls.filter(([, options]) => options?.method === "POST").map(([, options]) => JSON.parse(String(options?.body)));
  expect(posts).toHaveLength(2);
  expect(posts[0]).toMatchObject({ reviewId: "10", sessionId: 101, mode: "grammar", correct: true });
  expect(posts[1]).toMatchObject({ reviewId: "11", sessionId: 102, mode: "vocab", correct: true });
});
