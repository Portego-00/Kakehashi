import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { hasIncompleteReviewPairs, REVIEW_LEAVE_TITLE, ReviewNavigationGuardHost, useReviewLeaveGuard } from "./use-review-leave-guard";

function Harness({ partial = true, navigate = () => {} }: { partial?: boolean; navigate?: () => void }) {
  const guard = useReviewLeaveGuard(partial);
  return <>
    <ReviewNavigationGuardHost />
    <button onClick={() => guard.requestLeave(navigate)}>Exit reviews</button>
    <a href="/dashboard" onClick={(event) => { event.preventDefault(); navigate(); }}><span>Dashboard</span></a>
    <a href="#help" onClick={(event) => event.preventDefault()}>Question help</a>
    <a href="/subjects/1" target="_blank" onClick={(event) => event.preventDefault()}>Open subject</a>
    <a href="/export" download onClick={(event) => event.preventDefault()}>Download</a>
    {guard.isLeaveDialogOpen ? <div role="dialog" aria-label={REVIEW_LEAVE_TITLE}>
      <button onClick={guard.cancelLeave}>Keep reviewing</button>
      <button onClick={guard.confirmLeave}>Leave reviews</button>
    </div> : null}
  </>;
}

function subject(object: Subject["object"], readings = true): Subject {
  return { id: 1, object, url: "", data_updated_at: "", data: { level: 1, created_at: "", slug: "字", document_url: "", hidden_at: null, characters: "字", meanings: [], auxiliary_meanings: [], ...(readings ? { readings: [{ reading: "じ", primary: true, accepted_answer: true }] } : {}) } };
}
const assignment: Assignment = { id: 11, object: "assignment", url: "", data_updated_at: "", data: { subject_id: 1, subject_type: "kanji", srs_stage: 1, available_at: "2020-01-01", started_at: "2020-01-01", unlocked_at: "2020-01-01", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "" } };

describe("incomplete review pairs", () => {
  it.each(["kanji", "vocabulary"] as const)("warns on either completed half of a %s pair", (object) => {
    const questions = [{ assignment, subject: subject(object) }];
    expect(hasIncompleteReviewPairs(questions, { 11: ["meaning"] })).toBe(true);
    expect(hasIncompleteReviewPairs(questions, { 11: ["reading"] })).toBe(true);
    expect(hasIncompleteReviewPairs(questions, {})).toBe(false);
    expect(hasIncompleteReviewPairs(questions, { 11: ["meaning", "reading"] })).toBe(false);
  });

  it("does not treat meaning-only items or another assignment's progress as partial", () => {
    for (const item of [subject("radical"), subject("kana_vocabulary"), subject("vocabulary", false), { ...subject("vocabulary"), data: { ...subject("vocabulary").data, readings: [] } }]) {
      expect(hasIncompleteReviewPairs([{ assignment, subject: item }], { 11: ["meaning"] })).toBe(false);
    }
    expect(hasIncompleteReviewPairs([{ assignment, subject: subject("kanji") }], { 12: ["meaning"] })).toBe(false);
  });
});

describe("review leave guard", () => {
  beforeEach(() => window.history.replaceState({ review: true }, "", "/reviews"));
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("leaves immediately without partial pairs and does not add history entries", () => {
    const navigate = vi.fn();
    const historyLength = window.history.length;
    render(<Harness partial={false} navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Exit reviews" }));
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.history.length).toBe(historyLength);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it("lets the user cancel an explicit exit or confirm it once", () => {
    const navigate = vi.fn();
    render(<Harness navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Exit reviews" }));
    expect(screen.getByRole("dialog", { name: REVIEW_LEAVE_TITLE })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep reviewing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit reviews" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave reviews" }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks a nested Next-style link before its handler, then replays it after confirmation", () => {
    const navigate = vi.fn();
    render(<Harness navigate={navigate} />);
    fireEvent.click(screen.getByText("Dashboard"));
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep reviewing" }));
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Dashboard"));
    fireEvent.click(screen.getByRole("button", { name: "Leave reviews" }));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("does not interrupt anchors, downloads, new tabs, or modified clicks", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("link", { name: "Question help" }));
    fireEvent.click(screen.getByRole("link", { name: "Open subject" }));
    fireEvent.click(screen.getByRole("link", { name: "Download" }));
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }), { metaKey: true });
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }), { ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("warns on refresh only while a pair is incomplete and cleans up on unmount", () => {
    const { rerender, unmount } = render(<Harness />);
    const blocked = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);
    rerender(<Harness partial={false} />);
    const completed = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(completed);
    expect(completed.defaultPrevented).toBe(false);
    rerender(<Harness />);
    unmount();
    const afterUnmount = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });

  it("does not show a second unload warning during the confirmed navigation", () => {
    const unload = new Event("beforeunload", { cancelable: true });
    render(<Harness navigate={() => window.dispatchEvent(unload)} />);
    fireEvent.click(screen.getByRole("button", { name: "Exit reviews" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave reviews" }));
    expect(unload.defaultPrevented).toBe(false);
    const laterUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(laterUnload);
    expect(laterUnload.defaultPrevented).toBe(true);
  });

  it("dismisses a stale warning once the pair is completed", () => {
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Exit reviews" }));
    rerender(<Harness partial={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the review and its history state on Back until the user confirms", async () => {
    window.history.replaceState({ dashboard: true }, "", "/dashboard");
    const reviewState = { __NA: true, review: { currentAnswer: "じ" } };
    window.history.pushState(reviewState, "", "/reviews");
    render(<Harness />);
    const routerPopState = vi.fn();
    window.addEventListener("popstate", routerPopState);
    try {
      act(() => window.history.back());
      await screen.findByRole("dialog", { name: REVIEW_LEAVE_TITLE });
      expect(window.location.pathname).toBe("/reviews");
      expect(window.history.state).toEqual(reviewState);
      expect(routerPopState).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Keep reviewing" }));
      expect(window.location.pathname).toBe("/reviews");
      act(() => window.history.back());
      await screen.findByRole("dialog", { name: REVIEW_LEAVE_TITLE });
      fireEvent.click(screen.getByRole("button", { name: "Leave reviews" }));
      await waitFor(() => expect(window.location.pathname).toBe("/dashboard"));
      expect(routerPopState).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener("popstate", routerPopState); }
  });
});
