/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories load their dependencies locally. */
import React from 'react';
import { render } from '@testing-library/react-native';
import { NativeTabsNavigator } from 'expo-router/build/native-tabs/NativeBottomTabsNavigator';

let mockVisibleRoutes = ['index', 'progress', 'items', 'more', 'search'];
let mockNativeHostMounts = 0;

jest.mock('@react-navigation/native', () => ({
  createNavigatorFactory: (component: React.ComponentType) => () => ({ Navigator: component }),
  useNavigationBuilder: () => ({
    state: { index: 4, routes: ['index', 'progress', 'items', 'analytics', 'more', 'search'].map(name => ({ name, key: name })) },
    descriptors: Object.fromEntries(['index', 'progress', 'items', 'analytics', 'more', 'search'].map(name => [name, {
      route: { name, key: name },
      options: { hidden: !mockVisibleRoutes.includes(name) },
      render: () => null,
    }])),
    navigation: { emit: jest.fn(), dispatch: jest.fn() },
    NavigationContent: require('react').Fragment,
  }),
}));
jest.mock('expo-router/build/native-tabs/NativeBottomTabsRouter', () => ({ NativeBottomTabsRouter: jest.fn() }));
jest.mock('expo-router/build/native-tabs/NativeTabTrigger', () => ({ NativeTabTrigger: () => null }));
jest.mock('expo-router/build/layouts/withLayoutContext', () => ({ withLayoutContext: (component: React.ComponentType) => component }));
jest.mock('expo-router/build/link/linking', () => ({ getPathFromState: () => '/more' }));
jest.mock('expo-router/build/native-tabs/utils', () => ({ convertLabelStylePropToObject: () => ({}), convertIconColorPropToObject: () => ({}) }));
jest.mock('expo-router/build/native-tabs/NativeTabsView', () => ({
  NativeTabsView: ({ tabs }: { tabs: { name: string }[] }) => {
    const React = require('react');
    const { Text } = require('react-native');
    React.useEffect(() => { mockNativeHostMounts += 1; }, []);
    return <Text>{tabs.map(tab => tab.name).join(',')}</Text>;
  },
}));

it('reconciles visible tabs without tearing down the iOS native host', () => {
  // The real Expo navigator used to key its host by these route names. Changing
  // a bottom tab then deleted the old host with no selected child, crashing iOS.
  mockVisibleRoutes = ['index', 'progress', 'items', 'more', 'search'];
  mockNativeHostMounts = 0;
  const screen = render(<NativeTabsNavigator />);
  expect(mockNativeHostMounts).toBe(1);

  mockVisibleRoutes = ['index', 'progress', 'analytics', 'more', 'search'];
  screen.rerender(<NativeTabsNavigator />);
  expect(screen.getByText(mockVisibleRoutes.join(','))).toBeTruthy();
  expect(mockNativeHostMounts).toBe(1);

  mockVisibleRoutes = ['index', 'progress', 'items', 'more', 'search'];
  screen.rerender(<NativeTabsNavigator />);
  expect(screen.getByText(mockVisibleRoutes.join(','))).toBeTruthy();
  expect(mockNativeHostMounts).toBe(1);
});
