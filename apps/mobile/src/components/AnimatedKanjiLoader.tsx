import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../utils/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Sample kanji characters for the animation
const SAMPLE_KANJI = [
  "学",
  "生",
  "日",
  "本",
  "人",
  "年",
  "大",
  "中",
  "小",
  "国",
  "出",
  "見",
  "時",
  "手",
  "自",
  "分",
  "前",
  "後",
  "上",
  "下",
  "左",
  "右",
  "今",
  "来",
  "行",
  "子",
  "女",
  "男",
  "山",
  "川",
  "水",
  "火",
  "木",
  "金",
  "土",
  "空",
  "青",
  "赤",
  "白",
  "黒",
  "車",
  "電",
  "話",
  "書",
  "読",
  "食",
  "飲",
  "立",
  "座",
  "歩",
  "走",
  "飛",
  "泳",
  "買",
  "売",
  "作",
  "使",
  "持",
  "取",
  "入",
  "出",
  "開",
  "閉",
  "始",
  "終",
  "新",
  "古",
  "早",
  "遅",
  "高",
  "低",
  "長",
  "短",
  "多",
  "少",
  "良",
  "悪",
  "美",
  "醜",
  "強",
  "弱",
  "明",
  "暗",
  "静",
  "動",
  "熱",
  "冷",
  "重",
  "軽",
  "固",
  "柔",
  "硬",
  "易",
  "難",
  "正",
  "誤",
  "真",
  "偽",
  "安",
  "危",
  "健",
  "病",
  "楽",
  "苦",
  "幸",
  "不",
  "愛",
  "恨",
  "希",
  "望",
  "夢",
  "現",
  "過",
  "未",
  "春",
  "夏",
  "秋",
  "冬",
  "朝",
  "昼",
  "夜",
  "月",
  "星",
  "雲",
  "雨",
  "雪",
  "風",
  "台",
];

interface KanjiCardProps {
  kanji: string;
  style?: any;
}

const KanjiCard: React.FC<KanjiCardProps> = React.memo(({ kanji, style }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: theme.border },
        style,
      ]}
    >
      <Text style={[styles.kanjiText, { color: theme.textColor }]}>
        {kanji}
      </Text>
    </View>
  );
});

KanjiCard.displayName = "KanjiCard";

interface AnimatedRowProps {
  kanji: string[];
  direction: "left" | "right";
  delay: number;
  rowIndex: number;
}

const AnimatedRow = React.memo(
  React.forwardRef<{ dismiss: () => void }, AnimatedRowProps>(
    ({ kanji, direction, delay, rowIndex }, ref) => {
      const translateX = useSharedValue(
        direction === "left" ? SCREEN_WIDTH : -SCREEN_WIDTH
      );
      const dismissX = useSharedValue(0);
      const opacity = useSharedValue(1);

      useEffect(() => {
        // Start the infinite scrolling animation
        translateX.value = withDelay(
          delay,
          withRepeat(
            withTiming(
              direction === "left" ? -SCREEN_WIDTH * 1.5 : SCREEN_WIDTH * 1.5,
              {
                duration: 6000, // Faster animation
                easing: Easing.linear,
              }
            ),
            -1,
            false
          )
        );
      }, [delay, direction, translateX]);

      const animatedStyle = useAnimatedStyle(() => {
        "worklet";
        const CARD_SIZE = 80;
        const CARD_MARGIN = 8;
        const topPosition = rowIndex * (CARD_SIZE + CARD_MARGIN);

        return {
          transform: [{ translateX: translateX.value + dismissX.value }],
          opacity: opacity.value,
          top: topPosition,
        };
      }, [rowIndex]);

      const dismiss = useCallback(() => {
        // Stop the infinite animation loop before dismissing.
        cancelAnimation(translateX);

        // Animate dismissal
        dismissX.value = withTiming(
          direction === "left" ? -SCREEN_WIDTH * 1.5 : SCREEN_WIDTH * 1.5,
          { duration: 420, easing: Easing.out(Easing.quad) }
        );
        opacity.value = withTiming(0, { duration: 320 });
      }, [direction, dismissX, opacity, translateX]);

      // Expose dismiss function
      React.useImperativeHandle(ref, () => ({ dismiss }), [dismiss]);

      return (
        <Animated.View
          style={[styles.row, animatedStyle]}
          shouldRasterizeIOS={true}
          renderToHardwareTextureAndroid={true}
        >
          {kanji.map((char, index) => (
            <KanjiCard key={`${char}-${index}`} kanji={char} />
          ))}
        </Animated.View>
      );
    }
  )
);

