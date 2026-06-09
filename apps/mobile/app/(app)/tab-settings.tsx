import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFeatureFlag } from "../../src/hooks/useFeatureFlags";
import { supportsNativeTabs } from "../../src/utils/nativeTabs";
import { isPortegoUsername } from "../../src/utils/portegoAccess";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

type TabId =
  | "home"
  | "progress"
  | "news"
  | "songs"
  | "items"
  | "analytics"
  | "epubs"
  | "videos"
  | "mangas";

interface TabInfo {
  id: TabId;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  sfIcon?: string;
  isRequired?: boolean;
  isClusterable?: boolean; // Can be clustered inside progress
  requiresFeatureFlag?: boolean;
}

const TAB_INFO: TabInfo[] = [
  {
    id: "home",
    label: "Home",
    description: "Dashboard with reviews, lessons, and progress",
    icon: "home",
    sfIcon: "house.fill",
    isRequired: true,
  },
  {
    id: "progress",
    label: "Level",
    description: "Current level progress and SRS stages",
    icon: "trending-up",
    sfIcon: "chart.line.text.clipboard.fill",
    isRequired: true,
  },
  {
    id: "items",
    label: "Items",
    description: "Browse all radicals, kanji, and vocabulary",
    icon: "library",
    sfIcon: "square.stack.3d.up.fill",
    isClusterable: true,
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Detailed statistics and review history",
    icon: "analytics",
    sfIcon: "chart.bar.fill",
    isClusterable: true,
  },
  {
    id: "epubs",
    label: "Books",
    description: "EPUB library and reader",
    icon: "book",
    sfIcon: "book.closed.fill",
  },
  {
    id: "videos",
    label: "Video",
    description: "Video player with transcripts and WaniKani/JPDB integration",
    icon: "videocam",
    sfIcon: "play.square.fill",
  },
  {
    id: "mangas",
    label: "Manga",
    description: "CBZ/PDF manga reader with OCR sentence and word lookup",
    icon: "bookmarks",
    sfIcon: "books.vertical.fill",
  },
  {
    id: "news",
    label: "News",
    description: "Latest updates from WaniKani",
    icon: "newspaper",
    sfIcon: "newspaper.fill",
  },
  {
    id: "songs",
    label: "Music",
    description: "Japanese songs for learning",
    icon: "musical-notes",
    sfIcon: "music.note.list",
    requiresFeatureFlag: true,
  },
];

function getMaxTabsForDevice(): number {
  if (Platform.OS !== "ios") {
    return 5;
  }

  const majorVersion =
    typeof Platform.Version === "string"
      ? Number.parseInt(Platform.Version, 10)
      : Platform.Version;

  const isIphoneIos26OrGreater =
    !Platform.isPad &&
    Number.isFinite(majorVersion) &&
    Number(majorVersion) >= 26;

  return isIphoneIos26OrGreater ? 4 : 5;
}

