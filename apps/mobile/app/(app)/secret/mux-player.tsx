import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";
import {
  CaptionCue,
  muxService,
} from "../../../src/services/muxService";
import { useTheme } from "../../../src/utils/theme";
import { VocabularyTooltip } from "../../../src/components/VocabularyTooltip";
import {
  findVocabularyMatches,
  getHighlightSegments,
  getItemColor,
  KanjiMatch,
  VocabularyMatch,
} from "../../../src/utils/textHighlighting";
import { getAllSubjects } from "../../../src/utils/cache";
import { useAuthStore } from "../../../src/utils/store";

export default function MuxPlayerScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData } = useAuthStore();
  const userLevel = userData?.level || 0;
  const params = useLocalSearchParams<{
    playbackId: string;
    title: string;
    trackId?: string;
  }>();

  const { width } = Dimensions.get("window");
  const videoHeight = (width * 9) / 16;

  const streamUrl = muxService.getStreamUrl(params.playbackId);
  const player = useVideoPlayer(streamUrl, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.timeUpdateEventInterval = 0.2;
    videoPlayer.play();
  });

  const [captions, setCaptions] = useState<CaptionCue[]>([]);
  const [currentCue, setCurrentCue] = useState<CaptionCue | null>(null);
  const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);

  // Vocabulary highlighting state
  const [vocabularyMatches, setVocabularyMatches] = useState<VocabularyMatch[]>(
    []
  );
  const [kanjiMatches, setKanjiMatches] = useState<KanjiMatch[]>([]);

  // Tooltip state
  const [selectedItem, setSelectedItem] = useState<
    (VocabularyMatch | KanjiMatch) | null
  >(null);
  const [selectedSurfaceText, setSelectedSurfaceText] = useState<string | null>(
    null
  );
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const [tooltipReady, setTooltipReady] = useState(false);
  const tooltipOpacity = useSharedValue(0);

  // Load captions if trackId is provided
  useEffect(() => {
    if (params.trackId) {
      setIsLoadingCaptions(true);
      muxService
        .getCaptions(params.playbackId, params.trackId)
        .then((cues) => {
          setCaptions(cues);
          console.log(`Loaded ${cues.length} caption cues`);
        })
        .finally(() => setIsLoadingCaptions(false));
    }
  }, [params.playbackId, params.trackId]);

  // Find vocabulary matches when captions load
  useEffect(() => {
    const findMatches = async () => {
      if (captions.length === 0) return;

      try {
        const allSubjects = await getAllSubjects();
        const fullText = captions.map((cue) => cue.text).join("\n");
        const { vocabularyMatches: vocabMatches, kanjiMatches: kMatches } =
          findVocabularyMatches(fullText, allSubjects);

        console.log(`Found ${vocabMatches.length} vocabulary matches`);
        console.log(`Found ${kMatches.length} kanji matches`);

        setVocabularyMatches(vocabMatches);
        setKanjiMatches(kMatches);
      } catch (error) {
        console.error("Error finding vocabulary matches:", error);
      }
    };

    findMatches();
  }, [captions]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    const subscription = player.addListener("timeUpdate", ({ currentTime }) => {
      if (captions.length === 0) {
        return;
      }

      const cue = muxService.findCurrentCue(captions, currentTime);
      setCurrentCue((previousCue) => {
        if (previousCue?.id === cue?.id) {
          return previousCue;
        }
        return cue;
      });
    });

    return () => {
      subscription.remove();
    };
  }, [captions, player]);

  const handleCuePress = useCallback(
    (cue: CaptionCue) => {
      player.currentTime = cue.startTime;
    },
    [player]
  );

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Tooltip handlers
  const handleVocabularyPress = useCallback(
    (itemId: number, surfaceText: string, event: any) => {
      const item = [...vocabularyMatches, ...kanjiMatches].find(
        (m) => m.id === itemId
      );
      if (item && event?.nativeEvent) {
        setTooltipReady(false);
        tooltipOpacity.value = 0;

        const { pageX, pageY } = event.nativeEvent;
        const screenWidth = Dimensions.get("window").width;
        const screenHeight = Dimensions.get("window").height;
        const tooltipWidth = 280;
        const tooltipEstimatedHeight = 180;

        // Center tooltip horizontally on the tap position
        let left = pageX - tooltipWidth / 2;
        left = Math.max(16, Math.min(left, screenWidth - tooltipWidth - 16));

        // Position below the tap by default, or above if not enough space
        const spaceBelow = screenHeight - pageY;
        let top: number;

        if (spaceBelow >= tooltipEstimatedHeight + 20) {
          // Position below the tap
          top = pageY + 20;
        } else {
          // Position above the tap
          top = pageY - tooltipEstimatedHeight - 10;
        }

        setTooltipPosition({ x: left, y: top, width: 0 });
        setSelectedItem(item);
        setSelectedSurfaceText(surfaceText);
        requestAnimationFrame(() => {
          setTooltipReady(true);
          tooltipOpacity.value = withTiming(1, { duration: 200 });
        });
      }
    },
    [vocabularyMatches, kanjiMatches]
  );

  const handleCloseTooltip = useCallback(() => {
    tooltipOpacity.value = 0;
    setTooltipReady(false);
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setTooltipPosition(null);
  }, []);

  const handleViewDetails = useCallback(() => {
    if (selectedItem) {
      handleCloseTooltip();
      router.push({
        pathname: "/subject/[id]",
        params: { id: selectedItem.id.toString(), from: "mux-player" },
      });
    }
  }, [selectedItem, router, handleCloseTooltip]);

  // Render text with vocabulary highlighting (font color only)
  const renderHighlightedText = (
    text: string,
    baseStyle: any,
    isCurrentCue: boolean = false
  ) => {
    if (!text || (vocabularyMatches.length === 0 && kanjiMatches.length === 0)) {
      return <Text style={baseStyle}>{text}</Text>;
    }

    const allMatches = [...vocabularyMatches, ...kanjiMatches];
    const segments = getHighlightSegments(text, allMatches);

    return (
      <Text style={baseStyle}>
        {segments.map((segment, index) => {
          if (!segment.match) {
            return <Text key={`text-${index}`}>{segment.text}</Text>;
          }

          const highlight = segment.match;
          const color = getItemColor(highlight.type);

          return (
            <Text
              key={`highlight-${index}-${highlight.id}`}
              style={{ color, fontWeight: isCurrentCue ? "700" : "600" }}
              onPress={(e) =>
                handleVocabularyPress(highlight.id, segment.text, e)
              }
            >
              {segment.text}
            </Text>
          );
        })}
      </Text>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundColor,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.cardBackground }]}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: theme.textColor }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {params.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Video Player */}
      <View style={[styles.playerContainer, { height: videoHeight }]}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
        />
      </View>

      {/* Current Caption Display */}
      {params.trackId && (
        <View
          style={[
            styles.currentCaptionContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          {isLoadingCaptions ? (
            <Text style={[styles.captionText, { color: theme.textSecondary }]}>
              Loading captions...
            </Text>
          ) : currentCue ? (
            renderHighlightedText(
              currentCue.text,
              [styles.captionText, { color: theme.textColor }],
              true
            )
          ) : (
            <Text style={[styles.captionText, { color: theme.textLight }]}>
              {captions.length > 0 ? "..." : "No captions available"}
            </Text>
          )}
        </View>
      )}

      {/* Caption Transcript */}
      {params.trackId && captions.length > 0 && (
        <View style={styles.transcriptContainer}>
          <Text style={[styles.transcriptTitle, { color: theme.textSecondary }]}>
            Transcript
          </Text>
          <ScrollView
            style={styles.transcriptScroll}
            contentContainerStyle={styles.transcriptContent}
            showsVerticalScrollIndicator={true}
          >
            {captions.map((cue) => (
              <TouchableOpacity
                key={cue.id}
                style={[
                  styles.transcriptCue,
                  {
                    backgroundColor:
                      currentCue?.id === cue.id
                        ? theme.primary + "20"
                        : "transparent",
                    borderLeftColor:
                      currentCue?.id === cue.id
                        ? theme.primary
                        : "transparent",
                  },
                ]}
                onPress={() => handleCuePress(cue)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.transcriptTimestamp, { color: theme.primary }]}
                >
                  {formatTimestamp(cue.startTime)}
                </Text>
                {renderHighlightedText(
                  cue.text,
                  [
                    styles.transcriptText,
                    {
                      color:
                        currentCue?.id === cue.id
                          ? theme.textColor
                          : theme.textSecondary,
                    },
                  ],
                  currentCue?.id === cue.id
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Vocabulary Tooltip */}
      {tooltipReady && (
        <VocabularyTooltip
          selectedItem={selectedItem}
          position={tooltipPosition}
          opacity={tooltipOpacity}
          selectedSurfaceText={selectedSurfaceText}
          onClose={handleCloseTooltip}
          onViewDetails={handleViewDetails}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 44,
  },
  playerContainer: {
    width: "100%",
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  currentCaptionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 60,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  captionText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  transcriptContainer: {
    flex: 1,
    paddingTop: 12,
  },
  transcriptTitle: {
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  transcriptCue: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    marginBottom: 4,
    borderRadius: 4,
  },
  transcriptTimestamp: {
    fontSize: 12,
    fontWeight: "600",
    width: 48,
    fontVariant: ["tabular-nums"],
  },
  transcriptText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