AnimatedRow.displayName = "AnimatedRow";

interface AnimatedKanjiLoaderProps {
  shouldDismiss: boolean;
  onLoadingComplete: () => void;
  cachingProgress?: number;
  statusMessage?: string | null;
}

const AnimatedKanjiLoader: React.FC<AnimatedKanjiLoaderProps> = ({
  shouldDismiss,
  onLoadingComplete,
  cachingProgress = 0,
  statusMessage,
}) => {
  const { theme } = useTheme();
  const [isDismissing, setIsDismissing] = useState(false);
  const rowRefs = useRef<any[]>([]);
  const backgroundOpacity = useSharedValue(1);

  // Generate random kanji for each row - memoized to prevent rerenders
  const generateRowKanji = useCallback((count: number) => {
    const shuffled = [...SAMPLE_KANJI].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }, []);

  // Calculate constants - memoized
  const constants = useMemo(() => {
    const CARD_SIZE = 80;
    const CARD_MARGIN = 8;
    const CARDS_PER_ROW =
      Math.ceil(SCREEN_WIDTH / (CARD_SIZE + CARD_MARGIN)) + 3; // Optimized for performance
    const ROWS_COUNT = Math.ceil(SCREEN_HEIGHT / (CARD_SIZE + CARD_MARGIN)) + 1;
    return { CARD_SIZE, CARD_MARGIN, CARDS_PER_ROW, ROWS_COUNT };
  }, []);

  // Generate rows data - memoized to prevent recreating on every render
  const rows = useMemo(
    () =>
      Array.from({ length: constants.ROWS_COUNT }, (_, index) => ({
        id: index,
        kanji: generateRowKanji(constants.CARDS_PER_ROW),
        direction: index % 2 === 0 ? "left" : ("right" as "left" | "right"),
        delay: index * 100,
      })),
    [constants.ROWS_COUNT, constants.CARDS_PER_ROW, generateRowKanji]
  );

  useEffect(() => {
    if (shouldDismiss && !isDismissing) {
      setIsDismissing(true);

      // Start dismissing all rows
      rowRefs.current.forEach((ref, index) => {
        if (ref?.dismiss) {
          setTimeout(() => {
            ref.dismiss();
          }, index * 15);
        }
      });

      // Fade out background and complete loading
      backgroundOpacity.value = withTiming(0, { duration: 420 }, () => {
        runOnJS(onLoadingComplete)();
      });
    }
  }, [shouldDismiss, isDismissing, backgroundOpacity, onLoadingComplete]);

  const backgroundStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: backgroundOpacity.value,
    };
  }, []);

  const renderedRows = useMemo(
    () =>
      rows.map((row, index) => (
        <AnimatedRow
          key={row.id}
          kanji={row.kanji}
          direction={row.direction}
          delay={row.delay}
          rowIndex={index}
          ref={(ref) => {
            rowRefs.current[index] = ref;
          }}
        />
      )),
    [rows]
  );

  const subtitleText =
    statusMessage ??
    (cachingProgress > 0
      ? `Downloading subjects... ${cachingProgress}%`
      : "Loading subjects...");

  if (isDismissing && backgroundOpacity.value === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        backgroundStyle,
        { backgroundColor: theme.backgroundColor },
      ]}
    >
      <View style={styles.loadingContent}>
        {renderedRows}

        {/* Loading text overlay */}
        <View
          style={[
            styles.loadingOverlay,
            { backgroundColor: `${theme.backgroundColor}DD` },
          ]}
        >
          <Text style={[styles.loadingTitle, { color: theme.textColor }]}>
            Kakehashi
          </Text>
          <Text
            style={[styles.loadingSubtitle, { color: theme.textSecondary }]}
          >
            {subtitleText}
          </Text>
          {cachingProgress > 0 && (
            <View style={[styles.progressBar, { borderColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.primary,
                    width: `${cachingProgress}%`,
                  },
                ]}
              />
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  loadingContent: {
    flex: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    position: "absolute",
    height: 80,
  },
  card: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  kanjiText: {
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingTitle: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
    fontFamily: "SourceHanSansJP-Bold",
  },
  loadingSubtitle: {
    fontSize: 18,
    fontFamily: "SourceHanSansJP-Regular",
  },
  progressBar: {
    width: 200,
    height: 4,
    borderRadius: 2,
    borderWidth: 1,
    marginTop: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
  },
});

export default AnimatedKanjiLoader;
