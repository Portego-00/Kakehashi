import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../../src/components/GlassButton";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import { type Assignment, type Subject } from "../../src/utils/api";
import { getAllSubjects } from "../../src/utils/cache";
import { useTheme } from "../../src/utils/theme";

type KanjiCatalogEntry = {
  subjectId: number;
  kanji: string;
  level: number;
};

type KanjiGridItem = {
  subjectId: number;
  kanji: string;
  level: number;
  srsStage: number;
};

const GRID_GAP = 2;
const GRID_SIDE_PADDING = 12;
const STAGE_MIN = 0;
const STAGE_MAX = 9;
const GRID_DRAW_DISTANCE = 260;
const KANJI_GRID_CATALOG_CACHE_KEY = "wanikani_kanji_grid_catalog_v1";

let inMemoryKanjiCatalog: KanjiCatalogEntry[] | null = null;
let inFlightKanjiCatalogLoad: Promise<KanjiCatalogEntry[]> | null = null;

const STAGE_HEAT_COLORS_LIGHT: readonly string[] = [
  "#d9d9d9", // Not started
  "#f25f5c",
  "#f07e4a",
  "#eba63e",
  "#d8c33a",
  "#a0cb46",
  "#6fca5b",
  "#42c58b",
  "#31c3aa",
  "#29bec2",
];

const STAGE_HEAT_COLORS_DARK: readonly string[] = [
  "#3a3a3a", // Not started
  "#b73e3c",
  "#c5663a",
  "#ca8f37",
  "#b7a437",
  "#87ad3f",
  "#58ae53",
  "#33ab74",
  "#2ca991",
  "#2aa3a7",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getHeatColorForStage(stage: number, isDark: boolean): string {
  const safeStage = clamp(Math.round(stage), STAGE_MIN, STAGE_MAX);
  const palette = isDark ? STAGE_HEAT_COLORS_DARK : STAGE_HEAT_COLORS_LIGHT;
  return palette[safeStage];
}

function getContrastTextColor(hexColor: string): "#111111" | "#ffffff" {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) {
    return "#111111";
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111111" : "#ffffff";
}

function isKanjiSubject(
  subject: Subject
): subject is Subject & {
  object: "kanji";
  data: Subject["data"] & { characters: string };
} {
  return (
    subject.object === "kanji" &&
    typeof subject.data?.characters === "string" &&
    subject.data.characters.length > 0
  );
}

function isKanjiCatalogEntry(value: unknown): value is KanjiCatalogEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<KanjiCatalogEntry>;
  return (
    typeof candidate.subjectId === "number" &&
    typeof candidate.kanji === "string" &&
    candidate.kanji.length > 0 &&
    typeof candidate.level === "number"
  );
}

function parseKanjiCatalogCache(raw: string | null): KanjiCatalogEntry[] | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const validEntries = parsed.filter(isKanjiCatalogEntry);
    return validEntries.length > 0 ? validEntries : null;
  } catch {
    return null;
  }
}

async function buildKanjiCatalogFromSubjects(): Promise<KanjiCatalogEntry[]> {
  const subjects = (await getAllSubjects()) as Subject[];

  const catalog = subjects
    .filter(isKanjiSubject)
    .map((subject) => ({
      subjectId: subject.id,
      kanji: subject.data.characters,
      level: subject.data.level,
    }))
    .sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      return a.kanji.localeCompare(b.kanji, "ja");
    });

  return catalog;
}

async function loadKanjiCatalog(): Promise<KanjiCatalogEntry[]> {
  if (inMemoryKanjiCatalog && inMemoryKanjiCatalog.length > 0) {
    return inMemoryKanjiCatalog;
  }

  if (inFlightKanjiCatalogLoad) {
    return inFlightKanjiCatalogLoad;
  }

  inFlightKanjiCatalogLoad = (async () => {
    const cachedRaw = await AsyncStorage.getItem(KANJI_GRID_CATALOG_CACHE_KEY);
    const cachedCatalog = parseKanjiCatalogCache(cachedRaw);
    if (cachedCatalog) {
      inMemoryKanjiCatalog = cachedCatalog;
      return cachedCatalog;
    }

    const freshCatalog = await buildKanjiCatalogFromSubjects();
    inMemoryKanjiCatalog = freshCatalog;
    await AsyncStorage.setItem(
      KANJI_GRID_CATALOG_CACHE_KEY,
      JSON.stringify(freshCatalog)
    );
    return freshCatalog;
  })();

  try {
    return await inFlightKanjiCatalogLoad;
  } finally {
    inFlightKanjiCatalogLoad = null;
  }
}

