/* eslint-disable @typescript-eslint/no-require-imports -- Jest factories load mocked component dependencies locally. */
import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { VoiceChoices, voiceName } from '../conversation-voices';
import { VOICE_PREVIEW_SAMPLES } from '../voice-preview-samples';
import { LIVE_VOICES } from '../voices';
import { defaultPreferences } from '../model';
import type { ConversationController } from '../conversation-settings';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../use-conversation', () => ({ AI_CONSENT_VERSION: 2 }));
jest.mock('react-native/Libraries/AppState/AppState', () => ({ __esModule: true, default: { currentState: 'active', addEventListener: jest.fn() } }));
jest.mock('../../../utils/store', () => ({ useAuthStore: { getState: () => mockAuth, subscribe: jest.fn((callback) => { mockAuthChanged = callback; return jest.fn(); }) } }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(() => mockPlayer), setAudioModeAsync: jest.fn(async () => {}) }));
// Traps for the retired provider path, even after its modules have been removed.
jest.mock('../voice-preview-cache', () => ({ getVoicePreview: mockGenerate, readVoicePreview: mockReadCache, releaseVoicePreview: jest.fn() }), { virtual: true });
jest.mock('../credentials', () => ({ readKey: mockReadKey }));
jest.mock('../design', () => {
  const React = require('react'); const { Text } = require('react-native');
  return { colors: { secondary: '#666', border: '#ddd' }, styles: { secondary: {} }, Label: (props: object) => React.createElement(Text, props), Icon: () => null, Sheet: ({ children, visible }: { children: React.ReactNode; visible: boolean }) => visible ? children : null };
});

let mockAuth = { apiToken: 'wk-token', userData: { id: 17 } };
let mockAuthChanged: (state: typeof mockAuth, previous: typeof mockAuth) => void;
const mockGenerate = jest.fn(async () => { throw new Error('Could not create this voice preview. Check your OpenAI key, model access and connection.'); });
const mockReadCache = jest.fn(async () => null);
const mockReadKey = jest.fn(async () => { throw new Error('A key must not be read to play a bundled preview'); });
const mockPlayer = { pause: jest.fn(), remove: jest.fn(), play: jest.fn(), addListener: jest.fn((_event: string, _callback: (status: { isLoaded?: boolean; playing?: boolean; didJustFinish?: boolean; playbackState?: string; duration?: number }) => void) => ({ remove: jest.fn() })) };
const controller = (overrides = {}) => ({ accountId: '17', preferences: { ...defaultPreferences(), aiConsentVersion: 2 }, isRunning: false, hasKey: true, updatePreferences: jest.fn(), ...overrides } as unknown as ConversationController);
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(setAudioModeAsync).mockResolvedValue(undefined);
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
  mockAuth = { apiToken: 'wk-token', userData: { id: 17 } };
});

it.each([
  { hasKey: false, consent: null, label: 'without a key or consent' },
  { hasKey: true, consent: 2, label: 'when the former generation provider rejects' },
])('plays a bundled preview offline with an empty cache $label', async ({ hasKey, consent }) => {
  const network = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'));
  try {
    const result = render(<VoiceChoices controller={controller({ hasKey, preferences: { ...defaultPreferences(), aiConsentVersion: consent } })} />);
    await settle(); fireEvent.press(screen.getByLabelText('Preview Marin')); await settle();
    expect(screen.queryByRole('alert')?.props.children ?? null).toBeNull();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(createAudioPlayer).toHaveBeenCalledWith(VOICE_PREVIEW_SAMPLES.marin, { updateInterval: 100 });
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: true, shouldPlayInBackground: false, allowsRecording: false, interruptionMode: 'doNotMix' });
    expect(typeof VOICE_PREVIEW_SAMPLES.marin).toBe('number');
    expect(mockGenerate).not.toHaveBeenCalled(); expect(mockReadCache).not.toHaveBeenCalled();
    expect(mockReadKey).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
    result.unmount();
  } finally { network.mockRestore(); }
});

