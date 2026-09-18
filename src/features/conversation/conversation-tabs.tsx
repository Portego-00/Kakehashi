import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Keyboard } from 'react-native';
import { supportsNativeTabs } from '../../utils/nativeTabs';
import { useConversationTheme } from './conversation-theme';
import { useConversationRuntime } from './conversation-runtime';

/** Same native navigator as Home: UIKit supplies Liquid Glass on iOS 26+. */
export function ConversationTabs() {
  const { colors } = useConversationTheme();
  const runtime = useConversationRuntime();
  const hidden = runtime ? runtime.controller.loading || !runtime.controller.preferences.hasOnboarded : false;
  if (supportsNativeTabs()) return <NativeTabs hidden={hidden} tintColor={colors.orange} iconColor={{ default: colors.secondary, selected: colors.orange }} labelStyle={{ default: { fontSize: 10, color: colors.secondary }, selected: { fontSize: 10, color: colors.orange } }} backBehavior="initialRoute" screenListeners={{ tabPress: () => Keyboard.dismiss() }}>
    <NativeTabs.Trigger name="index" disableAutomaticContentInsets contentStyle={{ backgroundColor: colors.cream }}>
      <NativeTabs.Trigger.Icon sf="waveform" />
      <NativeTabs.Trigger.Label>Talk</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="themes" disableAutomaticContentInsets contentStyle={{ backgroundColor: colors.cream }}>
      <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
      <NativeTabs.Trigger.Label>Themes</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="words" disableAutomaticContentInsets contentStyle={{ backgroundColor: colors.cream }}>
      <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} />
      <NativeTabs.Trigger.Label>Words</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
  </NativeTabs>;
  return <Tabs backBehavior="initialRoute" screenListeners={{ tabPress: () => Keyboard.dismiss() }} screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.orange, tabBarInactiveTintColor: colors.secondary, tabBarHideOnKeyboard: true, tabBarStyle: { display: hidden ? 'none' : undefined, backgroundColor: colors.paper, borderTopColor: colors.border }, sceneStyle: { backgroundColor: colors.cream } }}>
    <Tabs.Screen name="index" options={{ title: 'Talk', tabBarIcon: ({ color, size }) => <Ionicons name="pulse" color={color} size={size} /> }} />
    <Tabs.Screen name="themes" options={{ title: 'Themes', tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }} />
    <Tabs.Screen name="words" options={{ title: 'Words', tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} /> }} />
  </Tabs>;
}
