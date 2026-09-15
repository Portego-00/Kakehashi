import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

import {
  getIssueActivityNotificationIssueId,
  startIssueActivityNotifications,
  stopIssueActivityNotifications,
} from "../issueActivityNotifications";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { easConfig: { projectId: "test-project" } },
}));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));
jest.mock("expo-file-system", () => ({
  File: jest.fn(() => ({ write: jest.fn() })),
  Paths: { document: "file:///documents/" },
}));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 5,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  addPushTokenListener: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    isPad: false,
    constants: { interfaceIdiom: "phone", systemName: "iOS" },
  },
  AppState: { addEventListener: jest.fn() },
}));

const installationId = "4e995ae1-d0b9-49aa-9a85-e9ac754ee5de";
const identity = {
  currentUserId: "123",
  currentUsername: "Portego",
  apiToken: "private-wanikani-token",
};
const mockFetch = jest.mocked(fetch);
const mockGetPermissions = jest.mocked(Notifications.getPermissionsAsync);
const mockRequestPermissions = jest.mocked(Notifications.requestPermissionsAsync);
const mockGetExpoPushToken = jest.mocked(Notifications.getExpoPushTokenAsync);
const mockGetInstallation = jest.mocked(SecureStore.getItemAsync);
const mockSetInstallation = jest.mocked(SecureStore.setItemAsync);
const removeAppStateListener = jest.fn();
const removePushTokenListener = jest.fn();
type PushResponse = Awaited<ReturnType<typeof fetch>>;

function respond(body: Record<string, unknown>, status = 200): PushResponse {
  return new Response(JSON.stringify(body), { status }) as PushResponse;
}