it('has an offline bundled asset for all 22 selectable voices and plays the selected sample', async () => {
  const result = render(<VoiceChoices controller={controller({ hasKey: false, preferences: { ...defaultPreferences(), aiConsentVersion: null } })} />);
  await settle();
  expect(Object.keys(VOICE_PREVIEW_SAMPLES).sort()).toEqual([...LIVE_VOICES].sort());
  for (const voice of LIVE_VOICES) {
    fireEvent.press(screen.getByLabelText(`Preview ${voiceName(voice)}`)); await settle();
    expect(typeof VOICE_PREVIEW_SAMPLES[voice]).toBe('number');
    expect(createAudioPlayer).toHaveBeenLastCalledWith(VOICE_PREVIEW_SAMPLES[voice], { updateInterval: 100 });
  }
  expect(mockPlayer.play).toHaveBeenCalledTimes(22);
  expect(mockGenerate).not.toHaveBeenCalled(); expect(mockReadKey).not.toHaveBeenCalled();
  result.unmount();
});

it('saves a selected voice without playing a sample, including during an active conversation', async () => {
  const c = controller({ isRunning: true });
  render(<VoiceChoices controller={c} />); await settle();
  fireEvent.press(screen.getByLabelText('Use Cedar voice'));
  expect(c.updatePreferences).toHaveBeenCalledWith({ voice: 'cedar' });
  expect(mockGenerate).not.toHaveBeenCalled(); expect(createAudioPlayer).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Preview Cedar').props.accessibilityState.disabled).toBe(true);
});

it('replays the same local asset and releases each player when stopped or closed', async () => {
  const result = render(<VoiceChoices controller={controller()} />); await settle();
  for (let index = 0; index < 2; index++) {
    fireEvent.press(screen.getByLabelText('Preview Marin')); await settle();
    act(() => mockPlayer.addListener.mock.calls[index][1]({ isLoaded: true, playing: true }));
    fireEvent.press(screen.getByLabelText('Stop Marin'));
  }
  expect(createAudioPlayer).toHaveBeenCalledTimes(2); expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  expect(mockPlayer.pause).toHaveBeenCalledTimes(2); expect(mockPlayer.remove).toHaveBeenCalledTimes(2);
  expect(mockGenerate).not.toHaveBeenCalled(); expect(mockReadCache).not.toHaveBeenCalled();
  result.unmount();
});

it('does not start playback after its pending audio setup finishes while the picker is closed', async () => {
  let finish!: () => void;
  jest.mocked(setAudioModeAsync).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const result = render(<VoiceChoices controller={controller()} />); await settle();
  expect(createAudioPlayer).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Preview Cedar')); await settle();
  expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
  result.unmount(); await act(async () => finish());
  expect(createAudioPlayer).not.toHaveBeenCalled();
});

it('stops playback if the app backgrounds or a conversation starts', async () => {
  const result = render(<VoiceChoices controller={controller()} />); await settle();
  fireEvent.press(screen.getByLabelText('Preview Marin'));
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  const stateChanged = jest.mocked(AppState.addEventListener).mock.calls[0][1];
  act(() => stateChanged('background'));
  expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
  act(() => stateChanged('active'));
  fireEvent.press(screen.getByLabelText('Preview Marin'));
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalledTimes(2));
  result.rerender(<VoiceChoices controller={controller({ isRunning: true })} />);
  expect(mockPlayer.remove).toHaveBeenCalledTimes(2);
});

it('discards pending playback after account identity changes', async () => {
  let finish!: () => void;
  jest.mocked(setAudioModeAsync).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<VoiceChoices controller={controller()} />); await settle();
  fireEvent.press(screen.getByLabelText('Preview Marin')); await settle();
  act(() => { const previous = mockAuth; mockAuth = { apiToken: 'other-token', userData: { id: 18 } }; mockAuthChanged(mockAuth, previous); });
  await act(async () => finish());
  expect(createAudioPlayer).not.toHaveBeenCalled();
});

