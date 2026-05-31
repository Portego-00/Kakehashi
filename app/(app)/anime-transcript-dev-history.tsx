import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../../src/components/GlassButton";
import {
  buildAnimeTranscriptSessionFromHistoryEntry,
  clearAnimeTranscriptPlaybackProgress,
  formatAnimeTranscriptPlaybackHistoryTimestamp,
  getAnimeTranscriptPlaybackHistory,
  getAnimeTranscriptPlaybackProgressRatio,
  getAnimeTranscriptPlaybackProgressStatus,
  removeAnimeTranscriptPlaybackHistoryEntry,
  touchAnimeTranscriptPlaybackHistoryEntry,
  type AnimeTranscriptPlaybackHistoryEntry,
} from "../../src/utils/animeTranscriptPlaybackHistory";
import { setAnimeTranscriptDevSession } from "../../src/utils/animeTranscriptDevSession";
import { withAlpha } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";

type HistoryFilter = "all" | "inProgress" | "finished";
type HistorySection = {
  title: string;
  data: AnimeTranscriptPlaybackHistoryEntry[];
};

function formatDuration(durationSeconds: number): string {
  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatTotalDuration(durationSeconds: number): string {
  const roundedSeconds = Math.max(0, Math.round(durationSeconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m total`;
  }

  return `${minutes}m total`;
}

function getDaySectionKey(timestamp: number): "today" | "yesterday" | "earlier" {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  if (timestamp >= todayStart) {
    return "today";
  }
  if (timestamp >= yesterdayStart) {
    return "yesterday";
  }
  return "earlier";
}

function getDaySectionTitle(sectionKey: "today" | "yesterday" | "earlier"): string {
  if (sectionKey === "today") {
    return "Today";
  }
  if (sectionKey === "yesterday") {
    return "Yesterday";
  }
  return "Earlier";
}

function HistoryVideoThumbnail({
  videoUri,
  durationLabel,
}: {
  videoUri: string;
  durationLabel: string;
}) {
  const player = useVideoPlayer(videoUri, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.currentTime = 0;
    videoPlayer.pause();
  });

  return (
    <View style={styles.thumbnailWrap}>
      <VideoView
        player={player}
        style={styles.thumbnailVideo}
        nativeControls={false}
        contentFit="cover"
      />
      <View style={styles.thumbnailOverlay}>
        <Ionicons name="play" size={14} color="#ffffff" />
      </View>
      <View style={styles.thumbnailDurationBadge}>
        <Text style={styles.thumbnailDurationText}>{durationLabel}</Text>
      </View>
    </View>
  );
}

type AnimeTranscriptDevHistoryScreenProps = {
  showBackButton?: boolean;
};

export default function AnimeTranscriptDevHistoryScreen({
  showBackButton = true,
}: AnimeTranscriptDevHistoryScreenProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<AnimeTranscriptPlaybackHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const skeletonOpacity = useRef(new Animated.Value(0.46)).current;

  useEffect(() => {
    if (!isLoading) {
      skeletonOpacity.setValue(0.46);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, {
          toValue: 0.92,
          duration: 760,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0.46,
          duration: 760,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [isLoading, skeletonOpacity]);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    const entries = await getAnimeTranscriptPlaybackHistory();
    setHistory(entries);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const handleOpenImportScreen = useCallback(() => {
    router.push("/anime-transcript-dev");
  }, [router]);

  const handleOpenHistoryItem = useCallback(
    async (
      entry: AnimeTranscriptPlaybackHistoryEntry,
      options?: { startAtSeconds?: number | null }
    ) => {
      setAnimeTranscriptDevSession(
        buildAnimeTranscriptSessionFromHistoryEntry(entry, {
          startAtSeconds:
            typeof options?.startAtSeconds === "number"
              ? options.startAtSeconds
              : undefined,
        })
      );
      await touchAnimeTranscriptPlaybackHistoryEntry(entry.id);
      router.push("/anime-transcript-dev-viewer");
    },
    [router]
  );

  const handleDeleteHistoryItem = useCallback(async (entryId: string) => {
    await removeAnimeTranscriptPlaybackHistoryEntry(entryId);
    setHistory((previous) => previous.filter((entry) => entry.id !== entryId));
  }, []);

  const handleResetProgress = useCallback(async (entryId: string) => {
    const updatedEntry = await clearAnimeTranscriptPlaybackProgress(entryId);
    if (!updatedEntry) {
      return;
    }

    setHistory((previous) =>
      previous.map((entry) => (entry.id === entryId ? updatedEntry : entry))
    );
  }, []);

  const historyCounts = useMemo(() => {
    const inProgress = history.filter(
      (entry) => getAnimeTranscriptPlaybackProgressStatus(entry) === "inProgress"
    ).length;
    const finished = history.filter(
      (entry) => getAnimeTranscriptPlaybackProgressStatus(entry) === "finished"
    ).length;

    return {
      all: history.length,
      inProgress,
      finished,
    };
  }, [history]);

  const filteredEntries = useMemo(() => {
    if (filter === "all") {
      return history;
    }

    return history.filter((entry) => {
      const status = getAnimeTranscriptPlaybackProgressStatus(entry);
      return filter === "inProgress" ? status === "inProgress" : status === "finished";
    });
  }, [filter, history]);

  const sections = useMemo<HistorySection[]>(() => {
    const bySectionKey: Record<"today" | "yesterday" | "earlier", AnimeTranscriptPlaybackHistoryEntry[]> =
      {
        today: [],
        yesterday: [],
        earlier: [],
      };

    filteredEntries.forEach((entry) => {
      bySectionKey[getDaySectionKey(entry.lastOpenedAt)].push(entry);
    });

    return (["today", "yesterday", "earlier"] as const)
      .map((sectionKey) => ({
        title: getDaySectionTitle(sectionKey),
        data: bySectionKey[sectionKey],
      }))
      .filter((section) => section.data.length > 0);
  }, [filteredEntries]);

  const totalDurationSeconds = useMemo(() => {
    return history.reduce(
      (sum, entry) => sum + Math.max(0, entry.durationSeconds || 0),
      0
    );
  }, [history]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 8, 20),
          },
        ]}
      >
        {showBackButton ? (
          <GlassButton
            iconName="arrow-back"
            iconSize={20}
            iconColor={theme.textColor}
            variant="light"
            style={styles.headerGlassButton}
            onPress={() => router.back()}
          />
        ) : (
          <View style={styles.headerGlassButton} />
        )}
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Watched</Text>
        <GlassButton
          iconName="add"
          iconSize={22}
          iconColor={theme.textColor}
          variant="light"
          style={styles.headerGlassButton}
          onPress={handleOpenImportScreen}
        />
      </View>

      {isLoading ? (
        <View
          style={[
            styles.listContent,
            styles.loadingSkeletonWrap,
            { paddingBottom: Math.max(insets.bottom + 24, 30) },
          ]}
        >
          <View style={styles.listHeaderWrap}>
            <Animated.View
              style={[
                styles.skeletonSummaryLine,
                {
                  backgroundColor: withAlpha(theme.textSecondary, 0.35),
                  opacity: skeletonOpacity,
                },
              ]}
            />
            <View style={styles.filterPillRow}>
              {[92, 116, 98].map((pillWidth, index) => (
                <Animated.View
                  key={`history-skeleton-pill-${index}`}
                  style={[
                    styles.skeletonFilterPill,
                    {
                      width: pillWidth,
                      backgroundColor: withAlpha(theme.textSecondary, 0.28),
                      opacity: skeletonOpacity,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>TODAY</Text>

          {[0, 1, 2, 3].map((index) => (
            <View
              key={`history-skeleton-card-${index}`}
              style={[
                styles.historyCard,
                {
                  borderColor: withAlpha(theme.border, 0.55),
                  backgroundColor: withAlpha(theme.cardBackground, 0.7),
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.skeletonThumbnail,
                  {
                    backgroundColor: withAlpha(theme.textSecondary, 0.24),
                    opacity: skeletonOpacity,
                  },
                ]}
              />

              <View style={styles.historyBody}>
                <View style={styles.titleRow}>
                  <Animated.View
                    style={[
                      styles.skeletonLine,
                      styles.skeletonTitleLine,
                      {
                        backgroundColor: withAlpha(theme.textSecondary, 0.26),
                        opacity: skeletonOpacity,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.skeletonCircleSmall,
                      {
                        backgroundColor: withAlpha(theme.textSecondary, 0.24),
                        opacity: skeletonOpacity,
                      },
                    ]}
                  />
                </View>
                <Animated.View
                  style={[
                    styles.skeletonLine,
                    styles.skeletonMetaLine,
                    {
                      backgroundColor: withAlpha(theme.textSecondary, 0.24),
                      opacity: skeletonOpacity,
                    },
                  ]}
                />
                <View style={styles.historyMetaRow}>
                  <Animated.View
                    style={[
                      styles.skeletonLine,
                      styles.skeletonTimestampLine,
                      {
                        backgroundColor: withAlpha(theme.textSecondary, 0.24),
                        opacity: skeletonOpacity,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.skeletonLine,
                      styles.skeletonDurationLine,
                      {
                        backgroundColor: withAlpha(theme.textSecondary, 0.24),
                        opacity: skeletonOpacity,
                      },
                    ]}
                  />
                </View>
                <Animated.View
                  style={[
                    styles.skeletonResumePill,
                    {
                      backgroundColor: withAlpha(theme.primary, 0.2),
                      opacity: skeletonOpacity,
                    },
                  ]}
                />
              </View>

              <View style={styles.cardActions}>
                <Animated.View
                  style={[
                    styles.skeletonActionCircle,
                    {
                      backgroundColor: withAlpha(theme.textSecondary, 0.24),
                      opacity: skeletonOpacity,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.skeletonActionCircle,
                    {
                      backgroundColor: withAlpha(theme.textSecondary, 0.24),
                      opacity: skeletonOpacity,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="videocam-outline" size={56} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>No videos yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Your imported videos and subtitles will appear here.</Text>
          <TouchableOpacity
            style={[styles.emptyActionButton, { backgroundColor: theme.primary }]}
            onPress={handleOpenImportScreen}
            activeOpacity={0.82}
          >
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text style={styles.emptyActionButtonText}>Import Video</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(entry) => entry.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 24, 30) },
          ]}
          ListHeaderComponent={
            <View style={styles.listHeaderWrap}>
              <Text style={[styles.listSummaryText, { color: theme.textSecondary }]}>
                {history.length} videos · {formatTotalDuration(totalDurationSeconds)}
              </Text>
              <View style={styles.filterPillRow}>
                {([
                  { key: "all", label: "All", count: historyCounts.all },
                  {
                    key: "inProgress",
                    label: "In progress",
                    count: historyCounts.inProgress,
                  },
                  { key: "finished", label: "Finished", count: historyCounts.finished },
                ] as const).map((chip) => {
                  const selected = filter === chip.key;
                  return (
                    <TouchableOpacity
                      key={`filter-${chip.key}`}
                      style={[
                        styles.filterPill,
                        {
                          borderColor: selected ? withAlpha(theme.primary, 0.55) : theme.border,
                          backgroundColor: selected
                            ? withAlpha(theme.primary, 0.2)
                            : withAlpha(theme.cardBackground, 0.76),
                        },
                      ]}
                      onPress={() => setFilter(chip.key)}
                      activeOpacity={0.82}
                    >
                      <Text
                        style={[
                          styles.filterPillLabel,
                          { color: selected ? theme.primary : theme.textColor },
                        ]}
                      >
                        {chip.label}
                      </Text>
                      <View
                        style={[
                          styles.filterPillCountBubble,
                          {
                            backgroundColor: selected
                              ? withAlpha(theme.primary, 0.28)
                              : withAlpha(theme.textSecondary, 0.2),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterPillCountText,
                            { color: selected ? theme.primary : theme.textSecondary },
                          ]}
                        >
                          {chip.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {section.title.toUpperCase()}
            </Text>
          )}
          renderItem={({ item }) => {
            const progressRatio = getAnimeTranscriptPlaybackProgressRatio(item);
            const playbackStatus = getAnimeTranscriptPlaybackProgressStatus(item);
            const progressPercent = Math.round(progressRatio * 100);
            const hasProgress = progressRatio > 0.01;

            return (
              <TouchableOpacity
                style={[
                  styles.historyCard,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.cardBackground,
                  },
                ]}
                onPress={() => {
                  void handleOpenHistoryItem(item);
                }}
                activeOpacity={0.82}
              >
                <HistoryVideoThumbnail
                  videoUri={item.videoUri}
                  durationLabel={formatDuration(item.durationSeconds)}
                />

                <View style={styles.historyBody}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.videoTitle, { color: theme.textColor }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {playbackStatus === "finished" ? (
                      <View style={[styles.finishedBadge, { backgroundColor: withAlpha("#16a34a", 0.2) }]}>
                        <Ionicons name="checkmark" size={13} color="#16a34a" />
                      </View>
                    ) : playbackStatus === "inProgress" ? (
                      <Text style={[styles.progressPercentText, { color: theme.textSecondary }]}>
                        {progressPercent}%
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.videoMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.subtitleFileName}
                  </Text>
                  <View style={styles.historyMetaRow}>
                    <Text
                      style={[styles.videoTimestamp, { color: theme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {formatAnimeTranscriptPlaybackHistoryTimestamp(item.lastOpenedAt)}
                    </Text>
                    <Text style={[styles.videoDuration, { color: theme.textColor }]}>
                      {formatDuration(item.durationSeconds)}
                    </Text>
                  </View>
                  {hasProgress && playbackStatus !== "finished" ? (
                    <TouchableOpacity
                      style={[
                        styles.resumePill,
                        {
                          borderColor: withAlpha(theme.primary, 0.46),
                          backgroundColor: withAlpha(theme.primary, 0.14),
                        },
                      ]}
                      onPress={() => {
                        void handleOpenHistoryItem(item, {
                          startAtSeconds: item.lastPlaybackPositionSeconds,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play" size={12} color={theme.primary} />
                      <Text style={[styles.resumePillText, { color: theme.primary }]}>
                        Resume {formatDuration(item.lastPlaybackPositionSeconds)}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.cardActions}>
                  {hasProgress ? (
                    <TouchableOpacity
                      style={styles.iconActionButton}
                      onPress={() => {
                        void handleResetProgress(item.id);
                      }}
                      activeOpacity={0.72}
                    >
                      <Ionicons name="refresh-outline" size={17} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.iconActionButton} />
                  )}
                  <TouchableOpacity
                    style={styles.iconActionButton}
                    onPress={() => {
                      void handleDeleteHistoryItem(item.id);
                    }}
                    activeOpacity={0.72}
                  >
                    <Ionicons name="trash-outline" size={17} color={theme.error} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerGlassButton: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  emptyActionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  loadingSkeletonWrap: {
    paddingTop: 2,
  },
  listHeaderWrap: {
    marginBottom: 8,
  },
  skeletonSummaryLine: {
    width: 150,
    height: 14,
    borderRadius: 7,
    marginBottom: 8,
  },
  skeletonFilterPill: {
    height: 30,
    borderRadius: 999,
  },
  listSummaryText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  filterPillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  filterPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterPillLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  filterPillCountBubble: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterPillCountText: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  sectionTitle: {
    marginTop: 6,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.45,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 94,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 4,
    marginBottom: 8,
  },
  skeletonThumbnail: {
    width: 106,
    height: 62,
    borderRadius: 12,
    flexShrink: 0,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  skeletonTitleLine: {
    flex: 1,
    marginTop: 2,
  },
  skeletonMetaLine: {
    width: "76%",
  },
  skeletonTimestampLine: {
    width: "52%",
  },
  skeletonDurationLine: {
    width: 40,
  },
  skeletonResumePill: {
    width: 118,
    height: 20,
    borderRadius: 999,
    marginTop: 2,
  },
  skeletonCircleSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  skeletonActionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  thumbnailWrap: {
    width: 106,
    height: 62,
    borderRadius: 12,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
  },
  thumbnailVideo: {
    width: "100%",
    height: "100%",
  },
  thumbnailOverlay: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    left: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  thumbnailDurationBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    borderRadius: 6,
    paddingVertical: 1,
    paddingHorizontal: 5,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  thumbnailDurationText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  historyBody: {
    flex: 1,
    paddingVertical: 2,
    paddingLeft: 10,
    paddingRight: 8,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  videoTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
  },
  finishedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  videoMeta: {
    fontSize: 12,
    lineHeight: 15,
  },
  historyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  videoTimestamp: {
    flex: 1,
    fontSize: 12,
    lineHeight: 15,
  },
  videoDuration: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  resumePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  resumePillText: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  cardActions: {
    width: 34,
    gap: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
