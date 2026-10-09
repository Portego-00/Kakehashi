import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_WEB_SETTINGS, loadWebSettings, saveWebSettings } from "@/features/settings/settings";
import { ReviewSettingsButton } from "./ReviewSettingsButton";

const setTheme = vi.fn();
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "system", setTheme }) }));
vi.mock("@/lib/session", () => ({ useSession: () => ({ user: { data: { username: "settings-test" } } }) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

it("saves multiple choice during a review without changing Anki preferences", () => {
  saveWebSettings(localStorage, "settings-test", { ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, ankiMode: "reading" } });
  render(<ReviewSettingsButton />);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.getByLabelText("Multiple Choice")).not.toBeChecked();
  fireEvent.click(screen.getByLabelText("Multiple Choice"));
  expect(loadWebSettings(localStorage, "settings-test").study).toMatchObject({ reviewMultipleChoiceEnabled: true, ankiMode: "reading" });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.getByLabelText("Multiple Choice")).toBeChecked();
});

it("offers choices for custom vocabulary and mixed sessions, while keeping Bunpro-only settings relevant", () => {
  const view = render(<ReviewSettingsButton ankiSupported={false} bunproSupported />);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.queryByLabelText("Multiple Choice")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  view.rerender(<ReviewSettingsButton ankiSupported={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.getByLabelText("Multiple Choice")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  view.rerender(<ReviewSettingsButton bunproSupported />);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.getByLabelText("Multiple Choice")).toBeInTheDocument();
});

it("persists smaller question text without changing the app text size", () => {
  saveWebSettings(localStorage, "settings-test", { ...DEFAULT_WEB_SETTINGS, textScale: 1.2 });
  const change = vi.fn();
  render(<ReviewSettingsButton onStudyChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  const size = screen.getByLabelText("Question text size");
  for (const scale of ["0.6", "0.5", "0.4", "0.3"]) {
    fireEvent.change(size, { target: { value: scale } });
    expect(loadWebSettings(localStorage, "settings-test")).toMatchObject({ textScale: 1.2, study: { reviewCharacterFontScale: Number(scale) } });
  }
  expect(change.mock.lastCall?.[0].reviewCharacterFontScale).toBe(0.3);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.getByLabelText("Question text size")).toHaveValue("0.3");
});

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
  expect(within(dialog).getByLabelText("Combined Anki details tab")).toHaveValue("meaning");
  fireEvent.change(within(dialog).getByLabelText("Combined Anki details tab"), { target: { value: "reading" } });
  fireEvent.change(within(dialog).getByLabelText("Review subject order"), { target: { value: "lowestLevelFirst" } });
  fireEvent.change(within(dialog).getByLabelText("Theme"), { target: { value: "dark" } });
  const saved = loadWebSettings(localStorage, "settings-test");
  expect(saved.textScale).toBe(1.2);
  expect(saved.study).toMatchObject({ ankiMode: "both", ankiGroupQuestions: true, ankiCombinedDetailsTab: "reading", reviewOrder: "lowestLevelFirst" });
  expect(change).toHaveBeenCalledTimes(4);
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

it("saves the opt-in wrong-answer details setting and shows it when reopened", () => {
  render(<ReviewSettingsButton />);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.getByLabelText("Show details on wrong answer")).not.toBeChecked();
  fireEvent.click(screen.getByLabelText("Show details on wrong answer"));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(loadWebSettings(localStorage, "settings-test").study.showDetailsOnWrongAnswer).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.getByLabelText("Show details on wrong answer")).toBeChecked();
});

it("saves the Bunpro furigana toggle and shows it again when reopened", () => {
  render(<ReviewSettingsButton bunproSupported />);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.getByLabelText("Hide Bunpro furigana")).not.toBeChecked();
  fireEvent.click(screen.getByLabelText("Hide Bunpro furigana"));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(loadWebSettings(localStorage, "settings-test").study.bunproHideFurigana).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
  expect(screen.getByLabelText("Hide Bunpro furigana")).toBeChecked();
});
