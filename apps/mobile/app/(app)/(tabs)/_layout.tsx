import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useEffect, useMemo } from "react";
import { Appearance, DynamicColorIOS, Platform } from "react-native";
import { useFeatureFlag } from "../../../src/hooks/useFeatureFlags";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import { useAuthStore, useSettingsStore } from "../../../src/utils/store";
import { isPortegoUsername } from "../../../src/utils/portegoAccess";
import { useTheme } from "../../../src/utils/theme";

type TabId =
  | "home"
  | "progress"
  | "news"
  | "songs"
  | "items"
  | "analytics"
  | "epubs"
  | "videos"
  | "mangas"
  | "bunpro";

export default function TabsLayout() {
  const { theme, themeMode, isDark } = useTheme();
  const useNativeTabs = supportsNativeTabs();
  const { userData } = useAuthStore();
  const { gravatarEmail, customTabOrder } = useSettingsStore();
  const showSongsTabFlag = useFeatureFlag("show_songs_tab");
  const normalizedEmail = gravatarEmail?.trim().toLowerCase() ?? "";
  const isSongsHiddenForEmail = normalizedEmail === "kakehashi.app@gmail.com";
  const canAccessMangaTab = isPortegoUsername(userData?.username);
  const showSongsTab =
    (showSongsTabFlag || normalizedEmail === "portego2000@hotmail.es") &&
    !isSongsHiddenForEmail;
  const maxTabs = 5;

  // Determine which tabs should be visible based on customTabOrder
  const visibleTabs = useMemo(() => {
    // Filter out songs if feature flag is disabled
    const filteredOrder = customTabOrder.filter((tab: TabId) => {
      if (tab === "songs" && !showSongsTab) return false;
      if (tab === "mangas" && !canAccessMangaTab) return false;
      if (tab === "bunpro") return false;
      return true;
    });

    const cappedOrder = filteredOrder.slice(0, maxTabs);
    return new Set(cappedOrder);
  }, [canAccessMangaTab, customTabOrder, maxTabs, showSongsTab]);

  const isTabVisible = (tabId: TabId) => visibleTabs.has(tabId);

  // Workaround for iOS liquid glass tabs: force appearance to match any
  // non-system app theme (light, dark, midnight, sepia, etc).
  useEffect(() => {
    if (Platform.OS !== "ios" || !useNativeTabs) {
      return;
    }

    if (themeMode === "system") {
      Appearance.setColorScheme("unspecified");
      return;
    }

    Appearance.setColorScheme(isDark ? "dark" : "light");

    return () => {
      Appearance.setColorScheme("unspecified");
    };
  }, [isDark, themeMode, useNativeTabs]);

  // Fallback to standard Tabs for older iOS versions
  if (!useNativeTabs) {
    return (
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.cardBackground,
            borderTopColor: theme.border,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: "Level",
            href: isTabVisible("progress") ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="items"
          options={{
            title: "Items",
            href: isTabVisible("items") ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="library" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: "Analytics",
            href: isTabVisible("analytics") ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="analytics" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="news"
          options={{
            title: "News",
            href: isTabVisible("news") ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="newspaper" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="epubs"
          options={{
            title: "Books",
            href: isTabVisible("epubs") ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="videos"
          options={{
            title: "Video",
            href: isTabVisible("videos") ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="videocam" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="mangas"
          options={{
            title: "Manga",
            href: isTabVisible("mangas") ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bookmarks" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="songs"
          options={{
            title: "Music",
            href: isTabVisible("songs") ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="musical-notes" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="search"
          options={{
            href: null,
          }}
        />
        {/* Hide previous Anki tab just in case file still exists temporarily, but we will delete it */}
        <Tabs.Screen
          name="anki"
          options={{
            href: null,
          }}
        />
      </Tabs>
    );
  }

  // Define dynamic colors for iOS liquid glass effect
  const tabTintColor = DynamicColorIOS({
    dark: theme.primary,
    light: theme.primary,
  });

  // The LoadingProgressBar is now managed individually in each tab component
  // to ensure proper positioning below each tab's header
  return (
    <NativeTabs
      labelStyle={{
        fontSize: 10,
      }}
      tintColor={tabTintColor}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="progress" hidden={!isTabVisible("progress")}>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "chart.line.text.clipboard",
            selected: "chart.line.text.clipboard.fill",
          }}
        />
        <NativeTabs.Trigger.Label>Level</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="items" hidden={!isTabVisible("items")}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.stack.3d.up", selected: "square.stack.3d.up.fill" }}
        />
        <NativeTabs.Trigger.Label>Items</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analytics" hidden={!isTabVisible("analytics")}>
        <NativeTabs.Trigger.Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <NativeTabs.Trigger.Label>Analytics</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="news" hidden={!isTabVisible("news")}>
        <NativeTabs.Trigger.Icon sf={{ default: "newspaper", selected: "newspaper.fill" }} />
        <NativeTabs.Trigger.Label>News</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="epubs" hidden={!isTabVisible("epubs")}>
        <NativeTabs.Trigger.Icon sf={{ default: "book.closed", selected: "book.closed.fill" }} />
        <NativeTabs.Trigger.Label>Books</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="videos" hidden={!isTabVisible("videos")}>
        <NativeTabs.Trigger.Icon sf={{ default: "play.square", selected: "play.square.fill" }} />
        <NativeTabs.Trigger.Label>Video</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mangas" hidden={!isTabVisible("mangas")}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "books.vertical", selected: "books.vertical.fill" }}
        />
        <NativeTabs.Trigger.Label>Manga</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="songs" hidden={!isTabVisible("songs")}>
        <NativeTabs.Trigger.Icon sf={{ default: "music.pages", selected: "music.pages.fill" }} />
        <NativeTabs.Trigger.Label>Songs</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