export default function TabSettings() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const { customTabOrder, setCustomTabOrder, gravatarEmail } = useSettingsStore();
  const showSongsTabFlag = useFeatureFlag("show_songs_tab");
  const normalizedEmail = gravatarEmail?.trim().toLowerCase() ?? "";
  const isSongsHiddenForEmail = normalizedEmail === "kakehashi.app@gmail.com";
  const canAccessMangaTab = isPortegoUsername(userData?.username);
  const showSongsTab =
    (showSongsTabFlag || normalizedEmail === "portego2000@hotmail.es") &&
    !isSongsHiddenForEmail;
  const hasNativeTabs = supportsNativeTabs();
  const maxTabs = getMaxTabsForDevice();

  // Use store directly for auto-save
  const enabledTabs = customTabOrder as TabId[];

  // Calculate which tabs can be toggled
  const availableTabs = useMemo(() => {
    return TAB_INFO.filter(tab => {
      if (tab.requiresFeatureFlag && !showSongsTab) return false;
      if (tab.id === "mangas" && !canAccessMangaTab) return false;
      return true;
    });
  }, [canAccessMangaTab, showSongsTab]);

  const enabledTabsInAvailableSet = useMemo(
    () => enabledTabs.filter((id) => availableTabs.some((tab) => tab.id === id)),
    [availableTabs, enabledTabs]
  );

  // Check if a tab is enabled
  const isTabEnabled = useCallback((tabId: TabId) => {
    return enabledTabs.includes(tabId);
  }, [enabledTabs]);

  // Count visible tabs (excluding clusterable ones that aren't explicitly enabled)
  const visibleTabCount = useMemo(() => {
    return enabledTabsInAvailableSet.filter(id => {
      const tabInfo = TAB_INFO.find(t => t.id === id);
      return tabInfo && !tabInfo.isClusterable;
    }).length + enabledTabsInAvailableSet.filter(id => {
      const tabInfo = TAB_INFO.find(t => t.id === id);
      return tabInfo?.isClusterable;
    }).length;
  }, [enabledTabsInAvailableSet]);

  // Check if we can add more tabs
  const canAddMoreTabs = visibleTabCount < maxTabs;

  // Check if a tab can be enabled
  const canEnableTab = useCallback((tabId: TabId) => {
    if (isTabEnabled(tabId)) return true; // Can always disable
    const tabInfo = TAB_INFO.find(t => t.id === tabId);
    if (tabInfo?.isRequired) return true; // Required tabs are always on
    return canAddMoreTabs;
  }, [isTabEnabled, canAddMoreTabs]);

  // Toggle a tab (auto-saves)
  const toggleTab = useCallback((tabId: TabId) => {
    const tabInfo = TAB_INFO.find(t => t.id === tabId);
    if (tabInfo?.isRequired) return; // Can't toggle required tabs

    if (enabledTabs.includes(tabId)) {
      // Removing - always allowed
      const nextTabs: TabId[] = enabledTabs.filter((id): id is TabId => id !== tabId);
      setCustomTabOrder(nextTabs);
    } else {
      // Adding - check if we have room
      if (!canAddMoreTabs) {
        Alert.alert(
          "Maximum Tabs Reached",
          `You can only have ${maxTabs} tabs visible. Remove another tab first.`
        );
        return;
      }
      // Add in the correct position based on TAB_INFO order
      const order: TabId[] = TAB_INFO.map(t => t.id);
      const newTabs: TabId[] = [...enabledTabs, tabId].sort(
        (a: TabId, b: TabId) => order.indexOf(a) - order.indexOf(b)
      );
      setCustomTabOrder(newTabs);
    }
  }, [enabledTabs, canAddMoreTabs, maxTabs, setCustomTabOrder]);

  // Reset to default (auto-saves)
  const handleReset = useCallback(() => {
    const defaultTabCandidates: TabId[] = showSongsTab
      ? ["home", "progress", "news", "songs"]
      : ["home", "progress", "news"];
    const defaultTabs = defaultTabCandidates.slice(0, maxTabs);
    setCustomTabOrder(defaultTabs);
  }, [maxTabs, setCustomTabOrder, showSongsTab]);

  // Get tabs for preview (in display order)
  const previewTabs = useMemo(() => {
    const order: TabId[] = TAB_INFO.map(t => t.id);
    return enabledTabs
      .filter(id => availableTabs.some(t => t.id === id))
      .sort((a: TabId, b: TabId) => order.indexOf(a) - order.indexOf(b))
      .slice(0, maxTabs)
      .map(id => TAB_INFO.find(t => t.id === id)!)
      .filter(Boolean);
  }, [enabledTabs, availableTabs, maxTabs]);

  // Check which clusterable tabs are hidden (accessible from Level)
  const clusteredTabs = useMemo(() => {
    return TAB_INFO.filter(t => t.isClusterable && !enabledTabs.includes(t.id));
  }, [enabledTabs]);

  React.useEffect(() => {
    const sanitizedTabs = enabledTabs.filter((id) =>
      availableTabs.some((tab) => tab.id === id)
    );
    if (
      sanitizedTabs.length !== enabledTabs.length ||
      sanitizedTabs.some((tabId, index) => tabId !== enabledTabs[index])
    ) {
      setCustomTabOrder(sanitizedTabs);
    }
  }, [availableTabs, enabledTabs, setCustomTabOrder]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
            paddingTop: 60,
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.headerText }]}>
          Customize Tabs
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Preview Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Preview
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            {hasNativeTabs ? "Your tab bar will look like this" : "Tab bar preview"}
          </Text>

          {/* Tab Bar Preview */}
          <View style={[styles.tabBarPreview, { backgroundColor: theme.isDark ? "#1c1c1e" : "#f2f2f7", borderColor: theme.border }]}>
            {previewTabs.map((tab, index) => (
              <View key={tab.id} style={styles.previewTab}>
                <View style={[styles.previewIconContainer, index === 0 && { backgroundColor: theme.primary + "20" }]}>
                  <Ionicons
                    name={tab.icon}
                    size={22}
                    color={index === 0 ? theme.primary : theme.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.previewLabel,
                    { color: index === 0 ? theme.primary : theme.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </View>
            ))}
            {hasNativeTabs && (
              <View style={styles.previewTab}>
                <View style={styles.previewIconContainer}>
                  <Ionicons name="search" size={22} color={theme.textSecondary} />
                </View>
                <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                  Search
                </Text>
              </View>
            )}
          </View>

          {/* Clustered Info */}
          {clusteredTabs.length > 0 && (
            <View style={[styles.clusteredInfo, { backgroundColor: theme.isDark ? "#2c2c2e" : "#e5e5ea" }]}>
              <Ionicons name="information-circle" size={16} color={theme.textSecondary} />
              <Text style={[styles.clusteredText, { color: theme.textSecondary }]}>
                {clusteredTabs.map(t => t.label).join(" & ")} accessible from Level tab
              </Text>
            </View>
          )}
        </View>

        {/* Available Tabs Section */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Available Tabs
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                {visibleTabCount} of {maxTabs} slots used (Search excluded)
              </Text>
            </View>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
              <Ionicons name="refresh" size={18} color={theme.primary} />
              <Text style={[styles.resetButtonText, { color: theme.primary }]}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Count Indicator */}
          <View style={styles.slotIndicator}>
            {Array.from({ length: maxTabs }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.slotDot,
                  {
                    backgroundColor: i < visibleTabCount ? theme.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>

          {/* Tab List */}
          {availableTabs.map((tab, index) => {
            const isEnabled = isTabEnabled(tab.id);
            const canToggle = !tab.isRequired && (isEnabled || canEnableTab(tab.id));

            return (
              <View
                key={tab.id}
                style={[
                  styles.tabItem,
                  { borderBottomColor: theme.border },
                  index === availableTabs.length - 1 && styles.tabItemLast,
                ]}
              >
                <View style={[styles.tabIconContainer, { backgroundColor: isEnabled ? theme.primary + "15" : "transparent" }]}>
                  <Ionicons
                    name={tab.icon}
                    size={24}
                    color={isEnabled ? theme.primary : theme.textSecondary}
                  />
                </View>
                <View style={styles.tabInfo}>
                  <View style={styles.tabLabelRow}>
                    <Text style={[styles.tabLabel, { color: theme.textColor }]}>
                      {tab.label}
                    </Text>
                    {tab.isRequired && (
                      <View style={[styles.requiredBadge, { backgroundColor: theme.textSecondary + "20" }]}>
                        <Text style={[styles.requiredBadgeText, { color: theme.textSecondary }]}>
                          Required
                        </Text>
                      </View>
                    )}
                    {tab.isClusterable && !isEnabled && (
                      <View style={[styles.clusteredBadge, { backgroundColor: theme.primary + "15" }]}>
                        <Text style={[styles.clusteredBadgeText, { color: theme.primary }]}>
                          In Level
                        </Text>
                      </View>
                    )}
                    {(tab.id === "epubs" || tab.id === "videos" || tab.id === "mangas") && (
                      <View style={styles.betaBadge}>
                        <Text style={styles.betaBadgeText}>BETA</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.tabDescription, { color: theme.textSecondary }]}>
                    {tab.description}
                  </Text>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={() => toggleTab(tab.id)}
                  disabled={!canToggle}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={Platform.OS === "ios" ? undefined : "#ffffff"}
                  ios_backgroundColor={theme.border}
                />
              </View>
            );
          })}
        </View>

        {/* Info Section */}
        <View style={[styles.infoSection, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Ionicons name="bulb" size={20} color={theme.primary} />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Items and Analytics can be shown as separate tabs or accessed from the Level tab.
            {hasNativeTabs
              ? " Search is always available in the tab bar."
              : " On iOS 19+, Search will appear as a special tab."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 8,
    marginTop: -8,
    marginRight: -8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  slotIndicator: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  slotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tabBarPreview: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
  },
  previewTab: {
    alignItems: "center",
    flex: 1,
    maxWidth: 70,
  },
  previewIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
  },
  clusteredInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
  },
  clusteredText: {
    fontSize: 13,
    flex: 1,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItemLast: {
    borderBottomWidth: 0,
  },
  tabIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tabInfo: {
    flex: 1,
    marginRight: 12,
  },
  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  requiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  clusteredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  clusteredBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  betaBadge: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  betaBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  tabDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
