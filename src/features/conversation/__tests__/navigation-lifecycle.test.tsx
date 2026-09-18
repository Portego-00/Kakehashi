/* eslint-disable @typescript-eslint/no-require-imports -- Jest factories load real helpers behind mocked IO boundaries. */
import React from 'react';
import { AppState, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { ConversationRuntimeProvider, useConversationRuntime, type ConversationRuntime } from '../conversation-runtime';
import { AI_CONSENT_VERSION, ConversationController } from '../use-conversation';
import { newArchive } from '../model';
import type { Archive } from '../types';
import type { LiveCallbacks } from '../live-transport-core';
import type { ResponseRequest } from '../api';
import { router } from 'expo-router';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockParentFocused }));
jest.mock('react-native/Libraries/AppState/AppState', () => ({ __esModule: true, default: { currentState: 'active', addEventListener: jest.fn() } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));
jest.mock('../credentials', () => ({ readKey: jest.fn(async () => 'test-key'), saveKey: jest.fn(), clearKey: jest.fn() }));
jest.mock('../storage', () => ({
  loadArchive: jest.fn(async () => mockArchive), loadFinalAssessmentTickets: jest.fn(async () => []),
  saveLearningSnapshot: jest.fn(async () => {}), exportArchive: (archive: Archive) => JSON.stringify(archive), importArchive: jest.fn(),
}));
jest.mock('../api', () => ({ ...jest.requireActual('../api'), apiForAccount: () => ({ respond: (request: ResponseRequest) => mockRespond(request) }) }));
jest.mock('../learning-context', () => ({
  ...jest.requireActual('../learning-context'),
  loadKakehashiContext: jest.fn(async () => ({ status: 'loaded', level: 8, words: [], prompt: 'Verified level 8', message: 'Loaded', retrievedAt: '2026-09-16T00:00:00Z' })),
}));
jest.mock('../kakehashi-tools', () => ({ KakehashiToolDefinitions: [], KakehashiLearningTools: class { execute = jest.fn(); dispose = jest.fn(); } }));
jest.mock('../live-transport', () => ({ createLiveTransport: jest.fn((callbacks: LiveCallbacks) => { mockCallbacks = callbacks; return mockTransport; }) }));
jest.mock('../../../utils/store', () => ({ useAuthStore: (select: (state: typeof mockAuth) => unknown) => select(mockAuth) }));
jest.mock('../conversation-tabs', () => ({ ConversationTabs: () => jest.requireActual<typeof import('react')>('react').createElement(mockRouteProbe) }));
jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn() },
  Redirect: ({ href }: { href: string }) => jest.requireActual<typeof import('react')>('react').createElement(jest.requireActual<typeof import('react-native')>('react-native').Text, { testID: 'redirect' }, href),
}));

const ConversationLayout: React.ComponentType = require('../../../../app/(app)/conversation/_layout').default;

let mockParentFocused = true;
let mockArchive: Archive;
let mockAuth: { apiToken: string | null; userData: { id: number; username: string } | null };
let mockCallbacks: LiveCallbacks;
const mockRespond = jest.fn(async (_request: ResponseRequest) => ({ text: 'こんにちは。', sources: [], usage: { input: 0, output: 0, searches: 0 } }));
const mockTransport = {
  started: false,
  connect: jest.fn(async () => {
    mockTransport.started = true;
    mockCallbacks.onEvent({ type: 'session.started', session: { id: 'live-test' } });
  }),
  send: jest.fn(() => true), mute: jest.fn(() => true), disconnect: jest.fn(),
  close: jest.fn(async () => { mockCallbacks.onEvent({ type: 'session.closed', usage: { seconds: 15 } }); return true; }),
};
let runtime: ConversationRuntime | null = null;

function Probe({ page }: { page: string }) {
  runtime = useConversationRuntime();
  return <Text testID="runtime-page">{`${page}:${runtime?.controller.session?.id ?? 'none'}`}</Text>;
}
function mockRouteProbe() { return <Probe page="talk" />; }
function Harness({ page = 'talk', accountId = '17', onExit }: { page?: string; accountId?: string; onExit?: () => void | Promise<void> }) {
  return <ConversationRuntimeProvider key={accountId} accountId={accountId} onExit={onExit}><Probe key={page} page={page} /></ConversationRuntimeProvider>;
}
const settle = async () => { await act(async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); await jest.advanceTimersByTimeAsync(0); }); };

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockParentFocused = true; runtime = null; mockTransport.started = false;
  mockAuth = { apiToken: 'signed-in', userData: { id: 17, username: 'Portego' } };
  mockArchive = newArchive(); mockArchive.preferences.aiConsentVersion = AI_CONSENT_VERSION;
  mockArchive.preferences.hasOnboarded = true; mockArchive.preferences.meaningVisible = false;
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

