import { useLyricsQuizStore } from "../lyricsQuizStore";

describe("lyrics quiz session state", () => {
  beforeEach(() => {
    useLyricsQuizStore.getState().reset("test-session");
  });

  it("bypasses a skipped question only for the current pass", () => {
    const store = useLyricsQuizStore.getState();

    store.markPaused("test-session", 4);
    expect(useLyricsQuizStore.getState().pausedLineIndex).toBe(4);
    expect(useLyricsQuizStore.getState().bypassedLineIndex).toBeNull();

    useLyricsQuizStore.getState().continuePastPause("test-session");
    expect(useLyricsQuizStore.getState().pausedLineIndex).toBeNull();
    expect(useLyricsQuizStore.getState().bypassedLineIndex).toBe(4);

    useLyricsQuizStore.getState().clearBypass("test-session");
    expect(useLyricsQuizStore.getState().bypassedLineIndex).toBeNull();

    useLyricsQuizStore.getState().markPaused("test-session", 4);
    expect(useLyricsQuizStore.getState().pausedLineIndex).toBe(4);
  });

  it("rearms the current unanswered question for replay", () => {
    const store = useLyricsQuizStore.getState();
    store.markPaused("test-session", 2);
    store.continuePastPause("test-session");

    useLyricsQuizStore.getState().rearmQuestions("test-session");

    expect(useLyricsQuizStore.getState().pausedLineIndex).toBeNull();
    expect(useLyricsQuizStore.getState().bypassedLineIndex).toBeNull();
  });

  it("clears answers and playback state when the quiz is reset", () => {
    const store = useLyricsQuizStore.getState();
    store.markPaused("test-session", 2);
    store.continuePastPause("test-session");
    store.recordAnswer("test-session", 2, "言葉");

    useLyricsQuizStore.getState().reset("test-session");

    expect(useLyricsQuizStore.getState().answers).toEqual({});
    expect(useLyricsQuizStore.getState().attempts).toEqual({});
    expect(useLyricsQuizStore.getState().bypassedLineIndex).toBeNull();
    expect(useLyricsQuizStore.getState().pausedLineIndex).toBeNull();
    expect(useLyricsQuizStore.getState().resultsPresented).toBe(false);
  });

  it("keeps every response for the results summary", () => {
    const store = useLyricsQuizStore.getState();

    store.recordAnswer("test-session", 3, "海");
    useLyricsQuizStore.getState().recordAnswer("test-session", 3, "空");
    useLyricsQuizStore.getState().markResultsPresented("test-session");

    expect(useLyricsQuizStore.getState().answers[3]).toBe("空");
    expect(useLyricsQuizStore.getState().attempts[3]).toEqual(["海", "空"]);
    expect(useLyricsQuizStore.getState().resultsPresented).toBe(true);
  });
});
