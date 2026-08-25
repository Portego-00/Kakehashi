import { Ionicons } from "@expo/vector-icons";
import { useActivityTracking } from "../../../../src/hooks/useActivityTracking";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel, {
  ICarouselInstance,
  Pagination,
} from "react-native-reanimated-carousel";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../../../../src/components/GlassButton";
import { NewsCard } from "../../../../src/components/news/NewsCard";
import { useDashboardData } from "../../../../src/hooks/useDashboardData";
import {
  preserveCachedFullArticles,
  readCachedNews,
  saveNewsToCache,
} from "../../../../src/services/NhkNewsCacheService";
import {
  type NewsItem,
  NhkNewsService,
} from "../../../../src/services/NhkNewsService";
import { calculateKnownKanjiPercentage } from "../../../../src/utils/kanjiUtils";
import {
  type NewsSourcePreference,
  useSettingsStore,
} from "../../../../src/utils/store";
import { useTheme } from "../../../../src/utils/theme";
import { supportsNativeTabs } from "@/src/utils/nativeTabs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;

const CAROUSEL_TAP_COOLDOWN_MS = 120;
type OtherNewsSortMode = "date" | "knownKanji";

const SOURCE_OPTIONS: readonly {
  label: string;
  value: NewsSourcePreference;
}[] = [
  { label: "Easy", value: "easy" },
  { label: "Standard", value: "regular" },
  { label: "Both", value: "both" },
];

