import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import type { EpubLibraryItem } from "../../../src/services/epubLibraryService";
import { GlassButton } from "../../../src/components/GlassButton";
import { epubReadingStreakService } from "../../../src/services/epubReadingStreakService";
import { epubLibraryService } from "../../../src/services/epubLibraryService";
import {
  readingGoalsService,
  type ReadingGoalDay,
  type ReadingGoalsProgress,
} from "../../../src/services/readingGoalsService";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import { useAuthStore } from "../../../src/utils/store";
import { useTheme } from "../../../src/utils/theme";

const COMPLETED_PROGRESS_COLOR = "#43AA8B";

type BookState = "reading" | "queued" | "read";

type BookMetrics = {
  state: BookState;
  currentPage: number;
  totalPages: number;
  progress: number;
  percent: number;
  progressLabel: string;
};

type SectionConfig = {
  key: BookState;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  emptyLabel: string;
};

const SECTION_CONFIG: SectionConfig[] = [
  {
    key: "reading",
    title: "Currently Reading",
    icon: "book-outline",
    emptyLabel: "Books you start will appear here.",
  },
  {
    key: "queued",
    title: "Queued",
    icon: "time-outline",
    emptyLabel: "Import more EPUB files to grow your queue.",
  },
  {
    key: "read",
    title: "Finished",
    icon: "checkmark-done-outline",
    emptyLabel: "Finished books will show up here.",
  },
];

function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return "Unknown";
  }
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function getBookMetrics(book: EpubLibraryItem): BookMetrics {
  const currentPage = Math.max(1, Math.floor(book.lastReadPage || 1));
  const totalPages = Math.max(1, Math.floor(book.estimatedPages || 1));
  const hasReliableTotal = totalPages > 1;
  const rawProgress = hasReliableTotal ? clampUnit(currentPage / totalPages) : 0;
  const isAtStart = currentPage <= 1;
  const isRead = hasReliableTotal && rawProgress >= 0.98;
  const hasMeaningfulProgress = hasReliableTotal && !isAtStart && rawProgress > 0.02;
  const state: BookState = isRead ? "read" : hasMeaningfulProgress ? "reading" : "queued";
  const progress = state === "queued" ? 0 : rawProgress;
  const percent = Math.round(progress * 100);

  let progressLabel: string;
  if (state === "queued") {
    progressLabel = "Not started";
  } else if (hasReliableTotal) {
    progressLabel = `Page ${Math.min(currentPage, totalPages)} / ${totalPages}`;
  } else {
    progressLabel = "In progress";
  }

  return {
    state,
    currentPage,
    totalPages,
    progress,
    percent,
    progressLabel,
  };
}

function fallbackWeekDays(): ReadingGoalDay[] {
  const days: ReadingGoalDay[] = [];
  const now = new Date();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    const label = new Intl.DateTimeFormat(undefined, { weekday: "short" })
      .format(date)
      .slice(0, 1)
      .toUpperCase();

    days.push({
      dateKey,
      label,
      completed: false,
      isToday: offset === 0,
    });
  }

  return days;
}

function getFallbackGoalsProgress(): ReadingGoalsProgress {
  return {
    goalMinutes: 5,
    todayMinutes: 0,
    todaySeconds: 0,
    todayRatio: 0,
    todayCompleted: false,
    streakCurrent: 0,
    streakBest: 0,
    week: fallbackWeekDays(),
  };
}

