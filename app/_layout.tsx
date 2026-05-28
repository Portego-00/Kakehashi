import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Slot, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  InteractionManager,
  Platform,
  type AppStateStatus,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AnimatedKanjiLoader from "../src/components/AnimatedKanjiLoader";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import GlobalMiniPlayer from "../src/components/GlobalMiniPlayer";
import { SessionProvider, useSession } from "../src/contexts/AuthContext";
import { errorService } from "../src/services/errorService";
import {
  BackgroundTasksProvider,
  useBackgroundTasks,
} from "../src/contexts/BackgroundTasksContext";
import { MusicPlayerProvider } from "../src/contexts/MusicPlayerContext";
import { DashboardProvider } from "../src/hooks/useDashboardData";
import { analyticsService } from "../src/services/analyticsService";
import { featureFlagsService } from "../src/services/featureFlagsService";
import { syncPendingProgress } from "../src/services/offlineStudyProgressService";
import { queueOfflineVocabularyAudioDownloads } from "../src/services/offlineVocabularyAudioService";
import { getAllSubjectsFromAPI, getUserData } from "../src/utils/api";
import {
  initializeBadgeNotifications,
  updateBadgeWithReviewCount,
} from "../src/utils/badgeNotifications";
import { ensureAllSubjectsCached, getCacheStatus } from "../src/utils/cache";
import { loadDownloadedJitaiFonts } from "../src/utils/jitaiFonts";
import {
  getIssueActivityNotificationIssueId,
  startIssueActivityNotifications,
} from "../src/utils/issueActivityNotifications";
import { performOcr } from "../src/utils/ocr";
import {
  initializeReviewNotifications,
  updateLastReviewCount,
} from "../src/utils/reviewNotifications";
import { shouldUseNativeReviewNotificationSystem } from "../src/utils/reviewNotificationIntegration";
import { useAuthStore, useSettingsStore } from "../src/utils/store";
import { startupDiagnostics } from "../src/utils/startupDiagnostics";
import { azureSpeechService } from "../src/utils/azureSpeech";
import { ThemeProvider, useTheme } from "../src/utils/theme";

// Import debug utilities in DEV mode
if (__DEV__) {
  import("../src/utils/backgroundFetchDebug");
}

// Keep the splash screen visible while we initialize the app
SplashScreen.preventAutoHideAsync();

type PendingDeepLinkIntent =
  | {
      kind: "ocr-image";
      imageUri: string;
      signature: string;
    }
  | {
      kind: "shared-url";
      sharedUrl: string;
      signature: string;
    };

const OTA_UPDATE_CHECK_TIMEOUT_MS = 1000;
const OTA_UPDATE_CHECK_TIMED_OUT = { timedOut: true } as const;

function resolveWithUpdateCheckTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T | typeof OTA_UPDATE_CHECK_TIMED_OUT> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(OTA_UPDATE_CHECK_TIMED_OUT);
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function isUpdateCheckTimedOut<T>(
  result: T | typeof OTA_UPDATE_CHECK_TIMED_OUT
): result is typeof OTA_UPDATE_CHECK_TIMED_OUT {
  return result === OTA_UPDATE_CHECK_TIMED_OUT;
}

