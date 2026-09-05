import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { setAudioModeAsync } from "expo-audio";
import React from "react";
import { Text, View } from "react-native";
import { resolveOfflineVocabularyAudioUri } from "../../services/offlineVocabularyAudioService";
import { azureSpeechService } from "../../utils/azureSpeech";
import AudioVocabPrompt from "../audio-vocab-prompt";

function mockCreatePlayer() {
  const state = { released: false, playing: false };
  const assertAlive = () => {
    if (state.released)
      throw new Error(
        "NativeSharedObjectNotFoundException: Unable to find the native shared object associated with given JavaScript object",
      );
  };
  return {
    state,
    pause: jest.fn(() => {
      assertAlive();
      state.playing = false;
    }),
    play: jest.fn(() => {
      assertAlive();
      state.playing = true;
    }),
    replace: jest.fn(assertAlive),
    seekTo: jest.fn(async () => assertAlive()),
    setPlaybackRate: jest.fn(assertAlive),
    get isLoaded() {
      assertAlive();
      return true;
    },
    shouldCorrectPitch: true,
    release: jest.fn(() => {
      state.playing = false;
      state.released = true;
    }),
  };
}
let mockPlayers: ReturnType<typeof mockCreatePlayer>[] = [];
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => {
    // Expo's real ownership hook releases before the component's later effect
    // cleanup, exactly as it does when answering advances to a new question.
    const { useReleasingSharedObject } = jest.requireActual(
      "../../../node_modules/expo-modules-core/src/hooks/useReleasingSharedObject",
    );
    return useReleasingSharedObject(() => {
      const player = mockCreatePlayer();
      mockPlayers.push(player);
      return player;
    }, []);
  },
  useAudioPlayerStatus: () => ({
    isLoaded: true,
    playing: false,
    isBuffering: false,
  }),
  setAudioModeAsync: jest.fn(),
}));
jest.mock("../../services/offlineVocabularyAudioService", () => ({
  resolveOfflineVocabularyAudioUri: jest.fn(),
}));
jest.mock("../../utils/azureSpeech", () => ({
  azureSpeechService: { speak: jest.fn(), stop: jest.fn() },
}));
jest.mock("../../utils/store", () => ({
  useSettingsStore: (selector: (state: object) => unknown) =>
    selector({ vocabularyAudioVoice: "female" }),
}));

const subject = {
  id: 1,
  object: "vocabulary",
  data: {
    characters: "猫",
    meanings: [{ meaning: "Cat", primary: true, accepted_answer: true }],
    readings: [{ reading: "ねこ", primary: true, accepted_answer: true }],
    pronunciation_audios: [
      { url: "https://example.com/neko.mp3", content_type: "audio/mpeg" },
    ],
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockPlayers = [];
  jest.mocked(setAudioModeAsync).mockResolvedValue(undefined);
  jest
    .mocked(resolveOfflineVocabularyAudioUri)
    .mockResolvedValue("file:///cached/neko.mp3");
  jest.mocked(azureSpeechService.speak).mockResolvedValue(undefined);
  jest.mocked(azureSpeechService.stop).mockResolvedValue(undefined);
});

it("plays the cached recording without exposing the answer and stops on exit", async () => {
  const view = render(<AudioVocabPrompt subject={subject} autoPlay />);
  const player = mockPlayers[0];
  for (const text of ["猫", "ねこ", "Cat", "Show answer"])
    expect(view.queryByText(text)).toBeNull();
  await waitFor(() => expect(player.play).toHaveBeenCalled());
  expect(player.replace).toHaveBeenCalledWith("file:///cached/neko.mp3");
  expect(player.state.playing).toBe(true);
  player.pause.mockClear();
  expect(() => view.unmount()).not.toThrow();
  expect(player.release).toHaveBeenCalledTimes(1);
  expect(player.state.playing).toBe(false);
  expect(player.pause).not.toHaveBeenCalled();
});

it("allows slow replay while autoplay is disabled", async () => {
  const view = render(<AudioVocabPrompt subject={subject} autoPlay={false} />);
  const player = mockPlayers[0];
  await waitFor(() => expect(player.replace).toHaveBeenCalled());
  expect(player.play).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText("Play vocabulary audio slowly"));
  await waitFor(() =>
    expect(player.setPlaybackRate).toHaveBeenCalledWith(0.75),
  );
});

