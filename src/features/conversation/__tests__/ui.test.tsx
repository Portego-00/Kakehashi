/* eslint-disable @typescript-eslint/no-require-imports -- Hoisted Jest factories must load their dependencies locally; the route is loaded after its auth-store mock. */
import React from 'react';
import { Keyboard, Modal, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-screens/experimental';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ConversationScreen } from '../conversation-screen';
import { ConversationRuntimeProvider } from '../conversation-runtime';
import { getLanguage, MeaningLanguages } from '../languages';
import { newArchive, projectLearner } from '../model';
import { emptyKakehashiContext } from '../learning-context';
import { AI_CONSENT_VERSION, useConversation, type ConversationState } from '../use-conversation';
import type { TopicBrief } from '../types';

jest.mock('../use-conversation', () => ({ AI_CONSENT_VERSION: 2, useConversation: jest.fn() }));
jest.mock('../conversation-orb', () => ({ ConversationOrb: () => null }));
jest.mock('../conversation-tabs', () => ({ ConversationTabs: () => {
  const React = require('react');
  const { ConversationScreen } = require('../conversation-screen');
  return React.createElement(ConversationScreen, { accountId: '17' });
} }));
jest.mock('../backup-files', () => ({ pickLearningBackup: jest.fn(), shareLearningBackup: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-screens/experimental', () => ({ SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, props, children);
} }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn(async () => {}) }));
jest.mock('../../../utils/store', () => ({ useAuthStore: (select: (state: typeof mockAuth) => unknown) => select(mockAuth) }));
jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'route-redirect' }, href);
  },
}));

// Keep the route's auth-store dependencies behind the mocked boundary while
// exercising its actual access guard and screen mounting at runtime.
const ConversationRoute: React.ComponentType = require('../../../../app/(app)/conversation/_layout').default;

let mockAuth: { apiToken: string | null; userData: { id: number; username: string } | null };
const mockUseConversation = jest.mocked(useConversation);

function makeController(): ConversationState {
  const archive = newArchive();
  archive.preferences = { ...archive.preferences, hasOnboarded: true, aiConsentVersion: AI_CONSENT_VERSION, learningLanguageID: 'ja' };
  return {
    accountId: '17', learningContext: emptyKakehashiContext(),
    archive, preferences: archive.preferences, language: getLanguage('ja'), learner: projectLearner([], 'ja'),
    sessions: [], passages: [], session: null, connection: 'idle', selectedTheme: null,
    inputLevel: 0, outputLevel: 0, isMuted: false, voiceSession: false, working: false,
    loading: false, hasKey: true, meaning: '', translating: false, meaningError: null, error: null, notice: null, isRunning: false,
    start: jest.fn(async () => {}), stop: jest.fn(async () => {}), reset: jest.fn(), sendTyped: jest.fn(async () => true),
    toggleMute: jest.fn(), interrupt: jest.fn(), help: jest.fn(), chooseTheme: jest.fn(),
    updatePreferences: jest.fn(async () => {}), lookup: jest.fn(async () => 'A word meaning.'),
    currentTopic: jest.fn(), discuss: jest.fn(async () => {}), retryMeaning: jest.fn(),
    saveKey: jest.fn(async () => {}), clearKey: jest.fn(async () => {}), deleteSession: jest.fn(async () => {}),
    correctTranscript: jest.fn(async () => {}), toggleHiddenWord: jest.fn(async () => {}), deleteLearningData: jest.fn(async () => {}),
    exportData: jest.fn(() => '{}'), importData: jest.fn(async () => {}), clearError: jest.fn(),
  };
}

let controller: ConversationState;
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { apiToken: 'signed-in', userData: { id: 17, username: 'Portego' } };
  controller = makeController();
  mockUseConversation.mockImplementation(() => controller);
});

