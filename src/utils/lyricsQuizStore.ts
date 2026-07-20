import { create } from "zustand";

interface LyricsQuizState {
  sessionKey: string | null;
  answers: Record<number, string>;
  attempts: Record<number, string[]>;
  bypassedLineIndex: number | null;
  pausedLineIndex: number | null;
  resultsPresented: boolean;
  recordAnswer: (sessionKey: string, lineIndex: number, answer: string) => void;
  markPaused: (sessionKey: string, lineIndex: number) => void;
  continuePastPause: (sessionKey: string) => void;
  rearmQuestions: (sessionKey: string) => void;
  clearBypass: (sessionKey: string) => void;
  markResultsPresented: (sessionKey: string) => void;
  reset: (sessionKey: string) => void;
}

export const useLyricsQuizStore = create<LyricsQuizState>((set) => ({
  sessionKey: null,
  answers: {},
  attempts: {},
  bypassedLineIndex: null,
  pausedLineIndex: null,
  resultsPresented: false,
  recordAnswer: (sessionKey, lineIndex, answer) =>
    set((state) => ({
      sessionKey,
      answers: {
        ...(state.sessionKey === sessionKey ? state.answers : {}),
        [lineIndex]: answer,
      },
      attempts: {
        ...(state.sessionKey === sessionKey ? state.attempts : {}),
        [lineIndex]: [
          ...(state.sessionKey === sessionKey
            ? state.attempts[lineIndex] ?? []
            : []),
          answer,
        ],
      },
      bypassedLineIndex:
        state.sessionKey === sessionKey ? state.bypassedLineIndex : null,
      pausedLineIndex:
        state.sessionKey === sessionKey ? state.pausedLineIndex : null,
      resultsPresented:
        state.sessionKey === sessionKey ? state.resultsPresented : false,
    })),
  markPaused: (sessionKey, lineIndex) =>
    set((state) => ({
      sessionKey,
      answers: state.sessionKey === sessionKey ? state.answers : {},
      attempts: state.sessionKey === sessionKey ? state.attempts : {},
      bypassedLineIndex: null,
      pausedLineIndex: lineIndex,
      resultsPresented:
        state.sessionKey === sessionKey ? state.resultsPresented : false,
    })),
  continuePastPause: (sessionKey) =>
    set((state) =>
      state.sessionKey === sessionKey
        ? {
            bypassedLineIndex:
              state.pausedLineIndex ?? state.bypassedLineIndex,
            pausedLineIndex: null,
          }
        : state,
    ),
  rearmQuestions: (sessionKey) =>
    set((state) =>
      state.sessionKey === sessionKey
        ? { bypassedLineIndex: null, pausedLineIndex: null }
        : state,
    ),
  clearBypass: (sessionKey) =>
    set((state) =>
      state.sessionKey === sessionKey
        ? { bypassedLineIndex: null }
        : state,
    ),
  markResultsPresented: (sessionKey) =>
    set((state) =>
      state.sessionKey === sessionKey
        ? { resultsPresented: true }
        : state,
    ),
  reset: (sessionKey) =>
    set({
      sessionKey,
      answers: {},
      attempts: {},
      bypassedLineIndex: null,
      pausedLineIndex: null,
      resultsPresented: false,
    }),
}));
