import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import React, { useEffect } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  isPatreonSupporterUsername,
} from "../../hooks/usePatreonSupporterUsernames";
import { Issue } from "../../services/issueService";
import { useTheme } from "../../utils/theme";
import { PatreonSupporterBadge } from "../PatreonSupporterBadge";
import { UserAvatar } from "../UserAvatar";

interface IssueListProps {
  issues: Issue[];
  isLoading: boolean;
  isRefreshing: boolean;
  patreonSupporterUsernames?: Set<string>;
  pendingLikeIssueIds?: Set<string>;
  onRefresh: () => void;
  onLoadMore: () => void;
  onPressIssue: (issue: Issue) => void;
  onToggleLike?: (issueId: string) => void;
}

const EMPTY_SUPPORTER_USERNAMES = new Set<string>();

const SkeletonIssueItem = () => {
  const { theme, isDark } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const skeletonColor = isDark ? "#333" : "#E0E0E0";

  return (
    <View
      style={[
        styles.itemContainer,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        {/* Avatar placeholder */}
        <Animated.View
          style={[
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: skeletonColor,
            },
            animatedStyle,
          ]}
        />
        <View style={styles.contentContainer}>
          {/* Title placeholder */}
          <Animated.View
            style={[
              {
                width: "80%",
                height: 16,
                backgroundColor: skeletonColor,
                borderRadius: 4,
                marginBottom: 8,
              },
              animatedStyle,
            ]}
          />
          {/* Meta row placeholder */}
          <Animated.View
            style={[
              {
                width: "60%",
                height: 12,
                backgroundColor: skeletonColor,
                borderRadius: 4,
                marginBottom: 8,
              },
              animatedStyle,
            ]}
          />
          {/* Stats row placeholder */}
          <View style={styles.statsRow}>
            <Animated.View
              style={[
                {
                  width: 30,
                  height: 12,
                  backgroundColor: skeletonColor,
                  borderRadius: 4,
                },
                animatedStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  width: 30,
                  height: 12,
                  backgroundColor: skeletonColor,
                  borderRadius: 4,
                },
                animatedStyle,
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export default function IssueList({
  issues,
  isLoading,
  isRefreshing,
  patreonSupporterUsernames,
  pendingLikeIssueIds,
  onRefresh,
  onLoadMore,
  onPressIssue,
  onToggleLike,
}: IssueListProps) {
  const { theme } = useTheme();
  const supporterUsernames =
    patreonSupporterUsernames ?? EMPTY_SUPPORTER_USERNAMES;

  const renderItem = ({ item }: { item: Issue }) => {
    const isOpen = item.status === "open";
    const statusColor = isOpen ? "#238636" : "#8957e5";
    const iconName = isOpen ? "radio-button-on" : "checkmark-circle-outline";
    const isLikePending = Boolean(pendingLikeIssueIds?.has(item.id));
    const isPatreonSupporter = isPatreonSupporterUsername(
      item.user_username,
      supporterUsernames,
    );

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { backgroundColor: theme.cardBackground, borderColor: theme.border },
        ]}
        onPress={() => onPressIssue(item)}
      >
        <View style={styles.headerRow}>
          <UserAvatar
            size={40}
            email={item.user_email}
            level={item.user_level}
            fallback={
              <View
                style={[
                  styles.avatarFallback,
                  { backgroundColor: theme.isDark ? "#444" : "#E0E0E0" },
                ]}
              >
                <Ionicons name="person" size={20} color={theme.textSecondary} />
              </View>
            }
          />
          <View style={styles.contentContainer}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: theme.textColor }]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <View
                style={[styles.statusBadge, { backgroundColor: statusColor }]}
              >
                <Ionicons
                  name={iconName}
                  size={12}
                  color="white"
                />
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text
                style={[styles.username, { color: theme.textColor }]}
                numberOfLines={1}
              >
                {item.user_username}
              </Text>
              {item.user_username === "Portego" &&
                item.user_email === "portego2000@hotmail.es" && (
                  <View
                    style={[
                      styles.devBadge,
                      { backgroundColor: theme.primary },
                    ]}
                  >
                    <Text style={styles.devBadgeText}>DEV</Text>
                  </View>
                )}
              {isPatreonSupporter && (
                <View style={styles.inlineBadge}>
                  <PatreonSupporterBadge compact />
                </View>
              )}
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {" "}
                • {formatDistanceToNow(new Date(item.created_at))} ago
              </Text>
            </View>
            <View style={styles.statsRow}>
              {item.reply_count > 0 && (
                <View style={styles.statItem}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <Text
                    style={[styles.statText, { color: theme.textSecondary }]}
                  >
                    {item.reply_count}
                  </Text>
                </View>
              )}
              {onToggleLike && (
                <TouchableOpacity
                  style={[
                    styles.statItem,
                    styles.likeButtonTouchable,
                    isLikePending && styles.likeButtonPending,
                  ]}
                  disabled={isLikePending}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleLike(item.id);
                  }}
                >
                  <Ionicons
                    name={item.is_liked ? "heart" : "heart-outline"}
                    size={14}
                    color={item.is_liked ? "#FF6B6B" : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.statText,
                      {
                        color: item.is_liked ? "#FF6B6B" : theme.textSecondary,
                      },
                    ]}
                  >
                    {item.likes_count}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // If loading and no issues, show skeleton list
  if (isLoading && issues.length === 0) {
    return (
      <View style={{ padding: 16 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonIssueItem key={i} />
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={issues}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.centerEmpty}>
            <Text style={{ color: theme.textSecondary }}>No issues found.</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    lineHeight: 22,
  },
  statusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  username: {
    fontSize: 13,
    fontWeight: "600",
  },
  devBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  inlineBadge: {
    marginLeft: 6,
  },
  metaText: {
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  likeButtonTouchable: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  likeButtonPending: {
    opacity: 0.6,
  },
  statText: {
    fontSize: 13,
    fontWeight: "500",
  },
  centerEmpty: {
    padding: 40,
    alignItems: "center",
  },
});
