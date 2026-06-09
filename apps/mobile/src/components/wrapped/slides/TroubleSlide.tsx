import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { WrappedSubjectStat } from "../../../hooks/useWrappedData";
import { getSubjectTypeColor } from "../../../utils/subjectColors";

interface TroubleSlideProps {
  mostMissed: WrappedSubjectStat[];
}

function TroubleItem({
  item,
  index,
  delay,
}: {
  item: WrappedSubjectStat;
  index: number;
  delay: number;
}) {
  const translateX = useSharedValue(-40);
  const opacity = useSharedValue(0);

  const typeColor =
    item.subjectType === "radical" ||
    item.subjectType === "kanji" ||
    item.subjectType === "vocabulary" ||
    item.subjectType === "kana_vocabulary"
      ? getSubjectTypeColor(item.subjectType)
      : getSubjectTypeColor("vocabulary");

  // Characters longer than 2 need a wider badge
  const isLongText = item.characters.length > 2;

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }));
    translateX.value = withDelay(delay, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.troubleItem, style]}>
      <View style={styles.rankContainer}>
        <Text style={styles.rankText}>{index + 1}</Text>
      </View>

      <View
        style={[
          styles.characterBadge,
          { backgroundColor: typeColor },
          isLongText && styles.characterBadgeWide,
        ]}
      >
        <Text
          style={[
            styles.characterText,
            isLongText && styles.characterTextSmall,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {item.characters}
        </Text>
      </View>

      <View style={styles.itemDetails}>
        <Text style={styles.meaningText} numberOfLines={1}>
          {item.primaryMeaning}
        </Text>
        <Text style={styles.mistakeCount}>
          {item.totalIncorrect} mistake{item.totalIncorrect !== 1 ? "s" : ""}
        </Text>
      </View>

      <View style={styles.accuracyBadge}>
        <Text style={styles.accuracyText}>
          {item.percentageCorrect}%
        </Text>
      </View>
    </Animated.View>
  );
}

export function TroubleSlide({ mostMissed }: TroubleSlideProps) {
  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(-12);

  useEffect(() => {
    headerOpacity.value = withDelay(200, withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }));
    headerTranslateY.value = withDelay(200, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  if (mostMissed.length === 0) {
    return (
      <LinearGradient
        colors={["#1a0a0a", "#4a1525", "#7f1d1d"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.content}>
          <Ionicons name="checkmark-circle" size={48} color="#4ade80" style={styles.headerIcon} />
          <Text style={styles.headerText}>No trouble items!</Text>
          <Text style={styles.perfectText}>
            You aced every single item. Incredible!
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#1a0a0a", "#4a1525", "#7f1d1d"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.headerGroup, headerStyle]}>
          <Ionicons name="alert-circle" size={36} color="#f87171" style={styles.headerIcon} />
          <Text style={styles.headerText}>These gave you trouble</Text>
        </Animated.View>

        <View style={styles.itemsList}>
          {mostMissed.map((item, index) => (
            <TroubleItem
              key={item.subjectId}
              item={item}
              index={index}
              delay={500 + index * 200}
            />
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 24,
    width: "100%",
  },
  headerGroup: {
    alignItems: "center",
    marginBottom: 28,
  },
  headerIcon: {
    marginBottom: 8,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  perfectText: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 16,
  },
  itemsList: {
    width: "100%",
    gap: 10,
  },
  troubleItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  rankContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  rankText: {
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
  },
  characterBadge: {
    minWidth: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    paddingHorizontal: 6,
  },
  characterBadgeWide: {
    paddingHorizontal: 10,
  },
  characterText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  characterTextSmall: {
    fontSize: 15,
  },
  itemDetails: {
    flex: 1,
    marginRight: 8,
  },
  meaningText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  mistakeCount: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  accuracyBadge: {
    backgroundColor: "rgba(255,100,100,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  accuracyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fca5a5",
  },
});
