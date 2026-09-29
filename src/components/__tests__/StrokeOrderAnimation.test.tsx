import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { ClipPath, Path } from 'react-native-svg';
import StrokeOrderAnimation from '../StrokeOrderAnimation';
import KanjiStrokeCanvas from '../KanjiStrokeCanvas';
import { loadKanjiWriterData } from '../../utils/kanjiWriterDataLoader';
import betsu from './fixtures/kanji-betsu.json';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../utils/kanjiWriterDataLoader', () => ({ loadKanjiWriterData: jest.fn() }));
jest.mock('../../utils/theme', () => ({ useTheme: () => ({ theme: { primary: 'blue', textColor: 'black', textSecondary: 'gray', isDark: false } }) }));
jest.mock('../../utils/subjectColors', () => ({ useSubjectColors: () => ({ kanji: 'pink' }), withAlpha: (color: string) => color }));

const loadData = jest.mocked(loadKanjiWriterData);
let callbacks: Map<number, FrameRequestCallback>;
let nextId: number;
let timestamp: number;
let changeAppState: (state: AppStateStatus) => void;
const removeListener = jest.fn();

beforeEach(() => {
  callbacks = new Map(); nextId = 0; timestamp = 0;
  loadData.mockReset().mockResolvedValue(betsu);
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++nextId; callbacks.set(id, callback); return id;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((id) => { callbacks.delete(id); });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    changeAppState = callback;
    return { remove: removeListener };
  });
  AppState.currentState = 'active';
});
afterEach(() => { jest.restoreAllMocks(); });

function nextFrame(delta = 16) {
  timestamp += delta;
  const pending = [...callbacks.values()]; callbacks.clear();
  act(() => pending.forEach((callback) => callback(timestamp)));
}
async function openPlayer(character = '別') {
  const screen = render(<StrokeOrderAnimation character={character} />);
  await act(async () => {});
  return screen;
}

test.each([8, 16, 33, 1000])('draws all seven strokes in order at %sms frames, including a stalled device', async (delta) => {
  const screen = await openPlayer();
  fireEvent.press(screen.getByLabelText('Play stroke animation'));
  const seen: number[] = [];
  const partial = new Set<number>();
  let ticks = 0;
  while (screen.queryByLabelText('Stop stroke animation') && ticks++ < 2000) {
    const frame = screen.UNSAFE_getByType(KanjiStrokeCanvas).props.frame;
    if (frame && seen.at(-1) !== frame.strokeIndex) seen.push(frame.strokeIndex);
    if (frame?.progress > 0 && frame.progress < 1) {
      partial.add(frame.strokeIndex);
      // Inspect the real SVG: only this stroke is being revealed.
      const drawing = screen.UNSAFE_getAllByType(Path).filter((path) => path.props.strokeDashoffset !== undefined);
      expect(drawing).toHaveLength(1);
      expect(drawing[0].props.strokeDashoffset).toBeGreaterThan(0);
    }
    nextFrame(delta);
  }
  expect(ticks).toBeLessThan(2000);
  expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect([...partial]).toEqual(seen);
  expect(screen.getByLabelText('Play stroke animation')).toBeTruthy();
  expect(callbacks.size).toBe(0);
});

test('does not restart or finish on parent updates, and speed changes apply to the next play', async () => {
  const screen = await openPlayer();
  fireEvent.press(screen.getByLabelText('Play stroke animation'));
  nextFrame(); nextFrame(50);
  const before = screen.UNSAFE_getByType(KanjiStrokeCanvas).props.frame;
  for (let i = 0; i < 100; i++) screen.rerender(<StrokeOrderAnimation character="別" onPractice={() => {}} />);
  fireEvent.press(screen.getByLabelText('Animation speed 1x'));
  expect(screen.UNSAFE_getByType(KanjiStrokeCanvas).props.frame).toEqual(before);
  nextFrame(50);
  expect(screen.UNSAFE_getByType(KanjiStrokeCanvas).props.frame.progress).toBeCloseTo(0.2);
});