it('releases the native player even if pausing an interrupted player throws', async () => {
  const result = render(<VoiceChoices controller={controller()} />); await settle();
  fireEvent.press(screen.getByLabelText('Preview Marin'));
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  mockPlayer.pause.mockImplementationOnce(() => { throw new Error('Already interrupted'); });
  result.unmount();
  expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
});

it('reports playback that loads but never starts without making a generation request', async () => {
  jest.useFakeTimers();
  try {
    const result = render(<VoiceChoices controller={controller()} />); await settle();
    fireEvent.press(screen.getByLabelText('Preview Marin')); await settle();
    expect(mockPlayer.play).toHaveBeenCalled();
    act(() => mockPlayer.addListener.mock.calls[0][1]({ isLoaded: true, playing: false }));
    act(() => jest.advanceTimersByTime(12_000));
    expect(screen.getByRole('alert').props.children).toContain('could not play');
    expect(mockPlayer.remove).toHaveBeenCalledTimes(1); expect(mockGenerate).not.toHaveBeenCalled();
    result.unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

it('reports a native playback failure as a local error and releases the player and listener', async () => {
  jest.useFakeTimers();
  try {
    const result = render(<VoiceChoices controller={controller()} />); await settle();
    fireEvent.press(screen.getByLabelText('Preview Marin')); await settle();
    const onStatus = mockPlayer.addListener.mock.calls[0][1];
    act(() => onStatus({ playbackState: 'failed' }));
    expect(screen.getByRole('alert').props.children).toBe('This included preview could not play. Please try again.');
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
    expect(mockPlayer.addListener.mock.results[0].value.remove).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Stop Marin')).toBeNull();
    // A late native event must not revive a failed preview or install another timer.
    act(() => onStatus({ playing: true, duration: 2 }));
    expect(screen.queryByLabelText('Stop Marin')).toBeNull();
    expect(mockGenerate).not.toHaveBeenCalled(); expect(mockReadKey).not.toHaveBeenCalled();
    result.unmount();
    // Flush testing-library's zero-delay act checks without advancing a playback deadline.
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

it.each([
  { duration: 2, deadline: 7_000, label: 'the sample duration plus five seconds' },
  { duration: 0, deadline: 45_000, label: '45 seconds when the duration is unknown' },
  { duration: 120, deadline: 60_000, label: '60 seconds for an excessive reported duration' },
])('releases playback that starts then stalls after $label', async ({ duration, deadline }) => {
  jest.useFakeTimers();
  try {
    const result = render(<VoiceChoices controller={controller()} />); await settle();
    fireEvent.press(screen.getByLabelText('Preview Marin')); await settle();
    const onStatus = mockPlayer.addListener.mock.calls[0][1];
    act(() => onStatus({ isLoaded: true, playing: true, duration }));
    expect(screen.getByLabelText('Stop Marin')).toBeTruthy();
    act(() => jest.advanceTimersByTime(deadline - 1));
    expect(mockPlayer.remove).not.toHaveBeenCalled(); expect(screen.queryByRole('alert')).toBeNull();
    // Repeated status events cannot indefinitely extend a stalled player's lifetime.
    act(() => onStatus({ isLoaded: true, playing: true, duration }));
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByRole('alert').props.children).toContain('could not play');
    expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
    expect(mockPlayer.addListener.mock.results[0].value.remove).toHaveBeenCalledTimes(1);
    expect(mockGenerate).not.toHaveBeenCalled();
    result.unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

it('releases a completed preview and clears its watchdog without reporting an error', async () => {
  jest.useFakeTimers();
  try {
    const result = render(<VoiceChoices controller={controller()} />); await settle();
    fireEvent.press(screen.getByLabelText('Preview Marin')); await settle();
    const onStatus = mockPlayer.addListener.mock.calls[0][1];
    act(() => onStatus({ playing: true, duration: 2 }));
    act(() => onStatus({ playing: false, didJustFinish: true }));
    expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByLabelText('Preview Marin')).toBeTruthy();
    result.unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
