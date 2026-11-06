/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories load their dependencies locally. */
import React from 'react';
import { render } from '@testing-library/react-native';
import { NativeTabsNavigatorWrapper } from 'expo-router/build/native-tabs/NativeBottomTabsNavigator';
import { NativeTabTrigger } from 'expo-router/build/native-tabs/NativeTabTrigger';

const mockRouteNames = ['index', 'progress', 'items', 'analytics', 'more', 'search'];
let mockVisibleRoutes = ['index', 'progress', 'items', 'more', 'search'];
let mockNativeHostMounts = 0;

jest.mock('expo-router/build/react-navigation/native/index', () => ({ CommonActions: { navigate: jest.fn() } }));
jest.mock('expo-router/build/layouts/createBaseTabProps', () => ({ createBaseTabProps: () => ({}) }));
jest.mock('expo-router/build/standard-navigation/index', () => {
  const React = require('react');
  return {
    IsWithinNativeNavigator: React.createContext(false),
    createStandardRouterNavigator: (Content: React.ComponentType<Record<string, unknown>>) =>
      function MockRouter(props: Record<string, unknown>) {
        const routes = mockRouteNames.map(name => ({ name, key: name }));
        return <Content {...props}
          state={{ index: 4, routes }}
          routeNames={mockRouteNames}
          descriptors={Object.fromEntries(routes.map(route => [route.key, {
            route,
            options: { hidden: !mockVisibleRoutes.includes(route.name) },
            render: () => null,
          }]))}
          emitter={{ emit: jest.fn() }}
          preload={jest.fn()}
          navigateSync={jest.fn()}
        />;
      },
  };
});
jest.mock('expo-router/build/standard-navigation/appendMissingPlaceholderTabRoutes', () => ({
  appendMissingPlaceholderTabDescriptors: jest.fn(), appendMissingPlaceholderTabRoutes: jest.fn(),
}));
jest.mock('expo-router/build/standard-navigation/useNonStackAnchorWarning', () => ({ useNonStackAnchorWarning: jest.fn() }));
jest.mock('expo-router/build/standard-navigation/usePreloadPlaceholderRoutes', () => ({ usePreloadPlaceholderRoutes: jest.fn() }));
jest.mock('expo-router/build/standard-navigation/useReconcileTabHistory', () => ({ useReconcileTabHistory: jest.fn() }));
jest.mock('expo-router/build/standard-navigation/useVisibleTabsWithRedirect', () => ({
  useVisibleTabsWithRedirect: ({ routes, focusedRouteKey }: { routes: { name: string; key: string }[]; focusedRouteKey: string }) => {
    const visibleRoutes = routes.filter(route => mockVisibleRoutes.includes(route.name));
    return { visibleRoutes, focusedIndex: visibleRoutes.findIndex(route => route.key === focusedRouteKey) };
  },
}));
jest.mock('expo-router/build/native-tabs/NativeBottomTabsRouter', () => ({ NativeBottomTabsRouter: jest.fn() }));
jest.mock('expo-router/build/native-tabs/NativeTabTrigger', () => ({ NativeTabTrigger: () => null }));
jest.mock('expo-router/build/native-tabs/utils/index', () => ({ convertLabelStylePropToObject: () => ({}), convertIconColorPropToObject: () => ({}) }));
jest.mock('expo-router/build/native-tabs/NativeTabsView.ios', () => ({
  NativeTabsView: ({ tabs }: { tabs: { name: string }[] }) => {
    const React = require('react');
    const { Text } = require('react-native');
    React.useEffect(() => { mockNativeHostMounts += 1; }, []);
    return <Text>{tabs.map(tab => tab.name).join(',')}</Text>;
  },
}));

const tabs = () => <NativeTabsNavigatorWrapper>
  {mockRouteNames.map(name => <NativeTabTrigger key={name} name={name} hidden={!mockVisibleRoutes.includes(name)} />)}
</NativeTabsNavigatorWrapper>;

it('reconciles visible tabs without tearing down the iOS native host', () => {
  // Keep the real SDK 58 wrapper and content; isolate the routing environment
  // so this checks native host lifetime when visible trigger names change.
  mockVisibleRoutes = ['index', 'progress', 'items', 'more', 'search'];
  mockNativeHostMounts = 0;
  const screen = render(tabs());
  expect(mockNativeHostMounts).toBe(1);

  mockVisibleRoutes = ['index', 'progress', 'analytics', 'more', 'search'];
  screen.rerender(tabs());
  expect(screen.getByText(mockVisibleRoutes.join(','))).toBeTruthy();
  expect(mockNativeHostMounts).toBe(1);

  mockVisibleRoutes = ['index', 'progress', 'items', 'more', 'search'];
  screen.rerender(tabs());
  expect(screen.getByText(mockVisibleRoutes.join(','))).toBeTruthy();
  expect(mockNativeHostMounts).toBe(1);
});