test('pauses in the background and resumes without skipping strokes', async () => {
  const screen = await openPlayer();
  fireEvent.press(screen.getByLabelText('Play stroke animation'));
  nextFrame(); nextFrame(50);
  const before = screen.UNSAFE_getByType(KanjiStrokeCanvas).props.frame;
  act(() => changeAppState('background'));
  expect(callbacks.size).toBe(0);
  nextFrame(60000);
  act(() => changeAppState('active'));
  nextFrame();
  expect(screen.UNSAFE_getByType(KanjiStrokeCanvas).props.frame).toEqual(before);
  nextFrame(50);
  expect(screen.UNSAFE_getByType(KanjiStrokeCanvas).props.frame.progress).toBeGreaterThan(before.progress);
});

test('stop, replay and unmount ignore callbacks from old playback runs', async () => {
  const screen = await openPlayer();
  for (let i = 0; i < 30; i++) {
    fireEvent.press(screen.getByLabelText('Play stroke animation'));
    nextFrame(); nextFrame(50);
    const stale = [...callbacks.values()][0];
    fireEvent.press(screen.getByLabelText('Stop stroke animation'));
    fireEvent.press(screen.getByLabelText('Play stroke animation'));
    act(() => stale(timestamp + 60000));
    expect(screen.UNSAFE_getByType(KanjiStrokeCanvas).props.frame).toEqual({strokeIndex: 0, progress: 0});
    fireEvent.press(screen.getByLabelText('Stop stroke animation'));
  }
  fireEvent.press(screen.getByLabelText('Play stroke animation'));
  screen.unmount();
  expect(callbacks.size).toBe(0);
  expect(removeListener).toHaveBeenCalled();
});

test('a new lesson cannot show the previous character or keep its clock running', async () => {
  const screen = await openPlayer();
  fireEvent.press(screen.getByLabelText('Play stroke animation'));
  nextFrame(); nextFrame(50);
  let resolveNext!: (data: typeof betsu) => void;
  loadData.mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; }));
  screen.rerender(<StrokeOrderAnimation character="利" />);
  expect(screen.getByText('Loading stroke order...')).toBeTruthy();
  expect(callbacks.size).toBe(0);
  await act(async () => resolveNext(betsu));
  expect(screen.getByLabelText('Play stroke animation')).toBeTruthy();
});

test('a failed load can be retried', async () => {
  loadData.mockRejectedValueOnce(new Error('offline'));
  const screen = await openPlayer();
  fireEvent.press(screen.getByText('Try again'));
  await act(async () => {});
  expect(screen.getByLabelText('Play stroke animation')).toBeTruthy();
});


test.each([['2x', 1, 0.2], ['0.5x', 2, 0.05]] as const)('uses the selected %s speed on replay', async (_label, taps, expectedProgress) => {
  const screen = await openPlayer();
  for (let i = 0; i < taps; i++) fireEvent.press(screen.getByLabelText(/Animation speed/));
  fireEvent.press(screen.getByLabelText('Play stroke animation'));
  nextFrame(); nextFrame(50);
  expect(screen.UNSAFE_getByType(KanjiStrokeCanvas).props.frame.progress).toBeCloseTo(expectedProgress);
});

test('simultaneous players have separate SVG clips and playback clocks', async () => {
  const screen = render(<><StrokeOrderAnimation character="別" /><StrokeOrderAnimation character="利" /></>);
  await act(async () => {});
  const ids = screen.UNSAFE_getAllByType(ClipPath).map((clip) => clip.props.id);
  expect(new Set(ids).size).toBe(14);
  fireEvent.press(screen.getAllByLabelText('Play stroke animation')[0]);
  nextFrame(); nextFrame(50);
  const players = screen.UNSAFE_getAllByType(KanjiStrokeCanvas);
  expect(players[0].props.frame.progress).toBeGreaterThan(0);
  expect(players[1].props.frame).toBeNull();
});

test('a late response for the previous lesson cannot replace the current kanji', async () => {
  let resolveOld!: (data: typeof betsu) => void;
  loadData.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const screen = await openPlayer();
  const next = { ...betsu, strokes: betsu.strokes.slice(0, 1), medians: betsu.medians.slice(0, 1) };
  loadData.mockResolvedValueOnce(next);
  screen.rerender(<StrokeOrderAnimation character="一" />);
  await act(async () => {});
  await act(async () => resolveOld(betsu));
  expect(screen.UNSAFE_getByType(KanjiStrokeCanvas).props.data).toEqual(next);
});