function RootLayoutContentInner() {
  const { setIsRunning, setProgress } = useBackgroundTasks();
  const [appIsReady, setAppIsReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [cachingProgress, setCachingProgress] = useState(0);
  const [loaderStatusMessage, setLoaderStatusMessage] = useState<string | null>(
    null
  );
  const startupSessionInitializedRef = useRef(false);
  const startupPrepareStartedRef = useRef(false);
  const appReadyRequestedRef = useRef(false);
  const fontGateStartedAtRef = useRef(Date.now());
  const fontGateResolvedRef = useRef(false);
  const fontGateDetailsRef = useRef({
    waitedMs: 0,
    timedOut: false,
    fontsLoaded: false,
    hasFontError: false,
  });
  const [fontGateResolved, setFontGateResolved] = useState(false);
  const {
    setUserData,
    userData,
    needsPostLoginCaching,
    setNeedsPostLoginCaching,
    apiToken,
  } = useAuthStore();
  const { session, isLoading } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const {
    gravatarEmail,
    offlineVocabularyAudioEnabled,
    otaUpdateExperience,
  } = useSettingsStore();
  const [settingsHydrated, setSettingsHydrated] = useState(() =>
    useSettingsStore.persist.hasHydrated()
  );
  const pendingDeepLinkIntentRef = useRef<PendingDeepLinkIntent | null>(null);
  const pendingIssueNotificationIssueIdRef = useRef<string | null>(null);
  const didCheckInitialUrlRef = useRef(false);
  const lastHandledDeepLinkSignatureRef = useRef<string | null>(null);
  const lastHandledDeepLinkAtRef = useRef(0);
  const lastHandledIssueNotificationIssueIdRef = useRef<string | null>(null);
  const lastHandledIssueNotificationAtRef = useRef(0);
  const requestAppReady = useCallback(
    (reason: string, details?: Record<string, unknown>) => {
      if (appReadyRequestedRef.current) {
        return;
      }
      appReadyRequestedRef.current = true;
      startupDiagnostics.markLoaderDismissRequested(reason, details);
      setAppIsReady(true);
    },
    []
  );
  const canNavigateForDeepLink =
    appIsReady && !showLoader && !isLoading && Boolean(session);

  const queueOfflineAudioDownloadsForLevel = useCallback(
    (level?: number) => {
      if (!offlineVocabularyAudioEnabled) {
        return;
      }

      const resolvedLevel = Math.max(1, Math.floor(level ?? userData?.level ?? 1));
      void queueOfflineVocabularyAudioDownloads({
        enabled: true,
        currentLevel: resolvedLevel,
        voicePreference: "both",
      }).catch(() => {});
    },
    [offlineVocabularyAudioEnabled, userData?.level]
  );

  // Load the fonts - put this first in this component
  const [fontsLoaded, fontError] = useFonts({
    // Be extremely careful about the paths here
    "SourceHanSansJP-Regular": require("../assets/fonts/SourceHanSansJP-Regular.otf"),
    "SourceHanSansJP-Bold": require("../assets/fonts/SourceHanSansJP-Bold.otf"),
    "ZenKurenaido-Regular": require("../assets/fonts/ZenKurenaido-Regular.ttf"),
    "ReggaeOne-Regular": require("../assets/fonts/ReggaeOne-Regular.ttf"),
    "YujiSyuku-Regular": require("../assets/fonts/YujiSyuku-Regular.ttf"),
    "HachiMaruPop-Regular": require("../assets/fonts/HachiMaruPop-Regular.ttf"),
  });

  const resolveFontGate = useCallback(
    (timedOut: boolean) => {
      if (fontGateResolvedRef.current) {
        return;
      }
      fontGateResolvedRef.current = true;

      const waitedMs = Math.max(0, Date.now() - fontGateStartedAtRef.current);
      fontGateDetailsRef.current = {
        waitedMs,
        timedOut,
        fontsLoaded,
        hasFontError: Boolean(fontError),
      };
      setFontGateResolved(true);
    },
    [fontError, fontsLoaded]
  );

  useEffect(() => {
    if (fontGateResolved) {
      return;
    }

    if (fontsLoaded || fontError) {
      resolveFontGate(false);
      return;
    }

    const fontTimeout = setTimeout(() => {
      resolveFontGate(true);
    }, 5000);

    return () => {
      clearTimeout(fontTimeout);
    };
  }, [fontError, fontGateResolved, fontsLoaded, resolveFontGate]);

  useEffect(() => {
    if (startupSessionInitializedRef.current) {
      return;
    }

    startupSessionInitializedRef.current = true;
    startupDiagnostics.startSession(
      {
        platform: Platform.OS,
        hasSession: Boolean(session),
        authLoading: isLoading,
      },
      { suppressPerCallApiLogs: true }
    );
  }, [isLoading, session]);

  useEffect(() => {
    startupDiagnostics.updateContext({
      hasSession: Boolean(session),
      authLoading: isLoading,
      fontsLoaded,
      hasFontError: Boolean(fontError),
      hasApiToken: Boolean(apiToken),
      settingsHydrated,
      otaUpdateExperience,
    });
  }, [
    apiToken,
    fontError,
    fontsLoaded,
    isLoading,
    otaUpdateExperience,
    session,
    settingsHydrated,
  ]);

  useEffect(() => {
    if (settingsHydrated) {
      return;
    }

    const unsubscribe = useSettingsStore.persist.onFinishHydration(() => {
      setSettingsHydrated(true);
    });

    if (useSettingsStore.persist.hasHydrated()) {
      setSettingsHydrated(true);
    }

    return unsubscribe;
  }, [settingsHydrated]);

  // Listen for app state changes to update badge when app becomes active
  useEffect(() => {
    const appStateRef = { current: AppState.currentState as AppStateStatus };
    let foregroundTimer: ReturnType<typeof setTimeout> | null = null;
    let isForegroundSyncRunning = false;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Only run when transitioning from background/inactive -> active
      const isForegroundTransition =
        /inactive|background/.test(prevState) && nextAppState === "active";

      if (!isForegroundTransition) {
        return;
      }

      // Debounce foreground work and run once even if active fires rapidly
      if (foregroundTimer) {
        clearTimeout(foregroundTimer);
      }

      foregroundTimer = setTimeout(() => {
        if (isForegroundSyncRunning) {
          return;
        }

        isForegroundSyncRunning = true;

        const tasks: Promise<unknown>[] = [
          updateBadgeWithReviewCount({
            forceSummaryRefresh: true,
          }),
        ];
        if (!shouldUseNativeReviewNotificationSystem()) {
          tasks.push(updateLastReviewCount());
        }
        if (apiToken) {
          tasks.push(syncPendingProgress(apiToken));
        }

        if (userData?.id) {
          tasks.push(
            analyticsService.logSession(
              userData.id,
              userData.username,
              userData.level
            )
          );
        }

        Promise.allSettled(tasks).finally(() => {
          isForegroundSyncRunning = false;
        });
      }, 750);
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      if (foregroundTimer) {
        clearTimeout(foregroundTimer);
      }
      subscription?.remove();
    };
  }, [apiToken, userData?.id, userData?.username, userData?.level]);

  // Initialize global error handlers
  useEffect(() => {
    errorService.initializeGlobalHandlers();
  }, []);

  // Set user info for error attribution
  useEffect(() => {
    errorService.setUser({
      id: userData?.id,
      username: userData?.username,
      email: gravatarEmail,
    });
  }, [userData?.id, userData?.username, gravatarEmail]);

  useEffect(() => {
    return startIssueActivityNotifications({
      currentUserId: userData?.id ?? null,
      currentUsername: userData?.username ?? null,
    });
  }, [userData?.id, userData?.username]);

  const getQueryParamValue = useCallback((value: unknown): string | null => {
    if (Array.isArray(value)) {
      const first = value[0];
      if (typeof first === "string") {
        return first;
      }
      if (typeof first === "number" || typeof first === "boolean") {
        return String(first);
      }
      return null;
    }

    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return null;
  }, []);

  const parsePendingDeepLinkIntent = useCallback(
    (url: string): PendingDeepLinkIntent | null => {
      const parsed = Linking.parse(url);

      const imageParam = getQueryParamValue(parsed?.queryParams?.imageUri);
      if (imageParam) {
        let imageUri = String(imageParam);
        try {
          imageUri = decodeURIComponent(imageUri);
        } catch {}
        const normalizedImageUri = imageUri.trim();
        if (normalizedImageUri) {
          return {
            kind: "ocr-image",
            imageUri: normalizedImageUri,
            signature: `ocr-image:${normalizedImageUri}`,
          };
        }
      }

      const sharedUrlParam = getQueryParamValue(parsed?.queryParams?.sharedUrl);
      if (sharedUrlParam) {
        let sharedUrl = sharedUrlParam;
        try {
          sharedUrl = decodeURIComponent(sharedUrl);
        } catch {}
        const normalizedSharedUrl = sharedUrl.trim();
        if (normalizedSharedUrl) {
          return {
            kind: "shared-url",
            sharedUrl: normalizedSharedUrl,
            signature: `shared-url:${normalizedSharedUrl}`,
          };
        }
      }

      return null;
    },
    [getQueryParamValue]
  );

  const shouldSkipRecentDuplicateDeepLink = useCallback((signature: string): boolean => {
    const now = Date.now();
    const isDuplicate =
      lastHandledDeepLinkSignatureRef.current === signature &&
      now - lastHandledDeepLinkAtRef.current < 5000;
    return isDuplicate;
  }, []);

  const executeDeepLinkIntent = useCallback(
    async (intent: PendingDeepLinkIntent) => {
      if (intent.kind === "ocr-image") {
        try {
          const { recognizedText, originalText, regions } = await performOcr(
            intent.imageUri
          );
          router.replace({
            pathname: "/ocr-results",
            params: {
              recognizedText: recognizedText ?? "",
              originalText: originalText ?? "",
              imageUri: intent.imageUri,
              textRegions: JSON.stringify(regions ?? []),
            },
          });
        } catch (err) {
          console.error("OCR error from deep link:", err);
          router.replace({
            pathname: "/ocr-results",
            params: {
              recognizedText: "",
              originalText: "",
              imageUri: intent.imageUri,
              textRegions: JSON.stringify([]),
            },
          });
        }
        return;
      }

      router.replace({
        pathname: "/url-reader",
        params: {
          url: intent.sharedUrl,
        },
      });
    },
    [router]
  );

  const handlePendingDeepLinkIntent = useCallback(
    (intent: PendingDeepLinkIntent) => {
      if (shouldSkipRecentDuplicateDeepLink(intent.signature)) {
        startupDiagnostics.markEvent("deeplink.duplicateSkipped", {
          signature: intent.signature,
        });
        return;
      }

      if (!canNavigateForDeepLink) {
        pendingDeepLinkIntentRef.current = intent;
        startupDiagnostics.markEvent("deeplink.queuedUntilReady", {
          kind: intent.kind,
        });
        return;
      }

      pendingDeepLinkIntentRef.current = null;
      lastHandledDeepLinkSignatureRef.current = intent.signature;
      lastHandledDeepLinkAtRef.current = Date.now();

      InteractionManager.runAfterInteractions(() => {
        void executeDeepLinkIntent(intent);
      });
    },
    [canNavigateForDeepLink, executeDeepLinkIntent, shouldSkipRecentDuplicateDeepLink]
  );

  const navigateToIssueFromNotification = useCallback(
    (issueId: string) => {
      if (!issueId) {
        return;
      }

      if (!canNavigateForDeepLink) {
        pendingIssueNotificationIssueIdRef.current = issueId;
        return;
      }

      const now = Date.now();
      const isDuplicate =
        lastHandledIssueNotificationIssueIdRef.current === issueId &&
        now - lastHandledIssueNotificationAtRef.current < 2000;
      if (isDuplicate) {
        return;
      }

      pendingIssueNotificationIssueIdRef.current = null;
      lastHandledIssueNotificationIssueIdRef.current = issueId;
      lastHandledIssueNotificationAtRef.current = now;

      InteractionManager.runAfterInteractions(() => {
        router.push({
          pathname: "/issue/[id]",
          params: {
            id: issueId,
          },
        });
      });
    },
    [canNavigateForDeepLink, router]
  );

  useEffect(() => {
    let isDisposed = false;

    const handleNotificationResponse = (
      response: Notifications.NotificationResponse | null | undefined
    ): boolean => {
      if (!response || isDisposed) {
        return false;
      }

      const issueId = getIssueActivityNotificationIssueId(
        response.notification.request.content.data
      );
      if (issueId) {
        navigateToIssueFromNotification(issueId);
        return true;
      }

      return false;
    };

    try {
      const initialResponse = Notifications.getLastNotificationResponse();
      if (handleNotificationResponse(initialResponse)) {
        Notifications.clearLastNotificationResponse();
      }
    } catch (error) {
      console.error("Failed to read initial notification response:", error);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      isDisposed = true;
      subscription.remove();
    };
  }, [navigateToIssueFromNotification]);

  // Handle incoming deep links like kakehashi://?sharedUrl=... and defer navigation
  // until app startup/auth loading has completed.
  useEffect(() => {
    let isDisposed = false;

    const handleIncomingUrl = (incomingUrl?: string | null) => {
      if (!incomingUrl || isDisposed) {
        return;
      }

      try {
        const intent = parsePendingDeepLinkIntent(incomingUrl);
        if (!intent) {
          return;
        }
        handlePendingDeepLinkIntent(intent);
      } catch (e) {
        console.error("Link handling error:", e);
      }
    };

    if (!didCheckInitialUrlRef.current) {
      didCheckInitialUrlRef.current = true;
      Linking.getInitialURL()
        .then((initialUrl) => {
          handleIncomingUrl(initialUrl);
        })
        .catch((error) => {
          console.error("Failed to read initial URL:", error);
        });
    }

    const sub = Linking.addEventListener("url", ({ url }) =>
      handleIncomingUrl(url)
    );
    return () => {
      isDisposed = true;
      sub.remove();
    };
  }, [handlePendingDeepLinkIntent, parsePendingDeepLinkIntent]);

  useEffect(() => {
    if (!canNavigateForDeepLink) {
      return;
    }

    const queuedIntent = pendingDeepLinkIntentRef.current;
    if (!queuedIntent) {
      return;
    }

    handlePendingDeepLinkIntent(queuedIntent);
  }, [canNavigateForDeepLink, handlePendingDeepLinkIntent]);

  useEffect(() => {
    if (!canNavigateForDeepLink) {
      return;
    }

    const queuedIssueId = pendingIssueNotificationIssueIdRef.current;
    if (!queuedIssueId) {
      return;
    }

    navigateToIssueFromNotification(queuedIssueId);
  }, [canNavigateForDeepLink, navigateToIssueFromNotification]);

  useEffect(() => {
    if (startupPrepareStartedRef.current) {
      return;
    }

    if (!fontGateResolved || isLoading || !settingsHydrated) {
      return;
    }

    startupPrepareStartedRef.current = true;

    async function prepare() {
      const prepareOperationId = startupDiagnostics.beginOperation("root.prepare", {
        phase: "loader",
      });
      let prepareError: unknown;

      const runTrackedOperation = async <T,>(
        operation: string,
        task: () => Promise<T>,
        details?: Record<string, unknown>
      ): Promise<T> => {
        const operationId = startupDiagnostics.beginOperation(operation, {
          phase: "loader",
          details,
        });

        try {
          const result = await task();
          startupDiagnostics.endOperation(operationId, { status: "ok" });
          return result;
        } catch (error) {
          startupDiagnostics.endOperation(operationId, {
            status: "error",
            error,
          });
          throw error;
        }
      };

      const runPostLoaderOperation = (
        operation: string,
        task: () => Promise<unknown>,
        details?: Record<string, unknown>
      ) => {
        const operationId = startupDiagnostics.beginOperation(operation, {
          phase: "post-loader",
          details: {
            deferredUntilIdle: true,
            deferredStartMs: 1500,
            ...(details ?? {}),
          },
        });

        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => {
            task()
              .then(() => {
                startupDiagnostics.endOperation(operationId, {
                  status: "ok",
                });
              })
              .catch((error) => {
                startupDiagnostics.endOperation(operationId, {
                  status: "error",
                  error,
                });
              });
          }, 1500);
        });
      };

      const applyStartupUpdateIfAvailable = async (): Promise<boolean> => {
        if (
          otaUpdateExperience === "background-next-open" ||
          otaUpdateExperience === "background-banner"
        ) {
          startupDiagnostics.markEvent("prepare.ota.deferred", {
            mode: otaUpdateExperience,
          });
          return false;
        }

        if (__DEV__ || !Updates.isEnabled) {
          startupDiagnostics.markEvent("prepare.ota.skipped", {
            reason: __DEV__ ? "development_mode" : "updates_disabled",
            mode: otaUpdateExperience,
          });
          return false;
        }

        try {
          setLoaderStatusMessage("Checking for updates...");

          const updateCheckPromise = runTrackedOperation(
            "prepare.ota.checkForUpdate",
            () => Updates.checkForUpdateAsync(),
            { mode: otaUpdateExperience }
          );
          const updateCheck =
            otaUpdateExperience === "startup-timeboxed"
              ? await resolveWithUpdateCheckTimeout(
                  updateCheckPromise,
                  OTA_UPDATE_CHECK_TIMEOUT_MS
                )
              : await updateCheckPromise;

          if (isUpdateCheckTimedOut(updateCheck)) {
            startupDiagnostics.markEvent("prepare.ota.checkTimedOut", {
              timeoutMs: OTA_UPDATE_CHECK_TIMEOUT_MS,
              mode: otaUpdateExperience,
            });
            setLoaderStatusMessage(null);
            return false;
          }

          startupDiagnostics.markEvent("prepare.ota.checkCompleted", {
            isAvailable: updateCheck.isAvailable,
            isRollBackToEmbedded: updateCheck.isRollBackToEmbedded,
            mode: otaUpdateExperience,
          });

          if (!updateCheck.isAvailable && !updateCheck.isRollBackToEmbedded) {
            setLoaderStatusMessage(null);
            return false;
          }

          setLoaderStatusMessage("Applying update...");

          const fetchResult = await runTrackedOperation(
            "prepare.ota.fetchUpdate",
            () => Updates.fetchUpdateAsync(),
            { mode: otaUpdateExperience }
          );
          const shouldReloadNow =
            fetchResult.isNew || fetchResult.isRollBackToEmbedded;

          startupDiagnostics.markEvent("prepare.ota.fetchCompleted", {
            isNew: fetchResult.isNew,
            isRollBackToEmbedded: fetchResult.isRollBackToEmbedded,
            shouldReloadNow,
            mode: otaUpdateExperience,
          });

          if (!shouldReloadNow) {
            setLoaderStatusMessage(null);
            return false;
          }

          await runTrackedOperation("prepare.ota.reload", () =>
            Updates.reloadAsync({
              reloadScreenOptions: {
                backgroundColor: theme.backgroundColor,
                image: require("../assets/images/splash-icon.png"),
                imageResizeMode: "contain",
                fade: true,
                spinner: { enabled: false },
              },
            })
          );
          return true;
        } catch (error) {
          console.error("Startup OTA check failed:", error);
          startupDiagnostics.markEvent("prepare.ota.failed", {
            error: error instanceof Error ? error.message : String(error),
            mode: otaUpdateExperience,
          });
          setLoaderStatusMessage(null);
          return false;
        }
      };

      const fetchStartupUpdateForNextLaunch = async (): Promise<void> => {
        if (__DEV__ || !Updates.isEnabled) {
          startupDiagnostics.markEvent("prepare.ota.backgroundSkipped", {
            reason: __DEV__ ? "development_mode" : "updates_disabled",
            mode: otaUpdateExperience,
          });
          return;
        }

        const updateCheck = await Updates.checkForUpdateAsync();
        startupDiagnostics.markEvent("prepare.ota.backgroundCheckCompleted", {
          isAvailable: updateCheck.isAvailable,
          isRollBackToEmbedded: updateCheck.isRollBackToEmbedded,
          mode: otaUpdateExperience,
        });

        if (!updateCheck.isAvailable && !updateCheck.isRollBackToEmbedded) {
          return;
        }

        const fetchResult = await Updates.fetchUpdateAsync();
        startupDiagnostics.markEvent("prepare.ota.backgroundFetchCompleted", {
          isNew: fetchResult.isNew,
          isRollBackToEmbedded: fetchResult.isRollBackToEmbedded,
          mode: otaUpdateExperience,
        });
      };

      startupDiagnostics.markEvent("root.prepare.begin", {
        fontsLoaded,
        hasFontError: Boolean(fontError),
        authLoading: isLoading,
        hasSession: Boolean(session),
        fontGateResolved,
        fontGate: fontGateDetailsRef.current,
        settingsHydrated,
        otaUpdateExperience,
      });

      try {
        // Fonts/auth readiness is handled before prepare starts, but we still
        // log the wait details in a dedicated operation.
        const waitForFontsOperationId = startupDiagnostics.beginOperation(
          "prepare.waitForFonts",
          { phase: "loader" }
        );
        startupDiagnostics.endOperation(waitForFontsOperationId, {
          status: "ok",
          details: fontGateDetailsRef.current,
        });

        if (fontGateDetailsRef.current.timedOut) {
          console.warn("⚠️ Font loading timed out, proceeding anyway");
        }

        // Load downloaded Jitai fonts so randomization works after app restarts
        try {
          await runTrackedOperation("prepare.loadDownloadedJitaiFonts", () =>
            loadDownloadedJitaiFonts()
          );
        } catch (error) {
          console.error("Failed to initialize downloaded Jitai fonts:", error);
        }

        // Hide the system splash screen immediately once fonts are ready
        const hideSplashOperationId = startupDiagnostics.beginOperation(
          "prepare.hideSplashScreen",
          { phase: "loader" }
        );
        await SplashScreen.hideAsync()
          .then(() => {
            startupDiagnostics.endOperation(hideSplashOperationId, {
              status: "ok",
            });
          })
          .catch((error) => {
            startupDiagnostics.endOperation(hideSplashOperationId, {
              status: "error",
              error,
            });
            // Silent failure for splash screen
          });

        const didTriggerReload = await applyStartupUpdateIfAvailable();
        if (didTriggerReload) {
          return;
        }

        if (otaUpdateExperience === "background-next-open") {
          runPostLoaderOperation(
            "prepare.ota.backgroundNextOpen",
            fetchStartupUpdateForNextLaunch,
            { mode: otaUpdateExperience }
          );
        }

        const token = session;

        // Non-blocking startup tasks: keep loader focused on rendering dashboard quickly.
        runPostLoaderOperation("prepare.initializeBadgeNotifications.background", () =>
          initializeBadgeNotifications()
        );

        if (!shouldUseNativeReviewNotificationSystem()) {
          runPostLoaderOperation("prepare.initializeReviewNotifications.background", () =>
            initializeReviewNotifications()
          );
        }

        runPostLoaderOperation("prepare.initializeFeatureFlags.background", () =>
          featureFlagsService.initialize()
        );

        runPostLoaderOperation("prepare.initializeAzureSpeech.background", () =>
          azureSpeechService.initialize()
        );

        if (token) {
          runPostLoaderOperation("prepare.syncPendingProgress.background", () =>
            syncPendingProgress(token)
          );
        }

        // If we have a token, try to load user data and start fast path
        if (token) {
          try {
            // Avoid an extra startup API call when persisted user data already exists.
            let currentUserData = useAuthStore.getState().userData;
            if (!currentUserData) {
              const userDataResponse = await runTrackedOperation(
                "prepare.getUserData",
                () => getUserData(token)
              );
              currentUserData = userDataResponse.data;
              setUserData(currentUserData);
            } else {
              startupDiagnostics.markEvent("prepare.userData.persisted", {
                userId: currentUserData.id,
                level: currentUserData.level,
              });
            }

            if (currentUserData?.id) {
              analyticsService
                .logSession(
                  currentUserData.id,
                  currentUserData.username,
                  currentUserData.level
                )
                .catch((error) => {
                  console.error("Failed to log usage session:", error);
                });
            }

            // Check if we have subjects in cache
            const cacheStatus = await runTrackedOperation(
              "prepare.getCacheStatus",
              () => getCacheStatus()
            );
            const hasCachedSubjects = cacheStatus.subjectCount > 0;

            if (hasCachedSubjects) {
              // Fast path: Let dashboard show immediately with cached data
              requestAppReady("prepare.fastPath.cacheHit", {
                subjectCount: cacheStatus.subjectCount,
              }); // This will dismiss the loader and show dashboard

              // Start background tasks after dashboard is visible
              setIsRunning(true);

              // Background task 1: Initialize subjects cache (refresh/verify)
              setProgress(0);
              const backgroundCacheOperationId = startupDiagnostics.beginOperation(
                "prepare.ensureAllSubjectsCached.background",
                {
                  phase: "post-loader",
                  details: {
                    mode: "background_refresh",
                    deferredUntilIdle: true,
                    deferredStartMs: 1500,
                  },
                }
              );

              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => {
                  ensureAllSubjectsCached(
                    token,
                    getAllSubjectsFromAPI,
                    (progress) => {
                      setProgress(progress);
                    }
                  )
                    .then((cacheSuccess) => {
                      if (cacheSuccess) {
                        queueOfflineAudioDownloadsForLevel(currentUserData?.level);
                      }
                      startupDiagnostics.endOperation(backgroundCacheOperationId, {
                        status: "ok",
                        details: { cacheSuccess },
                      });
                    })
                    .catch((error) => {
                      startupDiagnostics.endOperation(backgroundCacheOperationId, {
                        status: "error",
                        error,
                      });
                      // Silent failure for background cache
                    });
                }, 1500);
              });
            } else {
              // FIRST LOAD PATH: Block UI until subjects are downloaded
              // We do NOT set appIsReady(true) yet

              setCachingProgress(1); // Start progress bar
              const blockingCacheOperationId = startupDiagnostics.beginOperation(
                "prepare.ensureAllSubjectsCached.blocking",
                {
                  phase: "loader",
                  details: { mode: "first_load" },
                }
              );

              try {
                const cacheSuccess = await ensureAllSubjectsCached(
                  token,
                  getAllSubjectsFromAPI,
                  (progress) => {
                    setCachingProgress(progress);
                  }
                );

                if (cacheSuccess) {
                  setCachingProgress(100);
                  queueOfflineAudioDownloadsForLevel(currentUserData?.level);
                }

                startupDiagnostics.endOperation(blockingCacheOperationId, {
                  status: "ok",
                  details: { cacheSuccess },
                });
              } catch (error) {
                startupDiagnostics.endOperation(blockingCacheOperationId, {
                  status: "error",
                  error,
                });
                // Silent failure for first load cache
              }

              // Now we can let the user in
              requestAppReady("prepare.firstLoad.cacheCompleted");
              setIsRunning(true); // Start other background tasks
            }
          } catch (error) {
            console.error("Failed to load user data:", error);
            // Still show dashboard - let it handle auth errors
            requestAppReady("prepare.userData.failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          // No token - show dashboard immediately for login flow
          startupDiagnostics.markDashboardFetchStarted({
            reason: "no_api_token",
          });
          startupDiagnostics.markDashboardFetchCompleted({
            status: "skipped",
            details: { reason: "no_api_token" },
          });
          requestAppReady("prepare.noToken");
        }
      } catch (e) {
        prepareError = e;
        console.warn(e);
      } finally {
        startupDiagnostics.endOperation(prepareOperationId, {
          status: prepareError ? "error" : "ok",
          error: prepareError,
        });
        // Mark app as ready - this will trigger the animated loader dismissal
        requestAppReady("prepare.finallyFallback");
      }
    }

    prepare();
  }, [
    fontGateResolved,
    fontsLoaded,
    fontError,
    session,
    isLoading,
    otaUpdateExperience,
    setUserData,
    setIsRunning,
    setProgress,
    requestAppReady,
    queueOfflineAudioDownloadsForLevel,
    settingsHydrated,
    theme.backgroundColor,
  ]);

  // Handle post-login caching
  useEffect(() => {
    if (needsPostLoginCaching && apiToken) {
      startupDiagnostics.markEvent("postLoginCaching.started");
      appReadyRequestedRef.current = false;
      setShowLoader(true);
      setAppIsReady(false);

      const performPostLoginCaching = async () => {
        const postLoginCachingOperationId = startupDiagnostics.beginOperation(
          "postLogin.ensureAllSubjectsCached",
          {
            phase: "loader",
          }
        );
        try {
          const cacheSuccess = await ensureAllSubjectsCached(
            apiToken,
            getAllSubjectsFromAPI,
            (progress) => {
              setCachingProgress(progress);
            }
          );

          if (cacheSuccess) {
            setCachingProgress(100);
            queueOfflineAudioDownloadsForLevel(userData?.level);
          }
          startupDiagnostics.endOperation(postLoginCachingOperationId, {
            status: "ok",
            details: { cacheSuccess },
          });

          // Clear the flag and dismiss the loader
          setNeedsPostLoginCaching(false);
          requestAppReady("postLoginCaching.completed");
        } catch (error) {
          startupDiagnostics.endOperation(postLoginCachingOperationId, {
            status: "error",
            error,
          });
          setNeedsPostLoginCaching(false);
          requestAppReady("postLoginCaching.failed");
        }
      };

      performPostLoginCaching();
    }
  }, [
    needsPostLoginCaching,
    apiToken,
    setNeedsPostLoginCaching,
    requestAppReady,
    queueOfflineAudioDownloadsForLevel,
    userData?.level,
  ]);

  useEffect(() => {
    queueOfflineAudioDownloadsForLevel(userData?.level);
  }, [queueOfflineAudioDownloadsForLevel, userData?.level]);

  // Handle animated loader completion
  const handleLoadingComplete = () => {
    startupDiagnostics.markLoaderDismissed();
    setShowLoader(false);
  };

  return (
    <>
      {appIsReady && (
        <DashboardProvider>
          <MusicPlayerProvider>
            <StatusBar style={theme.statusBarStyle} />
            <Slot />

            {/* Global Music Player - persists across navigation */}
            <GlobalMiniPlayer />
          </MusicPlayerProvider>
        </DashboardProvider>
      )}

      {/* Animated Kanji Loader - shows during initialization */}
      {showLoader && (
        <AnimatedKanjiLoader
          shouldDismiss={appIsReady}
          onLoadingComplete={handleLoadingComplete}
          cachingProgress={cachingProgress}
          statusMessage={loaderStatusMessage}
        />
      )}
    </>
  );
}

function RootLayoutContent() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <BackgroundTasksProvider>
          <RootLayoutContentInner />
        </BackgroundTasksProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <RootLayoutContent />
      </SessionProvider>
    </ThemeProvider>
  );
}
