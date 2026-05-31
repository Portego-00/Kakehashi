import { Ionicons } from "@expo/vector-icons";
import { File as FSFile, Paths } from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "@/src/utils/haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { WrappedData } from "../../../hooks/useWrappedData";
import { getSubjectTypeColor } from "../../../utils/subjectColors";
import { RadialGlow } from "../RadialGlow";
import { generateShareCardHtml } from "../shareCardHtml";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");

/* ──── Confetti ──── */

const CONFETTI_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#FFD93D", "#C9B1FF", "#FF9FF3", "#54A0FF", "#5F27CD",
];

function ConfettiParticle({
  delay,
  color,
  startX,
}: {
  delay: number;
  color: string;
  startX: number;
}) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(startX);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT + 50, {
        duration: 3000 + Math.random() * 2000,
        easing: Easing.out(Easing.quad),
      })
    );
    translateX.value = withDelay(
      delay,
      withTiming(startX + (Math.random() - 0.5) * 120, {
        duration: 3000 + Math.random() * 2000,
      })
    );
    rotate.value = withDelay(
      delay,
      withTiming(360 * (Math.random() > 0.5 ? 1 : -1), { duration: 3000 })
    );
    scale.value = withDelay(
      delay,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

/* ──── Helpers ──── */

function getSubjectColor(type: string): string {
  if (
    type === "radical" ||
    type === "kanji" ||
    type === "vocabulary" ||
    type === "kana_vocabulary"
  ) {
    return getSubjectTypeColor(type);
  }

  return getSubjectTypeColor("vocabulary");
}

function formatDateRange(
  startedAt: string | null,
  passedAt: string | null
): string {
  const fmt = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };
  const s = fmt(startedAt);
  const p = fmt(passedAt);
  if (s && p) return `${s} — ${p}`;
  if (s) return `Started ${s}`;
  if (p) return `Completed ${p}`;
  return "";
}

function formatTimeToGuru(ms?: number): string {
  if (!ms) return "";
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return "< 1h";
}

/* ──── Build shareable text summary ──── */
function buildShareText(data: WrappedData): string {
  const timePart =
    data.timeDays === 0
      ? "< 1 day"
      : data.timeDays === 1
        ? "1 day"
        : `${data.timeDays} days`;

  const lines = [
    `Level ${data.level} Summary`,
    `━━━━━━━━━━━━━━━━`,
    `${timePart} · ${data.overallAccuracy}% accuracy · ${data.totalReviews.toLocaleString()} reviews`,
  ];

  if (data.starPerformer) {
    lines.push(
      `Star performer: ${data.starPerformer.characters} (${data.starPerformer.primaryMeaning})`
    );
  }

  const toughest = data.mostMissed.slice(0, 2);
  if (toughest.length > 0) {
    lines.push(
      `Toughest: ${toughest.map((s) => `${s.characters}`).join(", ")}`
    );
  }

  lines.push("", "Kakehashi for WaniKani");

  return lines.join("\n");
}