export default function EpubsTab() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width > 768;
  const cardWidth = isTablet ? 220 : Math.min(188, Math.max(156, width * 0.46));
  const coverHeight = Math.round(cardWidth * 1.35);
  const [books, setBooks] = useState<EpubLibraryItem[]>([]);
  const [readingGoals, setReadingGoals] = useState<ReadingGoalsProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [menuBook, setMenuBook] = useState<EpubLibraryItem | null>(null);
  const userId = userData?.id ?? null;

  const loadData = useCallback(async () => {
    try {
      const [booksResult, goalsResult] = await Promise.allSettled([
        epubLibraryService.listBooks(),
        readingGoalsService.getProgress(),
      ]);

      if (booksResult.status === "fulfilled") {
        setBooks(booksResult.value);
      } else {
        console.error("Failed to load EPUB library:", booksResult.reason);
        Alert.alert("Unable to load books", "Please try again in a moment.");
      }

      if (goalsResult.status === "fulfilled") {
        const localProgress = goalsResult.value;
        setReadingGoals(localProgress);

        if (userId) {
          void epubReadingStreakService.syncProgress(userId, localProgress).then((syncedProgress) => {
            setReadingGoals((previousProgress) => {
              if (!previousProgress) {
                return syncedProgress;
              }

              if (
                previousProgress.goalMinutes === syncedProgress.goalMinutes &&
                previousProgress.todayMinutes === syncedProgress.todayMinutes &&
                previousProgress.todaySeconds === syncedProgress.todaySeconds &&
                previousProgress.todayRatio === syncedProgress.todayRatio &&
                previousProgress.todayCompleted === syncedProgress.todayCompleted &&
                previousProgress.streakCurrent === syncedProgress.streakCurrent &&
                previousProgress.streakBest === syncedProgress.streakBest &&
                JSON.stringify(previousProgress.week) === JSON.stringify(syncedProgress.week)
              ) {
                return previousProgress;
              }

              return syncedProgress;
            });
          });
        }
      } else {
        console.error("Failed to load reading goals progress:", goalsResult.reason);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    loadData();
  }, [isRefreshing, loadData]);

  const openBook = useCallback((bookId: string) => {
    router.push({
      pathname: "/epub-reader",
      params: { bookId },
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (isImporting) {
      return;
    }

    setIsImporting(true);
    try {
      const imported = await epubLibraryService.importFromPicker();

      if (!imported) {
        return;
      }

      await loadData();
      openBook(imported.id);
    } catch (error) {
      console.error("Failed to import EPUB:", error);
      Alert.alert(
        "Import failed",
        "This EPUB could not be opened. Try another file or re-export it."
      );
    } finally {
      setIsImporting(false);
    }
  }, [isImporting, loadData, openBook]);

  const confirmDelete = useCallback(
    (book: EpubLibraryItem) => {
      Alert.alert(
        "Delete this EPUB?",
        `${book.title} will be removed from this device library.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await epubLibraryService.deleteBook(book.id);
                await loadData();
              } catch (error) {
                console.error("Failed to delete EPUB:", error);
                Alert.alert("Delete failed", "Please try again.");
              }
            },
          },
        ]
      );
    },
    [loadData]
  );

  const setBookToQueueStart = useCallback(
    async (book: EpubLibraryItem, failureTitle: string) => {
      try {
        await epubLibraryService.updateReadingProgress(
          book.id,
          1,
          Math.max(1, Math.floor(book.estimatedPages || 1))
        );
        await loadData();
      } catch (error) {
        console.error("Failed to update EPUB progress:", error);
        Alert.alert(failureTitle, "Please try again.");
      }
    },
    [loadData]
  );

  const handleMoveToQueue = useCallback(
    (book: EpubLibraryItem) => {
      void setBookToQueueStart(book, "Could not move to queue");
    },
    [setBookToQueueStart]
  );

  const handleResetProgress = useCallback(
    (book: EpubLibraryItem) => {
      void setBookToQueueStart(book, "Could not reset progress");
    },
    [setBookToQueueStart]
  );

  const groupedBooks = useMemo(() => {
    const groups: Record<BookState, EpubLibraryItem[]> = {
      reading: [],
      queued: [],
      read: [],
    };

    for (const book of books) {
      const metrics = getBookMetrics(book);
      groups[metrics.state].push(book);
    }

    groups.reading.sort((left, right) => right.updatedAt - left.updatedAt);
    groups.queued.sort((left, right) => right.importedAt - left.importedAt);
    groups.read.sort((left, right) => right.updatedAt - left.updatedAt);

    return groups;
  }, [books]);

  const sections = useMemo(
    () =>
      SECTION_CONFIG.map((config) => ({
        ...config,
        data: groupedBooks[config.key],
      })),
    [groupedBooks]
  );

  const goalsProgress = readingGoals ?? getFallbackGoalsProgress();
  const remainingGoalMinutes = Math.max(0, goalsProgress.goalMinutes - goalsProgress.todayMinutes);

  const handleMenuMoveToQueue = useCallback(() => {
    if (!menuBook) {
      return;
    }

    const selectedBook = menuBook;
    setMenuBook(null);
    handleMoveToQueue(selectedBook);
  }, [handleMoveToQueue, menuBook]);

  const handleMenuResetProgress = useCallback(() => {
    if (!menuBook) {
      return;
    }

    const selectedBook = menuBook;
    setMenuBook(null);
    handleResetProgress(selectedBook);
  }, [handleResetProgress, menuBook]);

  const handleMenuDelete = useCallback(() => {
    if (!menuBook) {
      return;
    }

    const selectedBook = menuBook;
    setMenuBook(null);
    confirmDelete(selectedBook);
  }, [confirmDelete, menuBook]);

  const renderBookCard = useCallback(
    ({ item }: { item: EpubLibraryItem }) => {
      const metrics = getBookMetrics(item);
      const progressColor =
        metrics.state === "read"
          ? COMPLETED_PROGRESS_COLOR
          : metrics.state === "reading"
            ? theme.primary
            : theme.textLight;
      const progressFill = metrics.state === "reading" ? Math.max(4, metrics.percent) : metrics.percent;
      const fallbackTitle = item.title.trim() || "Untitled";

      return (
        <View
          style={[
            styles.bookCard,
            {
              width: cardWidth,
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.bookCardMain}
            onPress={() => openBook(item.id)}
            activeOpacity={0.88}
          >
            <View
              style={[
                styles.coverContainer,
                {
                  height: coverHeight,
                  borderColor: theme.border,
                  backgroundColor: `${theme.primary}12`,
                },
              ]}
            >
              {item.coverUri ? (
                <Image source={{ uri: item.coverUri }} style={styles.coverImage} resizeMode="cover" />
              ) : (
                <View style={[styles.coverFallback, { backgroundColor: theme.primary }]}>
                  <View style={[styles.coverFallbackAccent, { backgroundColor: theme.secondary }]} />
                  <Text style={styles.coverInitial}>{fallbackTitle.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
            </View>

            <Text style={[styles.bookTitle, { color: theme.textColor }]} numberOfLines={2}>
              {fallbackTitle}
            </Text>

            <View
              style={[
                styles.progressTrack,
                { backgroundColor: theme.isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.08)" },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressFill}%`,
                    backgroundColor: progressColor,
                  },
                ]}
              />
            </View>

            <View style={styles.bookFooter}>
              <Text style={[styles.progressPercent, { color: progressColor }]}>{metrics.percent}%</Text>
              <Text style={[styles.bookFooterDate, { color: theme.textLight }]}>
                Updated {formatDate(item.updatedAt)}
              </Text>
            </View>
          </TouchableOpacity>

          <GlassButton
            iconName="ellipsis-horizontal"
            iconSize={16}
            iconColor={theme.textColor}
            style={styles.bookMenuFloatingButton}
            variant={theme.isDark ? "colored" : "light"}
            onPress={() => setMenuBook(item)}
          />
        </View>
      );
    },
    [
      cardWidth,
      coverHeight,
      openBook,
      theme,
    ]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.backgroundColor,
            paddingTop: supportsNativeTabs() && isTablet ? 80 : 60,
          },
        ]}
      >
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>EPUB Reader</Text>
        </View>

        <View style={styles.headerActions}>
          {isImporting ? (
            <View
              style={[
                styles.loadingAction,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.cardBackground,
                },
              ]}
            >
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : (
            <GlassButton
              iconName="add"
              iconSize={24}
              iconColor={theme.textColor}
              variant="light"
              onPress={handleImport}
            />
          )}
          <GlassButton
            iconName="settings-outline"
            iconSize={24}
            iconColor={theme.textColor}
            variant="light"
            onPress={() => router.push("/epub-settings")}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerStateText, { color: theme.textSecondary }]}>Loading library...</Text>
        </View>
      ) : books.length === 0 ? (
        <View style={styles.centerState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: `${theme.primary}1A` }]}>
            <Ionicons name="book-outline" size={46} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>No EPUB books yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Import your first book and your reading shelves will appear here.
          </Text>
          <TouchableOpacity
            style={[styles.emptyImportButton, { backgroundColor: theme.primary }]}
            onPress={handleImport}
            disabled={isImporting}
            activeOpacity={0.86}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.emptyImportButtonText}>Import EPUB</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          <View
            style={[
              styles.goalsCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.goalsTodayRow}>
              <Text style={[styles.goalsTodayLabel, { color: theme.textColor }]}>Today</Text>
              <Text style={[styles.goalsTodayValue, { color: theme.textColor }]}>
                {goalsProgress.todayMinutes} / {goalsProgress.goalMinutes} min
              </Text>
            </View>

            <View
              style={[
                styles.goalsTrack,
                { backgroundColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" },
              ]}
            >
              <View
                style={[
                  styles.goalsFill,
                  {
                    width: `${Math.max(3, Math.round(goalsProgress.todayRatio * 100))}%`,
                    backgroundColor: goalsProgress.todayCompleted
                      ? COMPLETED_PROGRESS_COLOR
                      : theme.primary,
                  },
                ]}
              />
            </View>

            <Text style={[styles.goalsHint, { color: theme.textSecondary }]}>
              {goalsProgress.todayCompleted
                ? "Goal reached for today."
                : `${remainingGoalMinutes} more minute${remainingGoalMinutes === 1 ? "" : "s"} to hit your goal.`}
            </Text>

            <View style={styles.streakRow}>
              {goalsProgress.week.map((day) => (
                <View key={day.dateKey} style={styles.streakDayWrap}>
                  <View
                    style={[
                      styles.streakDayCircle,
                      {
                        borderColor: day.completed ? theme.primary : theme.border,
                        backgroundColor: day.completed ? `${theme.primary}1A` : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.streakDayLabel,
                        { color: day.completed ? theme.primary : theme.textLight },
                      ]}
                    >
                      {day.label}
                    </Text>
                  </View>
                  {day.isToday ? (
                    <View style={[styles.todayDot, { backgroundColor: theme.primary }]} />
                  ) : (
                    <View style={styles.todayDotSpacer} />
                  )}
                </View>
              ))}
            </View>

            <Text style={[styles.streakText, { color: theme.textColor }]}>
              Your reading streak is {goalsProgress.streakCurrent} day
              {goalsProgress.streakCurrent === 1 ? "" : "s"}
            </Text>
            <Text style={[styles.streakSubtext, { color: theme.textSecondary }]}>
              Best streak: {goalsProgress.streakBest} day{goalsProgress.streakBest === 1 ? "" : "s"}
            </Text>
          </View>

          {sections.map((section) => (
            <View key={section.key} style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderTitleWrap}>
                  <Ionicons name={section.icon} size={18} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.textColor }]}>{section.title}</Text>
                </View>
                <View style={[styles.sectionCountBadge, { backgroundColor: `${theme.primary}1A` }]}>
                  <Text style={[styles.sectionCountText, { color: theme.primary }]}>
                    {section.data.length}
                  </Text>
                </View>
              </View>

              {section.data.length === 0 ? (
                <View
                  style={[
                    styles.sectionEmptyCard,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.sectionEmptyText, { color: theme.textSecondary }]}>
                    {section.emptyLabel}
                  </Text>
                </View>
              ) : (
                <FlatList
                  horizontal
                  data={section.data}
                  keyExtractor={(item) => item.id}
                  renderItem={renderBookCard}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sectionCarouselContent}
                />
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={menuBook !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuBook(null)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuBook(null)}>
          <View style={styles.bookMenuOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.bookMenuModal,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.bookMenuOption}
                  onPress={handleMenuMoveToQueue}
                  activeOpacity={0.82}
                >
                  <Ionicons name="time-outline" size={18} color={theme.textColor} />
                  <Text style={[styles.bookMenuOptionText, { color: theme.textColor }]}>
                    Move to queue
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bookMenuOption}
                  onPress={handleMenuResetProgress}
                  activeOpacity={0.82}
                >
                  <Ionicons name="refresh-outline" size={18} color={theme.textColor} />
                  <Text style={[styles.bookMenuOptionText, { color: theme.textColor }]}>
                    Reset progress
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bookMenuOption}
                  onPress={handleMenuDelete}
                  activeOpacity={0.82}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.error} />
                  <Text style={[styles.bookMenuOptionText, { color: theme.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 20,
  },
  goalsCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  goalsTodayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  goalsTodayLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  goalsTodayValue: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  goalsTrack: {
    marginTop: 4,
    width: "100%",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  goalsFill: {
    height: "100%",
    borderRadius: 999,
  },
  goalsHint: {
    marginTop: 2,
    fontSize: 13,
  },
  streakRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  streakDayWrap: {
    alignItems: "center",
    gap: 4,
  },
  streakDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  streakDayLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  todayDotSpacer: {
    width: 4,
    height: 4,
  },
  streakText: {
    marginTop: 2,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
  },
  streakSubtext: {
    textAlign: "center",
    fontSize: 13,
  },
  sectionBlock: {
    gap: 10,
    marginHorizontal: -16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
  },
  sectionHeaderTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sectionCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  sectionCountText: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  sectionCarouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  sectionEmptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginHorizontal: 16,
  },
  sectionEmptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bookCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  bookCardMain: {
    padding: 10,
    gap: 7,
  },
  coverContainer: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverFallbackAccent: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 999,
    top: -50,
    right: -26,
    opacity: 0.32,
  },
  coverInitial: {
    color: "#fff",
    fontSize: 52,
    fontWeight: "900",
  },
  bookTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    minHeight: 36,
  },
  progressTrack: {
    width: "100%",
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  bookFooter: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  bookFooterDate: {
    fontSize: 11,
    flex: 1,
    textAlign: "right",
  },
  bookMenuFloatingButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 16,
  },
  bookMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.22)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  bookMenuModal: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  bookMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  bookMenuOptionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  centerStateText: {
    marginTop: 14,
    fontSize: 14,
  },
  emptyIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "700",
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyImportButton: {
    marginTop: 18,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyImportButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
