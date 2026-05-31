import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  type LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { fontStyles } from "../utils/fonts";
import {
  getVerbInflectionLabelsForMatch,
  getItemColor,
  isWaniKaniBackedMatch,
  KanjiMatch,
  VocabularyMatch,
} from "../utils/textHighlighting";
import { useTheme } from "../utils/theme";

interface VocabularyTooltipProps {
  selectedItem: VocabularyMatch | KanjiMatch | null;
  position: { x: number; y: number; width?: number } | null;
  opacity: SharedValue<number>;
  selectedSurfaceText?: string | null;
  interactionMode?: "press" | "hover";
  headerColorOverride?: string;
  useModal?: boolean;
  rotationDegrees?: number;
  onClose: () => void;
  onViewDetails: () => void;
  onViewSubject?: (subjectId: number) => void;
  onTooltipLayout?: (height: number) => void;
}

export const VocabularyTooltip: React.FC<VocabularyTooltipProps> = ({
  selectedItem,
  position,
  opacity,
  selectedSurfaceText = null,
  interactionMode = "press",
  headerColorOverride,
  useModal = true,
  rotationDegrees = 0,
  onClose,
  onViewDetails,
  onViewSubject,
  onTooltipLayout,
}) => {
  const { theme } = useTheme();
  const isHoverPreview = interactionMode === "hover";

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  if (!selectedItem || !position) return null;

  const color = headerColorOverride ?? getItemColor(selectedItem.type);
  const isWaniKaniBacked = isWaniKaniBackedMatch(selectedItem);
  const primaryReading =
    selectedItem.readings?.find((r) => r.primary)?.reading ||
    selectedItem.readings?.[0]?.reading ||
    "";
  const inflectionLabels = selectedSurfaceText
    ? getVerbInflectionLabelsForMatch(selectedItem, selectedSurfaceText)
    : [];
  const jpdbKanjiComposition =
    !isWaniKaniBacked &&
    (selectedItem.type === "vocabulary" ||
      selectedItem.type === "kana_vocabulary")
      ? (selectedItem as VocabularyMatch).jpdbKanjiComposition ?? []
      : [];
  const handleViewKanjiSubject = (subjectId: number) => {
    onClose();
    if (onViewSubject) {
      onViewSubject(subjectId);
      return;
    }
    router.push(`/subject/${subjectId}`);
  };

  const tooltipBody = (
    <View
      style={styles.tooltipOverlay}
      pointerEvents={isHoverPreview ? "none" : "box-none"}
    >
      {!isHoverPreview ? (
        <Pressable style={styles.tooltipBackdrop} onPress={onClose} />
      ) : null}
      <Animated.View
        pointerEvents={isHoverPreview ? "none" : "auto"}
        onLayout={(event: LayoutChangeEvent) => {
          onTooltipLayout?.(event.nativeEvent.layout.height);
        }}
        style={[
          styles.tooltipPopup,
          {
            backgroundColor: theme.cardBackground,
            top: position.y,
            left: position.x,
            transform: rotationDegrees
              ? [{ rotate: `${rotationDegrees}deg` }]
              : undefined,
          },
          animatedStyle,
        ]}
      >
        <View
          style={[styles.tooltipPopupHeader, { backgroundColor: color }]}
        >
          <Text
            style={[
              styles.tooltipPopupCharacters,
              fontStyles.japaneseText,
            ]}
          >
            {selectedItem.characters}
          </Text>
          <View style={styles.tooltipLevelBadge}>
            <Text style={styles.tooltipLevelBadgeText}>
              {isWaniKaniBacked ? `Lv ${selectedItem.level}` : "JPDB"}
            </Text>
          </View>
        </View>

        <View style={styles.tooltipPopupContent}>
          {primaryReading && (
            <View style={styles.tooltipPopupRow}>
              <Text
                style={[
                  styles.tooltipPopupLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Reading:
              </Text>
              <Text
                style={[
                  styles.tooltipPopupValue,
                  { color: theme.textColor },
                  fontStyles.japaneseText,
                ]}
              >
                {primaryReading}
              </Text>
            </View>
          )}

          <View style={styles.tooltipPopupRow}>
            <Text
              style={[
                styles.tooltipPopupLabel,
                { color: theme.textSecondary },
              ]}
            >
              Meaning:
            </Text>
            <Text
              style={[
                styles.tooltipPopupValue,
                { color: theme.textColor },
              ]}
            >
              {selectedItem.meaning}
            </Text>
          </View>

          {jpdbKanjiComposition.length > 0 ? (
            <View style={styles.tooltipPopupRow}>
              <Text
                style={[
                  styles.tooltipPopupLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Kanji:
              </Text>
              <View style={styles.tooltipKanjiCompositionWrap}>
                {jpdbKanjiComposition.map((kanjiEntry) => (
                  <TouchableOpacity
                    key={`jpdb-kanji-${kanjiEntry.id}`}
                    style={[
                      styles.tooltipKanjiChip,
                      { borderColor: theme.border },
                    ]}
                    onPress={() => handleViewKanjiSubject(kanjiEntry.id)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.tooltipKanjiChipText,
                        { color: theme.textColor },
                      ]}
                    >
                      {kanjiEntry.characters}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {inflectionLabels.length > 0 && (
            <View style={styles.tooltipPopupRow}>
              <Text
                style={[
                  styles.tooltipPopupLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Form:
              </Text>
              <Text
                style={[
                  styles.tooltipPopupValue,
                  { color: theme.textColor },
                ]}
              >
                {inflectionLabels.join(", ")}
              </Text>
            </View>
          )}

          {isWaniKaniBacked ? (
            <TouchableOpacity
              style={[
                styles.tooltipPopupButton,
                { backgroundColor: color },
              ]}
              onPress={onViewDetails}
              activeOpacity={0.7}
            >
              <Text style={styles.tooltipPopupButtonText}>
                view details
              </Text>
              <Ionicons name="arrow-forward" size={14} color="white" />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );

  if (!useModal) {
    return tooltipBody;
  }

  return (
    <Modal
      visible={!!selectedItem && !!position}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {tooltipBody}
    </Modal>
  );
};

const styles = StyleSheet.create({
  tooltipOverlay: {
    ...StyleSheet.absoluteFill,
  },
  tooltipBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  tooltipPopup: {
    position: "absolute",
    width: 280,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  tooltipPopupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tooltipPopupCharacters: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    flex: 1,
  },
  tooltipLevelBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  tooltipLevelBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  tooltipPopupContent: {
    padding: 16,
    gap: 10,
  },
  tooltipPopupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tooltipPopupLabel: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 60,
    marginTop: 2, // Align with text
  },
  tooltipPopupValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  tooltipKanjiCompositionWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tooltipKanjiChip: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tooltipKanjiChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  tooltipPopupButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 6,
    gap: 6,
  },
  tooltipPopupButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "lowercase",
  },
  tooltipPopupInflectionNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: -2,
  },
});
