import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import {
  LESSON_ORDER_OPTIONS,
  normalizeLessonTypeOrder,
  sortLessonItemsForQueue,
  type LessonTypeOrderSetting,
  type OrderableLessonItem,
} from "../../src/utils/lessonOrdering";
import { useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

const FALLBACK_USER_LEVEL = 10;
const MAX_PREVIEW_ITEMS = 8;

type PreviewSubjectType =
  | "radical"
  | "kanji"
  | "vocabulary"
  | "kana_vocabulary";

interface PreviewItem extends OrderableLessonItem {
  id: number;
  label: string;
  subjectId: number;
  subject: {
    id: number;
    object: PreviewSubjectType;
    data: {
      level: number;
    };
  };
  availableAt: string;
}

const FALLBACK_PREVIEW_ITEMS: PreviewItem[] = [
  {
    id: 201,
    subjectId: 1001,
    label: "Water radical",
    subject: { id: 1001, object: "radical", data: { level: 10 } },
    availableAt: "2026-03-05T07:00:00.000Z",
  },
  {
    id: 202,
    subjectId: 1002,
    label: "Language",
    subject: { id: 1002, object: "kanji", data: { level: 10 } },
    availableAt: "2026-03-05T08:00:00.000Z",
  },
  {
    id: 203,
    subjectId: 1003,
    label: "School",
    subject: { id: 1003, object: "vocabulary", data: { level: 8 } },
    availableAt: "2026-03-04T02:00:00.000Z",
  },
  {
    id: 204,
    subjectId: 1004,
    label: "Fire",
    subject: { id: 1004, object: "kanji", data: { level: 7 } },
    availableAt: "2026-03-05T10:00:00.000Z",
  },
  {
    id: 205,
    subjectId: 1005,
    label: "Person radical",
    subject: { id: 1005, object: "radical", data: { level: 6 } },
    availableAt: "2026-03-04T18:00:00.000Z",
  },
  {
    id: 206,
    subjectId: 1006,
    label: "Kana vocab",
    subject: { id: 1006, object: "kana_vocabulary", data: { level: 10 } },
    availableAt: "2026-03-05T11:00:00.000Z",
  },
];

const PREVIEW_TRANSITION = LinearTransition.duration(220).easing(
  Easing.inOut(Easing.cubic)
);

interface LessonTypeOption {
  value: LessonTypeOrderSetting;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface TypeOrderRow {
  key: LessonTypeOrderSetting;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const LESSON_TYPE_OPTIONS: readonly LessonTypeOption[] = [
  {
    value: "radical",
    label: "Radicals",
    description: "Building blocks and components",
    icon: "shapes-outline",
  },
  {
    value: "kanji",
    label: "Kanji",
    description: "Characters with meaning and readings",
    icon: "book-outline",
  },
  {
    value: "vocabulary",
    label: "Vocabulary",
    description: "Words (including kana-only vocabulary)",
    icon: "chatbox-ellipses-outline",
  },
];

function normalizeSubjectType(value: unknown): PreviewSubjectType | null {
  if (
    value === "radical" ||
    value === "kanji" ||
    value === "vocabulary" ||
    value === "kana_vocabulary"
  ) {
    return value;
  }
  return null;
}

function withAlpha(color: string, alphaHex: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `${color}${alphaHex}`;
  }
  return color;
}

function getPreviewLabel(subject: any): string {
  const characters = subject?.data?.characters;
  if (typeof characters === "string" && characters.trim().length > 0) {
    return characters.trim();
  }

  const meanings = Array.isArray(subject?.data?.meanings)
    ? subject.data.meanings
    : [];
  const primaryMeaning =
    meanings.find((meaning: any) => meaning?.primary)?.meaning ??
    meanings[0]?.meaning;

  if (typeof primaryMeaning === "string" && primaryMeaning.trim().length > 0) {
    return primaryMeaning.trim();
  }

  return `Item ${subject?.id ?? ""}`.trim();
}

function getSubjectTypeLabel(subjectType: PreviewSubjectType): string {
  switch (subjectType) {
    case "radical":
      return "Radical";
    case "kanji":
      return "Kanji";
    case "vocabulary":
      return "Vocabulary";
    case "kana_vocabulary":
      return "Kana Vocab";
    default:
      return "Item";
  }
}

function formatAvailableAge(availableAt: string, nowMs: number): string {
  const availableMs = Date.parse(availableAt);
  if (!Number.isFinite(availableMs)) return "Unknown";

  const deltaMs = Math.max(0, nowMs - availableMs);
  const hours = Math.round(deltaMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function isCriticalPreviewItem(item: PreviewItem, userLevel: number): boolean {
  if (item.subject.data.level !== userLevel) return false;
  return item.subject.object === "radical" || item.subject.object === "kanji";
}

function sameTypeOrder(
  left: LessonTypeOrderSetting[] | undefined,
  right: LessonTypeOrderSetting[]
): boolean {
  if (!Array.isArray(left)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export default function LessonOrderSettings() {
  const { theme } = useTheme();
  const { dashboardData } = useDashboardData();
  const {
    lessonOrder,
    setLessonOrder,
    lessonBatchSize,
    lessonTypeOrderEnabled,
    setLessonTypeOrderEnabled,
    lessonTypeOrder,
    setLessonTypeOrder,
    interleaveLessonTypesEnabled,
    setInterleaveLessonTypesEnabled,
    minimumRadicalKanjiPerBatchEnabled,
    setMinimumRadicalKanjiPerBatchEnabled,
    prioritizeCriticalItems,
    setPrioritizeCriticalItems,
  } = useSettingsStore();

  const userLevel = dashboardData.currentLevel || FALLBACK_USER_LEVEL;
  const normalizedTypeOrder = useMemo(
    () => normalizeLessonTypeOrder(lessonTypeOrder),
    [lessonTypeOrder]
  );

  useEffect(() => {
    if (!sameTypeOrder(lessonTypeOrder, normalizedTypeOrder)) {
      setLessonTypeOrder(normalizedTypeOrder);
    }
  }, [normalizedTypeOrder, lessonTypeOrder, setLessonTypeOrder]);

  const typeOrderRows = useMemo<TypeOrderRow[]>(
    () =>
      normalizedTypeOrder.map((value) => {
        const option = LESSON_TYPE_OPTIONS.find((item) => item.value === value)!;
        return {
          key: option.value,
          label: option.label,
          description: option.description,
          icon: option.icon,
        };
      }),
    [normalizedTypeOrder]
  );

  const realPreviewItems = useMemo(() => {
    const subjects = Array.isArray(dashboardData.subjects)
      ? dashboardData.subjects
      : [];
    const assignments = Array.isArray(dashboardData.assignments)
      ? dashboardData.assignments
      : [];

    if (subjects.length === 0 || assignments.length === 0) {
      return [] as PreviewItem[];
    }

    const subjectById = new Map<number, any>();
    subjects.forEach((subject: any) => {
      if (typeof subject?.id === "number") {
        subjectById.set(subject.id, subject);
      }
    });

    const previewItems: PreviewItem[] = [];

    assignments.forEach((assignment: any) => {
      const data = assignment?.data;
      if (!data || data.hidden) return;
      if (!data.unlocked_at || data.started_at) return;
      if (typeof data.subject_id !== "number") return;
      if (typeof assignment?.id !== "number") return;

      const subject = subjectById.get(data.subject_id);
      const subjectType = normalizeSubjectType(subject?.object);
      if (!subject || !subjectType) return;

      const level =
        typeof subject?.data?.level === "number" ? subject.data.level : 1;
      const label = getPreviewLabel(subject);
      const availableAt: string =
        typeof data.available_at === "string" && data.available_at
          ? data.available_at
          : data.unlocked_at;

      previewItems.push({
        id: assignment.id,
        subjectId: data.subject_id,
        label,
        subject: {
          id: subject.id,
          object: subjectType,
          data: { level },
        },
        availableAt,
      });
    });

    return previewItems.slice(0, MAX_PREVIEW_ITEMS);
  }, [dashboardData.assignments, dashboardData.subjects]);

  const previewUsesSampleItems = realPreviewItems.length === 0;
  const previewItems = previewUsesSampleItems
    ? FALLBACK_PREVIEW_ITEMS
    : realPreviewItems;

  const previewNowMs = Date.now();
  const orderedPreviewItems = sortLessonItemsForQueue(previewItems, {
    lessonOrder,
    lessonTypeOrderEnabled,
    lessonTypeOrder: normalizedTypeOrder,
    interleaveLessonTypesEnabled,
    minimumRadicalKanjiPerBatchEnabled,
    lessonBatchSize,
    prioritizeCriticalItems,
    userLevel,
    randomFn: () => 0.42,
  });

  const renderTypeOrderRow = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<TypeOrderRow>) => (
    <TouchableOpacity
      style={[
        styles.typeOrderRow,
        {
          borderColor: theme.border,
          backgroundColor: isActive ? theme.cardBackground : theme.backgroundColor,
          opacity: isActive ? 0.92 : 1,
        },
      ]}
      onLongPress={drag}
      delayLongPress={120}
      activeOpacity={0.85}
    >
      <View style={styles.typeOrderContent}>
        <View
          style={[
            styles.typeOrderIconWrap,
            { backgroundColor: withAlpha(theme.primary, "14") },
          ]}
        >
          <Ionicons name={item.icon} size={16} color={theme.primary} />
        </View>
        <View style={styles.typeOrderTextWrap}>
          <Text style={[styles.typeOrderTitle, { color: theme.textColor }]}>
            {item.label}
          </Text>
          <Text
            style={[styles.typeOrderDescription, { color: theme.textSecondary }]}
          >
            {item.description}
          </Text>
        </View>
      </View>
      <Ionicons name="reorder-three" size={18} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          { backgroundColor: theme.headerBackground },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.headerText }]}>Lesson Order</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Choose Ordering
          </Text>

          {LESSON_ORDER_OPTIONS.map((option, index) => {
            const isSelected = lessonOrder === option.value;
            const isLast = index === LESSON_ORDER_OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionRow,
                  {
                    borderBottomColor: isLast ? "transparent" : theme.border,
                  },
                ]}
                onPress={() => setLessonOrder(option.value)}
                activeOpacity={0.75}
              >
                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionTitle, { color: theme.textColor }]}>
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {option.description}
                  </Text>
                </View>
                <Ionicons
                  name={isSelected ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={isSelected ? theme.primary : theme.textSecondary}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={[styles.optionRow, { borderBottomColor: theme.border }]}>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: theme.textColor }]}>
                Group by item type
              </Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Batch radicals, kanji, and vocabulary lessons in a custom order.
              </Text>
            </View>
            <Switch
              value={lessonTypeOrderEnabled}
              onValueChange={(enabled) => {
                setLessonTypeOrderEnabled(enabled);
                if (enabled) {
                  setInterleaveLessonTypesEnabled(false);
                }
              }}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {lessonTypeOrderEnabled ? (
            <View style={styles.typeOrderWrap}>
              <DraggableFlatList
                data={typeOrderRows}
                keyExtractor={(item) => item.key}
                onDragEnd={({ data }) => {
                  setLessonTypeOrder(data.map((row) => row.key));
                }}
                renderItem={renderTypeOrderRow}
                scrollEnabled={false}
                containerStyle={styles.typeOrderList}
                ItemSeparatorComponent={() => <View style={styles.typeOrderSpacer} />}
              />
            </View>
          ) : (
            <></>
          )}

          <View
            style={[
              styles.optionRow,
              { borderBottomColor: theme.border },
            ]}
          >
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: theme.textColor }]}>
                Interleave item types
              </Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Proportionally mix radicals, kanji, and vocabulary so each batch stays varied (WaniKani-style).
              </Text>
            </View>
            <Switch
              value={interleaveLessonTypesEnabled}
              onValueChange={(enabled) => {
                setInterleaveLessonTypesEnabled(enabled);
                if (enabled) {
                  setLessonTypeOrderEnabled(false);
                }
              }}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[
              styles.optionRow,
              { borderBottomColor: "transparent" },
            ]}
          >
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: theme.textColor }]}>
                Minimum radicals and kanji
              </Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Pull at least one radical and one kanji into each lesson batch when those item types are available.
              </Text>
            </View>
            <Switch
              value={minimumRadicalKanjiPerBatchEnabled}
              onValueChange={setMinimumRadicalKanjiPerBatchEnabled}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={[styles.optionRow, { borderBottomColor: "transparent" }]}>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: theme.textColor }]}>
                Prioritize critical items
              </Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Put current-level radicals and kanji at the top of the queue. (Applies to reviews too.)
              </Text>
            </View>
            <Switch
              value={prioritizeCriticalItems}
              onValueChange={setPrioritizeCriticalItems}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Example Preview
          </Text>
          {previewUsesSampleItems ? (
            <Text style={[styles.previewSubtitle, { color: theme.textSecondary }]}>
              No available lessons found, so this preview uses sample items.
            </Text>
          ) : (
            <Text style={[styles.previewSubtitle, { color: theme.textSecondary }]}>
              Preview built from your currently available lessons.
            </Text>
          )}
          <View style={styles.previewList}>
            {orderedPreviewItems.map((item, index) => {
              const isCritical = isCriticalPreviewItem(item, userLevel);

              return (
                <Animated.View
                  key={item.id}
                  layout={PREVIEW_TRANSITION}
                  style={[
                    styles.previewRow,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundColor,
                    },
                  ]}
                >
                  <View style={[styles.rankBadge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>

                  <View style={styles.previewMain}>
                    <View style={styles.previewTitleRow}>
                      <Text
                        style={[styles.previewItemLabel, { color: theme.textColor }]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      <View
                        style={[
                          styles.subjectChip,
                          {
                            borderColor: theme.border,
                            backgroundColor: theme.cardBackground,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.subjectChipText, { color: theme.textSecondary }]}
                        >
                          {getSubjectTypeLabel(item.subject.object)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.previewInfoRow}>
                      <View
                        style={[
                          styles.levelChip,
                          {
                            borderColor: theme.primary,
                            backgroundColor: withAlpha(theme.primary, "1A"),
                          },
                        ]}
                      >
                        <Text style={[styles.levelChipText, { color: theme.primary }]}>
                          Level {item.subject.data.level}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.waitChip,
                          {
                            borderColor: theme.border,
                            backgroundColor: theme.cardBackground,
                          },
                        ]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color={theme.textSecondary}
                        />
                        <Text style={[styles.waitChipText, { color: theme.textSecondary }]}>
                          {formatAvailableAge(item.availableAt, previewNowMs)}
                        </Text>
                      </View>

                      {isCritical && prioritizeCriticalItems ? (
                        <View
                          style={[
                            styles.criticalChip,
                            {
                              borderColor: theme.primary,
                              backgroundColor: withAlpha(theme.primary, "14"),
                            },
                          ]}
                        >
                          <Text style={[styles.criticalChipText, { color: theme.primary }]}>
                            Critical
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
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
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 28,
    gap: 16,
  },
  section: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  typeOrderWrap: {
    paddingBottom: 12,
    paddingTop: 12,
  },
  typeOrderList: {
    paddingHorizontal: 12,
  },
  typeOrderSpacer: {
    height: 8,
  },
  typeOrderRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeOrderContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  typeOrderIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  typeOrderTextWrap: {
    flex: 1,
  },
  typeOrderTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  typeOrderDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  previewSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  previewList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  previewRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  rankText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  previewMain: {
    flex: 1,
    marginLeft: 10,
  },
  previewTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  previewItemLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  subjectChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  subjectChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  previewInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  levelChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  waitChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  waitChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  criticalChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  criticalChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
