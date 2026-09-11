import { render, waitFor } from "@testing-library/react-native";
import React from "react";
import { InteractionManager } from "react-native";

const mockCheckForUpdateAsync = jest.fn(
  () => new Promise<never>(() => undefined)
);
const mockSetIsRunning = jest.fn();
const mockSetProgress = jest.fn();
const mockAuthState = {
  apiToken: "test-token",
  needsPostLoginCaching: false,
  setNeedsPostLoginCaching: jest.fn(),
  setUserData: jest.fn(),
  userData: { id: "user-1", username: "offline-user", level: 10 },
};

jest.mock("expo-font", () => ({
  useFonts: () => [true, null],
}));

jest.mock("expo-linking", () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(async () => null),
  parse: jest.fn(() => ({ queryParams: {} })),
}));

jest.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  clearLastNotificationResponse: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
}));

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Slot: () => React.createElement(Text, { testID: "app-slot" }, "App content"),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  };
});

jest.mock("expo-splash-screen", () => ({
  hideAsync: jest.fn(async () => undefined),
  preventAutoHideAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-updates", () => ({
  checkForUpdateAsync: mockCheckForUpdateAsync,
  fetchUpdateAsync: jest.fn(),
  isEnabled: true,
  reloadAsync: jest.fn(),
}));

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

jest.mock("react-native-gesture-handler", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock("../../src/components/AnimatedKanjiLoader", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: ({ shouldDismiss }: { shouldDismiss: boolean }) =>
      React.createElement(
        Text,
        { testID: "startup-loader" },
        shouldDismiss ? "ready" : "waiting"
      ),
  };
});

jest.mock("../../src/components/ErrorBoundary", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock("../../src/components/GlobalMiniPlayer", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../../src/contexts/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    SessionProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useSession: () => ({ isLoading: false, session: "test-token" }),
  };
});

jest.mock("../../src/contexts/BackgroundTasksContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    BackgroundTasksProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useBackgroundTasks: () => ({
      setIsRunning: mockSetIsRunning,
      setProgress: mockSetProgress,
    }),
  };
});

jest.mock("../../src/contexts/MusicPlayerContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    MusicPlayerProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock("../../src/hooks/useDashboardData", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    DashboardProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock("../../src/services/analyticsService", () => ({
  analyticsService: { logSession: jest.fn(async () => undefined) },
}));
jest.mock("../../src/services/errorService", () => ({
  errorService: {
    initializeGlobalHandlers: jest.fn(),
    setUser: jest.fn(),
  },
}));
jest.mock("../../src/services/featureFlagsService", () => ({
  featureFlagsService: { initialize: jest.fn(async () => undefined) },
}));
jest.mock("../../src/services/offlineStudyProgressService", () => ({
  hasPendingProgressAccountBinding: jest.fn(async () => true),
  registerPendingProgressAccount: jest.fn(async () => undefined),
  syncPendingProgress: jest.fn(async () => ({ sent: 0 })),
}));
jest.mock("../../src/services/offlineVocabularyAudioService", () => ({
  queueOfflineVocabularyAudioDownloads: jest.fn(async () => undefined),
}));
jest.mock("../../src/services/studyTimeHistoryService", () => ({
  maybeRefreshStudyTimeHistory: jest.fn(async () => undefined),
}));
jest.mock("../../src/services/studyTimeStorageScope", () => ({
  normalizeStudyTimeUserId: (value: unknown) => value,
}));
jest.mock("../../src/services/timeTrackingService", () => ({
  timeTrackingService: {
    initialize: jest.fn(),
    setUserDeviceScope: jest.fn(),
  },
}));
jest.mock("../../src/services/timeTrackingSyncService", () => ({
  getDeviceId: jest.fn(() => "device-1"),
  initializeTimeTrackingSync: jest.fn(),
}));

jest.mock("../../src/utils/api", () => ({
  getAllSubjectsFromAPI: jest.fn(),
  getUserData: jest.fn(),
}));
jest.mock("../../src/utils/appTextSize", () => ({
  applyAppTextSizeScale: jest.fn(),
  installAppTextSizePreprocessors: jest.fn(),
  normalizeAppTextSizeScale: (value: number) => value,
}));
jest.mock("../../src/utils/azureSpeech", () => ({
  azureSpeechService: { initialize: jest.fn(async () => undefined) },
}));
jest.mock("../../src/utils/badgeNotifications", () => ({
  initializeBadgeNotifications: jest.fn(async () => undefined),
  updateBadgeWithReviewCount: jest.fn(async () => undefined),
}));
jest.mock("../../src/utils/cache", () => ({
  ensureAllSubjectsCached: jest.fn(async () => true),
  getCacheStatus: jest.fn(async () => ({ subjectCount: 100 })),
}));
jest.mock("../../src/utils/issueActivityNotifications", () => ({
  getIssueActivityNotificationIssueId: jest.fn(() => null),
  startIssueActivityNotifications: jest.fn(() => jest.fn()),
}));
jest.mock("../../src/utils/jitaiFonts", () => ({
  loadDownloadedJitaiFonts: jest.fn(async () => undefined),
}));
jest.mock("../../src/utils/ocr", () => ({ performOcr: jest.fn() }));
jest.mock("../../src/utils/reviewNotificationIntegration", () => ({
  shouldUseNativeReviewNotificationSystem: jest.fn(() => true),
}));
jest.mock("../../src/utils/reviewNotifications", () => ({
  initializeReviewNotifications: jest.fn(async () => undefined),
  updateLastReviewCount: jest.fn(async () => undefined),
}));
jest.mock("../../src/utils/startupDiagnostics", () => ({
  startupDiagnostics: {
    beginOperation: jest.fn(() => 1),
    endOperation: jest.fn(),
    markDashboardFetchCompleted: jest.fn(),
    markDashboardFetchStarted: jest.fn(),
    markEvent: jest.fn(),
    markLoaderDismissRequested: jest.fn(),
    markLoaderDismissed: jest.fn(),
    startSession: jest.fn(),
    updateContext: jest.fn(),
  },
}));
jest.mock("../../src/utils/store", () => {
  const settingsState = {
    appTextSizeScale: 1,
    gravatarEmail: "",
    offlineVocabularyAudioEnabled: false,
  };
  const useAuthStore = Object.assign(() => mockAuthState, {
    getState: () => mockAuthState,
  });
  return {
    useAuthStore,
    useSettingsStore: (selector: (state: typeof settingsState) => unknown) =>
      selector(settingsState),
  };
});
jest.mock("../../src/utils/theme", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useTheme: () => ({
      theme: {
        backgroundColor: "#fff",
        statusBarStyle: "dark",
      },
    }),
  };
});

describe("offline startup", () => {
  const originalDev = (global as typeof globalThis & { __DEV__?: boolean }).__DEV__;
  let consoleWarnSpy: jest.SpyInstance;
  let interactionManagerSpy: jest.SpyInstance;

  beforeAll(() => {
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;
  });

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    interactionManagerSpy = jest
      .spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation(() => ({ cancel: jest.fn() }) as never);
  });

  afterEach(() => {
    interactionManagerSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  afterAll(() => {
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it("renders cached app content without waiting for an OTA request", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RootLayout = require("../_layout").default;
    const screen = render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByTestId("app-slot")).toBeTruthy();
      expect(screen.getByTestId("startup-loader").props.children).toBe("ready");
    });

    expect(mockCheckForUpdateAsync).not.toHaveBeenCalled();
    screen.unmount();
  });
});
