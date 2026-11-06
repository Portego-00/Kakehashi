import fs from "node:fs";
import path from "node:path";
import React from "react";
import { Text } from "react-native";
import { router, Slot, Tabs } from "expo-router";
import { act, renderRouter, testRouter } from "expo-router/testing-library";
import type { MemoryContext } from "expo-router/build/testing-library/context-stubs";

import * as appLayout from "../(app)/_layout";

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

// Exercise the installed router with the app's real route inventory and stack
// settings, without startup services or data-fetching screen components.
function routeContext(): MemoryContext {
  return Object.fromEntries(routeFiles(appDirectory).filter((route) => !route.includes("+")).map((route) => {
    if (route === "(app)/_layout") return [route, appLayout];
    if (route === "_layout") return [route, { default: () => <Slot /> }];
    if (route === "(app)/(tabs)/_layout") return [route, { default: () =>
      <Tabs screenOptions={{ headerShown: false }}><Tabs.Screen name="index" /></Tabs>,
    }];
    if (route.endsWith("_layout")) return [route, { default: () => <Slot /> }];
    if (route === "(app)/index") {
      // Keep the actual entry redirect if one exists in the route inventory.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return [route, require(path.join(appDirectory, `${route}.tsx`))];
    }
    return [route, { default: () => <Text>{route}</Text> }];
  }));
}

it.each(["/", "/(app)/(tabs)"])("opens Home once from %s, with no screen behind it", async (initialUrl) => {
  const screen = await renderRouter(routeContext(), { initialUrl });
  expect(screen.getSegments()).toEqual(["(app)", "(tabs)"]);
  expect(screen.getByText("(app)/(tabs)/index")).toBeTruthy();
  expect(testRouter.canGoBack()).toBe(false);

  await testRouter.push("/settings");
  expect(testRouter.canGoBack()).toBe(true);
  await testRouter.back();
  expect(screen.getPathname()).toBe("/");
  expect(screen.getSegments()).toEqual(["(app)", "(tabs)"]);
  expect(testRouter.canGoBack()).toBe(false);
});

it("keeps Home beneath a cold-linked subject, then returns to a single Home", async () => {
  const screen = await renderRouter(routeContext(), { initialUrl: "/subject/2470" });
  expect(screen.getSegments()).toEqual(["(app)", "subject", "[id]"]);
  expect(testRouter.canGoBack()).toBe(true);
  await testRouter.back();
  expect(screen.getPathname()).toBe("/");
  expect(screen.getSegments()).toEqual(["(app)", "(tabs)"]);
  expect(testRouter.canGoBack()).toBe(false);
});

it("returns to one Home when a study flow replaces its route with /", async () => {
  const screen = await renderRouter(routeContext(), { initialUrl: "/" });
  await testRouter.push("/custom-review");
  await testRouter.replace("/");
  expect(screen.getSegments()).toEqual(["(app)", "(tabs)"]);
  expect(screen.getByText("(app)/(tabs)/index")).toBeTruthy();
  expect(testRouter.canGoBack()).toBe(false);
});

it("enters a single Home when authentication replaces the login route", async () => {
  const screen = await renderRouter(routeContext(), { initialUrl: "/(auth)/login" });
  await act(async () => { router.replace("/(app)/(tabs)"); });
  expect(screen.getSegments()).toEqual(["(app)", "(tabs)"]);
  expect(testRouter.canGoBack()).toBe(false);
});
