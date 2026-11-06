import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useEffect } from "react";
import { Appearance, DynamicColorIOS, Platform } from "react-native";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import { useTheme } from "../../../src/utils/theme";
import { NativeSearchProvider, useNativeSearch } from "../../../src/contexts/NativeSearchContext";

export default function BunproTabsLayout() {
  return <NativeSearchProvider><BunproTabsContent /></NativeSearchProvider>;
}

function BunproTabsContent() {
  const { markAppeared } = useNativeSearch();
  const { theme, themeMode, isDark } = useTheme();
  const useNativeTabs = supportsNativeTabs();

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
              <Ionicons name="school" size={size} color={color ?? undefined} />
            ),
          }}
        />
        <Tabs.Screen
          name="bunpro-search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color ?? undefined} />
            ),
          }}
        />
      </Tabs>
    );
  }

  const tabTintColor = DynamicColorIOS({
    dark: theme.primary,
    light: theme.primary,
  });

  return (
    <NativeTabs
      labelStyle={{
        fontSize: 10,
      }}
      tintColor={tabTintColor}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "graduationcap", selected: "graduationcap.fill" }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bunpro-search" role="search" unstable_nativeProps={{ onDidAppear: markAppeared }}>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
