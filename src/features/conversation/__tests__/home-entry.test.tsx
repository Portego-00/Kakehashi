import React from 'react';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ConversationHomeEntry } from '../conversation-home-entry';
import { ConversationOrb } from '../conversation-orb';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native/Libraries/AppState/AppState', () => ({ __esModule: true, default: { currentState: 'active', addEventListener: jest.fn() } }));
jest.mock('../conversation-orb', () => ({ ConversationOrb: jest.fn(() => null) }));
jest.mock('../../../utils/theme', () => ({ useTheme: () => ({ theme: mockTheme }) }));

let mockTheme = { primary: '#333', cardBackground: '#fff', border: '#ddd', textColor: '#111', textSecondary: '#555' };
const mockOrb = jest.mocked(ConversationOrb);
const mockFocused = jest.mocked(useIsFocused);
let updateAppState: (state: AppStateStatus) => void;
const removeListener = jest.fn();

function expectOrbActive(active: boolean) {
  expect(mockOrb.mock.lastCall?.[0]).toEqual(expect.objectContaining({ size: 112, active }));
}

describe('private Home conversation entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused.mockReturnValue(true);
    mockTheme = { primary: '#333', cardBackground: '#fff', border: '#ddd', textColor: '#111', textSecondary: '#555' };
    jest.replaceProperty(AppState, 'currentState', 'active');
    updateAppState = () => { throw new Error('The authorized widget must subscribe first.'); };
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      updateAppState = listener;
      return { remove: removeListener };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    { username: 'Another learner', signedIn: true },
    { username: 'Portego', signedIn: false },
    { username: undefined, signedIn: true },
  ])('hides the entry without the required signed-in account: %j', props => {
    render(<ConversationHomeEntry {...props} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(mockOrb).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('opens the standalone conversation screen for Portego', () => {
    render(<ConversationHomeEntry username=" Portego " signedIn />);
    expect(screen.getByText('Japanese conversation')).toBeTruthy();
    expect(screen.getByText('Let’s talk')).toBeTruthy();
    expectOrbActive(true);
    fireEvent.press(screen.getByRole('button', { name: 'Open Japanese conversation' }));
    expect(router.push).toHaveBeenCalledWith('/conversation');
  });

  it('pauses the shared orb when Home loses focus or the caller marks it inactive', () => {
    const result = render(<ConversationHomeEntry username="Portego" signedIn />);
    expectOrbActive(true);
    mockFocused.mockReturnValue(false);
    result.rerender(<ConversationHomeEntry username="Portego" signedIn />);
    expectOrbActive(false);
    mockFocused.mockReturnValue(true);
    result.rerender(<ConversationHomeEntry username="Portego" signedIn active={false} />);
    expectOrbActive(false);
    result.rerender(<ConversationHomeEntry username="Portego" signedIn active />);
    expectOrbActive(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('pauses for background and inactive states, then resumes when the app becomes active', () => {
    render(<ConversationHomeEntry username="Portego" signedIn />);
    act(() => updateAppState('background'));
    expectOrbActive(false);
    act(() => updateAppState('inactive'));
    expectOrbActive(false);
    act(() => updateAppState('active'));
    expectOrbActive(true);
  });

  it('starts with a static orb if mounted while the app is already backgrounded', () => {
    jest.replaceProperty(AppState, 'currentState', 'background');
    render(<ConversationHomeEntry username="Portego" signedIn />);
    expectOrbActive(false);
  });

  it('renders a static customization preview that cannot open a conversation', () => {
    render(<ConversationHomeEntry username="Portego" signedIn previewMode />);
    expect(screen.queryByRole('button')).toBeNull();
    expectOrbActive(false);
    fireEvent.press(screen.getByLabelText('Japanese conversation preview'));
    act(() => updateAppState('background'));
    act(() => updateAppState('active'));
    expectOrbActive(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('stacks the orb above the copy in a narrow preview without reducing the text or orb size', () => {
    render(<ConversationHomeEntry username="Portego" signedIn previewMode />);
    const preview = screen.getByLabelText('Japanese conversation preview');
    fireEvent(preview, 'layout', { nativeEvent: { layout: { width: 240, height: 180, x: 0, y: 0 } } });
    expect(StyleSheet.flatten(screen.getByLabelText('Japanese conversation preview').props.style).flexDirection).toBe('column-reverse');
    expectOrbActive(false);
    expect(screen.getByText('Japanese conversation').props.numberOfLines).toBeUndefined();
    fireEvent(preview, 'layout', { nativeEvent: { layout: { width: 800, height: 180, x: 0, y: 0 } } });
    expect(StyleSheet.flatten(screen.getByLabelText('Japanese conversation preview').props.style).flexDirection).toBe('row');
  });

  it('unmounts the orb and its listener if authorization is removed', () => {
    const result = render(<ConversationHomeEntry username="Portego" signedIn />);
    mockOrb.mockClear();
    result.rerender(<ConversationHomeEntry username="Portego" signedIn={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(mockOrb).not.toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('cleans up the app-state listener when the widget is removed', () => {
    const result = render(<ConversationHomeEntry username="Portego" signedIn />);
    result.unmount();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('uses the Home theme and accepts the dashboard spacing override', () => {
    mockTheme = { primary: '#85b6ff', cardBackground: '#1e1e1e', border: '#333', textColor: '#f5f5f5', textSecondary: '#b0b0b0' };
    render(<ConversationHomeEntry username="Portego" signedIn style={{ marginBottom: 24 }} />);
    const card = screen.getByRole('button', { name: 'Open Japanese conversation' });
    expect(StyleSheet.flatten(card.props.style)).toEqual(expect.objectContaining({ backgroundColor: '#1e1e1e', borderColor: '#333', marginBottom: 24 }));
    expect(StyleSheet.flatten(screen.getByText('Japanese conversation').props.style).color).toBe('#f5f5f5');
    expect(StyleSheet.flatten(screen.getByText('Let’s talk').props.style).color).toBe('#85b6ff');
  });
});