describe('conversation route access', () => {
  it.each([
    { apiToken: 'signed-in', userData: { id: 18, username: 'Another learner' } },
    { apiToken: null, userData: { id: 17, username: 'Portego' } },
    { apiToken: 'signed-in', userData: null },
  ])('redirects unauthorized access before creating a conversation controller: %j', auth => {
    mockAuth = auth;
    render(<ConversationRoute />);
    expect(screen.getByTestId('route-redirect').props.children).toBe('/(app)/(tabs)');
    expect(mockUseConversation).not.toHaveBeenCalled();
  });

  it('mounts the standalone screen with the signed-in Portego account and returns to Home', async () => {
    render(<ConversationRoute />);
    expect(screen.queryByTestId('route-redirect')).toBeNull();
    expect(screen.getByRole('button', { name: 'Talk', selected: true })).toBeTruthy();
    expect(mockUseConversation).toHaveBeenCalledWith(expect.objectContaining({ accountId: '17' }));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Back to Home' })));
    expect(router.dismissTo).toHaveBeenCalledWith('/(app)/(tabs)');
  });
});

describe('conversation onboarding', () => {
  it('fixes practice to Japanese, defaults help to English, and grants connected-learning consent only after agreement', async () => {
    controller.preferences.hasOnboarded = false;
    controller.preferences.aiConsentVersion = null;
    jest.mocked(controller.updatePreferences).mockImplementation(async changes => {
      controller.preferences = { ...controller.preferences, ...changes };
      controller.archive = { ...controller.archive, preferences: controller.preferences };
      controller.language = getLanguage(controller.preferences.learningLanguageID);
    });
    render(<ConversationScreen accountId="17" />);

    expect(screen.getByRole('header', { name: 'Japanese conversation' })).toBeTruthy();
    expect(screen.getByText(getLanguage('ja').greeting)).toBeTruthy();
    expect(screen.queryByText('What would you like to speak?')).toBeNull();
    expect(screen.queryByText('Español')).toBeNull();
    expect(screen.getByRole('button', { name: 'English', selected: true })).toBeTruthy();
    for (const name of MeaningLanguages.all) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByText(/your WaniKani level and relevant study items are sent to OpenAI/)).toBeTruthy();
    expect(screen.getByText(/Your WaniKani key stays in Kakehashi/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'French' }));
    expect(controller.updatePreferences).not.toHaveBeenCalled();
    expect(controller.start).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Agree and start learning' }));
    expect(controller.updatePreferences).toHaveBeenCalledWith({ learningLanguageID: 'ja', meaningLanguage: 'French', hasOnboarded: true, aiConsentVersion: AI_CONSENT_VERSION });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Conversation settings' })).toBeTruthy());
    expect(screen.getByLabelText('OpenAI API key')).toBeTruthy();
    expect(controller.start).not.toHaveBeenCalled();
  });
});

describe('WaniKani context details', () => {
  it('distinguishes a partial load from a verified zero studied-word count', () => {
    controller.learningContext = { ...emptyKakehashiContext(), status: 'partial', level: 14, message: 'Your WaniKani level loaded, but studied words could not be loaded. You can still practise.' };
    render(<ConversationScreen accountId="17" />);
    expect(screen.getByText('WaniKani · Level 14 · Partly loaded')).toBeTruthy();
    expect(screen.queryByText(/0 studied words/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'WaniKani practice context' }));
    expect(screen.getByText(controller.learningContext.message)).toBeTruthy();
    expect(screen.getByText('WaniKani level 14')).toBeTruthy();
    expect(screen.queryByText(/These studied words were loaded/)).toBeNull();
    expect(controller.start).not.toHaveBeenCalled();
  });

  it('explains unavailable context without inventing a level or studied words', () => {
    controller.learningContext = { ...emptyKakehashiContext(), status: 'unavailable', message: 'WaniKani information could not be loaded. You can still practise Japanese.' };
    render(<ConversationScreen accountId="17" />);
    expect(screen.getByText('WaniKani unavailable')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'WaniKani practice context' }));
    expect(screen.getByText(controller.learningContext.message)).toBeTruthy();
    expect(screen.queryByText(/^WaniKani level \d/)).toBeNull();
    expect(screen.queryByText(/These studied words were loaded/)).toBeNull();
  });

  it('shows the actual loaded level, words, readings and meanings without offering a second active session', () => {
    controller.isRunning = true;
    controller.learningContext = {
      ...emptyKakehashiContext(), status: 'loaded', level: 14,
      words: [{ id: 123, characters: '食べる', readings: ['たべる'], meanings: ['to eat'], level: 6 }],
      message: 'Loaded your WaniKani level and 1 studied words for this conversation.',
    };
    render(<ConversationScreen accountId="17" />);
    expect(screen.getByText('WaniKani · Level 14 · 1 studied words')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'WaniKani practice context' }));
    for (const text of ['WaniKani level 14', '食べる', 'たべる', 'to eat']) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText(/This is a small sample of lessons you have started/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start with my WaniKani words' })).toBeNull();
    expect(controller.start).not.toHaveBeenCalled();
  });

  it('starts context practice through the normal key guard', () => {
    controller.hasKey = false;
    render(<ConversationScreen accountId="17" />);
    fireEvent.press(screen.getByRole('button', { name: 'WaniKani practice context' }));
    fireEvent.press(screen.getByRole('button', { name: 'Start with my WaniKani words' }));
    expect(screen.getByRole('header', { name: 'Conversation settings' })).toBeTruthy();
    expect(screen.getByLabelText('OpenAI API key')).toBeTruthy();
    expect(controller.start).not.toHaveBeenCalled();
  });
});

