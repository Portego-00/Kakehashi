/* eslint-disable @typescript-eslint/no-require-imports -- Hoisted native mocks load their dependencies inside the factory. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import * as Native from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { darkTheme, lightTheme, midnightTheme, sepiaTheme, ThemeProvider, useTheme, type ThemeMode } from '../../../utils/theme';
import { createConversationTheme, useConversationTheme } from '../conversation-theme';
import { ConversationScreen } from '../conversation-screen';
import { newArchive, projectLearner } from '../model';
import { getLanguage } from '../languages';
import { emptyKakehashiContext } from '../learning-context';
import { AI_CONSENT_VERSION, useConversation, type ConversationState } from '../use-conversation';

jest.mock('../use-conversation', () => ({ AI_CONSENT_VERSION: 2, useConversation: jest.fn() }));
jest.mock('../conversation-orb', () => ({ ConversationOrb: () => null }));
jest.mock('../backup-files', () => ({ pickLearningBackup: jest.fn(), shareLearningBackup: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-screens/experimental', () => ({ SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => {
  const React = require('react');
  return React.createElement(require('react-native').View, props, children);
} }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn(async () => {}) }));
jest.mock('../../../utils/store', () => ({ useAuthStore: { subscribe: jest.fn(() => jest.fn()) } }));

const presets = { light: lightTheme, dark: darkTheme, midnight: midnightTheme, sepia: sepiaTheme };
let currentTheme: ReturnType<typeof useConversationTheme>;
let selectTheme: ReturnType<typeof useTheme>['setThemeMode'];
let controller: ConversationState;
let controllerMounts = 0;
let controllerUnmounts = 0;

function ThemeProbe() {
  currentTheme = useConversationTheme();
  selectTheme = useTheme().setThemeMode;
  return <Native.View testID="palette" style={{ backgroundColor: currentTheme.colors.cream }} />;
}
function App({ conversation = false }: { conversation?: boolean }) {
  return <ThemeProvider><ThemeProbe />{conversation ? <ConversationScreen accountId="17" /> : null}</ThemeProvider>;
}
async function changeTheme(mode: ThemeMode) {
  await act(async () => { await selectTheme(mode); });
}
function makeController(): ConversationState {
  const archive = newArchive();
  archive.preferences = { ...archive.preferences, hasOnboarded: true, aiConsentVersion: AI_CONSENT_VERSION, learningLanguageID: 'ja' };
  return {
    accountId: '17', learningContext: emptyKakehashiContext(), archive, preferences: archive.preferences,
    language: getLanguage('ja'), learner: projectLearner([], 'ja'), sessions: [], passages: [], session: null,
    connection: 'active', selectedTheme: null, inputLevel: 0, outputLevel: 0, isMuted: false, voiceSession: true, working: false,
    loading: false, hasKey: true, meaning: '', translating: false, meaningError: null, error: null, notice: null, isRunning: true,
    start: jest.fn(async () => {}), stop: jest.fn(async () => {}), reset: jest.fn(), sendTyped: jest.fn(async () => true),
    toggleMute: jest.fn(), interrupt: jest.fn(), help: jest.fn(), chooseTheme: jest.fn(), updatePreferences: jest.fn(async () => {}),
    lookup: jest.fn(async () => 'Meaning'), currentTopic: jest.fn(), discuss: jest.fn(async () => {}), retryMeaning: jest.fn(),
    saveKey: jest.fn(async () => {}), clearKey: jest.fn(async () => {}), deleteSession: jest.fn(async () => {}),
    correctTranscript: jest.fn(async () => {}), toggleHiddenWord: jest.fn(async () => {}), deleteLearningData: jest.fn(async () => {}),
    exportData: jest.fn(() => '{}'), importData: jest.fn(async () => {}), clearError: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('light');
  jest.spyOn(Native, 'useColorScheme').mockReturnValue('light');
  jest.spyOn(Native.Appearance, 'setColorScheme').mockImplementation(() => {});
  jest.spyOn(Native.Keyboard, 'dismiss').mockImplementation(() => {});
  controller = makeController(); controllerMounts = 0; controllerUnmounts = 0;
  jest.mocked(useConversation).mockImplementation(function useTrackedConversation() {
    useEffect(() => { controllerMounts++; return () => { controllerUnmounts++; }; }, []);
    return controller;
  });
});
afterEach(() => jest.restoreAllMocks());

describe('Conversation follows the global app theme', () => {
  it.each(Object.entries(presets))('uses the saved %s preset even with an opposite system appearance', async (mode, theme) => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(mode);
    jest.mocked(Native.useColorScheme).mockReturnValue(theme.isDark ? 'light' : 'dark');
    render(<App />);
    await screen.findByTestId('palette');
    expect(currentTheme.colors).toEqual(expect.objectContaining({ cream: theme.backgroundColor, paper: theme.cardBackground, ink: theme.textColor, secondary: theme.textSecondary, orange: theme.primary, border: theme.border }));
    expect(currentTheme.isDark).toBe(theme.isDark);
    expect(currentTheme.orb.baseMid).toBe(theme.primary);
    expect(currentTheme.orb.secondary).toBe(theme.secondary);
    expect(currentTheme.orb.accent).toBe(theme.accent);
    expect(Native.Appearance.setColorScheme).toHaveBeenLastCalledWith(theme.isDark ? 'dark' : 'light');
  });

  it('follows system changes only in system mode and resumes following after an override', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('system');
    const app = render(<App />);
    await screen.findByTestId('palette');
    expect(currentTheme.colors.cream).toBe(lightTheme.backgroundColor);
    jest.mocked(Native.useColorScheme).mockReturnValue('dark');
    app.rerender(<App />);
    await waitFor(() => expect(currentTheme.colors.cream).toBe(darkTheme.backgroundColor));
    await changeTheme('sepia');
    jest.mocked(Native.useColorScheme).mockReturnValue('light');
    app.rerender(<App />);
    expect(currentTheme.colors.cream).toBe(sepiaTheme.backgroundColor);
    await changeTheme('system');
    expect(currentTheme.colors.cream).toBe(lightTheme.backgroundColor);
    expect(Native.Appearance.setColorScheme).toHaveBeenLastCalledWith('unspecified');
  });

  it('keeps the native appearance override when Conversation unmounts and resets only with the global provider', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('midnight');
    const app = render(<App conversation />);
    await screen.findByText('Type instead');
    expect(Native.Appearance.setColorScheme).toHaveBeenLastCalledWith('dark');
    jest.mocked(Native.Appearance.setColorScheme).mockClear();
    app.rerender(<App />);
    expect(Native.Appearance.setColorScheme).not.toHaveBeenCalled();
    expect(currentTheme.colors.cream).toBe(midnightTheme.backgroundColor);
    app.unmount();
    expect(Native.Appearance.setColorScheme).toHaveBeenCalledTimes(1);
    expect(Native.Appearance.setColorScheme).toHaveBeenCalledWith('unspecified');
  });

  it('recolors an open reply sheet and keyboard without losing its draft, presenter, or active controller', async () => {
    render(<App conversation />);
    await screen.findByText('Type instead');
    fireEvent.press(screen.getByText('Type instead'));
    fireEvent.changeText(screen.getByLabelText('Your reply'), '週末は映画を見ます');
    const originalModal = screen.UNSAFE_getByType(Native.Modal);
    jest.mocked(Native.Keyboard.dismiss).mockClear();
    for (const [mode, theme] of Object.entries(presets)) {
      await changeTheme(mode as ThemeMode);
      const input = screen.getByLabelText('Your reply');
      expect(input.props.value).toBe('週末は映画を見ます');
      expect(input.props.keyboardAppearance).toBe(theme.isDark ? 'dark' : 'light');
      expect(input.props.selectionColor).toBe(theme.primary);
      expect(Native.StyleSheet.flatten(input.props.style)).toEqual(expect.objectContaining({ color: theme.textColor, backgroundColor: theme.cardBackground, borderColor: theme.border }));
      const modal = screen.UNSAFE_getByType(Native.Modal);
      expect(modal).toBe(originalModal);
      expect(Native.StyleSheet.flatten(modal.findAllByType(Native.View)[0].props.style).backgroundColor).toBe(theme.backgroundColor);
      expect(screen.UNSAFE_getAllByType(Native.Modal)).toHaveLength(1);
      expect(screen.getByRole('header', { name: 'Type a reply' })).toBeTruthy();
    }
    expect(controllerMounts).toBe(1);
    expect(controllerUnmounts).toBe(0);
    expect(controller.stop).not.toHaveBeenCalled();
    expect(controller.updatePreferences).not.toHaveBeenCalled();
    expect(Native.Keyboard.dismiss).not.toHaveBeenCalled();
  });

  it('updates visible theme cards without resetting the list search', async () => {
    render(<App conversation />);
    await screen.findByText('Type instead');
    fireEvent.press(screen.getByRole('button', { name: 'Themes' }));
    const theme = controller.language.themes[0];
    fireEvent.changeText(screen.getByLabelText('Search conversation themes'), theme.title);
    const label = `${theme.title}. ${theme.subtitle}`;
    const originalColor = Native.StyleSheet.flatten(screen.getByRole('button', { name: label }).props.style).backgroundColor;
    await changeTheme('midnight');
    expect(screen.getByLabelText('Search conversation themes').props.value).toBe(theme.title);
    const card = screen.getByRole('button', { name: label });
    expect(Native.StyleSheet.flatten(card.props.style).backgroundColor).toBe(createConversationTheme(midnightTheme).panels[theme.colorIndex % 4]);
    expect(Native.StyleSheet.flatten(card.props.style).backgroundColor).not.toBe(originalColor);
    expect(controllerMounts).toBe(1);
    expect(controller.stop).not.toHaveBeenCalled();
  });
});