it("keeps audio playing through details rerenders with the test-session subject references", async () => {
  function QuestionWithDetails({
    questionSubject,
    detailsState,
  }: {
    questionSubject: typeof subject;
    detailsState: string;
  }) {
    // test-session remaps the review item on each render, while passing the
    // original question subject to AudioVocabPrompt. Its audio entries remain
    // the same objects even on the mapped review item.
    const reviewSubject = {
      ...questionSubject,
      data: {
        ...questionSubject.data,
        meanings: questionSubject.data.meanings.map((meaning) => ({
          ...meaning,
        })),
        readings: questionSubject.data.readings.map((reading) => ({
          ...reading,
        })),
      },
    };
    return (
      <View>
        <AudioVocabPrompt
          key={questionSubject.id}
          subject={questionSubject}
          autoPlay
        />
        <Text>{`${reviewSubject.id}:${detailsState}`}</Text>
      </View>
    );
  }

  const view = render(
    <QuestionWithDetails questionSubject={subject} detailsState="answering" />,
  );
  const first = mockPlayers[0];
  await waitFor(() => expect(first.play).toHaveBeenCalledTimes(1));
  for (const detailsState of ["wrong", "loading details", "details loaded"]) {
    await act(async () => {
      view.rerender(
        <QuestionWithDetails
          questionSubject={subject}
          detailsState={detailsState}
        />,
      );
    });
  }
  expect(mockPlayers).toHaveLength(1);
  expect({
    lookups: jest.mocked(resolveOfflineVocabularyAudioUri).mock.calls.length,
    replacements: first.replace.mock.calls.length,
    starts: first.play.mock.calls.length,
    pauses: first.pause.mock.calls.length,
  }).toEqual({ lookups: 1, replacements: 1, starts: 1, pauses: 2 });
  expect(first.state.playing).toBe(true);

  view.rerender(
    <QuestionWithDetails
      questionSubject={{ ...subject, id: 2 }}
      detailsState="answering"
    />,
  );
  expect(first.release).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(mockPlayers[1].play).toHaveBeenCalledTimes(1));
  expect(mockPlayers).toHaveLength(2);
});

it("releases the previous question before loading the next recording", async () => {
  const view = render(<AudioVocabPrompt subject={subject} autoPlay />);
  const first = mockPlayers[0];
  await waitFor(() => expect(first.play).toHaveBeenCalled());
  const nextSource = deferred<string>();
  jest
    .mocked(resolveOfflineVocabularyAudioUri)
    .mockReturnValueOnce(nextSource.promise);
  expect(() =>
    view.rerender(
      <AudioVocabPrompt subject={{ ...subject, id: 2 }} autoPlay />,
    ),
  ).not.toThrow();
  expect(first.release).toHaveBeenCalledTimes(1);
  expect(first.state.playing).toBe(false);
  const second = mockPlayers[1];
  expect(second.play).not.toHaveBeenCalled();
  await act(async () => nextSource.resolve("file:///cached/second.mp3"));
  expect(second.replace).toHaveBeenCalledWith("file:///cached/second.mp3");
  expect(second.play).toHaveBeenCalledTimes(1);
});

it("does not replace a released player when an offline lookup finishes after exit", async () => {
  const source = deferred<string>();
  jest
    .mocked(resolveOfflineVocabularyAudioUri)
    .mockReturnValueOnce(source.promise);
  const view = render(<AudioVocabPrompt subject={subject} autoPlay />);
  const player = mockPlayers[0];
  view.unmount();
  await act(async () => source.resolve("file:///cached/neko.mp3"));
  expect(player.release).toHaveBeenCalledTimes(1);
  expect(player.replace).not.toHaveBeenCalled();
  expect(player.play).not.toHaveBeenCalled();
});

