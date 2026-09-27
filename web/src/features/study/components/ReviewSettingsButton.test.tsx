import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_WEB_SETTINGS, loadWebSettings, saveWebSettings } from "@/features/settings/settings";
import { ReviewSettingsButton } from "./ReviewSettingsButton";

const setTheme = vi.fn();
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "system", setTheme }) }));
vi.mock("@/lib/session", () => ({ useSession: () => ({ user: { data: { username: "settings-test" } } }) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

it("saves each change without replacing unrelated settings and restores focus on close", () => {
  saveWebSettings(localStorage, "settings-test", { ...DEFAULT_WEB_SETTINGS, textScale: 1.2 });
  const change = vi.fn();
  const open = vi.fn();
  render(<ReviewSettingsButton onStudyChange={change} onOpenChange={open} />);
  const trigger = screen.getByRole("button", { name: "Review settings" });
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Review settings" });
  fireEvent.change(within(dialog).getByLabelText("Anki mode"), { target: { value: "both" } });
  fireEvent.click(within(dialog).getByLabelText("Group meaning and reading"));
  fireEvent.change(within(dialog).getByLabelText("Review subject order"), { target: { value: "lowestLevelFirst" } });
  fireEvent.change(within(dialog).getByLabelText("Theme"), { target: { value: "dark" } });
  const saved = loadWebSettings(localStorage, "settings-test");
  expect(saved.textScale).toBe(1.2);
  expect(saved.study).toMatchObject({ ankiMode: "both", ankiGroupQuestions: true, reviewOrder: "lowestLevelFirst" });
  expect(change).toHaveBeenCalledTimes(3);
  expect(setTheme).toHaveBeenCalledWith("dark");
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(open.mock.calls).toEqual([[true], [false]]);
});

it("closes on Escape cancellation and reports failed saves without changing the session", () => {
  const change = vi.fn();
  render(<ReviewSettingsButton onStudyChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  const dialog = screen.getByRole("dialog");
  const save = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Full"); });
  fireEvent.change(within(dialog).getByLabelText("Anki mode"), { target: { value: "both" } });
  expect(screen.getByRole("alert")).toHaveTextContent("could not be saved");
  expect(change).not.toHaveBeenCalled();
  save.mockRestore();
  act(() => dialog.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
