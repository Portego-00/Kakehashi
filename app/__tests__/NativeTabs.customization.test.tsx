/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories load their dependencies locally. */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import TabsLayout from '../(app)/(tabs)/_layout';
import TabSettings from '../(app)/tab-settings';

let mockFocused = true;
let mockSegments = ['(app)', '(tabs)', 'more'];
let mockNativeTabs = true;
let mockNativeRoutes: string[] = [];
let mockLegacyRoutes: string[] = [];
const initialOrder = ['home', 'progress', 'items', 'analytics', 'news', 'songs'];

jest.mock('../../src/utils/store', () => {
  const { create } = require('zustand');
  return {
    useAuthStore: () => ({ userData: { username: 'ordinary-user' } }),
    useSettingsStore: create((set: (state: object) => void) => ({
      customTabOrder: ['home', 'progress', 'items', 'analytics', 'news', 'songs'],
      gravatarEmail: '',
      setCustomTabOrder: (customTabOrder: string[]) => set({ customTabOrder }),
    })),
  };
});
jest.mock('expo-router/unstable-native-tabs', () => {
  const React = require('react');
  const { View } = require('react-native');
  const NativeTabs = ({ children }: { children: React.ReactNode }) => {
    mockNativeRoutes = React.Children.toArray(children)
      .filter((child: React.ReactElement<{ hidden?: boolean }>) => !child.props.hidden)
      .map((child: React.ReactElement<{ name: string }>) => child.props.name);
    return <View>{children}</View>;
  };
  NativeTabs.Trigger = Object.assign(() => null, { Icon: () => null, Label: () => null });
  return { NativeTabs };
});
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Tabs = ({ children }: { children: React.ReactNode }) => {
    mockLegacyRoutes = React.Children.toArray(children)
      .filter((child: React.ReactElement<{ options: { href?: null } }>) => child.props.options.href !== null)
      .map((child: React.ReactElement<{ name: string }>) => child.props.name);
    return <View>{children}</View>;
  };
  Tabs.Screen = function MockTabScreen() { return null; };
  return { Tabs, router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, useSegments: () => mockSegments };
});
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../src/utils/nativeTabs', () => ({ supportsNativeTabs: () => mockNativeTabs }));
jest.mock('../../src/hooks/useFeatureFlags', () => ({ useFeatureFlag: () => true }));
jest.mock('../../src/utils/theme', () => ({ useTheme: () => ({ themeMode: 'system', isDark: false, theme: {
  backgroundColor: '#fff', cardBackground: '#fff', textColor: '#000', textSecondary: '#555', primary: '#f09', border: '#ddd',
} }) }));

const settings = () => require('../../src/utils/store').useSettingsStore;
const app = () => <><TabsLayout /><TabSettings /></>;

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  mockSegments = ['(app)', '(tabs)', 'more'];
  mockNativeTabs = true;
  mockNativeRoutes = [];
  mockLegacyRoutes = [];
  settings().setState({ customTabOrder: initialOrder });
});

it('keeps the covered native navigator stable while removing and adding a bottom tab', () => {
  const screen = render(app());
  expect(mockNativeRoutes).toEqual(['index', 'progress', 'items', 'more', 'search']);
  mockFocused = false;
  mockSegments = ['(app)', 'tab-settings'];
  screen.rerender(app());

  fireEvent(screen.getByLabelText('Show Items tab'), 'valueChange', false);
  expect(settings().getState().customTabOrder).not.toContain('items');
  expect(mockNativeRoutes).toEqual(['index', 'progress', 'items', 'more', 'search']);

  mockFocused = true;
  mockSegments = ['(app)', '(tabs)', 'more'];
  screen.rerender(app());
  expect(mockNativeRoutes).toEqual(['index', 'progress', 'analytics', 'more', 'search']);

  mockFocused = false;
  mockSegments = ['(app)', 'tab-settings'];
  screen.rerender(app());
  fireEvent(screen.getByLabelText('Show Items tab'), 'valueChange', true);
  expect(mockNativeRoutes).toEqual(['index', 'progress', 'analytics', 'more', 'search']);

  mockFocused = true;
  mockSegments = ['(app)', '(tabs)', 'more'];
  screen.rerender(app());
  expect(mockNativeRoutes).toEqual(['index', 'progress', 'items', 'more', 'search']);
});

it.each(['more', 'items'])('leaves %s before applying a configuration that hides the selected route', activeTab => {
  mockSegments = ['(app)', '(tabs)', activeTab];
  const screen = render(app());
  mockFocused = false;
  mockSegments = ['(app)', 'tab-settings'];
  screen.rerender(app());
  fireEvent(screen.getByLabelText('Show Items tab'), 'valueChange', false);
  fireEvent(screen.getByLabelText('Show Analytics tab'), 'valueChange', false);
  expect(mockNativeRoutes).toContain('more');

  mockFocused = true;
  mockSegments = ['(app)', '(tabs)', activeTab];
  screen.rerender(app());
  expect(router.replace).toHaveBeenCalledWith('/(app)/(tabs)');
  expect(mockNativeRoutes).toContain('more');

  mockSegments = ['(app)', '(tabs)'];
  screen.rerender(app());
  expect(mockNativeRoutes).toEqual(['index', 'progress', 'news', 'songs', 'search']);
});

it('keeps immediate tab updates for the standard navigator', () => {
  mockNativeTabs = false;
  const screen = render(app());
  mockFocused = false;
  mockSegments = ['(app)', 'tab-settings'];
  screen.rerender(app());
  fireEvent(screen.getByLabelText('Show Items tab'), 'valueChange', false);
  expect(mockLegacyRoutes).not.toContain('items');
});
