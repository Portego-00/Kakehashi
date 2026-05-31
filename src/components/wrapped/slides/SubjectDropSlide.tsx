import * as Haptics from "@/src/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo } from "react";
import { Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import { WrappedLevelSubject } from "../../../hooks/useWrappedData";
import { pickBestImage, useRemoteSvg } from "../../../utils/radicalSvg";
import { getSubjectTypeColor } from "../../../utils/subjectColors";

const BOTTOM_PADDING = 140; // space for footer text
const SIDE_PADDING = 16;

interface SubjectDropSlideProps {
  levelUpSubjects: WrappedLevelSubject[];
  level: number;
}

/* ── SVG content for an image-only radical ── */
function RadicalSvgContent({
  characterImages,
  iconSize,
}: {
  characterImages?: WrappedLevelSubject["characterImages"];
  iconSize: number;
}) {
  const bestImg = pickBestImage(characterImages);
  const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
  const pngUrl = bestImg?.type === "png" ? bestImg.url : null;
  const svgXml = useRemoteSvg(svgUrl, "#ffffff");

  if (svgXml) {
    return <SvgXml xml={svgXml} width={iconSize} height={iconSize} />;
  }
  if (pngUrl) {
    return (
      <Image
        source={{ uri: pngUrl }}
        style={{ width: iconSize, height: iconSize }}
        resizeMode="contain"
      />
    );
  }
  return null;
}

// Haptic callback for landing impact
const triggerLandingHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/** A single falling item badge */
function DroppingItem({
  character,
  type,
  characterImages,
  targetX,
  targetY,
  delay,
  rotation,
  itemSize,
}: {
  character: string | null;
  type: "radical" | "kanji";
  characterImages?: WrappedLevelSubject["characterImages"];
  targetX: number;
  targetY: number;
  delay: number;
  rotation: number;
  itemSize: number;
}) {
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);
  const hasLanded = useSharedValue(false);

  const bgColor =
    type === "radical"
      ? getSubjectTypeColor("radical")
      : getSubjectTypeColor("kanji");
  const fallDistance = targetY + 80; // from -80 to targetY
  // Longer fall = slightly longer duration (proportional to distance)
  const fallDuration = Math.max(400, Math.min(900, fallDistance * 0.8));

  useEffect(() => {
    // Fade in immediately at drop time
    opacity.value = withDelay(delay, withTiming(1, { duration: 150 }));

    // Gravity-like fall: accelerate downward, then small bounce
    translateY.value = withDelay(
      delay,
      withSequence(
        // Fall with gravity easing (accelerating)
        withTiming(
          targetY + 6,
          {
            duration: fallDuration,
            easing: Easing.in(Easing.quad),
          },
          (finished) => {
            // Trigger haptic on landing
            if (finished && !hasLanded.value) {
              hasLanded.value = true;
              runOnJS(triggerLandingHaptic)();
            }
          }
        ),
        // Small bounce up
        withTiming(targetY - 3, {
          duration: 100,
          easing: Easing.out(Easing.quad),
        }),
        // Settle
        withTiming(targetY, {
          duration: 80,
          easing: Easing.inOut(Easing.quad),
        })
      )
    );

    // Slight scale pop on landing
    scale.value = withDelay(
      delay + fallDuration,
      withSequence(
        withTiming(1.1, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 100, easing: Easing.inOut(Easing.quad) })
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotation}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const isLong = character != null && character.length > 1;
  const fontSize = itemSize * 0.5;
  const fontSizeSmall = itemSize * 0.32;
  const iconSize = itemSize * 0.6;

  return (
    <Animated.View
      style={[
        styles.dropItem,
        {
          left: targetX,
          backgroundColor: bgColor,
          width: itemSize,
          height: itemSize,
          borderRadius: itemSize * 0.2,
        },
        animatedStyle,
      ]}
    >
      {character ? (
        <Text
          style={[
            styles.dropItemText,
            { fontSize: isLong ? fontSizeSmall : fontSize },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {character}
        </Text>
      ) : (
        <RadicalSvgContent characterImages={characterImages} iconSize={iconSize} />
      )}
    </Animated.View>
  );
}

export function SubjectDropSlide({
  levelUpSubjects,
  level,
}: SubjectDropSlideProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Determine if iPad (larger screen) and if in landscape
  const isTablet = Math.min(screenWidth, screenHeight) >= 600;
  const isLandscape = screenWidth > screenHeight;

  // Scale up item size for iPad
  const itemSize = isTablet ? 80 : 56;
  const itemGap = isTablet ? 8 : 5;

  // Adjust bottom padding for landscape mode (less vertical space)
  const bottomPadding = isLandscape ? 100 : BOTTOM_PADDING;

  // Pre-calculate grid landing positions
  const { positions, items } = useMemo(() => {
    const availableWidth = screenWidth - SIDE_PADDING * 2;
    const numColumns = Math.floor(availableWidth / (itemSize + itemGap));
    const gridWidth = numColumns * (itemSize + itemGap) - itemGap;
    const startX = (screenWidth - gridWidth) / 2;

    // Shuffle items for a more natural look
    const shuffled = [...levelUpSubjects].sort(() => Math.random() - 0.5);

    // Track column heights for stacking
    const columnHeights = new Array(numColumns).fill(0);

    // Calculate available height for items (screen height minus header, footer, and padding)
    const headerSpace = isLandscape ? 60 : 100;
    const availableHeight = screenHeight - bottomPadding - headerSpace;
    const maxRows = Math.floor(availableHeight / (itemSize + itemGap));

    // Assign each item to the shortest column (for even distribution)
    const calculated = shuffled.map((item, index) => {
      // Find the column with the lowest height
      let minCol = 0;
      let minH = columnHeights[0];
      for (let c = 1; c < numColumns; c++) {
        if (columnHeights[c] < minH) {
          minH = columnHeights[c];
          minCol = c;
        }
      }

      const row = columnHeights[minCol];
      columnHeights[minCol]++;

      const x = startX + minCol * (itemSize + itemGap) + (Math.random() - 0.5) * 3;
      // Calculate Y from bottom, ensuring items stay within visible area
      const y =
        screenHeight -
        bottomPadding -
        itemSize -
        row * (itemSize + itemGap);
      const rotation = (Math.random() - 0.5) * 14; // -7 to 7 degrees

      return {
        ...item,
        x,
        y,
        rotation,
        delay: 300 + index * 70,
      };
    });

    return { positions: calculated, items: shuffled };
  }, [levelUpSubjects, screenWidth, screenHeight, itemSize, itemGap, bottomPadding, isLandscape]);

  // Footer text fade
  const footerOpacity = useSharedValue(0);
  const footerTranslateY = useSharedValue(12);

  useEffect(() => {
    const totalDropTime = 300 + items.length * 70 + 900;
    footerOpacity.value = withDelay(
      totalDropTime,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })
    );
    footerTranslateY.value = withDelay(
      totalDropTime,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
  }, [items.length]);

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
    transform: [{ translateY: footerTranslateY.value }],
  }));

  const radCount = levelUpSubjects.filter((s) => s.type === "radical").length;
  const kanCount = levelUpSubjects.filter((s) => s.type === "kanji").length;

  // Adjust header/footer positions for landscape
  const headerTop = isLandscape ? 40 : 100;
  const footerBottom = isLandscape ? 30 : 60;

  return (
    <LinearGradient
      colors={["#0a0a1a", "#141432", "#1a1a40"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { top: headerTop }]}>
        <Text style={[styles.headerText, isTablet && styles.headerTextTablet]}>
          Level {level} foundations
        </Text>
      </View>

      {/* Drop area (full screen) */}
      <View style={styles.dropArea}>
        {positions.map((pos) => (
          <DroppingItem
            key={pos.id}
            character={pos.characters}
            characterImages={pos.characterImages}
            type={pos.type}
            targetX={pos.x}
            targetY={pos.y}
            delay={pos.delay}
            rotation={pos.rotation}
            itemSize={itemSize}
          />
        ))}
      </View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { bottom: footerBottom }, footerStyle]}>
        <Text style={[styles.footerText, isTablet && styles.footerTextTablet]}>
          {radCount} radical{radCount !== 1 ? "s" : ""} and{" "}
          {kanCount} kanji mastered
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.5,
  },
  headerTextTablet: {
    fontSize: 28,
  },
  dropArea: {
    ...StyleSheet.absoluteFill,
  },
  dropItem: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  dropItemText: {
    fontWeight: "bold",
    color: "#fff",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  footerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.5,
  },
  footerTextTablet: {
    fontSize: 20,
  },
});
