import { useRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useReviewAnswerFocus } from "./use-review-answer-focus";

function Session({ ready = true, active = true, dialog = false }) {
  const ref = useRef<HTMLInputElement>(null);
  const attach = useReviewAnswerFocus(ref, active);
  return <section data-study-session="active">
    {ready && <input aria-label="Answer" ref={attach} />}
    <button>Audio</button>
    <input aria-label="Notes" />
    {dialog && <dialog open><input aria-label="Dialog input" /></dialog>}
  </section>;
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("focuses an answer mounted after loading finishes", () => {
  const view = render(<Session ready={false} />);
  view.rerender(<Session />);
  expect(screen.getByRole("textbox", { name: "Answer" })).toHaveFocus();
});

it("does not steal focus from a dialog or another editable field on tab return", async () => {
  const view = render(<Session dialog />);
  const dialogInput = screen.getByRole("textbox", { name: "Dialog input" });
  dialogInput.focus();
  fireEvent(window, new Event("focus"));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(dialogInput).toHaveFocus();
  view.rerender(<Session />);
  const notes = screen.getByRole("textbox", { name: "Notes" });
  notes.focus();
  fireEvent(window, new Event("focus"));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(notes).toHaveFocus();
});

it("only focuses the active session when mixed reviews switch providers", async () => {
  const view = render(<Session active={false} />);
  const answer = screen.getByRole("textbox", { name: "Answer" });
  expect(answer).not.toHaveFocus();
  fireEvent(window, new Event("focus"));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(answer).not.toHaveFocus();
  view.rerender(<Session />);
  await waitFor(() => expect(answer).toHaveFocus());
});
