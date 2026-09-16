import * as Updates from "expo-updates";
import { Platform } from "react-native";

import {
  applyStartupUpdate,
  STARTUP_UPDATE_DOWNLOAD_TIMEOUT_MS,
  STARTUP_UPDATE_TIMEOUT_MS,
} from "../startupUpdateService";

let mockUpdatesEnabled = true;
jest.mock("expo-updates", () => {
  const { UpdateCheckResultNotAvailableReason } = jest.requireActual("expo-updates/build/Updates.types");
  return {
    UpdateCheckResultNotAvailableReason,
    get isEnabled() { return mockUpdatesEnabled; },
    checkForUpdateAsync: jest.fn(),
    fetchUpdateAsync: jest.fn(),
    reloadAsync: jest.fn(),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const mockCheck = jest.mocked(Updates.checkForUpdateAsync);
const mockFetch = jest.mocked(Updates.fetchUpdateAsync);
const mockReload = jest.mocked(Updates.reloadAsync);
const originalDev = __DEV__;
const originalPlatform = Platform.OS;
const manifest = { id: "fixture-update", commitTime: 0, assets: [] };
const AVAILABLE: Updates.UpdateCheckResult = { isAvailable: true, isRollBackToEmbedded: false, manifest, reason: undefined };
const DOWNLOADED: Updates.UpdateFetchResult = { isNew: true, isRollBackToEmbedded: false, manifest };
const NO_UPDATE: Updates.UpdateCheckResult = {
  isAvailable: false, isRollBackToEmbedded: false, manifest: undefined,
  reason: Updates.UpdateCheckResultNotAvailableReason.NO_UPDATE_AVAILABLE_ON_SERVER,
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(0);
  jest.resetAllMocks();
  Object.defineProperty(global, "__DEV__", { value: false, configurable: true });
  mockUpdatesEnabled = true;
  mockCheck.mockResolvedValue(AVAILABLE);
  mockFetch.mockResolvedValue(DOWNLOADED);
  mockReload.mockResolvedValue(undefined);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  Object.defineProperty(global, "__DEV__", { value: originalDev, configurable: true });
  Object.defineProperty(Platform, "OS", { value: originalPlatform });
});

it("checks, downloads and requests reload while retaining the applying status", async () => {
  const onStatus = jest.fn();
  const reloadScreenOptions = { backgroundColor: "#ffffff", fade: true, spinner: { enabled: false } };
  expect(await applyStartupUpdate({ onStatus, reloadScreenOptions })).toEqual({ reloadTriggered: true, outcome: "reload-requested" });
  expect(mockCheck).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockReload).toHaveBeenCalledWith({ reloadScreenOptions });
  expect(onStatus.mock.calls).toEqual([["checking"], ["applying"]]);
  expect(jest.getTimerCount()).toBe(0);
});

it("applies an update when downloading takes longer than the check timeout", async () => {
  const download = deferred<Updates.UpdateFetchResult>();
  mockFetch.mockReturnValueOnce(download.promise);
  const onStatus = jest.fn();
  const finished = jest.fn();
  const result = applyStartupUpdate({ onStatus }).then(finished);

  await jest.advanceTimersByTimeAsync(STARTUP_UPDATE_TIMEOUT_MS + 1000);
  expect(finished).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenLastCalledWith("applying");

  download.resolve(DOWNLOADED);
  await result;
  expect(mockReload).toHaveBeenCalledTimes(1);
  expect(finished).toHaveBeenCalledWith({ reloadTriggered: true, outcome: "reload-requested" });
  expect(jest.getTimerCount()).toBe(0);
});

it.each(["development", "disabled", "web"])("skips native update work when %s", async (reason) => {
  if (reason === "development") Object.defineProperty(global, "__DEV__", { value: true });
  else if (reason === "disabled") mockUpdatesEnabled = false;
  else Object.defineProperty(Platform, "OS", { value: "web" });
  expect(await applyStartupUpdate()).toEqual({ reloadTriggered: false, outcome: "skipped" });
  expect(mockCheck).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockReload).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it("continues startup when no update is available", async () => {
  mockCheck.mockResolvedValue(NO_UPDATE);
  const onStatus = jest.fn();
  expect(await applyStartupUpdate({ onStatus })).toEqual({ reloadTriggered: false, outcome: "no-update" });
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockReload).not.toHaveBeenCalled();
  expect(onStatus.mock.calls).toEqual([["checking"], [null]]);
  expect(jest.getTimerCount()).toBe(0);
});

it("applies an explicit rollback to the embedded update", async () => {
  mockCheck.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: true, manifest: undefined, reason: undefined });
  mockFetch.mockResolvedValue({ isNew: false, isRollBackToEmbedded: true, manifest: undefined });
  expect(await applyStartupUpdate()).toEqual({ reloadTriggered: true, outcome: "reload-requested" });
  expect(mockReload).toHaveBeenCalledTimes(1);
});

