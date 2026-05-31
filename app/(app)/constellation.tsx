import { useAuthStore } from "@/src/utils/store";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, SvgXml } from "react-native-svg";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import { Subject } from "../../src/types/wanikani";
import { getSubjects } from "../../src/utils/api";
import { pickBestImage, useRemoteSvg } from "../../src/utils/radicalSvg";
import { getSubjectTypeColor } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";
import { toHiragana } from "wanakana";

const { width, height } = Dimensions.get("window");
// Android can hard-crash on extremely large render surfaces (GPU texture/canvas limits).
// Keep Android at native scale for safety and supersample iOS for crisper zoom.
const MAX_DIMENSION = Math.max(width, height);
const SUPERSAMPLE = Platform.OS === "ios" ? 2 : 1;
const DEFAULT_ZOOM = 1 / SUPERSAMPLE;
const MIN_VISUAL_ZOOM = 0.5;
const MAX_VISUAL_ZOOM = Platform.OS === "android" ? 2.5 : 2;
const MIN_ZOOM_SCALE = MIN_VISUAL_ZOOM / SUPERSAMPLE;
const MAX_ZOOM_SCALE = MAX_VISUAL_ZOOM / SUPERSAMPLE;
const BASE_CONNECTION_OPACITY = SUPERSAMPLE > 1 ? 0.45 : 0.2;
const BASE_GRAPH_CANVAS_PADDING =
  Platform.OS === "android"
    ? Math.min(MAX_DIMENSION * 0.6, 1200)
    : MAX_DIMENSION * 2;
const GRAPH_CANVAS_PADDING =
  BASE_GRAPH_CANVAS_PADDING;
const GRAPH_CANVAS_WIDTH = width + GRAPH_CANVAS_PADDING * 2;
const GRAPH_CANVAS_HEIGHT = height + GRAPH_CANVAS_PADDING * 2;

// Constants for layout
const CENTER_X = GRAPH_CANVAS_PADDING + width / 2;
const CENTER_Y = GRAPH_CANVAS_PADDING + height / 2;
const INNER_ORBIT_RADIUS = 100 * SUPERSAMPLE;
const OUTER_ORBIT_RADIUS = 180 * SUPERSAMPLE;
const READING_ANCHOR_RADIUS = 210 * SUPERSAMPLE;
const MAX_AMALGAMATIONS = 12;
const MAX_AMALGAMATIONS_PER_READING = 12;
const CLUSTER_NODE_SPACING = 84 * SUPERSAMPLE;
const CLUSTER_RING_BASE_RADIUS = 86 * SUPERSAMPLE;
const CLUSTER_RING_GAP = 90 * SUPERSAMPLE;
const CLUSTER_ARC_SPAN = Math.PI * 1.2;

const normalizeReading = (reading: string) =>
  toHiragana(reading).replace(/[.\u30fb]/g, "").trim();

const stripSokuon = (reading: string) => reading.replace(/っ/g, "");

const commonPrefixLength = (a: string, b: string) => {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i += 1;
  return i;
};

const commonSuffixLength = (a: string, b: string) => {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
};

interface Node {
  id: number;
  x: number;
  y: number;
  type: "center" | "component" | "amalgamation";
  data: Subject;
}

interface ConnectionLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity?: number;
  width?: number;
}

interface ReadingAnchor {
  reading: string;
  x: number;
  y: number;
  angle: number;
}

interface NormalizedReadingEntry {
  label: string;
  normalized: string;
  type: string;
  noSokuon: string;
}

type SubjectReading = NonNullable<Subject["data"]["readings"]>[number];

