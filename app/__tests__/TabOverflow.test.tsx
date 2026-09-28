import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import TabSettings from '../(app)/tab-settings';
import MoreScreen from '../(app)/(tabs)/more';

const mockSetOrder = jest.fn();
let mockInitialOrder = ['home', 'progress', 'news', 'songs'];
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../src/utils/nativeTabs', () => ({ supportsNativeTabs: () => true }));
jest.mock('../../src/hooks/useFeatureFlags', () => ({ useFeatureFlag: () => true }));
jest.mock('../../src/utils/store', () => ({
  useAuthStore: () => ({ userData: { username: 'ordinary-user' } }),
  useSettingsStore: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const [customTabOrder, setOrder] = React.useState(mockInitialOrder);
    return { customTabOrder, gravatarEmail: '', setCustomTabOrder: (order: string[]) => { mockSetOrder(order); setOrder(order); } };
  },
}));
jest.mock('../../src/utils/theme', () => ({ useTheme: () => ({ theme: {
  backgroundColor: '#fff', cardBackground: '#fff', textColor: '#000', textSecondary: '#555', primary: '#f09', border: '#ddd',
} }) }));

it('lets users enable more than four tabs, shows More, and disable again', () => {
  const screen = render(<TabSettings />);
  fireEvent(screen.getByLabelText('Show Items tab'), 'valueChange', true);
  expect(mockSetOrder).toHaveBeenLastCalledWith(['home', 'progress', 'items', 'news', 'songs']);
  expect(screen.getByText('More')).toBeTruthy();
  fireEvent(screen.getByLabelText('Show Analytics tab'), 'valueChange', true);
  expect(mockSetOrder.mock.calls.at(-1)[0]).toHaveLength(6);
  fireEvent(screen.getByLabelText('Show Items tab'), 'valueChange', false);
  expect(mockSetOrder.mock.calls.at(-1)[0]).not.toContain('items');
});

it('opens overflow destinations inside More instead of navigating to a hidden native tab', () => {
  mockInitialOrder = ['home', 'progress', 'items', 'analytics', 'news', 'songs'];
  const screen = render(<MoreScreen />);
  fireEvent.press(screen.getByLabelText('Analytics'));
  expect(router.push).toHaveBeenCalledWith('/(app)/(tabs)/more/analytics');
  expect(screen.queryByLabelText('Items')).toBeNull();
});