async function flushRegistration() {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

function activateApp() {
  const listener = jest.mocked(AppState.addEventListener).mock.calls[0][1];
  listener("active");
}

function rotatePushToken(token: Notifications.DevicePushToken) {
  const listener = jest.mocked(Notifications.addPushTokenListener).mock.calls[0][0];
  listener(token);
}

describe("personal iPhone issue activity push registration", () => {
  let infoSpy: jest.SpyInstance;
  let warningSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
    Object.assign(Platform, {
      OS: "ios",
      isPad: false,
      constants: { interfaceIdiom: "phone", systemName: "iOS" },
    });
    Object.assign(Constants, { easConfig: { projectId: "test-project" } });
    mockGetInstallation.mockResolvedValue(installationId);
    mockSetInstallation.mockResolvedValue(undefined);
    jest.mocked(Crypto.randomUUID).mockReturnValue(installationId);
    mockGetPermissions.mockResolvedValue({
      status: "granted",
      granted: true,
      canAskAgain: true,
      expires: "never",
    } as Notifications.NotificationPermissionsStatus);
    mockRequestPermissions.mockResolvedValue({
      status: "granted",
      granted: true,
      canAskAgain: true,
      expires: "never",
    } as Notifications.NotificationPermissionsStatus);
    mockGetExpoPushToken.mockResolvedValue({
      type: "expo",
      data: "ExpoPushToken[private-push-token]",
    });
    mockFetch.mockImplementation(async (url) =>
      respond(String(url).endsWith("/eligibility") ? { eligible: true } : { registered: true }),
    );
    jest.mocked(AppState.addEventListener).mockReturnValue({ remove: removeAppStateListener });
    jest.mocked(Notifications.addPushTokenListener).mockReturnValue({ remove: removePushTokenListener });
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    warningSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    stopIssueActivityNotifications();
    await flushRegistration();
    infoSpy.mockRestore();
    warningSpy.mockRestore();
  });

  it.each([
    { OS: "android", isPad: false, constants: { interfaceIdiom: "phone" } },
    { OS: "web", isPad: false, constants: {} },
    { OS: "ios", isPad: true, constants: { interfaceIdiom: "pad" } },
    { OS: "ios", isPad: false, constants: { interfaceIdiom: "mac" } },
    { OS: "ios", isPad: false, constants: { interfaceIdiom: "phone", isMacCatalyst: true } },
  ])("does not register or request permissions on $OS $constants", async (platform) => {
    Object.assign(Platform, platform);
    startIssueActivityNotifications(identity);
    await flushRegistration();
    expect(mockGetInstallation).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockGetPermissions).not.toHaveBeenCalled();
  });

  it("requires a signed-in owner before contacting the server", async () => {
    startIssueActivityNotifications({ ...identity, currentUsername: "another-person" });
    startIssueActivityNotifications({ ...identity, apiToken: null });
    await flushRegistration();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
  });

  it("creates a device-only UUID and registers only after server approval", async () => {
    mockGetInstallation.mockResolvedValue(null);
    startIssueActivityNotifications(identity);
    await flushRegistration();

    expect(mockSetInstallation).toHaveBeenCalledWith(
      "issue-activity-push-installation-id",
      installationId,
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
    );
    expect(File).toHaveBeenCalledWith(
      "file:///documents/",
      "issue-activity-push-installation.json",
    );
    const diagnosticFile = jest.mocked(File).mock.results[0].value;
    expect(diagnosticFile.write).toHaveBeenCalledWith(JSON.stringify({ installationId }));
    expect(mockFetch).toHaveBeenNthCalledWith(1,
      "https://test.supabase.co/functions/v1/issue-activity-push/eligibility",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer private-wanikani-token",
          apikey: "public-anon-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ installationId, platform: "ios" }),
      }),
    );
    expect(mockGetExpoPushToken).toHaveBeenCalledWith({ projectId: "test-project" });
    expect(mockFetch).toHaveBeenNthCalledWith(2,
      "https://test.supabase.co/functions/v1/issue-activity-push/register",
      expect.objectContaining({
        body: JSON.stringify({
          installationId,
          expoPushToken: "ExpoPushToken[private-push-token]",
          platform: "ios",
        }),
      }),
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain("private-");
  });

  it.each([403, 503])("does not get a token for an unapproved phone or simulator (%s)", async (status) => {
    mockFetch.mockResolvedValue(respond({ error: "not approved" }, status));
    startIssueActivityNotifications(identity);
    await flushRegistration();
    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries approval on foreground after the physical phone has been approved", async () => {
    mockFetch.mockResolvedValueOnce(respond({}, 403));
    startIssueActivityNotifications(identity);
    await flushRegistration();
    activateApp();
    await flushRegistration();
    expect(mockGetExpoPushToken).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("refreshes the Expo token using the rotated APNs token without recursion", async () => {
    startIssueActivityNotifications(identity);
    await flushRegistration();
    const rotatedToken: Notifications.DevicePushToken = { type: "ios", data: "rotated-apns-token" };
    rotatePushToken(rotatedToken);
    await flushRegistration();
    expect(mockGetExpoPushToken).toHaveBeenLastCalledWith({
      projectId: "test-project",
      devicePushToken: rotatedToken,
    });
    expect(mockGetExpoPushToken).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("does not upload a token after its account session is stopped", async () => {
    let finishToken!: (value: Notifications.ExpoPushToken) => void;
    mockGetExpoPushToken.mockImplementationOnce(() => new Promise((resolve) => { finishToken = resolve; }));
    const stop = startIssueActivityNotifications(identity);
    await flushRegistration();
    expect(mockGetExpoPushToken).toHaveBeenCalledTimes(1);
    stop();
    finishToken({ type: "expo", data: "ExpoPushToken[obsolete-token]" });
    await flushRegistration();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
    expect(removePushTokenListener).toHaveBeenCalledTimes(1);
  });

  it("aborts a pending request and ignores a late approval after account change", async () => {
    let finishEligibility!: (value: PushResponse) => void;
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => { finishEligibility = resolve; }));
    startIssueActivityNotifications(identity);
    await flushRegistration();
    const requestSignal = mockFetch.mock.calls[0][1]?.signal;
    startIssueActivityNotifications({ ...identity, currentUsername: "someone-else" });
    expect(requestSignal?.aborted).toBe(true);
    finishEligibility(respond({ eligible: true }));
    await flushRegistration();
    expect(mockGetPermissions).not.toHaveBeenCalled();
  });

  it("handles a provider error without exposing credentials and retries on foreground", async () => {
    mockGetExpoPushToken.mockRejectedValueOnce(new Error("private-push-token private-wanikani-token"));
    startIssueActivityNotifications(identity);
    await flushRegistration();
    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warningSpy.mock.calls)).not.toContain("private-");
    activateApp();
    await flushRegistration();
    expect(mockGetExpoPushToken).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("preserves issue deep links from server notifications", () => {
    expect(getIssueActivityNotificationIssueId({ kind: "issueActivity", issueId: "issue-123" })).toBe("issue-123");
    expect(getIssueActivityNotificationIssueId({ kind: "review", issueId: "issue-123" })).toBeNull();
    expect(getIssueActivityNotificationIssueId({ kind: "issueActivity", issueId: "" })).toBeNull();
  });
});
