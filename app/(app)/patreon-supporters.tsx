import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";
import { useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

const PATREON_URL = "https://www.patreon.com/15731284/join";

type PatreonSupporter = {
  id: string;
  wanikani_username: string;
  display_name: string | null;
  wanikani_level: number | null;
  avatar_url: string | null;
  profile_url: string | null;
  support_tier: string | null;
};

function isMissingSupabaseTableError(error: unknown, tableName: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = String((error as { code?: unknown }).code ?? "");
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  const lowerTableName = tableName.toLowerCase();

  return (
    code === "42P01" ||
    (message.includes("does not exist") && message.includes(lowerTableName))
  );
}

export default function PatreonSupportersScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const gravatarEmail = useSettingsStore((state) => state.gravatarEmail);
  const normalizedEmail = gravatarEmail?.trim().toLowerCase() ?? "";
  const shouldHideBecomeSupporterButton =
    normalizedEmail === "kakehashi.app@gmail.com";

  const [supporters, setSupporters] = useState<PatreonSupporter[]>([]);
  const [isLoadingSupporters, setIsLoadingSupporters] = useState(true);
  const [supportersError, setSupportersError] = useState<string | null>(null);
  const bottomCtaSafePadding = Math.max(insets.bottom, 12);
  const contentBottomPadding = shouldHideBecomeSupporterButton
    ? Math.max(insets.bottom, 16)
    : bottomCtaSafePadding + 84;

  useEffect(() => {
    let isMounted = true;

    const loadSupporters = async () => {
      setIsLoadingSupporters(true);

      try {
        const { data, error } = await supabase
          .from("patreon_supporters")
          .select(
            "id, wanikani_username, display_name, wanikani_level, avatar_url, profile_url, support_tier, sort_order, created_at",
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (!isMounted) {
          return;
        }

        if (error) {
          if (isMissingSupabaseTableError(error, "patreon_supporters")) {
            setSupportersError(
              "Supporters table is not set up yet. Run the supporters migration in Supabase.",
            );
            setSupporters([]);
            return;
          }

          console.error("Failed to load Patreon supporters:", error);
          setSupportersError(
            "Could not load supporters right now. Please try again later.",
          );
          setSupporters([]);
          return;
        }

        setSupporters((data ?? []) as PatreonSupporter[]);
        setSupportersError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error("Failed to load Patreon supporters:", error);
        setSupportersError(
          "Could not load supporters right now. Please try again later.",
        );
        setSupporters([]);
      } finally {
        if (isMounted) {
          setIsLoadingSupporters(false);
        }
      }
    };

    void loadSupporters();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleBack = () => {
    router.back();
  };

  const openExternalUrl = async (url: string, errorTitle: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error(`Failed to open external URL: ${url}`, error);
      Alert.alert(
        errorTitle,
        "Could not open this link right now. Please try again later.",
      );
    }
  };

  const handleSupporterProfilePress = async (profileUrl: string | null) => {
    const trimmedUrl = profileUrl?.trim();
    if (!trimmedUrl) {
      return;
    }

    await openExternalUrl(trimmedUrl, "Unable to Open Profile");
  };

  const handleBecomeSupporterPress = async () => {
    await openExternalUrl(PATREON_URL, "Unable to Open Patreon");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
            paddingTop: Math.max(insets.top + 8, 52),
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.headerText }]}>
          Patreon Supporters
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
      >
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.sectionIntro, { color: theme.textSecondary }]}>
            Huge thanks to everyone supporting development.
          </Text>

          {isLoadingSupporters ? (
            <View style={[styles.stateRow, { borderTopColor: theme.border }]}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                Loading supporters...
              </Text>
            </View>
          ) : supportersError ? (
            <View style={[styles.stateRow, { borderTopColor: theme.border }]}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={theme.textSecondary}
              />
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {supportersError}
              </Text>
            </View>
          ) : supporters.length === 0 ? (
            <View style={[styles.stateRow, { borderTopColor: theme.border }]}>
              <Ionicons name="heart-outline" size={18} color={theme.primary} />
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                Be the first supporter on Patreon.
              </Text>
            </View>
          ) : (
            supporters.map((supporter) => {
              const supporterName =
                supporter.display_name?.trim() ||
                supporter.wanikani_username?.trim() ||
                "Supporter";
              const supporterUsername = supporter.wanikani_username?.trim();
              const hasProfileLink = Boolean(supporter.profile_url?.trim());
              const supporterSubtitle = supporterUsername
                ? `@${supporterUsername}${
                    typeof supporter.wanikani_level === "number"
                      ? ` • Level ${supporter.wanikani_level}`
                      : ""
                  }`
                : typeof supporter.wanikani_level === "number"
                  ? `Level ${supporter.wanikani_level}`
                  : "Patreon Supporter";

              return (
                <TouchableOpacity
                  key={supporter.id}
                  style={[
                    styles.supporterRow,
                    { borderTopColor: theme.border },
                    !hasProfileLink && styles.supporterRowNoLink,
                  ]}
                  disabled={!hasProfileLink}
                  activeOpacity={hasProfileLink ? 0.75 : 1}
                  onPress={() => {
                    void handleSupporterProfilePress(supporter.profile_url);
                  }}
                >
                  <View style={styles.supporterAvatar}>
                    <View
                      style={[
                        styles.supporterAvatarFallback,
                        { backgroundColor: `${theme.primary}22` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.supporterAvatarFallbackText,
                          { color: theme.primary },
                        ]}
                      >
                        {supporterName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    {supporter.avatar_url ? (
                      <Image
                        source={{ uri: supporter.avatar_url }}
                        style={styles.supporterAvatarImage}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : null}
                  </View>

                  <View style={styles.supporterTextContainer}>
                    <View style={styles.supporterTopRow}>
                      <Text
                        style={[styles.supporterName, { color: theme.textColor }]}
                        numberOfLines={1}
                      >
                        {supporterName}
                      </Text>
                      {supporter.support_tier ? (
                        <View
                          style={[
                            styles.supporterTierBadge,
                            {
                              backgroundColor: `${theme.primary}14`,
                              borderColor: `${theme.primary}4D`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.supporterTierText,
                              { color: theme.primary },
                            ]}
                            numberOfLines={1}
                          >
                            {supporter.support_tier}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.supporterUsername,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {supporterSubtitle}
                    </Text>
                  </View>

                  {hasProfileLink ? (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.textSecondary}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}

        </View>
      </ScrollView>

      {!shouldHideBecomeSupporterButton && (
        <View
          style={[
            styles.bottomCtaContainer,
            {
              backgroundColor: theme.backgroundColor,
              borderTopColor: theme.border,
              paddingBottom: bottomCtaSafePadding,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.becomeSupporterButton,
              { backgroundColor: theme.primary },
            ]}
            onPress={() => {
              void handleBecomeSupporterPress();
            }}
          >
            <MaterialCommunityIcons name="patreon" size={18} color="#fff" />
            <Text style={styles.becomeSupporterButtonText}>Become a supporter</Text>
          </TouchableOpacity>
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionIntro: {
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  stateText: {
    flex: 1,
    fontSize: 14,
  },
  supporterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  supporterRowNoLink: {
    paddingRight: 16,
  },
  supporterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    marginRight: 12,
  },
  supporterAvatarFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  supporterAvatarFallbackText: {
    fontSize: 18,
    fontWeight: "700",
  },
  supporterAvatarImage: {
    width: "100%",
    height: "100%",
  },
  supporterTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  supporterTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  supporterName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  supporterUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  supporterTierBadge: {
    maxWidth: 130,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  supporterTierText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bottomCtaContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  becomeSupporterButton: {
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  becomeSupporterButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
