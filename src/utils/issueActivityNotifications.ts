import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { fetch } from "expo/fetch";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

import { isIOSOnMac } from "./platformSupport";
import { isPortegoUsername } from "./portegoAccess";

const ISSUE_ACTIVITY_NOTIFICATION_KIND = "issueActivity";
const INSTALLATION_ID_KEY = "issue-activity-push-installation-id";
const REQUEST_TIMEOUT_MS = 15_000;
const INSTALLATION_ID_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

type IssueActivityIdentity = {
  currentUserId?: string | null;
  currentUsername?: string | null;
  apiToken?: string | null;
};

type RegistrationSession = {
  apiToken: string;
  endpoint: string;
  anonKey: string;
  projectId: string;
  subscriptions: { remove(): void }[];
  request: AbortController | null;
  work: Promise<void> | null;
  refreshRequested: boolean;
  devicePushToken?: Notifications.DevicePushToken;
};

let activeSession: RegistrationSession | null = null;
let installationIdPromise: Promise<string> | null = null;
let loggedInstallationId: string | null = null;
let exportedInstallationId: string | null = null;

export function getIssueActivityNotificationIssueId(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data || data.kind !== ISSUE_ACTIVITY_NOTIFICATION_KIND) {
    return null;
  }

  return typeof data.issueId === "string" && data.issueId.length > 0
    ? data.issueId
    : null;
}

export function startIssueActivityNotifications(
  identity: IssueActivityIdentity,
): () => void {
  stopIssueActivityNotifications();

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  if (
    Platform.OS !== "ios" ||
    Platform.constants.interfaceIdiom !== "phone" ||
    Platform.isPad ||
    isIOSOnMac() ||
    !isPortegoUsername(identity.currentUsername) ||
    !identity.currentUserId ||
    !identity.apiToken ||
    !supabaseUrl ||
    !anonKey ||
    typeof projectId !== "string" ||
    !projectId
  ) {
    return () => {};
  }

  const session: RegistrationSession = {
    apiToken: identity.apiToken,
    endpoint: `${supabaseUrl.replace(/\/$/, "")}/functions/v1/issue-activity-push`,
    anonKey,
    projectId,
    subscriptions: [],
    request: null,
    work: null,
    refreshRequested: false,
  };
  activeSession = session;

  try {
    session.subscriptions.push(
      AppState.addEventListener("change", (state) => {
        if (state === "active") refreshRegistration(session);
      }),
    );
    session.subscriptions.push(
      Notifications.addPushTokenListener((token) => {
        // Passing the supplied APNs token avoids requesting it again from inside
        // its own listener, which can otherwise cause a notification-token loop.
        session.devicePushToken = token;
        refreshRegistration(session);
      }),
    );
    refreshRegistration(session);
  } catch {
    stopIssueActivityNotifications();
    console.warn("Issue activity push registration could not start.");
  }

  return () => {
    if (activeSession === session) stopIssueActivityNotifications();
  };
}

export function stopIssueActivityNotifications(): void {
  const session = activeSession;
  activeSession = null;
  if (!session) return;

  session.request?.abort();
  session.subscriptions.forEach((subscription) => subscription.remove());
}

function refreshRegistration(session: RegistrationSession): void {
  if (activeSession !== session) return;
  if (session.work) {
    session.refreshRequested = true;
    return;
  }

  session.refreshRequested = false;
  session.work = registerInstallation(session);
  void session.work
    .catch(() => {
      if (activeSession === session) {
        // Provider errors can include tokens or request headers. Never log them.
        console.warn("Issue activity push registration failed; retrying when the app becomes active.");
      }
    })
    .finally(() => {
      session.work = null;
      if (session.refreshRequested) refreshRegistration(session);
    });
}

async function getInstallationId(): Promise<string> {
  if (!installationIdPromise) {
    installationIdPromise = (async () => {
      const stored = await SecureStore.getItemAsync(
        INSTALLATION_ID_KEY,
        INSTALLATION_ID_OPTIONS,
      );
      if (stored) return stored;

      const installationId = Crypto.randomUUID();
      await SecureStore.setItemAsync(
        INSTALLATION_ID_KEY,
        installationId,
        INSTALLATION_ID_OPTIONS,
      );
      return installationId;
    })();
  }

  try {
    return await installationIdPromise;
  } finally {
    installationIdPromise = null;
  }
}

async function postRegistrationAction(
  session: RegistrationSession,
  action: "eligibility" | "register",
  body: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  if (activeSession !== session) return null;

  const request = new AbortController();
  session.request = request;
  const timeout = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${session.endpoint}/${action}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
        apikey: session.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });
    if (activeSession !== session || request.signal.aborted) return null;
    // A phone must be explicitly approved on the server before it can enroll.
    if (response.status === 403 || response.status === 503) return null;
    if (!response.ok) throw new Error("Push registration request failed");

    const result: unknown = await response.json();
    return result !== null && typeof result === "object"
      ? (result as Record<string, unknown>)
      : null;
  } finally {
    clearTimeout(timeout);
    if (session.request === request) session.request = null;
  }
}

async function registerInstallation(session: RegistrationSession): Promise<void> {
  const installationId = await getInstallationId();
  if (activeSession !== session) return;

  if (__DEV__ && loggedInstallationId !== installationId) {
    // This non-secret UUID lets the owner approve this exact physical iPhone.
    // The APNs, Expo and WaniKani tokens must never appear in logs.
    console.info("Issue activity push installation ID:", installationId);
    loggedInstallationId = installationId;
  }

  if (exportedInstallationId !== installationId) {
    try {
      // A trusted, connected-device container read can enroll a Release build.
      // This file deliberately contains no account credentials or push tokens.
      new File(Paths.document, "issue-activity-push-installation.json").write(
        JSON.stringify({ installationId }),
      );
      exportedInstallationId = installationId;
    } catch {
      // Diagnostic export is optional; SecureStore remains the only ID source.
    }
  }

  // SDK 55 has no Constants.isDevice. The backend pins a UUID read from the
  // owner's physical iPhone; THIS_DEVICE_ONLY storage cannot migrate that
  // approval to a simulator, restored backup, iPad, Mac or another phone.
  const eligibility = await postRegistrationAction(session, "eligibility", {
    installationId,
    platform: "ios",
  });
  if (activeSession !== session || eligibility?.eligible !== true) return;

  let permissions = await Notifications.getPermissionsAsync();
  if (activeSession !== session) return;
  if (permissions.status !== "granted" && permissions.canAskAgain) {
    permissions = await Notifications.requestPermissionsAsync();
  }
  if (activeSession !== session || permissions.status !== "granted") return;

  const pushToken = await Notifications.getExpoPushTokenAsync({
    projectId: session.projectId,
    ...(session.devicePushToken
      ? { devicePushToken: session.devicePushToken }
      : {}),
  });
  if (activeSession !== session) return;

  const result = await postRegistrationAction(session, "register", {
    installationId,
    expoPushToken: pushToken.data,
    platform: "ios",
  });
  if (result && result.registered !== true) {
    throw new Error("Push registration was not confirmed");
  }
}