/* ──── Character badge (uniform size for all sections) ──── */
function CharBadge({
  character,
  type,
}: {
  character: string;
  type: string;
}) {
  const color = getSubjectColor(type);
  return (
    <View
      style={[
        styles.charBadge,
        {
          backgroundColor: `${color}20`,
          borderColor: `${color}40`,
        },
      ]}
    >
      <Text
        style={[styles.charBadgeText, { color }]}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        numberOfLines={1}
      >
        {character}
      </Text>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────── */

interface SummarySlideProps {
  data: WrappedData;
}

export function SummarySlide({ data }: SummarySlideProps) {
  const isAndroid = Platform.OS === "android";
  /* Animation values */
  const cardScale = useSharedValue(0.88);
  const cardOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(14);
  const shareOpacity = useSharedValue(0);
  const shareTranslateY = useSharedValue(16);

  const dateRange = useMemo(
    () => formatDateRange(data.startedAt, data.passedAt),
    [data.startedAt, data.passedAt]
  );

  useEffect(() => {
    cardOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
    cardScale.value = withDelay(
      200,
      withSequence(
        withTiming(1.02, {
          duration: 500,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) })
      )
    );

    contentOpacity.value = withDelay(
      600,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) })
    );
    contentTranslateY.value = withDelay(
      600,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    shareOpacity.value = withDelay(
      1200,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) })
    );
    shareTranslateY.value = withDelay(
      1200,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const shareStyle = useAnimatedStyle(() => ({
    opacity: shareOpacity.value,
    transform: [{ translateY: shareTranslateY.value }],
  }));

  /* ── Image-capture sharing via hidden WebView ── */
  const [isCapturing, setIsCapturing] = useState(false);
  const shareHtmlRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupCapture = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const fallbackTextShare = useCallback(async () => {
    try {
      await Share.share({ message: buildShareText(data) });
    } catch {
      /* user cancelled */
    }
  }, [data]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    shareHtmlRef.current = generateShareCardHtml(data);
    setIsCapturing(true);

    // Safety timeout – fall back to text if capture takes too long
    timeoutRef.current = setTimeout(async () => {
      setIsCapturing(false);
      await fallbackTextShare();
    }, 12000);
  }, [data, fallbackTextShare]);

  const onWebViewMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      cleanupCapture();
      try {
        const result = JSON.parse(event.nativeEvent.data);
        if (result.type === "success" && result.data) {
          const base64 = (result.data as string).replace(
            /^data:image\/png;base64,/,
            ""
          );
          const file = new FSFile(Paths.cache, "level-summary.png");
          file.write(base64, { encoding: "base64" });

          if (Platform.OS === "ios") {
            await Share.share({ url: file.uri });
          } else {
            // Android doesn't support url in Share – fall back to text
            await fallbackTextShare();
          }
          return;
        }
      } catch (err) {
        console.warn("Image share failed, falling back to text:", err);
      }
      await fallbackTextShare();
    },
    [cleanupCapture, fallbackTextShare]
  );

  const topMissed = data.mostMissed.slice(0, 2);
  const showFastest =
    data.fastestToGuru &&
    (!data.starPerformer ||
      data.fastestToGuru.subjectId !== data.starPerformer.subjectId);

  const timeDaysDisplay = data.timeDays === 0 ? "< 1" : String(data.timeDays);
  const timeDaysLabel = data.timeDays === 1 ? "DAY" : "DAYS";

  /* Confetti (fires when the card appears) */
  const confettiParticles = useMemo(
    () =>
      Array.from({ length: 35 }, (_, i) => ({
        id: i,
        delay: 400 + Math.random() * 1200,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        startX: Math.random() * SCREEN_WIDTH,
      })),
    []
  );

  return (
    <LinearGradient
      colors={["#06010e", "#0d0420", "#160836"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Confetti */}
      <View style={styles.confettiContainer}>
        {confettiParticles.map((p) => (
          <ConfettiParticle
            key={p.id}
            delay={p.delay}
            color={p.color}
            startX={p.startX}
          />
        ))}
      </View>

      <Animated.View
        style={[
          styles.cardWrapper,
          cardStyle,
          isAndroid && styles.cardWrapperNoShareAndroid,
        ]}
      >
        <LinearGradient
          colors={["#120428", "#1e0c50", "#321872", "#4a20a0"]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.card}
        >
          {/* Decorative glow behind level number */}
          <View style={styles.glowAnchor} pointerEvents="none">
            <RadialGlow
              size={260}
              color="#8b5cf6"
              intensity={0.3}
              style={{ top: -90, left: -90 }}
            />
          </View>

          {/* ── Hero header ── */}
          <View style={styles.hero}>
            <View style={styles.accentLine} />
            <Text style={styles.levelLabel}>LEVEL</Text>
            <Text style={styles.levelNumber}>{data.level}</Text>
            <Text style={styles.summaryLabel}>SUMMARY</Text>
            <View style={styles.accentLine} />
            {(data.username || dateRange) && (
              <Text style={styles.metaText}>
                {data.username ? `@${data.username}` : ""}
                {data.username && dateRange ? "  ·  " : ""}
                {dateRange}
              </Text>
            )}
          </View>

          {/* ── Body ── */}
          <Animated.View style={contentStyle}>
            {/* Stats strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{timeDaysDisplay}</Text>
                <Text style={styles.statLabel}>{timeDaysLabel}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{data.overallAccuracy}%</Text>
                <Text style={styles.statLabel}>ACCURACY</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>
                  {data.totalReviews.toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>REVIEWS</Text>
              </View>
            </View>

            {/* Highlights */}

            {/* Toughest */}
            {topMissed.length > 0 && (
              <View style={styles.highlightBlock}>
                <View style={styles.highlightTitleRow}>
                  <Ionicons
                    name="alert-circle"
                    size={10}
                    color="#f87171"
                  />
                  <Text style={styles.highlightTitle}>TOUGHEST</Text>
                </View>
                {topMissed.map((s, i) => (
                  <View key={i} style={styles.highlightRow}>
                    <CharBadge
                      character={s.characters}
                      type={s.subjectType}
                    />
                    <View style={styles.highlightRowInfo}>
                      <Text
                        style={styles.highlightMeaning}
                        numberOfLines={1}
                      >
                        {s.primaryMeaning}
                      </Text>
                      <Text style={styles.highlightStat}>
                        {s.percentageCorrect}% accuracy
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Star performer */}
            {data.starPerformer && (
              <View style={styles.highlightBlock}>
                <View style={styles.highlightTitleRow}>
                  <Ionicons name="star" size={10} color="#fbbf24" />
                  <Text style={styles.highlightTitle}>STAR PERFORMER</Text>
                </View>
                <View style={styles.highlightRow}>
                  <CharBadge
                    character={data.starPerformer.characters}
                    type={data.starPerformer.subjectType}
                  />
                  <View style={styles.highlightRowInfo}>
                    <Text
                      style={styles.highlightMeaning}
                      numberOfLines={1}
                    >
                      {data.starPerformer.primaryMeaning}
                    </Text>
                    <Text style={styles.highlightStat}>
                      {data.starPerformer.percentageCorrect}% ·{" "}
                      {data.starPerformer.maxStreak} streak
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Fastest to guru */}
            {showFastest && data.fastestToGuru && (
              <View style={styles.highlightBlock}>
                <View style={styles.highlightTitleRow}>
                  <Ionicons name="flash" size={10} color="#34d399" />
                  <Text style={styles.highlightTitle}>FASTEST TO GURU</Text>
                </View>
                <View style={styles.highlightRow}>
                  <CharBadge
                    character={data.fastestToGuru.characters}
                    type={data.fastestToGuru.subjectType}
                  />
                  <View style={styles.highlightRowInfo}>
                    <Text
                      style={styles.highlightMeaning}
                      numberOfLines={1}
                    >
                      {data.fastestToGuru.primaryMeaning}
                    </Text>
                    <Text style={styles.highlightStat}>
                      {formatTimeToGuru(data.fastestToGuru.timeToGuru)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>

          {/* ── Branding footer ── */}
          <View style={styles.brandingRow}>
            <View style={styles.brandLine} />
            <Text style={styles.brandText}>KAKEHASHI</Text>
            <View style={styles.brandLine} />
          </View>
        </LinearGradient>
      </Animated.View>

      {!isAndroid && (
        <Animated.View style={[styles.shareWrapper, shareStyle]}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.8}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="share-outline" size={20} color="#fff" />
            )}
            <Text style={styles.shareBtnText}>
              {isCapturing ? "Generating…" : "Share"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Hidden WebView for image capture (renders card → html2canvas → base64) */}
      {!isAndroid && isCapturing && (
        <View style={styles.hiddenWebView} pointerEvents="none">
          <WebView
            source={{ html: shareHtmlRef.current }}
            onMessage={onWebViewMessage}
            onError={() => {
              cleanupCapture();
              fallbackTextShare();
            }}
            javaScriptEnabled
            originWhitelist={["*"]}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </LinearGradient>
  );
}

/* ──── Styles ──── */

const styles = StyleSheet.create({
  /* Outer page */
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },

  /* Card shell */
  cardWrapper: {
    width: "100%",
    maxWidth: 350,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 14,
  },
  cardWrapperNoShareAndroid: {
    marginTop: 18,
  },
  card: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 22,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },

  /* Glow */
  glowAnchor: {
    position: "absolute",
    top: 30,
    left: 0,
    right: 0,
    alignItems: "center",
    width: 80,
    height: 80,
    alignSelf: "center",
  },

  /* ── Hero ── */
  hero: {
    alignItems: "center",
    marginBottom: 22,
  },
  accentLine: {
    width: 36,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 6,
  },
  levelLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 6,
  },
  levelNumber: {
    fontSize: 82,
    fontWeight: "900",
    color: "#ffffff",
    lineHeight: 90,
    marginVertical: 2,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(255,255,255,0.42)",
    letterSpacing: 10,
  },
  metaText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.28)",
    marginTop: 10,
    letterSpacing: 0.3,
  },

  /* ── Stats strip ── */
  statsStrip: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingVertical: 14,
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.38)",
    letterSpacing: 2,
  },

  /* ── Highlight blocks ── */
  highlightBlock: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  highlightTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 2.5,
  },
  highlightTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  highlightRowInfo: {
    flex: 1,
    gap: 2,
  },
  highlightMeaning: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  highlightStat: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
  },

  /* Character badge – uniform 40x40 for all sections */
  charBadge: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    minWidth: 40,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  charBadgeText: {
    fontWeight: "700",
    fontSize: 20,
  },

  /* ── Branding ── */
  brandingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 4,
  },
  brandLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  brandText: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.2)",
    letterSpacing: 5,
  },

  /* ── Share button ── */
  shareWrapper: {
    marginTop: 28,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124, 58, 237, 0.45)",
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 15,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  shareBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
  },

  /* Off-screen WebView used for image capture */
  hiddenWebView: {
    position: "absolute",
    left: -9999,
    top: 0,
    width: 400,
    height: 900,
    opacity: 0,
  },
});
