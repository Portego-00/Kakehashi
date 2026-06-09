import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getBestContrastTextColor } from "../../utils/subjectColors";

type BunproStudyQueueCardProps = {
  panelBackground: string;
  panelBorder: string;
  accent: string;
  accentSoft: string;
  softText: string;
  learnGoal: number;
  learnedTodayCount: number;
  nextLessonBatchCount: number;
  remainingLessons: number;
  availableReviews: number;
  dueTomorrow: number;
  dueNowGrammar: number;
  dueNowVocab: number;
  onPressLearn?: () => void;
  onPressReviewAll?: () => void;
  onPressReviewGrammar?: () => void;
  onPressReviewVocab?: () => void;
};

function LessonProgressSegments({
  total,
  current,
  activeColor,
  inactiveColor,
}: {
  total: number;
  current: number;
  activeColor: string;
  inactiveColor: string;
}) {
  if (total <= 0) {
    return null;
  }

  const segmentCount = Math.max(1, Math.min(total, 12));
  const filledSegments = Math.floor((Math.max(0, current) / Math.max(1, total)) * segmentCount);

  return (
    <View style={styles.lessonProgressRow}>
      {Array.from({ length: segmentCount }).map((_, index) => (
        <View
          key={`lesson-progress-${index}`}
          style={[
            styles.lessonProgressSegment,
            { backgroundColor: index < filledSegments ? activeColor : inactiveColor },
          ]}
        />
      ))}
    </View>
  );
}