describe('conversation navigation', () => {
  it.each(['loading', 'onboarding'])('protects fixed %s content from the native tab bar bottom inset', state => {
    controller.loading = state === 'loading';
    controller.preferences.hasOnboarded = false;
    render(<ConversationScreen accountId="17" page="talk" navigationMode="native" />);
    expect(screen.UNSAFE_getByType(NativeSafeAreaView).props.edges).toEqual({ top: true, bottom: true, left: true, right: true });
    if (state === 'onboarding') expect(screen.getByRole('button', { name: 'Agree and start learning' })).toBeTruthy();
  });

  it('shares one controller across routed pages and delegates navigation without an internal tab bar', () => {
    const onNavigate = jest.fn();
    const result = render(<ConversationRuntimeProvider accountId="17">
      <ConversationScreen accountId="17" page="themes" onNavigate={onNavigate} navigationMode="native" />
      <ConversationScreen accountId="17" page="words" onNavigate={onNavigate} navigationMode="native" />
    </ConversationRuntimeProvider>);
    expect(mockUseConversation).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Search conversation themes')).toBeTruthy();
    expect(screen.getByLabelText('Search vocabulary')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    for (const safeArea of screen.UNSAFE_getAllByType(NativeSafeAreaView)) expect(safeArea.props.edges.bottom).toBe(true);
    expect(screen.UNSAFE_queryAllByType(SafeAreaView)).toHaveLength(0);
    fireEvent.press(screen.getAllByRole('button', { name: 'Talk home' })[0]);
    expect(onNavigate).toHaveBeenCalledWith('talk');
    expect(controller.stop).not.toHaveBeenCalled();
    result.rerender(<ConversationRuntimeProvider accountId="17"><ConversationScreen accountId="17" page="talk" onNavigate={onNavigate} navigationMode="native" /></ConversationRuntimeProvider>);
    expect(screen.queryByLabelText('Search conversation themes')).toBeNull();
    expect(screen.getByRole('button', { name: 'Type instead' })).toBeTruthy();
    expect(controller.stop).not.toHaveBeenCalled();
  });

  it('dismisses search and reply keyboards when navigating or returning Home', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    try {
      const onExit = jest.fn();
      render(<ConversationScreen accountId="17" onExit={onExit} />);
      dismiss.mockClear();
      fireEvent.press(screen.getByRole('button', { name: 'Themes' }));
      expect(dismiss).toHaveBeenCalled();
      fireEvent.changeText(screen.getByLabelText('Search conversation themes'), 'coffee');
      dismiss.mockClear();
      fireEvent.press(screen.getByRole('button', { name: 'Talk' }));
      expect(dismiss).toHaveBeenCalled();
      fireEvent.press(screen.getByRole('button', { name: 'Type instead' }));
      fireEvent.changeText(screen.getByLabelText('Your reply'), 'こんにちは');
      dismiss.mockClear();
      fireEvent.press(screen.getByRole('button', { name: 'Close Type a reply' }));
      expect(dismiss).toHaveBeenCalled();
      dismiss.mockClear();
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Back to Home' })));
      expect(dismiss).toHaveBeenCalled();
      expect(onExit).toHaveBeenCalledTimes(1);
    } finally { dismiss.mockRestore(); }
  });

  it.each(['Talk', 'Themes', 'Words'])('returns Home from %s while retaining only the three internal destinations', async page => {
    const onExit = jest.fn();
    render(<ConversationScreen accountId="17" onExit={onExit} />);
    if (page !== 'Talk') fireEvent.press(screen.getByRole('button', { name: page }));
    expect(screen.getByRole('button', { name: page, selected: true })).toBeTruthy();
    for (const name of ['Talk', 'Themes', 'Words']) expect(screen.getByRole('button', { name })).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Back to Home' })));
    expect(controller.stop).toHaveBeenCalledWith('Returned to Home');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it.each(['loading', 'onboarding'])('keeps a way Home during %s without granting consent', async state => {
    controller.loading = state === 'loading';
    controller.preferences.hasOnboarded = false;
    const onExit = jest.fn();
    render(<ConversationScreen accountId="17" onExit={onExit} />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Back to Home' })));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(controller.updatePreferences).not.toHaveBeenCalled();
    expect(controller.start).not.toHaveBeenCalled();
  });

  it('finishes an active conversation before leaving and ignores repeated taps while saving', async () => {
    controller.connection = 'active'; controller.isRunning = true; controller.voiceSession = true;
    let finishStop: () => void = () => { throw new Error('Stopping must start first.'); };
    jest.mocked(controller.stop).mockImplementation(() => new Promise(resolve => { finishStop = resolve; }));
    const onExit = jest.fn();
    render(<ConversationScreen accountId="17" onExit={onExit} />);
    const home = screen.getByRole('button', { name: 'Back to Home' });
    fireEvent.press(home);
    fireEvent.press(home);
    expect(controller.stop).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Back to Home', disabled: true, busy: true })).toBeTruthy();
    expect(mockUseConversation).toHaveBeenLastCalledWith({ accountId: '17', active: false });
    expect(screen.getByRole('button', { name: 'Mute microphone', disabled: true })).toBeTruthy();
    await act(async () => finishStop());
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('still exits when graceful closing fails so unmount can disconnect the microphone', async () => {
    controller.connection = 'active'; controller.isRunning = true;
    jest.mocked(controller.stop).mockRejectedValue(new Error('Transport has already closed.'));
    const onExit = jest.fn();
    render(<ConversationScreen accountId="17" onExit={onExit} />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Back to Home' })));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('does not navigate again if hardware navigation unmounts the screen during stopping', async () => {
    let finishStop: () => void = () => { throw new Error('Stopping must start first.'); };
    jest.mocked(controller.stop).mockImplementation(() => new Promise(resolve => { finishStop = resolve; }));
    const onExit = jest.fn();
    const result = render(<ConversationScreen accountId="17" onExit={onExit} />);
    fireEvent.press(screen.getByRole('button', { name: 'Back to Home' }));
    result.unmount();
    await act(async () => finishStop());
    expect(onExit).not.toHaveBeenCalled();
  });

  it('allows retrying Home when navigation itself fails', async () => {
    const onExit = jest.fn().mockRejectedValueOnce(new Error('Navigation unavailable.')).mockResolvedValueOnce(undefined);
    render(<ConversationScreen accountId="17" onExit={onExit} />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Back to Home' })));
    expect(screen.getByText('Navigation unavailable.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Home', disabled: false })).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Back to Home' })));
    expect(onExit).toHaveBeenCalledTimes(2);
  });

  it('filters real language themes, selects one, and opens the vocabulary page', () => {
    render(<ConversationScreen accountId="17" />);
    fireEvent.press(screen.getByRole('button', { name: 'Themes' }));
    expect(screen.getByRole('button', { name: 'Themes', selected: true })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'What’s on your mind?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All themes', selected: true })).toBeTruthy();

    const theme = controller.language.themes[0];
    fireEvent.changeText(screen.getByLabelText('Search conversation themes'), theme.title);
    expect(screen.queryByRole('button', { name: `${controller.language.themes[1].title}. ${controller.language.themes[1].subtitle}` })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: `${theme.title}. ${theme.subtitle}` }));
    expect(controller.chooseTheme).toHaveBeenCalledWith(theme);
    expect(screen.getByRole('button', { name: 'Talk', selected: true })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Words' }));
    expect(screen.getByRole('button', { name: 'Words', selected: true })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Your words.' })).toBeTruthy();
    expect(screen.getByText('Your words will appear here.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search vocabulary'), 'not learned yet');
    expect(screen.getByText('No matching words')).toBeTruthy();
  });

  it('shows sourced search results and passes the chosen topic to the conversation', async () => {
    const topic: TopicBrief = { id: 'topic-1', languageID: 'ja', query: 'A new train route', text: 'A new regional route connects two cities.', sources: [{ title: 'Railway announcement', url: 'https://example.com/rail' }], retrievedAt: 800_000_000 };
    jest.mocked(controller.currentTopic).mockResolvedValue(topic);
    render(<ConversationScreen accountId="17" />);
    fireEvent.press(screen.getByRole('button', { name: 'Themes' }));
    const currentTheme = controller.language.themes.find(theme => theme.id === 'today');
    if (!currentTheme) throw new Error('The language must offer a current affairs theme.');
    fireEvent.changeText(screen.getByLabelText('Search conversation themes'), currentTheme.title);
    fireEvent.press(screen.getByRole('button', { name: `${currentTheme.title}. ${currentTheme.subtitle}` }));
    expect(screen.getByRole('header', { name: 'The world today' })).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Current conversation topic'), '  A new train route  ');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Find a topic' })));
    expect(controller.currentTopic).toHaveBeenCalledWith('A new train route');
    expect(screen.getByRole('header', { name: 'A current topic' })).toBeTruthy();
    expect(screen.getByText(topic.text)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Railway announcement' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: "Let's talk about this" }));
    expect(controller.discuss).toHaveBeenCalledWith(topic);
    expect(screen.getByRole('button', { name: 'Talk', selected: true })).toBeTruthy();
  });

  it('does not reopen a dismissed topic search when its response arrives later', async () => {
    let finishSearch: (topic: TopicBrief) => void = () => { throw new Error('Search must start first.'); };
    jest.mocked(controller.currentTopic).mockImplementation(() => new Promise(resolve => { finishSearch = resolve; }));
    render(<ConversationScreen accountId="17" />);
    fireEvent.press(screen.getByRole('button', { name: 'Themes' }));
    const theme = controller.language.themes.find(item => item.id === 'today');
    if (!theme) throw new Error('The language must offer a current affairs theme.');
    fireEvent.changeText(screen.getByLabelText('Search conversation themes'), theme.title);
    fireEvent.press(screen.getByRole('button', { name: `${theme.title}. ${theme.subtitle}` }));
    fireEvent.changeText(screen.getByLabelText('Current conversation topic'), 'A new train route');
    fireEvent.press(screen.getByRole('button', { name: 'Find a topic' }));
    expect(controller.currentTopic).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: 'Close The world today' }));
    fireEvent.press(screen.getByRole('button', { name: 'Conversation settings' }));

    await act(async () => finishSearch({ id: 'late-topic', languageID: 'ja', query: 'A new train route', text: 'This result arrived after dismissal.', sources: [], retrievedAt: 800_000_000 }));
    expect(screen.queryByRole('header', { name: 'A current topic' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Conversation settings' })).toBeTruthy();
    expect(controller.discuss).not.toHaveBeenCalled();
  });
});

describe('conversation sheets', () => {
  it('opens full offline license text and returns through nested notices to settings', () => {
    const result = render(<ConversationScreen accountId="17" />);
    fireEvent.press(screen.getByRole('button', { name: 'Conversation settings' }));
    fireEvent.press(screen.getByRole('button', { name: 'Open-source licenses' }));
    expect(screen.getByRole('header', { name: 'Open-source licenses' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Mural, MIT' }));
    expect(screen.getByRole('header', { name: 'Mural' })).toBeTruthy();
    expect(screen.getByText(/Copyright \(c\) 2026 Hackmamba/)).toBeTruthy();
    expect(screen.getByText(/THE SOFTWARE IS PROVIDED "AS IS"/)).toBeTruthy();
    expect(result.UNSAFE_getAllByType(Modal)).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: 'Close Mural' }));
    expect(screen.getByRole('header', { name: 'Open-source licenses' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Close Open-source licenses' }));
    expect(screen.getByRole('header', { name: 'Conversation settings' })).toBeTruthy();
  });

  it('keeps Japanese fixed and one native modal through translation choices and destructive confirmations', async () => {
    const result = render(<ConversationScreen accountId="17" />);
    const expectOneVisibleModal = (title: string) => {
      const modals = result.UNSAFE_getAllByType(Modal);
      expect(modals).toHaveLength(1);
      expect(modals[0].props.visible).toBe(true);
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
    };
    fireEvent.press(screen.getByRole('button', { name: 'Conversation settings' }));
    expectOneVisibleModal('Conversation settings');
    expect(screen.getByRole('button', { name: '15 minutes', selected: true })).toBeTruthy();
    expect(screen.getByLabelText('Practice language: Japanese')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Practice language: Japanese' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Choose translation and explanation language' }));
    expectOneVisibleModal('Translation language');
    expect(screen.queryByRole('header', { name: 'Conversation settings' })).toBeNull();
    for (const name of MeaningLanguages.all) expect(screen.getByRole('button', { name })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'French' }));
    expect(controller.updatePreferences).toHaveBeenCalledWith({ meaningLanguage: 'French' });
    expect(controller.language.id).toBe('ja');
    expectOneVisibleModal('Conversation settings');

    fireEvent.press(screen.getByRole('button', { name: 'Delete all conversation learning' }));
    expectOneVisibleModal('Delete your learning records?');
    expect(controller.deleteLearningData).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expectOneVisibleModal('Conversation settings');
    expect(controller.deleteLearningData).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Remove saved key' }));
    expectOneVisibleModal('Remove your API key?');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Remove key' })));
    expect(controller.clearKey).toHaveBeenCalledTimes(1);
    expectOneVisibleModal('Conversation settings');
    expect(screen.getByText('API key removed.')).toBeTruthy();
  });
});