describe('shared Conversation native-tab runtime', () => {
  it('keeps one active controller and session when Talk, Themes, and Words child routes mount and unmount', async () => {
    const load = jest.spyOn(ConversationController.prototype, 'load');
    const dispose = jest.spyOn(ConversationController.prototype, 'dispose');
    const result = render(<Harness />); await settle();
    await act(async () => { await runtime!.controller.start(); });
    const id = runtime!.controller.session!.id;
    const start = runtime!.controller.start;
    for (const page of ['themes', 'words', 'talk']) {
      result.rerender(<Harness page={page} />); await settle();
      expect(screen.getByTestId('runtime-page').props.children).toBe(`${page}:${id}`);
      expect(runtime!.controller.connection).toBe('active');
      expect(runtime!.controller.start).toBe(start);
    }
    expect(load).toHaveBeenCalledTimes(1); expect(dispose).not.toHaveBeenCalled();
    expect(mockTransport.connect).toHaveBeenCalledTimes(1);
    expect(mockTransport.close).not.toHaveBeenCalled(); expect(mockTransport.disconnect).not.toHaveBeenCalled();
    result.unmount(); await settle();
    expect(dispose).toHaveBeenCalledTimes(1); expect(mockTransport.close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    load.mockRestore(); dispose.mockRestore();
  });

  it('stops audio when the enclosing Conversation stack route loses focus', async () => {
    const result = render(<Harness />); await settle();
    await act(async () => { await runtime!.controller.start(); });
    mockParentFocused = false;
    result.rerender(<Harness page="themes" />); await settle();
    expect(mockTransport.close).toHaveBeenCalledTimes(1);
    expect(runtime!.controller.connection).toBe('ended');
    result.unmount(); await settle();
  });

  it('keeps iOS permission-inactive state alive but ends the session when the app backgrounds', async () => {
    const result = render(<Harness />); await settle();
    await act(async () => { await runtime!.controller.start(); });
    act(() => { for (const [event, changed] of jest.mocked(AppState.addEventListener).mock.calls) if (event === 'change') changed('inactive'); });
    await settle(); expect(mockTransport.close).not.toHaveBeenCalled();
    act(() => { for (const [event, changed] of jest.mocked(AppState.addEventListener).mock.calls) if (event === 'change') changed('background'); });
    await settle(); expect(mockTransport.close).toHaveBeenCalledTimes(1);
    expect(runtime!.controller.connection).toBe('ended');
    result.unmount(); await settle();
  });

  it('disposes the old account before exposing a fresh account runtime', async () => {
    const dispose = jest.spyOn(ConversationController.prototype, 'dispose');
    const result = render(<Harness />); await settle();
    await act(async () => { await runtime!.controller.start(); });
    const oldStart = runtime!.controller.start;
    result.rerender(<Harness accountId="18" />); await settle();
    expect(dispose).toHaveBeenCalledTimes(1); expect(mockTransport.close).toHaveBeenCalledTimes(1);
    expect(runtime!.controller.accountId).toBe('18');
    expect(runtime!.controller.session).toBeNull();
    expect(runtime!.controller.start).not.toBe(oldStart);
    result.unmount(); await settle(); dispose.mockRestore();
  });

  it('awaits graceful session stop before navigating Home and ignores duplicate exit taps', async () => {
    const onExit = jest.fn();
    const result = render(<Harness onExit={onExit} />); await settle();
    await act(async () => { await runtime!.controller.start(); });
    let finish!: () => void;
    mockTransport.close.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(true); }));
    let first!: Promise<void>;
    act(() => { first = runtime!.exit!(); void runtime!.exit!(); });
    await settle(); expect(onExit).not.toHaveBeenCalled(); expect(mockTransport.close).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await first; });
    expect(onExit).toHaveBeenCalledTimes(1);
    result.unmount(); await settle();
  });
});

describe('Conversation native-route account gate', () => {
  it.each([
    { apiToken: 'signed-in', userData: { id: 18, username: 'Another learner' } },
    { apiToken: null, userData: { id: 17, username: 'Portego' } },
    { apiToken: 'signed-in', userData: null },
  ])('redirects before mounting any child controller for unauthorized access: %j', async auth => {
    mockAuth = auth;
    const load = jest.spyOn(ConversationController.prototype, 'load');
    render(<ConversationLayout />); await settle();
    expect(screen.getByTestId('redirect').props.children).toBe('/(app)/(tabs)');
    expect(load).not.toHaveBeenCalled(); expect(runtime).toBeNull();
  });

  it('unmounts and stops the shared session immediately when the signed-in account loses access', async () => {
    const result = render(<ConversationLayout />); await settle();
    await act(async () => { await runtime!.controller.start(); });
    mockAuth = { apiToken: 'another-token', userData: { id: 18, username: 'Another learner' } };
    result.rerender(<ConversationLayout />); await settle();
    expect(screen.getByTestId('redirect').props.children).toBe('/(app)/(tabs)');
    expect(mockTransport.close).toHaveBeenCalledTimes(1); expect(mockTransport.disconnect).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('returns Home through the parent route after stopping its shared conversation', async () => {
    const result = render(<ConversationLayout />); await settle();
    await act(async () => { await runtime!.controller.start(); });
    await act(async () => { await runtime!.exit!(); });
    expect(mockTransport.close).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/(app)/(tabs)');
    result.unmount(); await settle();
    expect(jest.getTimerCount()).toBe(0);
  });
});