export default function ConstellationScreen() {
  const { id, rootId, constellationDepth } = useLocalSearchParams();
  const navigation = useNavigation();
  const { dashboardData } = useDashboardData();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const topControlsOffset = Math.max(insets.top + 10, 60);

  // Local state for subjects fetched on-demand (not in dashboard data)
  const [fetchedSubjects, setFetchedSubjects] = React.useState<Subject[]>([]);
  const [loadingMissing, setLoadingMissing] = React.useState(false);
  const { apiToken } = useAuthStore();

  // Combine dashboard subjects and fetched subjects
  const allSubjects = useMemo<Subject[]>(() => {
    const combined = [...(dashboardData.subjects as Subject[])];
    fetchedSubjects.forEach((fs) => {
      if (!combined.find((s) => s.id === fs.id)) {
        combined.push(fs);
      }
    });
    return combined;
  }, [dashboardData.subjects, fetchedSubjects]);

  const idParam = Array.isArray(id) ? id[0] : id;
  const rootIdParam = Array.isArray(rootId) ? rootId[0] : rootId;
  const depthParam = Array.isArray(constellationDepth)
    ? constellationDepth[0]
    : constellationDepth;
  const parsedDepth = Number(depthParam);
  const currentConstellationDepth =
    Number.isFinite(parsedDepth) && parsedDepth > 0
      ? Math.floor(parsedDepth)
      : 1;

  // Find the subject from combined list
  const subjectId = Number(idParam);
  const subject = useMemo(
    () => allSubjects.find((s) => s.id === subjectId),
    [allSubjects, subjectId]
  );

  // Animation values
  const introScale = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Position for panning
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const zoomScale = useSharedValue(DEFAULT_ZOOM);
  const pinchStartScale = useSharedValue(DEFAULT_ZOOM);
  const pinchStartTranslateX = useSharedValue(0);
  const pinchStartTranslateY = useSharedValue(0);
  const pinchStartFocalX = useSharedValue(0);
  const pinchStartFocalY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = panStartX.value + event.translationX;
      translateY.value = panStartY.value + event.translationY;
    })
    .onEnd((event) => {
      translateX.value = withDecay({
        velocity: event.velocityX,
        deceleration: 0.998,
      });
      translateY.value = withDecay({
        velocity: event.velocityY,
        deceleration: 0.998,
      });
    });

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      cancelAnimation(zoomScale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      pinchStartScale.value = zoomScale.value;
      pinchStartTranslateX.value = translateX.value;
      pinchStartTranslateY.value = translateY.value;
      pinchStartFocalX.value = event.focalX;
      pinchStartFocalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const nextScale = Math.max(
        MIN_ZOOM_SCALE,
        Math.min(MAX_ZOOM_SCALE, pinchStartScale.value * event.scale)
      );
      const scaleRatio = nextScale / pinchStartScale.value;

      zoomScale.value = nextScale;
      // Scale anchors at the view center, which aligns with screen center by layout.
      translateX.value =
        event.focalX -
        (1 - scaleRatio) * (width / 2) -
        scaleRatio * (pinchStartFocalX.value - pinchStartTranslateX.value);
      translateY.value =
        event.focalY -
        (1 - scaleRatio) * (height / 2) -
        scaleRatio * (pinchStartFocalY.value - pinchStartTranslateY.value);
    });

  const constellationGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  useEffect(() => {
    introScale.value = withSpring(1);
    opacity.value = withTiming(1, { duration: 1000 });
  }, [introScale, opacity]);

  // Fetch missing data
  useEffect(() => {
    let isMounted = true;

    const fetchMissing = async () => {
      if (!apiToken) return;

      // 1. Check if we have the main subject
      const mainSubjectMissing = !allSubjects.find((s) => s.id === subjectId);

      if (mainSubjectMissing) {
        setLoadingMissing(true);
        try {
          // Fetch the main subject
          console.log(`fetching missing subject ${subjectId}`);
          const response = await getSubjects(apiToken, { ids: [subjectId] });
          if (isMounted && response.data.length > 0) {
            setFetchedSubjects((prev) => [
              ...prev,
              ...(response.data as unknown as Subject[]),
            ]);
          }
        } catch (e) {
          console.warn("Failed to fetch subject", e);
        } finally {
          if (isMounted) setLoadingMissing(false);
        }
        return; // Wait for main subject to be set before fetching related
      }

      // 2. Check for missing related subjects (components & amalgamations)
      if (subject) {
        const componentIds = subject.data.component_subject_ids || [];
        const amalgamationIds = subject.data.amalgamation_subject_ids || [];
        const relatedIds = [...componentIds, ...amalgamationIds];

        const missingIds = relatedIds.filter(
          (id) => !allSubjects.find((s) => s.id === id)
        );

        if (missingIds.length > 0) {
          console.log(`fetching ${missingIds.length} missing related subjects`);
          try {
            // Fetch missing related subjects
            // Batch if too many? getSubjects handles arrays, but we should be careful.
            // Usually related subjects are < 30, so single call is fine.
            const response = await getSubjects(apiToken, { ids: missingIds });
            if (isMounted && response.data.length > 0) {
              setFetchedSubjects((prev) => {
                // Prevent duplicates
                const newSubjects = (
                  response.data as unknown as Subject[]
                ).filter((s) => !prev.find((existing) => existing.id === s.id));
                return [...prev, ...newSubjects];
              });
            }
          } catch (e) {
            console.warn("Failed to fetch related subjects", e);
          }
        }
      }
    };

    fetchMissing();

    return () => {
      isMounted = false;
    };
  }, [subjectId, allSubjects, apiToken, subject]);

  // Calculate nodes and connections
  const { nodes, connections, readingAnchors } = useMemo(() => {
    if (!subject) return { nodes: [], connections: [], readingAnchors: [] };

    const nodes: Node[] = [];
    const connections: ConnectionLine[] = [];
    const readingAnchors: ReadingAnchor[] = [];

    // Center Node (Current Subject)
    const centerNode: Node = {
      id: subject.id,
      x: CENTER_X,
      y: CENTER_Y,
      type: "center",
      data: subject,
    };
    nodes.push(centerNode);

    // Components (Inner Orbit)
    const componentIds = subject.data.component_subject_ids || [];
    // Now using allSubjects instead of dashboardData.subjects
    const components = allSubjects.filter((s) => componentIds.includes(s.id));

    components.forEach((comp, index) => {
      const angle = (index / components.length) * 2 * Math.PI;
      const x = CENTER_X + INNER_ORBIT_RADIUS * Math.cos(angle);
      const y = CENTER_Y + INNER_ORBIT_RADIUS * Math.sin(angle);

      const node: Node = {
        id: comp.id,
        x,
        y,
        type: "component",
        data: comp,
      };
      nodes.push(node);
      connections.push({
        key: `center-component-${node.id}`,
        x1: centerNode.x,
        y1: centerNode.y,
        x2: node.x,
        y2: node.y,
      });
    });

    // Amalgamations (Outer Orbit)
    const amalgamationIds = subject.data.amalgamation_subject_ids || [];
    const allAmalgamations = allSubjects.filter((s) =>
      amalgamationIds.includes(s.id)
    );
    // Keep a global cap for non-clustered views only.
    const nonClusteredAmalgamations = allAmalgamations.slice(
      0,
      MAX_AMALGAMATIONS
    );

    const readingsByNormalized = (subject.data.readings ?? []).reduce(
      (acc, reading: SubjectReading) => {
        const label = reading.reading.trim();
        const normalized = normalizeReading(label);
        if (!normalized) return acc;

        const readingType = reading.type ?? "unknown";
        const existing = acc.get(normalized);

        if (!existing) {
          acc.set(normalized, {
            label,
            normalized,
            type: readingType,
            noSokuon: stripSokuon(normalized),
          });
        } else if (existing.type === "nanori" && readingType !== "nanori") {
          // Prefer onyomi/kunyomi over nanori when the normalized reading collides.
          acc.set(normalized, {
            label,
            normalized,
            type: readingType,
            noSokuon: stripSokuon(normalized),
          });
        }

        return acc;
      },
      new Map<string, NormalizedReadingEntry>()
    );
    const uniqueKanjiReadings: NormalizedReadingEntry[] = Array.from(
      readingsByNormalized.values()
    );
    const shouldClusterByReading =
      subject.object === "kanji" &&
      uniqueKanjiReadings.length > 1 &&
      allAmalgamations.length > 0;

    if (!shouldClusterByReading) {
      nonClusteredAmalgamations.forEach((amal, index) => {
        const angle =
          (index / Math.max(nonClusteredAmalgamations.length, 1)) * 2 * Math.PI +
          Math.PI / 4;
        const x = CENTER_X + OUTER_ORBIT_RADIUS * Math.cos(angle);
        const y = CENTER_Y + OUTER_ORBIT_RADIUS * Math.sin(angle);

        const node: Node = {
          id: amal.id,
          x,
          y,
          type: "amalgamation",
          data: amal,
        };
        nodes.push(node);
        connections.push({
          key: `center-amalgamation-${node.id}`,
          x1: centerNode.x,
          y1: centerNode.y,
          x2: node.x,
          y2: node.y,
        });
      });

      return { nodes, connections, readingAnchors };
    }

    const maxClusteredAmalgamations = Math.min(
      allAmalgamations.length,
      uniqueKanjiReadings.length * MAX_AMALGAMATIONS_PER_READING
    );
    const readingAnchorsByReading = new Map<string, ReadingAnchor>();
    const dynamicAnchorRadius =
      READING_ANCHOR_RADIUS +
      Math.max(0, uniqueKanjiReadings.length - 2) * 10 +
      Math.max(0, maxClusteredAmalgamations - 8) * 4;

    uniqueKanjiReadings.forEach((readingEntry, index) => {
      const angle =
        (index / Math.max(uniqueKanjiReadings.length, 1)) * 2 * Math.PI -
        Math.PI / 2;
      const anchor: ReadingAnchor = {
        reading: readingEntry.label,
        angle,
        x: CENTER_X + dynamicAnchorRadius * Math.cos(angle),
        y: CENTER_Y + dynamicAnchorRadius * Math.sin(angle),
      };
      readingAnchors.push(anchor);
      readingAnchorsByReading.set(readingEntry.normalized, anchor);
      connections.push({
        key: `center-reading-${readingEntry.normalized}-${index}`,
        x1: centerNode.x,
        y1: centerNode.y,
        x2: anchor.x,
        y2: anchor.y,
        opacity: 0.18,
        width: 1.6,
      });
    });

    const groupCounts = new Map<string, number>(
      uniqueKanjiReadings.map((reading) => [reading.normalized, 0])
    );
    const groupedAmalgamations = new Map<string, Subject[]>(
      uniqueKanjiReadings.map((reading) => [reading.normalized, []])
    );
    const preferredFallbackReadings =
      uniqueKanjiReadings.filter((reading) => reading.type !== "nanori").length >
      0
        ? uniqueKanjiReadings.filter((reading) => reading.type !== "nanori")
        : uniqueKanjiReadings;

    const kanjiChar = subject.data.characters ?? "";

    const getBestReadingGroup = (amalgamation: Subject) => {
      const vocabReadings = (amalgamation.data.readings ?? [])
        .map((reading) => normalizeReading(reading.reading))
        .filter(Boolean);

      // Locate where the center kanji sits inside the vocab so we can prefer
      // readings that align with that position (e.g. 日 in 火曜日 is the trailing
      // character so its reading should match the END of かようび, not the start).
      const vocabChars = amalgamation.data.characters ?? "";
      const kanjiIndex =
        kanjiChar && vocabChars ? vocabChars.indexOf(kanjiChar) : -1;
      type KanjiPosition = "prefix" | "suffix" | "middle" | "unknown";
      let kanjiPosition: KanjiPosition;
      if (kanjiIndex === -1 || !vocabChars) {
        kanjiPosition = "unknown";
      } else if (vocabChars.length === 1 || kanjiIndex === 0) {
        kanjiPosition = "prefix";
      } else if (kanjiIndex === vocabChars.length - 1) {
        kanjiPosition = "suffix";
      } else {
        kanjiPosition = "middle";
      }

      if (vocabReadings.length > 0 && uniqueKanjiReadings.length > 0) {
        let bestMatch = uniqueKanjiReadings[0];
        let bestScore = Number.NEGATIVE_INFINITY;

        uniqueKanjiReadings.forEach((readingEntry) => {
          vocabReadings.forEach((vocabReading) => {
            const vocabNoSokuon = stripSokuon(vocabReading);
            let score = 0;

            if (vocabReading === readingEntry.normalized) {
              score += 1000;
            }

            if (
              vocabReading.includes(readingEntry.normalized) ||
              readingEntry.normalized.includes(vocabReading)
            ) {
              score += 160;
            }

            if (
              vocabNoSokuon.includes(readingEntry.noSokuon) ||
              readingEntry.noSokuon.includes(vocabNoSokuon)
            ) {
              score += 120;
            }

            // Position-conditional alignment scoring.
            if (kanjiPosition === "prefix" || kanjiPosition === "unknown") {
              const prefixScore =
                commonPrefixLength(vocabReading, readingEntry.normalized) * 28;
              const prefixScoreNoSokuon =
                commonPrefixLength(vocabNoSokuon, readingEntry.noSokuon) * 22;
              score += Math.max(prefixScore, prefixScoreNoSokuon);
            } else if (kanjiPosition === "suffix") {
              const suffixScore =
                commonSuffixLength(vocabReading, readingEntry.normalized) * 28;
              const suffixScoreNoSokuon =
                commonSuffixLength(vocabNoSokuon, readingEntry.noSokuon) * 22;
              score += Math.max(suffixScore, suffixScoreNoSokuon);
            }
            // "middle" gets no edge-aligned bonus; the substring +160/+120 above
            // is enough signal without rewarding either edge.

            // Positional placement bonus / wrong-edge penalty using indexOf.
            if (kanjiPosition !== "unknown") {
              const idx = vocabReading.indexOf(readingEntry.normalized);
              const expectedSuffixIdx =
                vocabReading.length - readingEntry.normalized.length;
              const idxNoSokuon = vocabNoSokuon.indexOf(readingEntry.noSokuon);
              const expectedSuffixIdxNoSokuon =
                vocabNoSokuon.length - readingEntry.noSokuon.length;

              if (kanjiPosition === "prefix") {
                if (idx === 0 || idxNoSokuon === 0) {
                  score += 80;
                } else if (idx > 0) {
                  score -= 60;
                }
              } else if (kanjiPosition === "suffix") {
                const atEnd =
                  (idx >= 0 && idx === expectedSuffixIdx) ||
                  (idxNoSokuon >= 0 &&
                    idxNoSokuon === expectedSuffixIdxNoSokuon);
                if (atEnd) {
                  score += 150;
                } else if (
                  idx === 0 &&
                  readingEntry.normalized.length < vocabReading.length
                ) {
                  // Reading was found, but only at the front - this is the
                  // か-in-かようび-for-日 trap. Penalize.
                  score -= 120;
                }
              } else if (kanjiPosition === "middle") {
                if (
                  idx > 0 &&
                  idx < expectedSuffixIdx &&
                  readingEntry.normalized.length < vocabReading.length
                ) {
                  score += 60;
                }
              }
            }

            if (readingEntry.type === "nanori") {
              score -= 140;
            } else {
              score += 24;
            }

            if (
              score > bestScore ||
              (score === bestScore &&
                (groupCounts.get(readingEntry.normalized) ?? 0) <
                  (groupCounts.get(bestMatch.normalized) ?? 0))
            ) {
              bestScore = score;
              bestMatch = readingEntry;
            }
          });
        });

        // Require at least a weak phonetic signal before accepting the match.
        if (bestScore >= 30) {
          return bestMatch.normalized;
        }
      }

      let fallbackReading = preferredFallbackReadings[0].normalized;
      let lowestCount = Number.MAX_SAFE_INTEGER;
      preferredFallbackReadings.forEach((readingEntry) => {
        const count = groupCounts.get(readingEntry.normalized) ?? 0;
        if (count < lowestCount) {
          lowestCount = count;
          fallbackReading = readingEntry.normalized;
        }
      });
      return fallbackReading;
    };

    allAmalgamations.forEach((amalgamation) => {
      const group = getBestReadingGroup(amalgamation);
      groupedAmalgamations.get(group)?.push(amalgamation);
      groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
    });

    uniqueKanjiReadings.forEach((readingEntry) => {
      const anchor = readingAnchorsByReading.get(readingEntry.normalized);
      const group = (
        groupedAmalgamations.get(readingEntry.normalized) ?? []
      ).slice(0, MAX_AMALGAMATIONS_PER_READING);
      if (!anchor || group.length === 0) return;

      let placed = 0;
      let ringIndex = 0;

      while (placed < group.length) {
        const ringRadius = CLUSTER_RING_BASE_RADIUS + ringIndex * CLUSTER_RING_GAP;
        const ringCapacity = Math.max(
          1,
          Math.floor((CLUSTER_ARC_SPAN * ringRadius) / CLUSTER_NODE_SPACING)
        );
        const remaining = group.length - placed;
        const itemsInRing = Math.min(ringCapacity, remaining);
        const arcStart = anchor.angle - CLUSTER_ARC_SPAN / 2;

        for (let i = 0; i < itemsInRing; i += 1) {
          const angle =
            itemsInRing === 1
              ? anchor.angle
              : arcStart + ((i + 0.5) / itemsInRing) * CLUSTER_ARC_SPAN;
          const amalgamation = group[placed + i];
          const x = anchor.x + ringRadius * Math.cos(angle);
          const y = anchor.y + ringRadius * Math.sin(angle);

          nodes.push({
            id: amalgamation.id,
            x,
            y,
            type: "amalgamation",
            data: amalgamation,
          });

          connections.push({
            key: `reading-amalgamation-${readingEntry.normalized}-${amalgamation.id}`,
            x1: anchor.x,
            y1: anchor.y,
            x2: x,
            y2: y,
            opacity: 0.16,
            width: 1.4,
          });
        }

        placed += itemsInRing;
        ringIndex += 1;
      }
    });

    return { nodes, connections, readingAnchors };
  }, [subject, allSubjects]); // Updated dependency

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: introScale.value * zoomScale.value },
    ],
  }));

  const handleNodePress = (nodeId: number) => {
    if (nodeId === subjectId) return;
    // Push new screen instead of replace to keep history stack
    router.push({
      pathname: "/constellation",
      params: {
        id: nodeId.toString(),
        rootId: rootIdParam || idParam || subjectId.toString(),
        constellationDepth: (currentConstellationDepth + 1).toString(),
      },
    });
  };

  const handleNodeLongPress = (nodeId: number) => {
    router.push(`/subject/${nodeId}`);
  };

  const handleBack = () => {
    router.back();
  };

  const getConstellationDismissCount = () => {
    const state = navigation.getState();
    const routes = state?.routes ?? [];
    const currentIndex =
      typeof state?.index === "number" ? state.index : routes.length - 1;
    let consecutiveConstellationScreens = 0;

    for (let routeIndex = currentIndex; routeIndex >= 0; routeIndex -= 1) {
      const routeName = routes[routeIndex]?.name ?? "";
      if (
        routeName !== "constellation" &&
        !routeName.endsWith("/constellation")
      ) {
        break;
      }
      consecutiveConstellationScreens += 1;
    }

    if (consecutiveConstellationScreens > 0) {
      return consecutiveConstellationScreens;
    }

    return routes.length > 0 ? 1 : currentConstellationDepth;
  };

  const handleExitRabbitHole = () => {
    if (!rootIdParam && !depthParam) {
      router.back();
      return;
    }

    router.dismiss(getConstellationDismissCount());
  };

  if (!subject && loadingMissing) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: "#0f0f13",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <StatusBar style="light" />
        <TouchableOpacity
          style={[
            styles.backButton,
            { position: "absolute", top: topControlsOffset, left: 20 },
          ]}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: "white", marginTop: 20, textAlign: "center" }}>
          Calculating orbit...
        </Text>
      </View>
    );
  }

  if (!subject && !loadingMissing) {
    return (
      <View style={[styles.container, { backgroundColor: "#0f0f13" }]}>
        {/* Deep dark space background */}
        <TouchableOpacity
          style={[styles.backButton, { top: topControlsOffset }]}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: "white", marginTop: 100, textAlign: "center" }}>
          Subject not found
        </Text>
      </View>
    );
  }

  if (!subject) {
    return null;
  }

  // Get primary reading for footer
  const primaryReading =
    subject.data.readings?.find((r) => r.primary)?.reading || "";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: "#0f0f13" }]}>
        <StatusBar style="light" />

        {/* Header - Absolute positioned with safe area */}
        <View style={[styles.header, { top: topControlsOffset }]}>
          <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={26} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Constellation</Text>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleExitRabbitHole}
          >
            <Ionicons name="close" size={26} color="white" />
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={constellationGesture}>
          <View style={styles.gestureSurface}>
            <Animated.View
              style={[styles.graphContainer, animatedContainerStyle]}
            >
              <Svg
                height={GRAPH_CANVAS_HEIGHT}
                width={GRAPH_CANVAS_WIDTH}
                style={StyleSheet.absoluteFill}
              >
                {/* Connections */}
                {connections.map((conn) => (
                  <Line
                    key={conn.key}
                    x1={conn.x1}
                    y1={conn.y1}
                    x2={conn.x2}
                    y2={conn.y2}
                    stroke="rgb(255, 255, 255)"
                    strokeOpacity={(conn.opacity ?? 1) * BASE_CONNECTION_OPACITY}
                    strokeWidth={(conn.width ?? 2) * SUPERSAMPLE}
                  />
                ))}
              </Svg>

              {readingAnchors.map((anchor) => (
                <View
                  key={`reading-anchor-${anchor.reading}`}
                  style={[
                    styles.readingAnchor,
                    {
                      left: anchor.x - 24 * SUPERSAMPLE,
                      top: anchor.y - 12 * SUPERSAMPLE,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text style={styles.readingAnchorText}>{anchor.reading}</Text>
                </View>
              ))}

              {/* Nodes */}
              {nodes.map((node) => (
                <ConstellationNode
                  key={node.id}
                  node={node}
                  onPress={() => handleNodePress(node.id)}
                  onLongPress={() => handleNodeLongPress(node.id)}
                />
              ))}
            </Animated.View>
          </View>
        </GestureDetector>

        {/* Legend / Info */}
        <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
          <Text style={styles.footerText}>
            {subject.object.toUpperCase()} • {subject.data.meanings[0].meaning}
          </Text>
          {!!primaryReading && (
            <Text style={styles.footerSubText}>{primaryReading}</Text>
          )}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

function ConstellationNode({
  node,
  onPress,
  onLongPress,
}: {
  node: Node;
  onPress: () => void;
  onLongPress: () => void;
}) {
  // Random respiration effect
  const scale = useSharedValue(1);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1500 + Math.random() * 1000 }),
        withTiming(1, { duration: 1500 + Math.random() * 1000 })
      ),
      -1,
      true
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getNodeColor = (type: string) => {
    if (
      type === "radical" ||
      type === "kanji" ||
      type === "vocabulary" ||
      type === "kana_vocabulary"
    ) {
      return getSubjectTypeColor(type);
    }

    return "#ffffff";
  };

  const color = getNodeColor(node.data.object);
  const isCenter = node.type === "center";
  const isRadical = node.data.object === "radical";

  const radicalBestImage = isRadical
    ? pickBestImage(node.data.data.character_images)
    : null;
  const radicalSvgUrl = radicalBestImage?.type === "svg" ? radicalBestImage.url : null;
  const radicalSvgXml = useRemoteSvg(radicalSvgUrl, "#ffffff");
  const radicalPngUrl =
    radicalBestImage?.type === "png"
      ? radicalBestImage.url
      : ((node.data.data as any).image_url ?? null);
  const processedRadicalImageUrl = radicalPngUrl?.replace(/^@/, "") ?? null;
  const nodeCharacters = node.data.data.characters;

  // Dynamic sizing based on content length
  const charLength = node.data.data.characters?.length || 1;
  let baseSize = (isCenter ? 80 : 60) * SUPERSAMPLE;

  // Adjust size for long words to fit text
  if (charLength > 2) {
    baseSize = (isCenter ? 100 : 70) * SUPERSAMPLE;
  }

  const fontSize =
    (isCenter ? (charLength > 2 ? 22 : 32) : charLength > 2 ? 10 : 18) *
    SUPERSAMPLE;

  // Show reading if it's the center node OR if it's a vocabulary node
  // "Except if it is a vocabulary, then show the reading... inside the planet"
  const isVocab =
    node.data.object === "vocabulary" ||
    (node.data.object as string) === "kana_vocabulary";
  const shouldShowReading = isCenter || isVocab;

  // Get primary reading
  const reading = node.data.data.readings?.find((r) => r.primary)?.reading;

  return (
    <Animated.View
      style={[
        styles.nodeContainer,
        {
          left: node.x - baseSize / 2,
          top: node.y - baseSize / 2,
          width: baseSize,
          height: baseSize,
        },
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        onPress={() => {
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
          }
          onPress();
        }}
        onLongPress={() => {
          longPressTriggeredRef.current = true;
          onLongPress();
        }}
        delayLongPress={300}
        activeOpacity={0.8}
        style={[
          styles.nodeCircle,
          {
            backgroundColor: color,
            shadowColor: color,
            width: baseSize,
            height: baseSize,
            borderRadius: baseSize / 2,
          },
        ]}
      >
        <View style={styles.nodeContent}>
          {nodeCharacters ? (
            <Text
              style={[styles.nodeText, { fontSize }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {nodeCharacters}
            </Text>
          ) : radicalSvgXml ? (
            <SvgXml
              xml={radicalSvgXml}
              width={Math.floor(baseSize * 0.48)}
              height={Math.floor(baseSize * 0.48)}
            />
          ) : processedRadicalImageUrl ? (
            <Image
              source={{ uri: processedRadicalImageUrl }}
              style={[
                styles.nodeRadicalImage,
                {
                  width: Math.floor(baseSize * 0.48),
                  height: Math.floor(baseSize * 0.48),
                },
              ]}
              resizeMode="contain"
            />
          ) : (
            <Text
              style={[
                styles.nodeText,
                { fontSize: Math.max(10 * SUPERSAMPLE, fontSize - 4 * SUPERSAMPLE) },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {node.data.data.meanings?.[0]?.meaning || "?"}
            </Text>
          )}
          {/* Show reading inside the node for center or vocabulary items */}
          {reading && shouldShowReading && (
            <Text
              style={[
                styles.nodeReading,
                // Adjust reading size for non-center nodes
                !isCenter && {
                  fontSize: 8 * SUPERSAMPLE,
                  marginTop: 1 * SUPERSAMPLE,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {reading}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 50, // Higher zIndex to be clickable above gesture detector
  },
  backButton: {
    // Keep for loading state components
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
  },
  iconButton: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  graphContainer: {
    position: "absolute",
    left: -GRAPH_CANVAS_PADDING,
    top: -GRAPH_CANVAS_PADDING,
    width: GRAPH_CANVAS_WIDTH,
    height: GRAPH_CANVAS_HEIGHT,
  },
  gestureSurface: {
    flex: 1,
  },
  nodeContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20, // ensure nodes are above lines
  },
  nodeCircle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2 * SUPERSAMPLE,
    borderColor: "rgba(255,255,255,0.5)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15 * SUPERSAMPLE,
    elevation: 10 * SUPERSAMPLE,
  },
  nodeContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  nodeText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  nodeRadicalImage: {
    tintColor: "#ffffff",
  },
  nodeReading: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12 * SUPERSAMPLE,
    marginTop: 2 * SUPERSAMPLE,
  },
  floatingReadingContainer: {
    position: "absolute",
    bottom: -20,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  floatingReading: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  readingAnchor: {
    position: "absolute",
    minWidth: 48 * SUPERSAMPLE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8 * SUPERSAMPLE,
    paddingVertical: 4 * SUPERSAMPLE,
    borderRadius: 12 * SUPERSAMPLE,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1 * SUPERSAMPLE,
    borderColor: "rgba(255,255,255,0.2)",
    zIndex: 18,
  },
  readingAnchorText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12 * SUPERSAMPLE,
    fontWeight: "700",
    letterSpacing: 0.3 * SUPERSAMPLE,
  },
  footer: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
    pointerEvents: "none", // Allow clicks to pass through to gesture detector
  },
  footerText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
    textAlign: "center",
    textShadowColor: "black",
    textShadowRadius: 4,
  },
  footerSubText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },
});