describe('Android accessibility semantics', () => {
  it('retains selected tabs and translation/duration radio choices on Android', () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      render(<ConversationScreen accountId="17" />);
      expect(screen.getByRole('tab', { name: 'Talk', selected: true })).toBeTruthy();
      fireEvent.press(screen.getByRole('tab', { name: 'Themes' }));
      expect(screen.getByRole('tab', { name: 'Themes', selected: true })).toBeTruthy();
      expect(screen.getByRole('tab', { name: 'All themes', selected: true })).toBeTruthy();
      const category = controller.language.themes[0].category;
      fireEvent.press(screen.getByRole('tab', { name: `${category} themes` }));
      expect(screen.getByRole('tab', { name: `${category} themes`, selected: true })).toBeTruthy();

      fireEvent.press(screen.getByRole('button', { name: 'Conversation settings' }));
      expect(screen.getByRole('radio', { name: '15 minutes', selected: true })).toBeTruthy();
      expect(screen.getByLabelText('Practice language: Japanese')).toBeTruthy();
      expect(screen.queryByRole('radio', { name: /Japanese/ })).toBeNull();
      fireEvent.press(screen.getByRole('button', { name: 'Choose translation and explanation language' }));
      expect(screen.getByRole('radio', { name: 'English', selected: true })).toBeTruthy();
      fireEvent.press(screen.getByRole('radio', { name: 'French' }));
      expect(controller.updatePreferences).toHaveBeenCalledWith({ meaningLanguage: 'French' });
    } finally {
      platform.restore();
    }
  });
});

describe('written replies', () => {
  it.each(['rejected', 'false'] as const)('keeps the original draft on a %s send and clears it only after success', async failure => {
    const send = jest.mocked(controller.sendTyped);
    if (failure === 'rejected') send.mockRejectedValueOnce(new Error('Connection unavailable.'));
    else send.mockResolvedValueOnce(false);
    send.mockResolvedValueOnce(true);
    render(<ConversationScreen accountId="17" />);
    fireEvent.press(screen.getByRole('button', { name: 'Type instead' }));
    fireEvent.changeText(screen.getByLabelText('Your reply'), '  こんにちは、元気ですか？  ');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send reply' })));
    expect(send).toHaveBeenNthCalledWith(1, 'こんにちは、元気ですか？');
    expect(screen.getByLabelText('Your reply').props.value).toBe('  こんにちは、元気ですか？  ');
    if (failure === 'rejected') expect(screen.getAllByRole('alert').some(alert => alert.props.children === 'Connection unavailable.')).toBe(true);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send reply' })));
    expect(send).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText('Your reply')).toBeNull();
    expect(screen.queryByText('Connection unavailable.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Type instead' }));
    expect(screen.getByLabelText('Your reply').props.value).toBe('');
  });
});
