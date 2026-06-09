import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import {
  CHANGE_TYPE_CONFIG,
  getCurrentPatchNotesVersion,
  PATCH_NOTES,
  type PatchNote,
  type PatchNoteChange,
} from "../../src/data/patchNotes";
import { useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Format relative time (e.g., "3 days ago")
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  return `${Math.floor(diffDays / 30)} months ago`;
};

// Format date for display (e.g., "Jan 28, 2025")
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getAppVersionLabel = (): string => {
  const manifestVersion = (Updates.manifest as { version?: string } | undefined)
    ?.version;
  return Constants.expoConfig?.version ?? manifestVersion ?? "Unknown";
};

const getOTAVersionLabel = (): string => {
  if (__DEV__) {
    return "Dev build";
  }

  const runtimeVersion = Updates.runtimeVersion ?? "no-runtime";
  const updateSource = Updates.isEmbeddedLaunch
    ? "embedded"
    : Updates.updateId
      ? Updates.updateId.slice(0, 8)
      : "unknown";

  return `${runtimeVersion} · ${updateSource}`;
};

// Change type badge component
const ChangeTypeBadge = ({ type }: { type: PatchNoteChange["type"] }) => {
  const config = CHANGE_TYPE_CONFIG[type];

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[styles.badgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};

// Single change item component
const ChangeItem = ({
  change,
  theme,
  isLast = false,
}: {
  change: PatchNoteChange;
  theme: any;
  isLast?: boolean;
}) => {
  const handleLinkPress = () => {
    if (change.link) {
      const route = change.link.route as any;
      if (change.link.params) {
        router.push({ pathname: route, params: change.link.params });
      } else {
        router.push(route);
      }
    }
  };

  return (
    <View
      style={[
        styles.changeItem,
        {
          borderBottomColor: theme.border + "40",
          borderBottomWidth: isLast ? 0 : 1,
        },
      ]}
    >
      <View style={styles.changeHeader}>
        <ChangeTypeBadge type={change.type} />
        <Text style={[styles.changeTitle, { color: theme.textColor }]}>
          {change.title}
        </Text>
      </View>

      {change.description && (
        <Text style={[styles.changeDescription, { color: theme.textSecondary }]}>
          {change.description}
        </Text>
      )}

      {change.link && (
        <TouchableOpacity
          style={[styles.linkButton, { borderColor: theme.primary + "40" }]}
          onPress={handleLinkPress}
        >
          <Text style={[styles.linkButtonText, { color: theme.primary }]}>
            {change.link.label}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Update section component (date-based instead of version-based)
const UpdateSection = ({
  patchNote,
  theme,
  isLatest,
  isExpanded,
  onToggle,
  onLayout,
}: {
  patchNote: PatchNote;
  theme: any;
  isLatest: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onLayout?: (y: number) => void;
}) => {
  return (
    <View
      onLayout={(event) => onLayout?.(event.nativeEvent.layout.y)}
      style={[
        styles.updateSection,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.updateHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.updateTitleRow}>
          <Text style={[styles.updateDate, { color: theme.textColor }]}>
            {formatDate(patchNote.date)}
          </Text>
          {isLatest && (
            <View style={[styles.latestBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.latestBadgeText}>Latest</Text>
            </View>
          )}
          <View style={styles.updateHeaderSpacer} />
          <Text style={[styles.relativeDate, { color: theme.textSecondary }]}>
            {formatRelativeTime(patchNote.date)}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.updateContent}>
          <View style={styles.changesList}>
            {patchNote.changes.map((change, index) => (
              <ChangeItem
                key={index}
                change={change}
                theme={theme}
                isLast={index === patchNote.changes.length - 1}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

export default function WhatsNewScreen() {
  const { theme } = useTheme();
  const { setLastSeenPatchNotesVersion } = useSettingsStore();
  const appVersionLabel = getAppVersionLabel();
  const otaVersionLabel = getOTAVersionLabel();
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set([PATCH_NOTES[0]?.version]) // Latest version expanded by default
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Record<string, number>>({});

  // Mark patch notes as seen when screen is opened
  useEffect(() => {
    const currentVersion = getCurrentPatchNotesVersion();
    setLastSeenPatchNotesVersion(currentVersion);
  }, [setLastSeenPatchNotesVersion]);

  const toggleVersion = useCallback((version: string) => {
    const isExpanding = !expandedVersions.has(version);

    // Configure the animation
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        250,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );

    setExpandedVersions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(version)) {
        newSet.delete(version);
      } else {
        newSet.add(version);
      }
      return newSet;
    });

    // Auto-scroll to show expanded content
    if (isExpanding) {
      setTimeout(() => {
        const sectionY = sectionPositions.current[version];
        if (sectionY !== undefined && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: sectionY - 100, // Offset to show some content above
            animated: true,
          });
        }
      }, 50); // Small delay to let layout update
    }
  }, [expandedVersions]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />

      {/* Floating Back Button */}
      <TouchableOpacity
        style={[
          styles.floatingBackButton,
          { backgroundColor: theme.cardBackground },
        ]}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color={theme.textColor} />
      </TouchableOpacity>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View style={styles.heroSection}>
          <View style={styles.versionBadgeStack}>
            <View
              style={[
                styles.versionBadge,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.versionBadgeText, { color: theme.textColor }]}>
                App v{appVersionLabel}
              </Text>
            </View>
            <View
              style={[
                styles.versionBadge,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[styles.versionBadgeText, { color: theme.textSecondary }]}
              >
                OTA {otaVersionLabel}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.heroIconContainer,
              { backgroundColor: theme.primary + "15" },
            ]}
          >
            <Ionicons name="sparkles" size={32} color={theme.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.textColor }]}>
            App Updates
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            See what&apos;s new in Kakehashi
          </Text>
        </View>

        {/* Patch notes list */}
        {PATCH_NOTES.map((patchNote, index) => (
          <UpdateSection
            key={patchNote.version}
            patchNote={patchNote}
            theme={theme}
            isLatest={index === 0}
            isExpanded={expandedVersions.has(patchNote.version)}
            onToggle={() => toggleVersion(patchNote.version)}
            onLayout={(y) => {
              sectionPositions.current[patchNote.version] = y;
            }}
          />
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Updates are delivered automatically via over-the-air updates.
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 40,
  },
  floatingBackButton: {
    position: "absolute",
    top: 54,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroSection: {
    position: "relative",
    width: "100%",
    alignItems: "center",
    paddingVertical: 24,
    marginBottom: 8,
  },
  versionBadgeStack: {
    position: "absolute",
    top: 0,
    right: 0,
    alignItems: "flex-end",
    gap: 6,
  },
  versionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  versionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 15,
  },
  updateSection: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  updateHeader: {
    padding: 16,
  },
  updateTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  updateDate: {
    fontSize: 18,
    fontWeight: "bold",
  },
  relativeDate: {
    fontSize: 13,
  },
  updateHeaderSpacer: {
    flex: 1,
  },
  latestBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  latestBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  updateContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  changesList: {
    gap: 0,
  },
  changeItem: {
    paddingVertical: 12,
  },
  changeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  changeTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  changeDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginLeft: 0,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 13,
    textAlign: "center",
  },
});