export default function BunproStudyQueueCard({
  panelBackground,
  panelBorder,
  accent,
  accentSoft,
  softText,
  learnGoal,
  learnedTodayCount,
  nextLessonBatchCount,
  remainingLessons,
  availableReviews,
  dueTomorrow,
  dueNowGrammar,
  dueNowVocab,
  onPressLearn,
  onPressReviewAll,
  onPressReviewGrammar,
  onPressReviewVocab,
}: BunproStudyQueueCardProps) {
  const [isReviewExpanded, setIsReviewExpanded] = useState(false);

  const learnProgressLabel =
    learnGoal > 0 ? `${learnedTodayCount}/${learnGoal}` : learnedTodayCount.toLocaleString();
  const canStartLessons = Boolean(onPressLearn) && remainingLessons > 0;
  const learnSubtitle =
    remainingLessons > 0
      ? `Next batch: ${nextLessonBatchCount.toLocaleString()}`
      : learnGoal > 0
        ? "Daily Goal Complete"
        : "No Lessons Queued";
  const dueNowTotal = useMemo(
    () => dueNowGrammar + dueNowVocab,
    [dueNowGrammar, dueNowVocab]
  );
  const learnTextColor = getBestContrastTextColor(accentSoft, "#18191d", "#ffffff");
  const reviewTextColor = getBestContrastTextColor(accent, "#17181d", "#ffffff");
  const learnSubtitleColor = learnTextColor === "#ffffff" ? "rgba(255,255,255,0.9)" : "#2a2b31";
  const reviewSubtitleColor = reviewTextColor === "#ffffff" ? "rgba(255,255,255,0.9)" : "#1f1f25";
  const learnDividerColor =
    learnTextColor === "#ffffff" ? "rgba(255,255,255,0.24)" : "rgba(22, 24, 30, 0.2)";
  const learnProgressInactiveColor =
    learnTextColor === "#ffffff" ? "rgba(255,255,255,0.28)" : "rgba(22, 24, 30, 0.18)";
  const reviewDividerColor =
    reviewTextColor === "#ffffff" ? "rgba(255,255,255,0.26)" : "rgba(22, 24, 30, 0.28)";

  return (
    <View
      style={[
        styles.studyQueueCard,
        { backgroundColor: panelBackground, borderColor: panelBorder },
      ]}
    >
      <View style={[styles.learnPanel, { backgroundColor: accentSoft }]}>
        <TouchableOpacity
          activeOpacity={0.84}
          style={styles.learnMainAction}
          onPress={onPressLearn}
          disabled={!canStartLessons}
        >
          <View style={styles.studyQueueCopy}>
            <Text style={[styles.studyQueueTitle, { color: learnTextColor }]}>Learn</Text>
            <Text style={[styles.studyQueueSubtitle, { color: learnSubtitleColor }]}>
              {learnSubtitle}
            </Text>
            <LessonProgressSegments
              total={learnGoal}
              current={learnedTodayCount}
              activeColor={learnTextColor}
              inactiveColor={learnProgressInactiveColor}
            />
          </View>
          <Text style={[styles.studyQueueCount, { color: learnTextColor }]}>{learnProgressLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.learnOpenButton, { borderLeftColor: learnDividerColor }]}
          onPress={onPressLearn}
          disabled={!canStartLessons}
        >
          <Ionicons name="chevron-forward" size={20} color={learnTextColor} />
        </TouchableOpacity>
      </View>

      <View style={[styles.reviewPanel, { backgroundColor: accent }]}>
        <View style={styles.reviewTopRow}>
          <TouchableOpacity
            activeOpacity={0.82}
            style={styles.reviewMainAction}
            onPress={onPressReviewAll}
            disabled={!onPressReviewAll}
          >
            <View style={styles.studyQueueCopy}>
              <Text style={[styles.studyQueueTitle, { color: reviewTextColor }]}>Review</Text>
              <Text style={[styles.studyQueueSubtitle, { color: reviewSubtitleColor }]}>
                Grammar & Vocab
              </Text>
            </View>
            <View style={styles.reviewCountPill}>
              <Text style={[styles.reviewCountText, { color: accent }]}>
                {availableReviews.toLocaleString()}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.reviewExpandButton, { borderLeftColor: reviewDividerColor }]}
            onPress={() => {
              setIsReviewExpanded((previousValue) => !previousValue);
            }}
          >
            <Ionicons
              name={isReviewExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={reviewTextColor}
            />
          </TouchableOpacity>
        </View>

        {isReviewExpanded ? (
          <View style={[styles.breakdownList, { borderTopColor: reviewDividerColor }]}>
            <TouchableOpacity
              activeOpacity={0.84}
              style={[styles.breakdownRow, { borderBottomColor: reviewDividerColor }]}
              onPress={onPressReviewGrammar}
              disabled={!onPressReviewGrammar}
            >
              <View style={styles.studyQueueCopy}>
                <Text style={[styles.studyQueueTitle, { color: reviewTextColor }]}>Review</Text>
                <Text style={[styles.studyQueueSubtitle, { color: reviewSubtitleColor }]}>Grammar</Text>
              </View>
              <View style={styles.reviewCountPill}>
                <Text style={[styles.reviewCountText, { color: accent }]}>
                  {dueNowGrammar.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.84}
              style={[styles.breakdownRow, styles.breakdownRowLast]}
              onPress={onPressReviewVocab}
              disabled={!onPressReviewVocab}
            >
              <View style={styles.studyQueueCopy}>
                <Text style={[styles.studyQueueTitle, { color: reviewTextColor }]}>Review</Text>
                <Text style={[styles.studyQueueSubtitle, { color: reviewSubtitleColor }]}>Vocab</Text>
              </View>
              <View style={styles.reviewCountPill}>
                <Text style={[styles.reviewCountText, { color: accent }]}>
                  {dueNowVocab.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <Text style={[styles.studyQueueMeta, { color: softText }]}>
        Due now: {dueNowTotal.toLocaleString()} · Due tomorrow: {dueTomorrow.toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  studyQueueCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  learnPanel: {
    borderRadius: 16,
    flexDirection: "row",
    overflow: "hidden",
    minHeight: 66,
  },
  learnMainAction: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  learnOpenButton: {
    width: 70,
    borderLeftWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewPanel: {
    borderRadius: 16,
    overflow: "hidden",
  },
  reviewTopRow: {
    flexDirection: "row",
    minHeight: 78,
  },
  reviewMainAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  reviewExpandButton: {
    width: 70,
    borderLeftWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownList: {
    borderTopWidth: 1,
  },
  breakdownRow: {
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  breakdownRowLast: {
    borderBottomWidth: 0,
  },
  studyQueueCopy: {
    flex: 1,
    paddingRight: 10,
    gap: 3,
  },
  studyQueueTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#18191d",
  },
  studyQueueSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2a2b31",
  },
  lessonProgressRow: {
    flexDirection: "row",
    gap: 3,
    maxWidth: "100%",
  },
  lessonProgressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 999,
  },
  studyQueueCount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#18191d",
    flexShrink: 0,
  },
  reviewCountPill: {
    minWidth: 74,
    borderRadius: 20,
    backgroundColor: "#15161a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reviewCountText: {
    fontSize: 18,
    fontWeight: "700",
  },
  studyQueueMeta: {
    fontSize: 12,
    textAlign: "center",
  },
});