export default function NewsScreen() {
  useActivityTracking("news", { mode: "focus" });
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCarouselInteracting, setIsCarouselInteracting] = useState(false);
  const [otherNewsSortMode, setOtherNewsSortMode] =
    useState<OtherNewsSortMode>("date");
  const newsSourcePreference = useSettingsStore(
    (state) => state.newsSourcePreference,
  );
  const setNewsSourcePreference = useSettingsStore(
    (state) => state.setNewsSourcePreference,
  );
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const newsRequestIdRef = useRef(0);
  const carouselInteractionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Get dashboard data for kanji stats
  const { dashboardData } = useDashboardData();

  // Memoize the set of passed kanji characters
  const passedKanjiSet = useMemo(() => {
    if (!dashboardData.assignments || !dashboardData.subjects)
      return new Set<string>();

    // Create a map of subject ID to character for quick lookup
    const kanjiSubjects = new Map<number, string>();
    dashboardData.subjects.forEach((subject) => {
      if (subject.object === "kanji" && subject.data.characters) {
        kanjiSubjects.set(subject.id, subject.data.characters);
      }
    });

    const passed = new Set<string>();
    dashboardData.assignments.forEach((assignment) => {
      // Check if assignment is for a kanji and is at Guru or above (srs_stage >= 5)
      // Also consider if it's passed (passed_at is not null)
      if (
        assignment.data.subject_type === "kanji" &&
        (assignment.data.srs_stage >= 5 || assignment.data.passed_at)
      ) {
        const character = kanjiSubjects.get(assignment.data.subject_id);
        if (character) {
          passed.add(character);
        }
      }
    });

    return passed;
  }, [dashboardData.assignments, dashboardData.subjects]);

  const fetchFreshNews = useCallback(
    async (requestId: number, fallbackItems: NewsItem[]) => {
      setLoading(true);
      setLoadError(null);

      try {
        const items = await NhkNewsService.getNews(newsSourcePreference);
        if (requestId !== newsRequestIdRef.current) return;

        if (items.length === 0) {
          NhkNewsService.setCachedItems(fallbackItems);
          setNews(fallbackItems);
          setLoadError(
            fallbackItems.length > 0
              ? "Couldn't refresh the news. Showing saved articles."
              : "Couldn't load news right now. Check your connection and try again.",
          );
          return;
        }

        const refreshedItems = preserveCachedFullArticles(items, fallbackItems);
        const refreshedSources = new Set(
          refreshedItems.map((item) => item.source),
        );
        const retainedFallbackItems = fallbackItems.filter(
          (item) => !refreshedSources.has(item.source),
        );
        const displayedItems = [
          ...refreshedItems,
          ...retainedFallbackItems,
        ].sort(
          (a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0),
        );

        NhkNewsService.setCachedItems(displayedItems);
        setNews(displayedItems);
        if (
          newsSourcePreference === "both" &&
          (["easy", "regular"] as const).some(
            (source) => !refreshedSources.has(source),
          )
        ) {
          setLoadError(
            retainedFallbackItems.length > 0
              ? "One source couldn't refresh. Showing its saved articles."
              : "One news source is temporarily unavailable.",
          );
        }
        try {
          await saveNewsToCache(displayedItems);
        } catch (error) {
          console.warn("Error saving NHK news cache:", error);
        }
      } catch (error) {
        if (requestId !== newsRequestIdRef.current) return;

        console.error("Error fetching NHK news:", error);
        NhkNewsService.setCachedItems(fallbackItems);
        setNews(fallbackItems);
        setLoadError(
          fallbackItems.length > 0
            ? "Couldn't refresh the news. Showing saved articles."
            : "Couldn't load news right now. Check your connection and try again.",
        );
      } finally {
        if (requestId === newsRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [newsSourcePreference],
  );

  useEffect(() => {
    const requestId = ++newsRequestIdRef.current;
    setLoadError(null);
    setLoading(true);

    void (async () => {
      let cachedNews: NewsItem[] = [];

      try {
        cachedNews = await readCachedNews(newsSourcePreference);
        if (requestId !== newsRequestIdRef.current) return;

        if (cachedNews.length > 0) {
          NhkNewsService.setCachedItems(cachedNews);
          setNews(cachedNews);
        }
      } catch (error) {
        console.error("Error loading cached news:", error);
      }

      await fetchFreshNews(requestId, cachedNews);
    })();

    return () => {
      if (newsRequestIdRef.current === requestId) {
        newsRequestIdRef.current += 1;
      }
    };
  }, [fetchFreshNews, newsSourcePreference]);

  useEffect(() => {
    return () => {
      if (carouselInteractionTimeoutRef.current) {
        clearTimeout(carouselInteractionTimeoutRef.current);
      }
    };
  }, []);

  const handleRefresh = useCallback(() => {
    const requestId = ++newsRequestIdRef.current;
    void fetchFreshNews(requestId, news);
  }, [fetchFreshNews, news]);

  const handlePress = (item: NewsItem) => {
    router.push({
      pathname: "/(app)/news/[id]",
      params: { id: item.id, source: item.source },
    });
  };

  const ref = useRef<ICarouselInstance>(null);
  const breakingNews = news.slice(0, 5);
  const knownKanjiPercentageById = useMemo(() => {
    const percentageMap = new Map<string, number>();

    news.forEach((item) => {
      const cleanContent = item.contentHtml.replace(/<[^>]*>/g, "");
      const text = item.title + cleanContent;

      percentageMap.set(
        item.id,
        calculateKnownKanjiPercentage(text, passedKanjiSet),
      );
    });

    return percentageMap;
  }, [news, passedKanjiSet]);

  const getPercentage = (item: NewsItem) =>
    knownKanjiPercentageById.get(item.id) ?? 0;

  const sortedRecommendationNews = useMemo(() => {
    const otherNews = news.slice(5);

    if (otherNewsSortMode === "knownKanji") {
      return otherNews.sort((a, b) => {
        const bPercentage = knownKanjiPercentageById.get(b.id) ?? 0;
        const aPercentage = knownKanjiPercentageById.get(a.id) ?? 0;
        const percentageDiff = bPercentage - aPercentage;
        if (percentageDiff !== 0) {
          return percentageDiff;
        }

        const bDate = Date.parse(b.pubDate || "");
        const aDate = Date.parse(a.pubDate || "");
        return (
          (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate)
        );
      });
    }

    return otherNews.sort((a, b) => {
      const bDate = Date.parse(b.pubDate || "");
      const aDate = Date.parse(a.pubDate || "");
      return (
        (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate)
      );
    });
  }, [news, otherNewsSortMode, knownKanjiPercentageById]);

  const sortButtonText =
    otherNewsSortMode === "date" ? "Date" : "Known Kanji %";

  const openSortFallbackMenu = () => {
    Alert.alert("Sort Other News", "Choose how to sort articles.", [
      {
        text: "Date (Newest first)",
        onPress: () => setOtherNewsSortMode("date"),
      },
      {
        text: "Known Kanji % (Highest first)",
        onPress: () => setOtherNewsSortMode("knownKanji"),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const openSourceFallbackMenu = () => {
    Alert.alert("News Source", "Choose which news to show.", [
      ...SOURCE_OPTIONS.map((option) => ({
        text: `${newsSourcePreference === option.value ? "✓ " : ""}${option.label}`,
        onPress: () => setNewsSourcePreference(option.value),
      })),
      {
        text: "Cancel",
        style: "cancel" as const,
      },
    ]);
  };

  const progress = useSharedValue<number>(0);
  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  const handleCarouselScrollStart = () => {
    if (carouselInteractionTimeoutRef.current) {
      clearTimeout(carouselInteractionTimeoutRef.current);
      carouselInteractionTimeoutRef.current = null;
    }

    setIsCarouselInteracting(true);
  };

  const handleCarouselScrollEnd = () => {
    if (carouselInteractionTimeoutRef.current) {
      clearTimeout(carouselInteractionTimeoutRef.current);
    }

    carouselInteractionTimeoutRef.current = setTimeout(() => {
      setIsCarouselInteracting(false);
      carouselInteractionTimeoutRef.current = null;
    }, CAROUSEL_TAP_COOLDOWN_MS);
  };

  const isTablet = width > 768;
  const carouselWidth = isTablet ? 500 : width;

  const renderHeader = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, fontSize: 30 },
          ]}
        >
          Recent News
        </Text>
        {Platform.OS === "ios" && SwiftUI ? (
          <SwiftUI.Host matchContents style={styles.sortMenuHost}>
            <SwiftUI.Menu
              label={
                <SwiftUI.RNHostView matchContents>
                  <GlassButton
                    iconName="filter-outline"
                    iconSize={18}
                    iconColor={theme.textColor}
                    style={styles.sortMenuButton}
                    variant={theme.isDark ? "colored" : "light"}
                  />
                </SwiftUI.RNHostView>
              }
            >
              {SOURCE_OPTIONS.map((option) => (
                <SwiftUI.Button
                  key={option.value}
                  label={option.label}
                  systemImage={
                    newsSourcePreference === option.value
                      ? "checkmark.circle.fill"
                      : "circle"
                  }
                  onPress={() => setNewsSourcePreference(option.value)}
                />
              ))}
            </SwiftUI.Menu>
          </SwiftUI.Host>
        ) : (
          <GlassButton
            iconName="filter-outline"
            iconSize={18}
            iconColor={theme.textColor}
            onPress={openSourceFallbackMenu}
            style={[styles.sortMenuButton, styles.sourceMenuFallbackButton]}
            variant={theme.isDark ? "colored" : "light"}
          />
        )}
      </View>

      {loadError ? (
        <View style={styles.loadErrorRow}>
          <Ionicons
            name="cloud-offline-outline"
            size={18}
            color={theme.textSecondary}
          />
          <Text
            selectable
            style={[styles.loadErrorText, { color: theme.textSecondary }]}
          >
            {loadError}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retryButton,
              { borderColor: theme.border, opacity: pressed ? 0.65 : 1 },
            ]}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: theme.textColor }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : null}

      {breakingNews.length > 0 ? (
        <>
          <View style={{ alignItems: "center" }}>
            <Carousel
              ref={ref}
              autoPlayInterval={4000}
              loop={breakingNews.length > 1}
              width={carouselWidth}
              height={230}
              autoPlay={breakingNews.length > 1}
              data={breakingNews}
              scrollAnimationDuration={1000}
              pagingEnabled
              onProgressChange={progress}
              onScrollStart={handleCarouselScrollStart}
              onScrollEnd={handleCarouselScrollEnd}
              onConfigurePanGesture={(panGesture) => {
                panGesture.activeOffsetX([-10, 10]);
              }}
              style={{
                width: carouselWidth,
                overflow: "visible",
              }}
              renderItem={({ item }: { item: NewsItem }) => (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 16,
                  }}
                >
                  <NewsCard
                    item={item}
                    onPress={handlePress}
                    variant="breaking"
                    knownKanjiPercentage={getPercentage(item)}
                    disablePress={isCarouselInteracting}
                    showSourceBadge={newsSourcePreference === "both"}
                  />
                </View>
              )}
              mode="parallax"
              modeConfig={{ parallaxScrollingScale: 0.9 }}
            />
          </View>

          {breakingNews.length > 1 ? (
            <Pagination.Basic
              progress={progress}
              data={breakingNews}
              dotStyle={{ backgroundColor: theme.border, borderRadius: 50 }}
              activeDotStyle={{
                backgroundColor: theme.primary,
                borderRadius: 50,
              }}
              containerStyle={{ gap: 5, marginTop: 10 }}
              onPress={onPressPagination}
            />
          ) : null}

          {sortedRecommendationNews.length > 0 ? (
            <View
              style={[
                styles.sectionHeader,
                { marginTop: 24, marginBottom: 12 },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Other News
              </Text>
              {Platform.OS === "ios" && SwiftUI ? (
                <SwiftUI.Host matchContents style={styles.sortMenuHost}>
                  <SwiftUI.Menu
                    label={
                      <SwiftUI.RNHostView matchContents>
                        <GlassButton
                          iconName="swap-vertical"
                          iconSize={18}
                          iconColor={theme.textColor}
                          style={styles.sortMenuButton}
                          variant={theme.isDark ? "colored" : "light"}
                        />
                      </SwiftUI.RNHostView>
                    }
                  >
                    <SwiftUI.Button
                      label="Date (Newest first)"
                      systemImage={
                        otherNewsSortMode === "date"
                          ? "checkmark.circle.fill"
                          : "circle"
                      }
                      onPress={() => setOtherNewsSortMode("date")}
                    />
                    <SwiftUI.Button
                      label="Known Kanji % (Highest first)"
                      systemImage={
                        otherNewsSortMode === "knownKanji"
                          ? "checkmark.circle.fill"
                          : "circle"
                      }
                      onPress={() => setOtherNewsSortMode("knownKanji")}
                    />
                  </SwiftUI.Menu>
                </SwiftUI.Host>
              ) : (
                <Pressable
                  style={[
                    styles.sortControlButton,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={openSortFallbackMenu}
                >
                  <Ionicons
                    name="swap-vertical"
                    size={14}
                    color={theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.sortControlButtonText,
                      { color: theme.textColor },
                    ]}
                  >
                    {sortButtonText}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </>
      ) : loading ? (
        <View style={styles.headerLoadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="newspaper-outline"
            size={42}
            color={theme.textLight}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No articles are available for this source right now.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <FlatList
        data={sortedRecommendationNews}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <NewsCard
              item={item}
              onPress={handlePress}
              variant="standard"
              knownKanjiPercentage={getPercentage(item)}
              showSourceBadge={newsSourcePreference === "both"}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader()}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: 100,
            paddingTop:
              insets.top + (supportsNativeTabs() && isTablet ? 30 : 10),
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading && news.length > 0}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      {loading && news.length > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.loadingOverlay, { top: insets.top + 12 }]}
        >
          <View
            style={[
              styles.loadingPill,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textColor }]}>
              Loading news…
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 16,
  },
  loadErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  loadErrorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    minHeight: 32,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  headerLoadingContainer: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
  loadingPill: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyContainer: {
    minHeight: 280,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    paddingHorizontal: 16,
  },
  sortControlButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 16,
    minHeight: 32,
  },
  sortControlButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sortMenuHost: {
    marginRight: 16,
  },
  sortMenuButton: {
    width: 36,
    height: 36,
  },
  sourceMenuFallbackButton: {
    marginRight: 16,
  },
});
