import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useEffect } from "react";
import { Appearance, DynamicColorIOS, Platform } from "react-native";
import { TabBarVisibilityProvider, useTabBarHidden } from "../../../src/contexts/TabBarVisibilityContext";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import { useTabNavigation } from "../../../src/hooks/useTabNavigation";
import { TAB_INFO, type TabId } from "../../../src/utils/tabNavigation";
import { useTheme } from "../../../src/utils/theme";

export default function TabsLayout() {
  return <TabBarVisibilityProvider><TabsContent /></TabBarVisibilityProvider>;
}

function TabsContent() {
  const tabBarHidden = useTabBarHidden();
  const { theme, themeMode, isDark } = useTheme();
  const useNativeTabs = supportsNativeTabs();
  const { direct, overflow } = useTabNavigation();
  const routeName = (id: TabId) => id === "home" ? "index" : id;
  const nativeIcons = {
    home: { default: "house", selected: "house.fill" },
    progress: { default: "chart.line.text.clipboard", selected: "chart.line.text.clipboard.fill" },
    items: { default: "square.stack.3d.up", selected: "square.stack.3d.up.fill" },
    analytics: { default: "chart.bar", selected: "chart.bar.fill" },
    news: { default: "newspaper", selected: "newspaper.fill" },
    epubs: { default: "book.closed", selected: "book.closed.fill" },
    videos: { default: "play.square", selected: "play.square.fill" },
    mangas: { default: "books.vertical", selected: "books.vertical.fill" },
    notebooks: { default: "note.text", selected: "note.text" },
    songs: { default: "music.pages", selected: "music.pages.fill" },
  } as const;
  const isTabVisible = (tabId: TabId) => direct.some(tab => tab.id === tabId);

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
            display: tabBarHidden ? "none" : undefined,
            backgroundColor: theme.cardBackground,
            borderTopColor: theme.border,
          },
        }}
      >
        {TAB_INFO.map(tab => <Tabs.Screen key={tab.id} name={routeName(tab.id)} options={{
          title: tab.label,
          href: isTabVisible(tab.id) ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name={tab.id === "progress" ? "stats-chart" : tab.icon} size={size} color={color} />,
        }} />)}

        <Tabs.Screen name="more" options={{ title: "More", href: overflow.length ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} />,
        }} />
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
      hidden={tabBarHidden}
      labelStyle={{
        fontSize: 10,
      }}
      tintColor={tabTintColor}
    >
      {TAB_INFO.map(tab => <NativeTabs.Trigger key={tab.id} name={routeName(tab.id)} hidden={!isTabVisible(tab.id)}>
        <NativeTabs.Trigger.Icon sf={nativeIcons[tab.id]} />
        <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>)}
      <NativeTabs.Trigger name="more" hidden={!overflow.length}>
        <NativeTabs.Trigger.Icon sf="ellipsis" />
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
