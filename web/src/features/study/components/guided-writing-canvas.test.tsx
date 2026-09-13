import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KanjiStrokeData } from "../stroke-data";

const writerMocks = vi.hoisted(() => ({
  cancelQuiz: vi.fn(),
  destroy: vi.fn(),
  hideCharacter: vi.fn(async () => ({ canceled: false })),
  pauseAnimation: vi.fn(async () => undefined),
  quiz: vi.fn(async () => undefined),
  setCharacter: vi.fn(async () => undefined),
}));

vi.mock("hanzi-writer", () => ({
  default: class MockHanziWriter {
    _hanziWriterRenderer = { destroy: writerMocks.destroy };
    cancelQuiz = writerMocks.cancelQuiz;
    hideCharacter = writerMocks.hideCharacter;
    pauseAnimation = writerMocks.pauseAnimation;
    quiz = writerMocks.quiz;
    setCharacter = writerMocks.setCharacter;
    animateCharacter = vi.fn(async (options?: { onComplete?: () => void }) => {
      options?.onComplete?.();
      return { canceled: false };
    });
    highlightStroke = vi.fn(async () => ({ canceled: false }));
    updateDimensions = vi.fn();
  },
}));

import { GuidedWritingCanvas } from "./guided-writing-canvas";

const data: KanjiStrokeData = {
  strokes: ["M100 100L900 100"],
  medians: [[[100, 100], [900, 100]]],
};

function props(leniency: number) {
  return {
    character: "一",
    complete: false,
    data,
    label: "Guided writing",
    leniency,
    onComplete: vi.fn(),
    onCorrectStroke: vi.fn(),
    onError: vi.fn(),
    onMistake: vi.fn(),
    onReady: vi.fn(),
    onReplayStateChange: vi.fn(),
    ready: true,
    showGrid: true,
    showOutline: false,
    state: "ready" as const,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("guided writing options", () => {
  it("passes the configured mobile strictness to Hanzi Writer", async () => {
    const view = render(<GuidedWritingCanvas {...props(0.8)} />);

    await waitFor(() => expect(writerMocks.quiz).toHaveBeenCalledWith(expect.objectContaining({
      acceptBackwardsStrokes: false,
      leniency: 0.8,
      showHintAfterMisses: 3,
    })));

    view.rerender(<GuidedWritingCanvas {...props(2.5)} />);

    await waitFor(() => expect(writerMocks.quiz).toHaveBeenLastCalledWith(expect.objectContaining({ leniency: 2.5 })));
  });
});
