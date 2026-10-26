// Setup fetch mock
import fetchMock from 'jest-fetch-mock';
fetchMock.enableMocks();

// Mock AsyncStorage properly
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  __INTERNAL_MOCK_STORAGE__: {},
}));

// Mock Expo modules that might cause issues in tests
jest.mock('expo-font');
jest.mock('expo-asset');
jest.mock('expo-constants', () => ({
  Constants: { manifest: { extra: { apiUrl: 'https://mock-api-url.com' } } },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve('test-token')),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'success' })),
}));

// Native runtimes are unavailable in Jest; use Worklets' supported test runtime.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// SDK 58 subscribes immediately on import and removes subscriptions when replacing
// the foreground handler. The native-module fallback must return removable handles.
jest.mock('expo-notifications/build/NotificationsHandlerModule', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    handleNotificationAsync: jest.fn(async () => undefined),
  },
}));

// Mock the global object for features that might be used but are not available in jest
global.apiToken = null;

// Mock native modules like Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}));

// Fix TextEncoder issue
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}