it("does not reload when the fetch has no new update or rollback", async () => {
  mockFetch.mockResolvedValue({ isNew: false, isRollBackToEmbedded: false, manifest: undefined });
  const onStatus = jest.fn();
  expect(await applyStartupUpdate({ onStatus })).toEqual({ reloadTriggered: false, outcome: "no-update" });
  expect(mockReload).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenLastCalledWith(null);
});

it.each(["check", "fetch", "reload"])("continues startup after a %s error", async (phase) => {
  const operation = phase === "check" ? mockCheck : phase === "fetch" ? mockFetch : mockReload;
  operation.mockRejectedValueOnce(new Error("fixture failure"));
  const onStatus = jest.fn();
  expect(await applyStartupUpdate({ onStatus })).toEqual({ reloadTriggered: false, outcome: "failed" });
  expect(onStatus).toHaveBeenLastCalledWith(null);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(["resolve", "reject"])("stops waiting at five seconds and ignores a late check %s", async (settlement) => {
  const check = deferred<Updates.UpdateCheckResult>();
  mockCheck.mockReturnValueOnce(check.promise);
  const onStatus = jest.fn();
  const finished = jest.fn();
  void applyStartupUpdate({ onStatus }).then(finished);
  await jest.advanceTimersByTimeAsync(STARTUP_UPDATE_TIMEOUT_MS);
  expect(finished).toHaveBeenCalledWith({ reloadTriggered: false, outcome: "timed-out" });
  expect(onStatus.mock.calls).toEqual([["checking"], [null]]);
  if (settlement === "resolve") check.resolve(AVAILABLE);
  else check.reject(new Error("late check failure"));
  await jest.advanceTimersByTimeAsync(0);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockReload).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(["resolve", "reject"])("gives downloads a separate deadline and ignores a late download %s", async (settlement) => {
  const check = deferred<Updates.UpdateCheckResult>();
  const download = deferred<Updates.UpdateFetchResult>();
  mockCheck.mockReturnValueOnce(check.promise);
  mockFetch.mockReturnValueOnce(download.promise);
  const onStatus = jest.fn();
  const finished = jest.fn();
  void applyStartupUpdate({ onStatus }).then(finished);
  await jest.advanceTimersByTimeAsync(4000);
  check.resolve(AVAILABLE);
  await jest.advanceTimersByTimeAsync(0);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1000);
  expect(finished).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenLastCalledWith("applying");
  await jest.advanceTimersByTimeAsync(STARTUP_UPDATE_DOWNLOAD_TIMEOUT_MS - 1000);
  expect(finished).toHaveBeenCalledWith({ reloadTriggered: false, outcome: "timed-out" });
  expect(onStatus.mock.calls).toEqual([["checking"], ["applying"], [null]]);
  if (settlement === "resolve") download.resolve(DOWNLOADED);
  else download.reject(new Error("late download failure"));
  await jest.advanceTimersByTimeAsync(0);
  expect(mockReload).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenCalledTimes(3);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(["check", "fetch"])("checks the deadline after %s even if the timeout callback is delayed", async (phase) => {
  if (phase === "check") mockCheck.mockImplementationOnce(async () => {
    jest.setSystemTime(STARTUP_UPDATE_TIMEOUT_MS + 1);
    return AVAILABLE;
  });
  else mockFetch.mockImplementationOnce(async () => {
    jest.setSystemTime(STARTUP_UPDATE_DOWNLOAD_TIMEOUT_MS + 1);
    return DOWNLOADED;
  });
  expect(await applyStartupUpdate()).toEqual({ reloadTriggered: false, outcome: "timed-out" });
  if (phase === "check") expect(mockFetch).not.toHaveBeenCalled();
  expect(mockReload).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it("does not time out a reload already requested within the download deadline", async () => {
  const reload = deferred<void>();
  mockReload.mockReturnValueOnce(reload.promise);
  const onStatus = jest.fn();
  const finished = jest.fn();
  const result = applyStartupUpdate({ onStatus }).then(finished);
  await jest.advanceTimersByTimeAsync(0);
  expect(mockReload).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(STARTUP_UPDATE_DOWNLOAD_TIMEOUT_MS + 1);
  expect(finished).not.toHaveBeenCalled();
  expect(onStatus.mock.calls).toEqual([["checking"], ["applying"]]);
  expect(jest.getTimerCount()).toBe(0);
  reload.resolve();
  await result;
  expect(finished).toHaveBeenCalledWith({ reloadTriggered: true, outcome: "reload-requested" });
});
