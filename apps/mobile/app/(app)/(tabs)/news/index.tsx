import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel, {
  ICarouselInstance,
  Pagination,
} from "react-native-reanimated-carousel";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Directory, File, Paths } from "expo-file-system";
import { GlassButton } from "../../../../src/components/GlassButton";
import { NewsCard } from "../../../../src/components/news/NewsCard";
import { useDashboardData } from "../../../../src/hooks/useDashboardData";
import {
  NhkEasyItem,
  NhkEasyService,
} from "../../../../src/services/NhkEasyService";
import { calculateKnownKanjiPercentage } from "../../../../src/utils/kanjiUtils";
import { useTheme } from "../../../../src/utils/theme";
import { supportsNativeTabs } from "@/src/utils/nativeTabs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;

const NEWS_CACHE_FILE = "news-cache.json";
const MAX_CACHED_NEWS = 20;
const CAROUSEL_TAP_COOLDOWN_MS = 120;
type OtherNewsSortMode = "date" | "knownKanji";

export default function NewsScreen() {
  const [news, setNews] = useState<NhkEasyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCarouselInteracting, setIsCarouselInteracting] = useState(false);
  const [otherNewsSortMode, setOtherNewsSortMode] =
    useState<OtherNewsSortMode>("date");
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  useEffect(() => {
    loadCachedNews();
    loadNews();
  }, []);

  useEffect(() => {
    return () => {
      if (carouselInteractionTimeoutRef.current) {
        clearTimeout(carouselInteractionTimeoutRef.current);
      }
    };
  }, []);

  // Load cached news from file system
  const loadCachedNews = async () => {
    try {
      const cacheDir = new Directory(Paths.cache, "news");
      cacheDir.create({ idempotent: true });

      const cacheFile = new File(cacheDir, NEWS_CACHE_FILE);

      if (cacheFile.exists) {
        const content = await cacheFile.text();
        const cachedNews = JSON.parse(content) as NhkEasyItem[];
        setNews(cachedNews);
        console.log(`✅ Loaded ${cachedNews.length} news items from cache`);
      }
    } catch (error) {
      console.error("Error loading cached news:", error);
    }
  };

  // Save news to cache
  const saveNewsToCache = async (items: NhkEasyItem[]) => {
    try {
      const cacheDir = new Directory(Paths.cache, "news");
      cacheDir.create({ idempotent: true });

      const cacheFile = new File(cacheDir, NEWS_CACHE_FILE);

      // Keep only the most recent 20 items
      const itemsToCache = items.slice(0, MAX_CACHED_NEWS);
      cacheFile.write(JSON.stringify(itemsToCache, null, 2));

      console.log(`✅ Saved ${itemsToCache.length} news items to cache`);
    } catch (error) {
      console.error("Error saving news to cache:", error);
    }
  };

  const loadNews = async () => {
    // Keep showing loading indicator only on initial load
    if (news.length === 0) setLoading(true);
    const items = await NhkEasyService.getNews();

    if (items.length > 0) {
      setNews(items);
      // Save to cache for offline access
      await saveNewsToCache(items);
    }
    // If fetch failed but we have cached news, keep showing cached news

    setLoading(false);
  };

  const handlePress = (item: NhkEasyItem) => {
    // Extract ID from guid or link
    // guid: https://nhkeasier.com/story/9228/
    const idMatch = item.guid.match(/story\/(\d+)\//);
    const id = idMatch ? idMatch[1] : encodeURIComponent(item.guid);

    router.push({
      pathname: "/(app)/news/[id]",
      params: { id },
    });
  };

  const ref = useRef<ICarouselInstance>(null);
  const breakingNews = news.slice(0, 5);
  const knownKanjiPercentageByGuid = useMemo(() => {
    const percentageMap = new Map<string, number>();

    news.forEach((item) => {
      const cleanContent = item.contentHtml.replace(/<[^>]*>/g, "");
      const text = item.title + cleanContent;

      percentageMap.set(
        item.guid,
        calculateKnownKanjiPercentage(text, passedKanjiSet)
      );
    });

    return percentageMap;
  }, [news, passedKanjiSet]);

  const getPercentage = (item: NhkEasyItem) =>
    knownKanjiPercentageByGuid.get(item.guid) ?? 0;

  const sortedRecommendationNews = useMemo(() => {
    const otherNews = news.slice(5);

    if (otherNewsSortMode === "knownKanji") {
      return otherNews.sort((a, b) => {
        const bPercentage = knownKanjiPercentageByGuid.get(b.guid) ?? 0;
        const aPercentage = knownKanjiPercentageByGuid.get(a.guid) ?? 0;
        const percentageDiff = bPercentage - aPercentage;
        if (percentageDiff !== 0) {
          return percentageDiff;
        }

        const bDate = Date.parse(b.pubDate || "");
        const aDate = Date.parse(a.pubDate || "");
        return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
      });
    }

    return otherNews.sort((a, b) => {
      const bDate = Date.parse(b.pubDate || "");
      const aDate = Date.parse(a.pubDate || "");
      return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
    });
  }, [news, otherNewsSortMode, knownKanjiPercentageByGuid]);

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

  const { width } = Dimensions.get("window");
  const isTablet = width > 768;
  const carouselWidth = isTablet ? 500 : width;

  const renderHeader = () => (
    <View>
      {/* Breaking News Section */}
      <View style={[styles.sectionHeader]}>
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, fontSize: 30, marginBottom: 4 },
          ]}
        >
          Recent News
        </Text>
      </View>

      <View style={{ alignItems: "center" }}>
        <Carousel
          ref={ref}
          autoPlayInterval={4000}
          loop
          width={carouselWidth}
          height={230}
          autoPlay={true}
          data={breakingNews}
          scrollAnimationDuration={1000}
          pagingEnabled={true}
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
          renderItem={({ item }: { item: NhkEasyItem }) => (
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
              />
            </View>
          )}
          mode="parallax"
          modeConfig={{
            parallaxScrollingScale: 0.9,
            //   parallaxScrollingOffset: 10,
          }}
        />
      </View>
      <Pagination.Basic
        progress={progress}
        data={breakingNews}
        dotStyle={{ backgroundColor: theme.border, borderRadius: 50 }}
        activeDotStyle={{ backgroundColor: theme.primary, borderRadius: 50 }}
        containerStyle={{ gap: 5, marginTop: 10 }}
        onPress={onPressPagination}
      />

      {/* Recommendation Section Header */}
      <View style={[styles.sectionHeader, { marginTop: 24, marginBottom: 12 }]}>
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
            <Ionicons name="swap-vertical" size={14} color={theme.textSecondary} />
            <Text style={[styles.sortControlButtonText, { color: theme.textColor }]}>
              {sortButtonText}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      {loading && news.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={sortedRecommendationNews}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              <NewsCard
                item={item}
                onPress={handlePress}
                variant="standard"
                knownKanjiPercentage={getPercentage(item)}
              />
            </View>
          )}
          keyExtractor={(item) => item.guid}
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
              refreshing={loading}
              onRefresh={loadNews}
              tintColor={theme.primary}
            />
          }
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingTop: 16,
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
});
