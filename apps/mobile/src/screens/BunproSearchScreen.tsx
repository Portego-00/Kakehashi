import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BunproGrammarPointAttributes,
  BunproReviewablesSearchResponse,
  BunproVocabAttributes,
} from "../types/bunpro";
import { BunproApiError, searchBunproReviewables } from "../utils/bunproApi";
import { supportsNativeTabs } from "../utils/nativeTabs";
import { isPortegoUsername } from "../utils/portegoAccess";
import { useAuthStore } from "../utils/store";
import { getBestContrastTextColor } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

type BunproSearchItem = {
  id: string;
  type: "grammar" | "vocab";
  slug: string;
  title: string;
  subtitle: string;
  meaning: string;
  metaLine: string;
  badgeLabel: "文" | "単";
};

type BunproSectionKey = "grammar" | "vocab";

type BunproSection = {
  key: BunproSectionKey;
  title: string;
  count: number;
  data: BunproSearchItem[];
};

const MIN_QUERY_LENGTH = 2;

function formatBunproSearchError(error: unknown): string {
  if (error instanceof BunproApiError) {
    if (error.code) {
      return `${error.message} (${error.code})`;
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while searching Bunpro.";
}

function normalizeJlptLabel(rawLevel: string): string {
  const normalized = rawLevel.trim();
  if (normalized.length === 0) {
    return normalized;
  }

  const jlptMatch = normalized.match(/^JLPT\s*([1-5])$/i);
  if (jlptMatch?.[1]) {
    return `N${jlptMatch[1]}`;
  }

  return normalized;
}

function toGrammarItem(attributes: BunproGrammarPointAttributes, id: string): BunproSearchItem {
  const title =
    (typeof attributes.title === "string" && attributes.title.trim().length > 0
      ? attributes.title
      : typeof attributes.slug === "string" && attributes.slug.trim().length > 0
      ? attributes.slug
      : "Grammar Point");

  const subtitle =
    (typeof attributes.furigana === "string" && attributes.furigana.trim().length > 0
      ? attributes.furigana
      : typeof attributes.slug === "string"
      ? attributes.slug
      : "");

  const meaning =
    (typeof attributes.meaning === "string" && attributes.meaning.trim().length > 0
      ? attributes.meaning
      : typeof attributes.nuance_translation === "string"
      ? attributes.nuance_translation
      : "");

  const level =
    typeof attributes.level === "string" && attributes.level.trim().length > 0
      ? normalizeJlptLabel(attributes.level)
      : "Grammar";
  const lessonId =
    typeof attributes.lesson_id === "number" && Number.isFinite(attributes.lesson_id)
      ? attributes.lesson_id
      : null;
  const lessonCount =
    typeof attributes.lesson_count === "string" && attributes.lesson_count.trim().length > 0
      ? attributes.lesson_count.trim()
      : null;
  const lessonDescriptor = lessonId !== null ? `Lesson ${lessonId}` : "Lesson";
  const metaLine =
    lessonCount !== null
      ? `${level} ${lessonDescriptor}: ${lessonCount}`
      : lessonId !== null
      ? `${level} ${lessonDescriptor}`
      : level;

  return {
    id: `grammar-${id}`,
    type: "grammar",
    slug:
      (typeof attributes.slug === "string" && attributes.slug.trim().length > 0
        ? attributes.slug.trim()
        : id),
    title,
    subtitle,
    meaning,
    metaLine,
    badgeLabel: "文",
  };
}

function toVocabItem(attributes: BunproVocabAttributes, id: string): BunproSearchItem {
  const title =
    (typeof attributes.title === "string" && attributes.title.trim().length > 0
      ? attributes.title
      : typeof attributes.kana === "string" && attributes.kana.trim().length > 0
      ? attributes.kana
      : "Vocabulary");

  const subtitle =
    (typeof attributes.furigana === "string" && attributes.furigana.trim().length > 0
      ? attributes.furigana
      : typeof attributes.kana === "string"
      ? attributes.kana
      : "");

  const meaning =
    (typeof attributes.meaning === "string" && attributes.meaning.trim().length > 0
      ? attributes.meaning
      : "");

  const level =
    typeof attributes.jlpt_level === "string" && attributes.jlpt_level.trim().length > 0
      ? normalizeJlptLabel(attributes.jlpt_level)
      : "Vocabulary";

  return {
    id: `vocab-${id}`,
    type: "vocab",
    slug:
      (typeof attributes.slug === "string" && attributes.slug.trim().length > 0
        ? attributes.slug.trim()
        : id),
    title,
    subtitle,
    meaning,
    metaLine: level,
    badgeLabel: "単",
  };
}

export default function BunproSearchScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { userData } = useAuthStore();
  const usesNativeTabSearch = supportsNativeTabs();
  const isPortegoUser = isPortegoUsername(userData?.username);
  const params = useLocalSearchParams<{ query?: string }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchResponse, setSearchResponse] =
    useState<BunproReviewablesSearchResponse | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<BunproSectionKey, boolean>
  >({
    grammar: true,
    vocab: true,
  });

  const showInlineSearchBar = !usesNativeTabSearch;
  const headerSearchQuery = typeof params.query === "string" ? params.query : "";

  useEffect(() => {
    if (!usesNativeTabSearch) {
      return;
    }

    setSearchQuery((previousValue) => {
      if (previousValue === headerSearchQuery) {
        return previousValue;
      }
      return headerSearchQuery;
    });
  }, [headerSearchQuery, usesNativeTabSearch]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, searchQuery.length <= 2 ? 320 : 220);

    return () => {
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!isPortegoUser) {
      return;
    }

    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setIsLoading(false);
      setErrorMessage(null);
      setSearchResponse(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);

    void searchBunproReviewables({
      query: debouncedQuery,
      signal: controller.signal,
    })
      .then((response) => {
        setSearchResponse(response);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setSearchResponse(null);
        setErrorMessage(formatBunproSearchError(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, isPortegoUser]);

  const grammarItems = useMemo(() => {
    return (searchResponse?.grammar_points.data ?? []).map((resource) =>
      toGrammarItem(resource.attributes, resource.id)
    );
  }, [searchResponse?.grammar_points.data]);

  const vocabItems = useMemo(() => {
    return (searchResponse?.vocabs.data ?? []).map((resource) =>
      toVocabItem(resource.attributes, resource.id)
    );
  }, [searchResponse?.vocabs.data]);

  const sections = useMemo<BunproSection[]>(
    () => [
      {
        key: "grammar",
        title: "Grammar",
        count: grammarItems.length,
        data: expandedSections.grammar ? grammarItems : [],
      },
      {
        key: "vocab",
        title: "Vocabulary",
        count: vocabItems.length,
        data: expandedSections.vocab ? vocabItems : [],
      },
    ],
    [expandedSections.grammar, expandedSections.vocab, grammarItems, vocabItems]
  );

  const toggleSection = (sectionKey: BunproSectionKey) => {
    setExpandedSections((previousState) => ({
      ...previousState,
      [sectionKey]: !previousState[sectionKey],
    }));
  };

  if (!isPortegoUser) {
    return (
      <View style={[styles.gatedContainer, { backgroundColor: theme.backgroundColor }]}> 
        <Ionicons name="lock-closed-outline" size={24} color={theme.textSecondary} />
        <Text style={[styles.gatedTitle, { color: theme.textColor }]}>Bunpro Beta Is Portego-Only</Text>
        <Text style={[styles.gatedSubtitle, { color: theme.textSecondary }]}>This tab is currently enabled only for the Portego account.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor, paddingTop: 60 }]}> 
      {showInlineSearchBar ? (
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons
              name="search"
              size={20}
              color={theme.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.textColor }]}
              onChangeText={setSearchQuery}
              placeholder="Search Bunpro grammar or vocabulary..."
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoFocus
            />
          </View>
        </View>
      ) : (
        <View style={styles.nativeHeaderRow}>
          <Text style={[styles.nativeHeaderTitle, { color: theme.textColor }]}>Bunpro Search</Text>
        </View>
      )}

      {debouncedQuery.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="search-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>Search Bunpro</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Look up grammar points and vocabulary across your Bunpro reviewables.</Text>
        </View>
      ) : debouncedQuery.length < MIN_QUERY_LENGTH ? (
        <View style={styles.centerContent}>
          <Ionicons name="information-circle-outline" size={44} color={theme.textSecondary} />
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Type at least {MIN_QUERY_LENGTH} characters to search.</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Searching Bunpro...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={46} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
        </View>
      ) : grammarItems.length === 0 && vocabItems.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="file-tray-outline" size={46} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>No results</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Try a different query.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            if (section.count === 0) {
              return null;
            }

            const isExpanded = expandedSections[section.key];
            return (
              <TouchableOpacity
                style={[
                  styles.sectionHeader,
                  {
                    backgroundColor: theme.isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.03)",
                  },
                ]}
                activeOpacity={0.75}
                onPress={() => toggleSection(section.key)}
              >
                <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                  {section.title}
                </Text>
                <View style={styles.sectionHeaderRight}>
                  <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
                    {section.count}
                  </Text>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.textSecondary}
                  />
                </View>
              </TouchableOpacity>
            );
          }}
          renderItem={({ item }) => {
            const badgeBackground =
              item.type === "grammar"
                ? "rgba(217, 92, 137, 0.95)"
                : "rgba(66, 163, 234, 0.95)";
            const badgeTextColor = getBestContrastTextColor(
              badgeBackground,
              "#13151a",
              "#ffffff"
            );

            return (
              <TouchableOpacity
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.isDark ? "#2d2f34" : theme.cardBackground,
                    borderColor: theme.isDark ? "rgba(255,255,255,0.09)" : theme.border,
                  },
                ]}
                activeOpacity={0.82}
                onPress={() =>
                  router.push({
                    pathname: "/bunpro-reviewable/[kind]/[slug]",
                    params: {
                      kind: item.type === "grammar" ? "grammar" : "vocab",
                      slug: encodeURIComponent(item.slug),
                    },
                  })
                }
              >
                <View style={styles.itemTopRow}>
                  <Text
                    style={[styles.itemTitle, { color: theme.isDark ? "#f4f5f8" : theme.textColor }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.title}
                  </Text>
                  {item.subtitle.length > 0 ? (
                    <Text
                      style={[
                        styles.itemSubtitleInline,
                        { color: theme.isDark ? "#8f939c" : theme.textSecondary },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>

                {item.meaning.length > 0 ? (
                  <Text
                    style={[styles.itemMeaning, { color: theme.isDark ? "#c2c4c9" : theme.textSecondary }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.meaning}
                  </Text>
                ) : null}

                <View style={styles.itemMetaRow}>
                  <View
                    style={[
                      styles.typePill,
                      {
                        backgroundColor: badgeBackground,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        { color: badgeTextColor },
                      ]}
                    >
                      {item.badgeLabel}
                    </Text>
                  </View>
                  <Text style={[styles.metaLineText, { color: theme.isDark ? "#f4f5f8" : theme.textColor }]}>
                    {item.metaLine}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gatedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  gatedTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  gatedSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: 48,
  },
  nativeHeaderRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  nativeHeaderTitle: {
    fontSize: 30,
    fontWeight: "700",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 2,
  },
  sectionHeader: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "600",
  },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 6,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    minHeight: 24,
  },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  typePill: {
    borderRadius: 8,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  typePillText: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 16,
  },
  itemTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  itemSubtitleInline: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20,
  },
  itemMeaning: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  metaLineText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
});
