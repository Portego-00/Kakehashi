import { act, cleanup, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { InteractionManager } from "react-native";

const mockCheckForUpdateAsync = jest.fn<Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>, []>(
  () => new Promise<never>(() => undefined)
);
const mockFetchUpdateAsync = jest.fn(async () => ({ isNew: true, isRollBackToEmbedded: false }));
const mockReloadAsync = jest.fn(async () => undefined);
let mockUpdatesEnabled = true;
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
  fetchUpdateAsync: mockFetchUpdateAsync,
  get isEnabled() { return mockUpdatesEnabled; },
  reloadAsync: mockReloadAsync,
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
    default: ({ shouldDismiss, statusMessage }: { shouldDismiss: boolean; statusMessage?: string | null }) =>
      React.createElement(
        Text,
        { testID: "startup-loader" },
        shouldDismiss ? "ready" : statusMessage ?? "waiting"
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
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockUpdatesEnabled = true;
    mockAuthState.needsPostLoginCaching = false;
    mockAuthState.setNeedsPostLoginCaching.mockClear();
    mockCheckForUpdateAsync.mockReset().mockImplementation(() => new Promise(() => undefined));
    mockFetchUpdateAsync.mockReset().mockResolvedValue({ isNew: true, isRollBackToEmbedded: false });
    mockReloadAsync.mockReset().mockResolvedValue(undefined);
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    interactionManagerSpy = jest
      .spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation(() => ({ cancel: jest.fn() }) as never);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    mockAuthState.needsPostLoginCaching = false;
    interactionManagerSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    (global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  function renderRoot() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const RootLayout = require("../_layout").default;
    return render(<RootLayout />);
  }

  it("checks and applies an update before opening app content", async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false });
    const screen = renderRoot();
    await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(1));
    expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("app-slot")).toBeNull();
    expect(screen.getByTestId("startup-loader").props.children).toBe("Applying update...");
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(screen.queryByTestId("app-slot")).toBeNull();
  });

  it("keeps the loader visible and applies an update that takes longer than five seconds to download", async () => {
    let finishFetch!: (result: { isNew: boolean; isRollBackToEmbedded: boolean }) => void;
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false });
    mockFetchUpdateAsync.mockImplementation(() => new Promise((resolve) => { finishFetch = resolve; }));
    const screen = renderRoot();
    await waitFor(() => expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1));

    await act(async () => { jest.advanceTimersByTime(6000); });
    expect(screen.queryByTestId("app-slot")).toBeNull();
    expect(screen.getByTestId("startup-loader").props.children).toBe("Applying update...");

    await act(async () => { finishFetch({ isNew: true, isRollBackToEmbedded: false }); });
    expect(mockReloadAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("app-slot")).toBeNull();
  });

  it("opens cached content immediately when no update is available", async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: false });
    const screen = renderRoot();
    await waitFor(() => {
      expect(screen.getByTestId("app-slot")).toBeTruthy();
      expect(screen.getByTestId("startup-loader").props.children).toBe("ready");
    });
    expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
  });

  it("opens cached content after five seconds and ignores a late update check", async () => {
    let finishCheck!: (result: { isAvailable: boolean; isRollBackToEmbedded: boolean }) => void;
    mockCheckForUpdateAsync.mockImplementation(() => new Promise((resolve) => { finishCheck = resolve; }));
    const screen = renderRoot();
    await waitFor(() => expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("app-slot")).toBeNull();
    expect(screen.getByTestId("startup-loader").props.children).toBe("Checking for updates...");
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(screen.getByTestId("app-slot")).toBeTruthy();
    await act(async () => { finishCheck({ isAvailable: true, isRollBackToEmbedded: false }); });
    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
    expect(mockReloadAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("startup-loader").props.children).toBe("ready");
  });

  it("gives the download a full minute after a four-second update check", async () => {
    let finishCheck!: (result: { isAvailable: boolean; isRollBackToEmbedded: boolean }) => void;
    let finishFetch!: (result: { isNew: boolean; isRollBackToEmbedded: boolean }) => void;
    mockCheckForUpdateAsync.mockImplementation(() => new Promise((resolve) => { finishCheck = resolve; }));
    mockFetchUpdateAsync.mockImplementation(() => new Promise((resolve) => { finishFetch = resolve; }));
    const screen = renderRoot();
    await waitFor(() => expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1));
    await act(async () => {
      jest.advanceTimersByTime(4000);
      finishCheck({ isAvailable: true, isRollBackToEmbedded: false });
    });
    expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("app-slot")).toBeNull();
    await act(async () => { jest.advanceTimersByTime(59_999); });
    expect(screen.queryByTestId("app-slot")).toBeNull();
    expect(screen.getByTestId("startup-loader").props.children).toBe("Applying update...");
    await act(async () => { finishFetch({ isNew: true, isRollBackToEmbedded: false }); });
    expect(mockReloadAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("app-slot")).toBeNull();
  });

  it("opens cached content after a minute of downloading and ignores a late completion", async () => {
    let finishFetch!: (result: { isNew: boolean; isRollBackToEmbedded: boolean }) => void;
    let downloadStartedAt = 0;
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false });
    mockFetchUpdateAsync.mockImplementation(() => {
      downloadStartedAt = Date.now();
      return new Promise((resolve) => { finishFetch = resolve; });
    });
    const screen = renderRoot();
    await waitFor(() => expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1));

    // waitFor also advances fake timers; measure from the actual download start.
    await act(async () => { jest.advanceTimersByTime(59_999 - (Date.now() - downloadStartedAt)); });
    expect(screen.queryByTestId("app-slot")).toBeNull();
    expect(screen.getByTestId("startup-loader").props.children).toBe("Applying update...");
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(screen.getByTestId("app-slot")).toBeTruthy();
    expect(screen.getByTestId("startup-loader").props.children).toBe("ready");

    await act(async () => { finishFetch({ isNew: true, isRollBackToEmbedded: false }); });
    expect(mockReloadAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("app-slot")).toBeTruthy();
    expect(screen.getByTestId("startup-loader").props.children).toBe("ready");
  });

  it.each(["check", "download", "reload"])("opens cached content if the update %s fails", async (step) => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true, isRollBackToEmbedded: false });
    if (step === "check") mockCheckForUpdateAsync.mockRejectedValue(new Error("offline"));
    if (step === "download") mockFetchUpdateAsync.mockRejectedValue(new Error("offline"));
    if (step === "reload") mockReloadAsync.mockRejectedValue(new Error("reload unavailable"));
    const screen = renderRoot();
    await waitFor(() => expect(screen.getByTestId("app-slot")).toBeTruthy());
    expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    if (step !== "check") expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
    if (step === "reload") expect(mockReloadAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("startup-loader").props.children).toBe("ready");
  });

  it("skips the update wait when native updates are disabled", async () => {
    mockUpdatesEnabled = false;
    const screen = renderRoot();
    await waitFor(() => expect(screen.getByTestId("app-slot")).toBeTruthy());
    expect(mockCheckForUpdateAsync).not.toHaveBeenCalled();
  });

  it("does not let post-login cache completion bypass the update gate", async () => {
    mockAuthState.needsPostLoginCaching = true;
    const screen = renderRoot();
    await waitFor(() => expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1));
    expect(mockAuthState.setNeedsPostLoginCaching).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId("app-slot")).toBeNull();
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(screen.getByTestId("app-slot")).toBeTruthy();
  });
});
