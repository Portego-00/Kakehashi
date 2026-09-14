import fs from "node:fs";
import path from "node:path";

import { getLinkingConfig } from "expo-router/build/getLinkingConfig";
import { getRoutes } from "expo-router/build/getRoutes";
import { extractExpoPathFromURL } from "expo-router/build/fork/extractPathFromURL";
import { getMockContext } from "expo-router/build/testing-library/mock-config";
import { openAuthSessionAsync } from "expo-web-browser";
import { Platform } from "react-native";

import * as nativeIntent from "../../../../app/+native-intent";
import { SPOTIFY_REDIRECT_URI } from "../../../utils/spotifyAuthRedirect";

const mockUrlListeners = new Set<(event: { url: string }) => unknown>();
let mockAppStateChange: (state: string) => void;
jest.unmock("expo-web-browser");
jest.mock("react-native/Libraries/Linking/Linking", () => ({
  __esModule: true,
  default: {
    addEventListener: (_event: string, listener: (event: { url: string }) => unknown) => {
      mockUrlListeners.add(listener);
      return { remove: () => mockUrlListeners.delete(listener) };
    },
  },
}));
jest.mock("expo-linking", () => ({
  addEventListener: (...args: unknown[]) => jest.requireMock("react-native/Libraries/Linking/Linking").default.addEventListener(...args),
}));
jest.mock("react-native/Libraries/AppState/AppState", () => ({
  __esModule: true,
  default: {
    currentState: "active",
    addEventListener: (_event: string, listener: typeof mockAppStateChange) => {
      mockAppStateChange = listener;
      return { remove: jest.fn() };
    },
  },
}));
jest.mock("expo-web-browser/build/ExpoWebBrowser", () => ({
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
  dismissBrowser: () => mockAppStateChange("active"),
}));

const appDirectory = path.join(process.cwd(), "app");
function routeFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "__tests__") return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? routeFiles(filename)
      : /\.[tj]sx?$/.test(entry.name)
        ? [path.relative(appDirectory, filename).replace(/\.[tj]sx?$/, "")]
        : [];
  });
}

// Use the real app route inventory and native-intent discovery. Screen components
// are irrelevant to URL delivery, so avoid mounting their unrelated providers.
function linkingConfig(serverUrl?: string) {
  const context = getMockContext(Object.fromEntries(routeFiles(appDirectory).map((route) => [
    route, route === "+native-intent" ? nativeIntent : { default: () => null },
  ])));
  const routes = getRoutes(context);
  if (!routes) throw new Error("Expected app routes");
  return getLinkingConfig(routes, context, () => ({
    unstable_globalHref: "/", pathname: "/", pathnameWithParams: "/",
    params: {}, searchParams: new URLSearchParams(), segments: [], isIndex: true,
  }), { serverUrl, skipGenerated: false, sitemap: true, notFound: true });
}

const originalPlatform = Platform.OS;
beforeAll(() => { Object.defineProperty(Platform, "OS", { value: "android" }); });
afterAll(() => { Object.defineProperty(Platform, "OS", { value: originalPlatform }); });
afterEach(() => { mockUrlListeners.clear(); });

it.each(["code=fixture-code", "error=access_denied"])(
  "keeps Android callback %s on the current screen while AuthSession receives it",
  async (params) => {
    const config = linkingConfig();
    const onNavigate = jest.fn();
    const unsubscribe = config.subscribe?.(onNavigate);
    // Native browser opening is mocked; the installed Android AuthSession
    // polyfill and its independent Linking callback listener both run for real.
    const authorization = openAuthSessionAsync("https://accounts.spotify.com/authorize", SPOTIFY_REDIRECT_URI);
    await Promise.resolve();
    const url = `${SPOTIFY_REDIRECT_URI}?${params}&state=fixture-audit`;
    await Promise.all([...mockUrlListeners].map((listener) => listener({ url })));
    await expect(authorization).resolves.toEqual({ type: "success", url });
    expect(onNavigate).not.toHaveBeenCalled();
    unsubscribe?.();
  }
);

it("opens the app entry route for a cold callback without routing OAuth parameters", async () => {
  const config = linkingConfig(`${SPOTIFY_REDIRECT_URI}?code=fixture-code&state=fixture-audit`);
  expect(await config.getInitialURL?.()).toBe("/");
});

it.each([
  "kakehashi://subject/2470",
  "kakehashi://?sharedUrl=https%3A%2F%2Fexample.com",
  "kakehashi://?imageUri=file%3A%2F%2Ffixture.png",
  "kakehashi://spotify-auth-other?code=fixture",
  "kakehashi://spotify-auth/other?code=fixture",
  "https://example.com/spotify-auth?code=fixture",
  "/settings",
  "not a valid URL",
])("preserves unrelated native links: %s", async (url) => {
  const config = linkingConfig();
  const onNavigate = jest.fn();
  const unsubscribe = config.subscribe?.(onNavigate);
  await Promise.all([...mockUrlListeners].map((listener) => listener({ url })));
  expect(onNavigate).toHaveBeenCalledWith(url);
  expect(nativeIntent.redirectSystemPath({ path: url, initial: true })).toBe(url);
  unsubscribe?.();
});

it("still resolves normal subject navigation with the current route inventory", () => {
  const config = linkingConfig();
  const state = config.getStateFromPath(extractExpoPathFromURL([], "kakehashi://subject/2470"), config.config);
  expect(JSON.stringify(state)).toContain("subject/[id]");
  expect(JSON.stringify(state)).not.toContain("+not-found");
});