type KanjiGridCellProps = {
  item: KanjiGridItem;
  cellSize: number;
  isDark: boolean;
  onPressSubject: (subjectId: number) => void;
};

const KanjiGridCell = React.memo(function KanjiGridCell({
  item,
  cellSize,
  isDark,
  onPressSubject,
}: KanjiGridCellProps) {
  const backgroundColor = getHeatColorForStage(item.srsStage, isDark);
  const textColor = getContrastTextColor(backgroundColor);
  const fontSize = Math.max(12, Math.floor(cellSize * 0.58));

  return (
    <Pressable
      style={[
        styles.kanjiCell,
        {
          width: cellSize,
          height: cellSize,
          backgroundColor,
        },
      ]}
      onPress={() => onPressSubject(item.subjectId)}
    >
      <Text style={[styles.kanjiCellText, { color: textColor, fontSize }]}>
        {item.kanji}
      </Text>
    </Pressable>
  );
});

export default function KanjiGridScreen() {
  const { theme } = useTheme();
  const { dashboardData, isLoading } = useDashboardData();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [kanjiCatalog, setKanjiCatalog] = useState<KanjiCatalogEntry[] | null>(
    inMemoryKanjiCatalog
  );

  useEffect(() => {
    let isMounted = true;
    let interactionTask: ReturnType<typeof InteractionManager.runAfterInteractions> | null =
      null;

    const loadCatalog = async () => {
      const catalog = await loadKanjiCatalog();
      if (isMounted) {
        setKanjiCatalog(catalog);
      }
    };

    if (!kanjiCatalog) {
      interactionTask = InteractionManager.runAfterInteractions(() => {
        void loadCatalog();
      });
    }

    return () => {
      isMounted = false;
      interactionTask?.cancel();
    };
  }, [kanjiCatalog]);

  const assignments = useMemo(
    () => (dashboardData.assignments ?? []) as Assignment[],
    [dashboardData.assignments]
  );

  const kanjiItems = useMemo<KanjiGridItem[]>(() => {
    if (!kanjiCatalog) {
      return [];
    }

    const assignmentStageBySubjectId = new Map<number, number>();
    assignments.forEach((assignment) => {
      if (assignment.data.subject_type !== "kanji") {
        return;
      }

      assignmentStageBySubjectId.set(
        assignment.data.subject_id,
        assignment.data.srs_stage
      );
    });

    const buckets: KanjiGridItem[][] = Array.from(
      { length: STAGE_MAX + 1 },
      () => []
    );

    kanjiCatalog.forEach((entry) => {
      const srsStage = assignmentStageBySubjectId.get(entry.subjectId) ?? 0;
      const safeStage = clamp(srsStage, STAGE_MIN, STAGE_MAX);
      buckets[safeStage].push({
        subjectId: entry.subjectId,
        kanji: entry.kanji,
        level: entry.level,
        srsStage: safeStage,
      });
    });

    const items: KanjiGridItem[] = [];
    for (let stage = STAGE_MAX; stage >= STAGE_MIN; stage -= 1) {
      items.push(...buckets[stage]);
    }

    return items;
  }, [kanjiCatalog, assignments]);

  const stats = useMemo(() => {
    const total = kanjiItems.length;
    const started = kanjiItems.filter((item) => item.srsStage > 0).length;
    const guruPlus = kanjiItems.filter((item) => item.srsStage >= 5).length;
    const burned = kanjiItems.filter((item) => item.srsStage >= 9).length;

    return {
      total,
      started,
      guruPlus,
      burned,
      startedPercent: total > 0 ? (started / total) * 100 : 0,
    };
  }, [kanjiItems]);

  const availableWidth = Math.max(220, width - GRID_SIDE_PADDING * 2);
  const minCellSize = width >= 900 ? 19 : width >= 700 ? 21 : 24;
  const numColumns = Math.max(
    8,
    Math.floor((availableWidth + GRID_GAP) / (minCellSize + GRID_GAP))
  );
  const cellSize = Math.max(16, Math.floor(availableWidth / numColumns) - GRID_GAP);

  const handlePressSubject = useCallback((subjectId: number) => {
    router.push(`/subject/${subjectId}`);
  }, []);
  const handleBackPress = useCallback(() => {
    router.back();
  }, []);

  const renderKanjiItem = useCallback(
    ({ item }: { item: KanjiGridItem }) => {
      return (
        <KanjiGridCell
          item={item}
          cellSize={cellSize}
          isDark={theme.isDark}
          onPressSubject={handlePressSubject}
        />
      );
    },
    [cellSize, theme.isDark, handlePressSubject]
  );

  const keyExtractor = useCallback((item: KanjiGridItem) => {
    return `kanji-grid-${item.subjectId}`;
  }, []);

  const listHeader = useMemo(() => {
    const summaryColor = theme.isDark ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.7)";

    return (
      <View style={styles.summaryHeader}>
        <View style={styles.summaryMainRow}>
          <GlassButton
            iconName="arrow-back"
            onPress={handleBackPress}
            iconColor={theme.textColor}
            variant="light"
            style={styles.summaryBackButton}
          />
          <View style={styles.summaryTextGroup}>
            <Text style={[styles.summaryTitle, { color: theme.textColor }]}>Kanji Grid</Text>
            <Text style={[styles.summaryMeta, { color: theme.textSecondary }]}>
              {stats.started}/{stats.total} started · Guru+ {stats.guruPlus} · Burned {stats.burned}
            </Text>
          </View>
          <View style={styles.summaryBackSpacer} />
        </View>

        <Text style={[styles.legendTitle, { color: summaryColor }]}>Key</Text>
        <View style={styles.legendRow}>
          <Text style={[styles.legendLabel, { color: summaryColor }]}>Weak</Text>
          <View style={styles.legendScale}>
            {Array.from({ length: 9 }, (_, idx) => {
              const stage = idx + 1;
              return (
                <View
                  key={`legend-stage-${stage}`}
                  style={[
                    styles.legendScaleCell,
                    { backgroundColor: getHeatColorForStage(stage, theme.isDark) },
                  ]}
                />
              );
            })}
          </View>
          <Text style={[styles.legendLabel, { color: summaryColor }]}>Strong</Text>
        </View>
      </View>
    );
  }, [handleBackPress, stats.burned, stats.guruPlus, stats.started, stats.total, theme]);

  const isKanjiDataReady = Boolean(kanjiCatalog);
  const shouldShowSpinner = !isKanjiDataReady || (isLoading && kanjiItems.length === 0);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundColor, paddingTop: insets.top + 4 },
      ]}
    >
      {shouldShowSpinner ? (
        <>
          <View style={styles.topStateBackButtonRow}>
            <GlassButton
              iconName="arrow-back"
              onPress={handleBackPress}
              iconColor={theme.textColor}
              variant="light"
              style={styles.summaryBackButton}
            />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.secondary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading kanji heatmap...
            </Text>
          </View>
        </>
      ) : kanjiItems.length === 0 ? (
        <>
          <View style={styles.topStateBackButtonRow}>
            <GlassButton
              iconName="arrow-back"
              onPress={handleBackPress}
              iconColor={theme.textColor}
              variant="light"
              style={styles.summaryBackButton}
            />
          </View>
          <View style={styles.loadingContainer}>
            <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
              No kanji data available yet
            </Text>
            <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
              Refresh your dashboard once to cache all kanji subjects.
            </Text>
          </View>
        </>
      ) : (
        <FlashList
          data={kanjiItems}
          renderItem={renderKanjiItem}
          numColumns={numColumns}
          key={`kanji-grid-${numColumns}`}
          keyExtractor={keyExtractor}
          getItemType={() => "kanji"}
          removeClippedSubviews={true}
          drawDistance={GRID_DRAW_DISTANCE}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.gridContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topStateBackButtonRow: {
    paddingHorizontal: GRID_SIDE_PADDING,
    marginBottom: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDescription: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
  },
  gridContent: {
    paddingTop: 0,
    paddingHorizontal: GRID_SIDE_PADDING,
    paddingBottom: 32,
  },
  summaryHeader: {
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  summaryMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  summaryBackButton: {
    width: 40,
    height: 40,
  },
  summaryBackSpacer: {
    width: 40,
    height: 40,
  },
  summaryTextGroup: {
    flex: 1,
    alignItems: "center",
    paddingTop: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  legendTitle: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  legendRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  legendScale: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 5,
    overflow: "hidden",
  },
  legendScaleCell: {
    width: 18,
    height: 10,
  },
  summaryStats: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
  },
  summaryMeta: {
    marginTop: 3,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  kanjiCell: {
    borderRadius: 3,
    margin: GRID_GAP / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  kanjiCellText: {
    fontWeight: "700",
  },
});
