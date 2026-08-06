import {
  DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS,
  DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS,
  resolveAnkiReviewShortcutAction,
} from "../reviewKeyboardShortcuts";

const resolveAction = (
  key: string,
  options: Partial<{
    isAnswerRevealed: boolean;
    canReplayAudio: boolean;
    canSkip: boolean;
  }> = {},
) =>
  resolveAnkiReviewShortcutAction({
    key,
    isAnswerRevealed: options.isAnswerRevealed ?? true,
    canReplayAudio: options.canReplayAudio ?? true,
    canSkip: options.canSkip ?? true,
    incorrectShortcuts: DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS,
    correctShortcuts: DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS,
  });

describe("Anki review keyboard shortcuts", () => {
  it("uses the advance shortcut to reveal and then grade a card correct", () => {
    expect(resolveAction(" ", { isAnswerRevealed: false })).toBe("reveal");
    expect(resolveAction("Space", { isAnswerRevealed: true })).toBe(
      "markCorrect",
    );
  });

  it("maps the configured grading and card action shortcuts", () => {
    expect(resolveAction("x")).toBe("markIncorrect");
    expect(resolveAction("C")).toBe("markCorrect");
    expect(resolveAction("a")).toBe("skip");
    expect(resolveAction("D")).toBe("openDetails");
    expect(resolveAction("r")).toBe("replayAudio");
  });

  it("respects customized shortcut keys", () => {
    const incorrectShortcuts = {
      ...DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS,
      markIncorrect: "1",
      markCorrect: "2",
    };
    const correctShortcuts = {
      ...DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS,
      advanceOnCorrect: "Enter",
    };

    expect(
      resolveAnkiReviewShortcutAction({
        key: "1",
        isAnswerRevealed: true,
        canReplayAudio: true,
        canSkip: true,
        incorrectShortcuts,
        correctShortcuts,
      }),
    ).toBe("markIncorrect");
    expect(
      resolveAnkiReviewShortcutAction({
        key: "Return",
        isAnswerRevealed: false,
        canReplayAudio: true,
        canSkip: true,
        incorrectShortcuts,
        correctShortcuts,
      }),
    ).toBe("reveal");
  });

  it("only exposes skip and replay when those actions are available", () => {
    expect(resolveAction("A", { canSkip: false })).toBeNull();
    expect(resolveAction("R", { canReplayAudio: false })).toBeNull();
  });

  it("allows skip before reveal but ignores grading shortcuts", () => {
    expect(resolveAction("A", { isAnswerRevealed: false })).toBe("skip");
    expect(resolveAction("X", { isAnswerRevealed: false })).toBeNull();
    expect(resolveAction("C", { isAnswerRevealed: false })).toBeNull();
  });
});
