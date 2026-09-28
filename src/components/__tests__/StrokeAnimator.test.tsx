/* eslint-disable @typescript-eslint/no-require-imports -- Load the patched CommonJS distribution and hoisted mock dependencies. */
import React from 'react';
import { act, render } from '@testing-library/react-native';

const mockCompletions: ((finished: boolean) => void)[] = [];
const mockWithTiming = jest.fn((value, config, callback) => {
  if (callback) mockCompletions.push(callback);
  return value;
});
jest.mock('react-native-reanimated', () => ({
  Easing: { linear: 'linear', ease: 'ease' },
  ReduceMotion: { Never: 'never' },
  useSharedValue: (value: number) => {
    const React = require('react');
    return React.useRef({ value }).current;
  },
  useAnimatedProps: (callback: () => unknown) => callback(),
  withTiming: (...args: Parameters<typeof mockWithTiming>) => mockWithTiming(...args),
  withDelay: (_delay: number, animation: unknown) => animation,
  cancelAnimation: jest.fn(),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (callback: () => void) => callback() }));
jest.mock('@jamsch/react-native-hanzi-writer/lib/commonjs/components/AnimatedPath', () => () => null);
const { StrokeAnimator } = require('@jamsch/react-native-hanzi-writer/lib/commonjs/components/StrokeAnimator');
const stroke = { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], strokeNum: 0, getLength: () => 140 };

beforeEach(() => { mockCompletions.length = 0; mockWithTiming.mockClear(); });
it('does not complete a cancelled stroke', () => {
  const ref = React.createRef<any>();
  render(<StrokeAnimator ref={ref} stroke={stroke} strokeColor="black" strokeWidth={100} />);
  const onComplete = jest.fn();
  act(() => ref.current.animate({ duration: 500, onComplete }));
  act(() => mockCompletions[0](false));
  expect(onComplete).not.toHaveBeenCalled();
  act(() => mockCompletions[0](true));
  expect(onComplete).toHaveBeenCalledTimes(1);
});
it('keeps user-requested stroke teaching animation visible with Reduce Motion', () => {
  const ref = React.createRef<any>();
  render(<StrokeAnimator ref={ref} stroke={stroke} strokeColor="black" strokeWidth={100} />);
  act(() => ref.current.animate({ duration: 500, delay: 400 }));
  expect(mockWithTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 500, reduceMotion: 'never' }), expect.any(Function));
});

jest.mock('react-native-gesture-handler', () => ({ Gesture: {}, GestureDetector: () => null }));
const { CharacterAnimator, HanziWriterContext } = require('@jamsch/react-native-hanzi-writer/lib/commonjs/HanziWriter');
it('does not restart strokes during unrelated parent renders, and ignores a previous run after replay', () => {
  const completed = jest.fn();
  const state = { state: 'playing', animationKey: 'first', strokeDuration: 500, delayBetweenStrokes: 400 };
  const writer = {
    characterClass: { strokes: [stroke, { ...stroke, strokeNum: 1 }] },
    animator: { useStore: (selector: (value: unknown) => unknown) => selector(state), onAnimationComplete: completed },
  };
  const scene = () => <HanziWriterContext.Provider value={{ ...writer }}><CharacterAnimator /></HanziWriterContext.Provider>;
  const screen = render(scene());
  expect(mockWithTiming).toHaveBeenCalledTimes(2);
  for (let i = 0; i < 100; i++) screen.rerender(scene());
  expect(mockWithTiming).toHaveBeenCalledTimes(2);
  const staleCompletion = mockCompletions[1];
  state.animationKey = 'second';
  screen.rerender(scene());
  expect(mockWithTiming).toHaveBeenCalledTimes(4);
  act(() => staleCompletion(true));
  expect(completed).not.toHaveBeenCalled();
  act(() => mockCompletions[3](true));
  expect(completed).toHaveBeenCalledWith('second');
});