it("does not touch a released player after audio setup finishes", async () => {
  const audioMode = deferred<void>();
  jest.mocked(setAudioModeAsync).mockReturnValueOnce(audioMode.promise);
  const view = render(<AudioVocabPrompt subject={subject} autoPlay />);
  const player = mockPlayers[0];
  await waitFor(() => expect(setAudioModeAsync).toHaveBeenCalled());
  player.pause.mockClear();
  view.unmount();
  await act(async () => audioMode.resolve(undefined));
  expect(player.pause).not.toHaveBeenCalled();
  expect(player.play).not.toHaveBeenCalled();
});

it("does not resume a released player after an in-flight seek finishes", async () => {
  const view = render(<AudioVocabPrompt subject={subject} autoPlay={false} />);
  const player = mockPlayers[0];
  await waitFor(() => expect(player.replace).toHaveBeenCalled());
  const seek = deferred<void>();
  player.seekTo.mockReturnValueOnce(seek.promise);
  fireEvent.press(view.getByLabelText("Play vocabulary audio"));
  await waitFor(() => expect(player.seekTo).toHaveBeenCalled());
  view.unmount();
  await act(async () => seek.resolve(undefined));
  expect(player.setPlaybackRate).not.toHaveBeenCalled();
  expect(player.play).not.toHaveBeenCalled();
});

it("speaks the target reading then its sentence without requiring a recording", async () => {
  const sentence = "猫がいます。";
  const view = render(
    <AudioVocabPrompt
      subject={{
        ...subject,
        data: { ...subject.data, pronunciation_audios: [] },
      }}
      sentence={sentence}
      autoPlay
    />,
  );
  await waitFor(() => expect(azureSpeechService.speak).toHaveBeenCalled());
  expect(azureSpeechService.speak).toHaveBeenCalledWith(
    "ねこ。猫がいます。",
    expect.any(Function),
    undefined,
    expect.any(Function),
    { speedMultiplier: 1 },
  );
  expect(mockPlayers).toHaveLength(0);
  for (const text of ["猫", "ねこ", "Cat", sentence])
    expect(view.queryByText(text)).toBeNull();
  expect(view.getByText("Listen to the word, then its sentence.")).toBeTruthy();
  view.unmount();
  expect(azureSpeechService.stop).toHaveBeenCalledTimes(1);
});

it("replays the whole sentence prompt at the selected speed without autoplay", async () => {
  const view = render(
    <AudioVocabPrompt
      subject={subject}
      sentence="猫がいます。"
      autoPlay={false}
    />,
  );
  expect(azureSpeechService.speak).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText("Play vocabulary audio slowly"));
  await waitFor(() => expect(azureSpeechService.speak).toHaveBeenCalled());
  expect(jest.mocked(azureSpeechService.speak).mock.calls[0][4]).toEqual({
    speedMultiplier: 0.75,
  });
});

it("cancels pending sentence playback when leaving before audio setup completes", async () => {
  const audioMode = deferred<void>();
  jest.mocked(setAudioModeAsync).mockReturnValueOnce(audioMode.promise);
  const view = render(
    <AudioVocabPrompt subject={subject} sentence="猫がいます。" autoPlay />,
  );
  view.unmount();
  await act(async () => audioMode.resolve(undefined));
  expect(azureSpeechService.speak).not.toHaveBeenCalled();
  expect(azureSpeechService.stop).toHaveBeenCalledTimes(1);
});

it("ignores stale speech errors after replaying or changing the sentence", async () => {
  const speech = deferred<void>();
  jest.mocked(azureSpeechService.speak).mockReturnValueOnce(speech.promise);
  const view = render(
    <AudioVocabPrompt subject={subject} sentence="猫がいます。" autoPlay />,
  );
  await waitFor(() =>
    expect(azureSpeechService.speak).toHaveBeenCalledTimes(1),
  );
  const oldError = jest.mocked(azureSpeechService.speak).mock.calls[0][3];
  view.rerender(
    <AudioVocabPrompt subject={subject} sentence="猫が食べます。" autoPlay />,
  );
  await waitFor(() =>
    expect(azureSpeechService.speak).toHaveBeenCalledTimes(2),
  );
  expect(azureSpeechService.stop).toHaveBeenCalledTimes(1);
  await act(async () => {
    oldError?.(new Error("Cancelled speech"));
    speech.resolve(undefined);
  });
  expect(
    view.queryByText("Audio couldn’t play. Tap the speaker to retry."),
  ).toBeNull();
});
