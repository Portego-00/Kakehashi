import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyQuestion } from "../types";
import { AudioVocabPrompt } from "./audio-vocab-prompt";

const question: StudyQuestion = {
  id: "1:audio-vocab",
  subjectId: 1,
  subjectType: "vocabulary",
  kind: "audio-vocab",
  prompt: "Listen",
  promptLabel: "What does this word mean?",
  characters: "猫",
  reading: "ねこ",
  displayAnswer: "Cat",
  acceptedAnswers: ["Cat"],
  audioUrl: "https://example.com/neko.mp3",
  autoPlayAudio: true,
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

class MockSpeechUtterance {
  lang = "";
  rate = 1;
  voice: { lang: string; name: string } | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

function mockSpeech() {
  const utterances: MockSpeechUtterance[] = [];
  const japaneseVoice = { lang: "ja-JP", name: "Japanese" };
  const synthesis = {
    cancel: vi.fn(),
    speak: vi.fn((utterance: MockSpeechUtterance) =>
      utterances.push(utterance),
    ),
    getVoices: vi.fn(() => [{ lang: "en-US", name: "English" }, japaneseVoice]),
  };
  vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechUtterance);
  vi.stubGlobal("speechSynthesis", synthesis);
  return { synthesis, utterances, japaneseVoice };
}

const sentenceQuestion: StudyQuestion = {
  ...question,
  audioVocabSentence: "猫がいます。",
};

describe("audio-only vocabulary session", () => {
  it("handles blocked autoplay and lets the learner replay slowly", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new DOMException("Blocked", "NotAllowedError"),
    );
    const { container } = render(<AudioVocabPrompt question={question} />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Tap the speaker"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Play vocabulary audio slowly" }),
    );
    expect(container.querySelector("audio")?.playbackRate).toBe(0.75);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  it("respects disabled autoplay and stops playback on exit", () => {
    const { unmount } = render(
      <AudioVocabPrompt question={{ ...question, autoPlayAudio: false }} />,
    );
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Play vocabulary audio" }),
    );
    unmount();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("speaks the target word followed by its sentence in Japanese without revealing text", async () => {
    const { synthesis, utterances, japaneseVoice } = mockSpeech();
    const { container } = render(
      <AudioVocabPrompt question={sentenceQuestion} />,
    );

    await waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(1));
    expect(utterances[0]).toMatchObject({
      text: "ねこ。猫がいます。",
      lang: "ja-JP",
      rate: 1,
      voice: japaneseVoice,
    });
    expect(container.querySelector("audio")).toBeNull();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    for (const answer of ["猫", "ねこ", "Cat", "猫がいます。"]) {
      expect(screen.queryByText(answer)).not.toBeInTheDocument();
    }
    expect(screen.getByRole("status")).toHaveTextContent(
      "Listen to the word, then its sentence.",
    );
  });

  it("respects disabled sentence autoplay and supports slow replay", () => {
    const { synthesis, utterances } = mockSpeech();
    render(
      <AudioVocabPrompt
        question={{ ...sentenceQuestion, autoPlayAudio: false }}
      />,
    );
    expect(synthesis.speak).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Play vocabulary audio slowly" }),
    );
    expect(utterances[0].rate).toBe(0.75);
    act(() => utterances[0].onstart?.());
    expect(
      screen.getByRole("button", { name: "Play vocabulary audio" }),
    ).toHaveAttribute("data-playing", "true");
    act(() => utterances[0].onend?.());
    expect(
      screen.getByRole("button", { name: "Play vocabulary audio" }),
    ).toHaveAttribute("data-playing", "false");
  });

  it("does not start queued sentence autoplay after leaving the question", () => {
    vi.useFakeTimers();
    const { synthesis } = mockSpeech();
    const { unmount } = render(
      <AudioVocabPrompt question={sentenceQuestion} />,
    );
    unmount();
    act(() => vi.runAllTimers());
    expect(synthesis.speak).not.toHaveBeenCalled();
  });

  it("cancels earlier sentences and ignores their callbacks after replay and question changes", async () => {
    const { synthesis, utterances } = mockSpeech();
    const { rerender, unmount } = render(
      <AudioVocabPrompt question={sentenceQuestion} />,
    );
    await waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(1));
    const staleError = utterances[0].onerror;
    const staleEnd = utterances[0].onend;
    synthesis.cancel.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "Play vocabulary audio slowly" }),
    );
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
    act(() => {
      utterances[1].onstart?.();
      staleError?.({ error: "network" });
      staleEnd?.();
    });
    expect(
      screen.getByRole("button", { name: "Play vocabulary audio" }),
    ).toHaveAttribute("data-playing", "true");
    expect(screen.getByRole("status")).not.toHaveTextContent("couldn’t play");

    const previousStart = utterances[1].onstart;
    rerender(
      <AudioVocabPrompt
        question={{ ...sentenceQuestion, id: "next", autoPlayAudio: false }}
      />,
    );
    expect(synthesis.cancel).toHaveBeenCalledTimes(2);
    act(() => previousStart?.());
    expect(
      screen.getByRole("button", { name: "Play vocabulary audio" }),
    ).toHaveAttribute("data-playing", "false");
    fireEvent.click(
      screen.getByRole("button", { name: "Play vocabulary audio" }),
    );
    synthesis.cancel.mockClear();
    unmount();
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(utterances[2].onstart).toBeNull();
  });

  it("offers a recovery message when speech synthesis is unsupported", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    render(<AudioVocabPrompt question={sentenceQuestion} />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Sentence audio isn’t supported in this browser",
      ),
    );
  });

  it("reports blocked or unavailable Japanese speech and allows retry", async () => {
    const { synthesis, utterances } = mockSpeech();
    render(<AudioVocabPrompt question={sentenceQuestion} />);
    await waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(1));
    act(() => utterances[0].onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tap the speaker to play the word and sentence.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Play vocabulary audio" }),
    );
    act(() => utterances[1].onerror?.({ error: "language-unavailable" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "A Japanese voice isn’t available",
    );
  });
});
