import { Ionicons } from "@expo/vector-icons";
import {
  HanziWriter,
  useHanziWriter,
} from "@jamsch/react-native-hanzi-writer";
import * as Haptics from "@/src/utils/haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  PanResponderInstance,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { loadKanjiWriterData } from "../utils/kanjiWriterDataLoader";
import { useTheme } from "../utils/theme";

type InternalPoint = {
  x: number;
  y: number;
};

type FreehandPoint = {
  x: number;
  y: number;
  width: number;
};

type StrokeLike = {
  points: InternalPoint[];
  getAverageDistance: (points: InternalPoint[]) => number;
  getStartingPoint: () => InternalPoint;
  getEndingPoint: () => InternalPoint;
  getLength: () => number;
};

type FreehandThresholds = {
  minSimilarityPercent: number;
  minCoveragePercent: number;
  maxStrokeDelta: number;
};

type FreehandChecks = {
  similarity: boolean;
  coverage: boolean;
  strokeCount: boolean;
};

export interface FreehandDecisionDetails {
  similarityPercent: number;
  coveragePercent: number;
  strokeMatchPercent: number;
  drawnStrokeCount: number;
  expectedStrokeCount: number;
  strokeDelta: number;
  thresholds: FreehandThresholds;
  checks: FreehandChecks;
}

export interface KanjiFreehandQuizResult {
  totalMistakes: number;
  character: string;
  similarityPercent: number;
  isCorrect: boolean;
  decisionDetails: FreehandDecisionDetails;
}

export interface KanjiFreehandQuizProps {
  character: string;
  onComplete?: (result: KanjiFreehandQuizResult) => void;
  onSubmissionStateChange?: (isSubmitted: boolean) => void;
  leniency?: number;
  onSkip?: () => void;
  onNext?: () => void;
  onUnavailable?: () => void;
}

const INTERNAL_SIZE = 1024;
const INTERNAL_Y_OFFSET = 124;
const SCORE_GRID_SIZE = 128;
const DRAWABLE_TOP_MARGIN = -5;
const DEFAULT_FORCE = 0.5;
const FORCE_MIN_WIDTH = 8;
const FORCE_MAX_WIDTH = 20;
const MIN_POINT_DISTANCE = 1.2;
const MASK_MIN_RADIUS = 1.2;
const CANVAS_INNER_SIZE = 300;
const LOADER_PENDING_TIMEOUT_MS = 12000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clamp01 = (value: number) => clamp(value, 0, 1);

const pointDistance = (
  point1: { x: number; y: number },
  point2: { x: number; y: number },
) => Math.hypot(point1.x - point2.x, point1.y - point2.y);

const polylineLength = (points: InternalPoint[]) => {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += pointDistance(points[i - 1], points[i]);
  }
  return total;
};

const toInternalPoint = (
  point: { x: number; y: number },
  canvasSize: number,
): InternalPoint => ({
  x: clamp((point.x / canvasSize) * INTERNAL_SIZE, 0, INTERNAL_SIZE),
  y: clamp(
    ((canvasSize - clamp(point.y - DRAWABLE_TOP_MARGIN, 0, canvasSize)) / canvasSize) *
      INTERNAL_SIZE -
      INTERNAL_Y_OFFSET,
    -INTERNAL_Y_OFFSET,
    900,
  ),
});

const normalizeForce = (
  force: number | undefined,
) => {
  if (typeof force !== "number" || Number.isNaN(force)) {
    return DEFAULT_FORCE;
  }

  return clamp(force, 0, 1);
};

const forceToWidth = (normalizedForce: number) =>
  FORCE_MIN_WIDTH + (FORCE_MAX_WIDTH - FORCE_MIN_WIDTH) * normalizedForce;

const maskIndex = (x: number, y: number, size: number) => y * size + x;

const drawCircleOnMask = (
  mask: Uint8Array,
  size: number,
  centerX: number,
  centerY: number,
  radius: number,
) => {
  const r = Math.max(MASK_MIN_RADIUS, radius);
  const rSquared = r * r;
  const startX = Math.max(0, Math.floor(centerX - r));
  const endX = Math.min(size - 1, Math.ceil(centerX + r));
  const startY = Math.max(0, Math.floor(centerY - r));
  const endY = Math.min(size - 1, Math.ceil(centerY + r));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= rSquared) {
        mask[maskIndex(x, y, size)] = 1;
      }
    }
  }
};

const drawSegmentOnMask = (
  mask: Uint8Array,
  size: number,
  from: { x: number; y: number; radius: number },
  to: { x: number; y: number; radius: number },
) => {
  const steps = Math.max(
    1,
    Math.ceil(pointDistance(from, to) * 2),
  );

  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const radius = from.radius + (to.radius - from.radius) * t;
    drawCircleOnMask(mask, size, x, y, radius);
  }
};

const INTERNAL_TO_MASK_SCALE = (SCORE_GRID_SIZE - 1) / INTERNAL_SIZE;
const INTERNAL_TO_MASK_Y_OFFSET = INTERNAL_Y_OFFSET * INTERNAL_TO_MASK_SCALE;

const internalPointToMask = (point: InternalPoint) => ({
  x: point.x * INTERNAL_TO_MASK_SCALE,
  y:
    (SCORE_GRID_SIZE - 1) -
    (point.y * INTERNAL_TO_MASK_SCALE + INTERNAL_TO_MASK_Y_OFFSET),
});

const createExpectedMask = (strokes: StrokeLike[]): Uint8Array => {
  const mask = new Uint8Array(SCORE_GRID_SIZE * SCORE_GRID_SIZE);
  const referenceRadius = 2.1;

  for (const stroke of strokes) {
    const points = stroke.points;
    if (points.length === 0) {
      continue;
    }

    const first = points[0];
    let previous = {
      ...internalPointToMask(first),
      radius: referenceRadius,
    };
    drawCircleOnMask(mask, SCORE_GRID_SIZE, previous.x, previous.y, referenceRadius);

    for (let i = 1; i < points.length; i += 1) {
      const nextPoint = points[i];
      const next = {
        ...internalPointToMask(nextPoint),
        radius: referenceRadius,
      };
      drawSegmentOnMask(mask, SCORE_GRID_SIZE, previous, next);
      previous = next;
    }
  }

  return mask;
};

const createDrawnMask = (
  strokes: FreehandPoint[][],
  canvasSize: number,
): Uint8Array => {
  const mask = new Uint8Array(SCORE_GRID_SIZE * SCORE_GRID_SIZE);
  const internalUnitToMask = (SCORE_GRID_SIZE - 1) / INTERNAL_SIZE;
  const widthToMaskRadius = ((SCORE_GRID_SIZE - 1) / canvasSize) / 2;

  for (const stroke of strokes) {
    if (stroke.length === 0) {
      continue;
    }

    const firstPoint = stroke[0];
    const firstInternal = toInternalPoint(firstPoint, canvasSize);
    const firstMaskPoint = internalPointToMask(firstInternal);
    let previous = {
      x: firstMaskPoint.x,
      y: firstMaskPoint.y,
      radius: Math.max(
        MASK_MIN_RADIUS,
        firstPoint.width * widthToMaskRadius + internalUnitToMask * 0.4,
      ),
    };
    drawCircleOnMask(mask, SCORE_GRID_SIZE, previous.x, previous.y, previous.radius);

    for (let i = 1; i < stroke.length; i += 1) {
      const point = stroke[i];
      const internalPoint = toInternalPoint(point, canvasSize);
      const maskPoint = internalPointToMask(internalPoint);
      const current = {
        x: maskPoint.x,
        y: maskPoint.y,
        radius: Math.max(
          MASK_MIN_RADIUS,
          point.width * widthToMaskRadius + internalUnitToMask * 0.4,
        ),
      };
      drawSegmentOnMask(mask, SCORE_GRID_SIZE, previous, current);
      previous = current;
    }
  }

  return mask;
};

const getDirectionScore = (
  points: InternalPoint[],
  strokeStart: InternalPoint,
  strokeEnd: InternalPoint,
) => {
  const userStart = points[0];
  const userEnd = points[points.length - 1];
  const userVector = {
    x: userEnd.x - userStart.x,
    y: userEnd.y - userStart.y,
  };
  const strokeVector = {
    x: strokeEnd.x - strokeStart.x,
    y: strokeEnd.y - strokeStart.y,
  };

  const userMagnitude = Math.hypot(userVector.x, userVector.y);
  const strokeMagnitude = Math.hypot(strokeVector.x, strokeVector.y);
  if (userMagnitude < 1 || strokeMagnitude < 1) {
    return 0;
  }

  const dot = userVector.x * strokeVector.x + userVector.y * strokeVector.y;
  const cosine = clamp(dot / (userMagnitude * strokeMagnitude), -1, 1);
  return (cosine + 1) / 2;
};

const evaluateFreehandAttempt = (
  expectedStrokes: StrokeLike[],
  drawnStrokes: FreehandPoint[][],
  leniency: number,
  canvasSize: number,
): {
  totalMistakes: number;
  isCorrect: boolean;
  details: FreehandDecisionDetails;
} => {
  const normalizedLeniency = clamp(leniency, 0.6, 2);
  const expectedStrokeCount = expectedStrokes.length;
  const drawnStrokeCount = drawnStrokes.length;
  const strokeDelta = Math.abs(drawnStrokeCount - expectedStrokeCount);

  const minSimilarityPercent = Math.round(
    clamp(74 - (normalizedLeniency - 1) * 16, 56, 82),
  );
  const minCoveragePercent = Math.round(
    clamp(66 - (normalizedLeniency - 1) * 18, 48, 74),
  );
  const minDeltaByComplexity = expectedStrokeCount >= 8 ? 2 : 1;
  const strokeDeltaBase = Math.round(expectedStrokeCount * 0.16);
  const strokeDeltaLeniencyAdjustment = Math.round((normalizedLeniency - 1) * 1.0);
  const maxStrokeDelta = Math.round(
    clamp(
      strokeDeltaBase + strokeDeltaLeniencyAdjustment,
      minDeltaByComplexity,
      Math.max(minDeltaByComplexity, Math.round(expectedStrokeCount * 0.24)),
    ),
  );

  if (expectedStrokeCount === 0) {
    const emptyDetails: FreehandDecisionDetails = {
      similarityPercent: 0,
      coveragePercent: 0,
      strokeMatchPercent: 0,
      drawnStrokeCount,
      expectedStrokeCount,
      strokeDelta,
      thresholds: {
        minSimilarityPercent,
        minCoveragePercent,
        maxStrokeDelta,
      },
      checks: {
        similarity: false,
        coverage: false,
        strokeCount: strokeDelta <= maxStrokeDelta,
      },
    };

    return {
      totalMistakes: 0,
      isCorrect: false,
      details: emptyDetails,
    };
  }

  const avgDistanceThreshold = 350 * normalizedLeniency;
  const startEndThreshold = 250 * normalizedLeniency;
  const perStrokePassThreshold = clamp(
    0.67 - (normalizedLeniency - 1) * 0.1,
    0.5,
    0.72,
  );

  let matchedStrokes = 0;
  for (let i = 0; i < expectedStrokes.length; i += 1) {
    const expectedStroke = expectedStrokes[i];
    const drawnStroke = drawnStrokes[i] ?? [];
    const drawnPoints = drawnStroke.map((point) => toInternalPoint(point, canvasSize));
    if (drawnPoints.length < 2) {
      continue;
    }

    const averageDistanceScore = clamp01(
      1 - expectedStroke.getAverageDistance(drawnPoints) / avgDistanceThreshold,
    );
    const startDistanceScore = clamp01(
      1 -
        pointDistance(drawnPoints[0], expectedStroke.getStartingPoint()) /
          startEndThreshold,
    );
    const endDistanceScore = clamp01(
      1 -
        pointDistance(
          drawnPoints[drawnPoints.length - 1],
          expectedStroke.getEndingPoint(),
        ) /
          startEndThreshold,
    );
    const expectedLength = expectedStroke.getLength();
    const drawnLength = polylineLength(drawnPoints);
    const lengthScore =
      expectedLength > 0
        ? Math.min(drawnLength, expectedLength) /
          Math.max(drawnLength, expectedLength)
        : 0;
    const directionScore = getDirectionScore(
      drawnPoints,
      expectedStroke.getStartingPoint(),
      expectedStroke.getEndingPoint(),
    );

    const strokeScore =
      averageDistanceScore * 0.5 +
      startDistanceScore * 0.2 +
      endDistanceScore * 0.2 +
      lengthScore * 0.08 +
      directionScore * 0.02;

    if (strokeScore >= perStrokePassThreshold) {
      matchedStrokes += 1;
    }
  }

  const expectedMask = createExpectedMask(expectedStrokes);
  const drawnMask = createDrawnMask(drawnStrokes, canvasSize);

  let expectedPixels = 0;
  let overlapPixels = 0;
  for (let i = 0; i < expectedMask.length; i += 1) {
    const expectedPixel = expectedMask[i] === 1;
    const drawnPixel = drawnMask[i] === 1;
    if (expectedPixel) {
      expectedPixels += 1;
    }
    if (expectedPixel && drawnPixel) {
      overlapPixels += 1;
    }
  }

  const coverageRaw = expectedPixels > 0 ? overlapPixels / expectedPixels : 0;
  const strokeMatchRatio = matchedStrokes / Math.max(expectedStrokeCount, 1);
  const coverageComposite =
    coverageRaw * 0.2 +
    strokeMatchRatio * 0.8;
  const coveragePercent = Math.round(
    clamp(coverageComposite * 100 + strokeMatchRatio * 12, 0, 100),
  );
  const strokeMatchPercent = Math.round(strokeMatchRatio * 100);

  const strokePenalty =
    Math.min(strokeDelta / Math.max(expectedStrokeCount, 1), 1) * 10;
  const similarityPercent = Math.round(
    clamp(strokeMatchPercent * 0.6 + coveragePercent * 0.4 - strokePenalty, 0, 100),
  );

  const checks: FreehandChecks = {
    similarity: similarityPercent >= minSimilarityPercent,
    coverage: coveragePercent >= minCoveragePercent,
    strokeCount: strokeDelta <= maxStrokeDelta,
  };

  const isCorrect =
    checks.similarity &&
    checks.coverage &&
    checks.strokeCount;

  const estimatedMatchedStrokes = Math.round(expectedStrokeCount * coverageComposite);
  const totalMistakes = clamp(
    expectedStrokeCount - Math.max(matchedStrokes, estimatedMatchedStrokes),
    0,
    expectedStrokeCount,
  );

  return {
    totalMistakes,
    isCorrect,
    details: {
      similarityPercent,
      coveragePercent,
      strokeMatchPercent,
      drawnStrokeCount,
      expectedStrokeCount,
      strokeDelta,
      thresholds: {
        minSimilarityPercent,
        minCoveragePercent,
        maxStrokeDelta,
      },
      checks,
    },
  };
};

function GridOverlay({
  size,
  color,
}: {
  size: number;
  color: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Line
        x1={8}
        y1={8}
        x2={size - 8}
        y2={size - 8}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="6,6"
      />
      <Line
        x1={size - 8}
        y1={8}
        x2={8}
        y2={size - 8}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="6,6"
      />
    </Svg>
  );
}

export default function KanjiFreehandQuiz({
  character,
  onComplete,
  onSubmissionStateChange,
  leniency = 1.0,
  onSkip,
  onNext,
  onUnavailable,
}: KanjiFreehandQuizProps) {
  const { theme } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const canvasSize = isTablet
    ? Math.min(400, screenWidth * 0.5)
    : screenWidth - 64;
  const hanziScale = canvasSize / CANVAS_INNER_SIZE;

  const [showOutline, setShowOutline] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [strokes, setStrokes] = useState<FreehandPoint[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<FreehandPoint[]>([]);
  const [result, setResult] = useState<{
    totalMistakes: number;
    isCorrect: boolean;
    details: FreehandDecisionDetails;
  } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [replayMode, setReplayMode] = useState<"none" | "character" | "user">(
    "none",
  );
  const [replayStrokes, setReplayStrokes] = useState<FreehandPoint[][]>([]);
  const [replayCurrentStroke, setReplayCurrentStroke] = useState<FreehandPoint[]>(
    [],
  );

  const showGridRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const completionDataRef = useRef<KanjiFreehandQuizResult | null>(null);
  const cancelAnimationRef = useRef<() => void>(() => {});
  const summaryAnimation = useRef(new Animated.Value(0)).current;
  const userReplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const strokesRef = useRef<FreehandPoint[][]>([]);
  const currentStrokeRef = useRef<FreehandPoint[]>([]);
  const isCompleteRef = useRef(false);
  const canvasSizeRef = useRef(canvasSize);
  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  const writer = useHanziWriter({
    character,
    loader: loadKanjiWriterData,
  });

  useEffect(() => {
    cancelAnimationRef.current = () => {
      writer.animator.cancelAnimation();
    };
  }, [writer.animator]);

  const clearUserReplayTimer = useCallback(() => {
    if (userReplayTimerRef.current) {
      clearTimeout(userReplayTimerRef.current);
      userReplayTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearUserReplayTimer();
    };
  }, [clearUserReplayTimer]);

  const resetAttemptState = useCallback(() => {
    clearUserReplayTimer();
    setIsComplete(false);
    setIsAnimating(false);
    setReplayMode("none");
    setReplayStrokes([]);
    setReplayCurrentStroke([]);
    setStrokes([]);
    setCurrentStroke([]);
    setResult(null);
    onSubmissionStateChange?.(false);
    completionDataRef.current = null;
    strokesRef.current = [];
    currentStrokeRef.current = [];
    isCompleteRef.current = false;
    cancelAnimationRef.current();
  }, [clearUserReplayTimer, onSubmissionStateChange]);

  const appendPointToCurrentStroke = useCallback((point: FreehandPoint) => {
    currentStrokeRef.current = [...currentStrokeRef.current, point];
    setCurrentStroke(currentStrokeRef.current);
  }, []);

  const beginStroke = useCallback(
    (
      event: GestureResponderEvent,
      _gestureState: PanResponderGestureState,
    ) => {
      if (isCompleteRef.current) {
        return;
      }

      const normalizedForce = normalizeForce(event.nativeEvent.force);
      const point: FreehandPoint = {
        x: clamp(event.nativeEvent.locationX, 0, canvasSizeRef.current),
        y: clamp(event.nativeEvent.locationY, 0, canvasSizeRef.current),
        width: forceToWidth(normalizedForce),
      };
      currentStrokeRef.current = [point];
      setCurrentStroke([point]);
    },
    [],
  );

  const moveStroke = useCallback(
    (
      event: GestureResponderEvent,
      _gestureState: PanResponderGestureState,
    ) => {
      if (isCompleteRef.current || currentStrokeRef.current.length === 0) {
        return;
      }

      const lastPoint = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      const normalizedForce = normalizeForce(event.nativeEvent.force);
      const nextPoint: FreehandPoint = {
        x: clamp(event.nativeEvent.locationX, 0, canvasSizeRef.current),
        y: clamp(event.nativeEvent.locationY, 0, canvasSizeRef.current),
        width: forceToWidth(normalizedForce),
      };

      if (pointDistance(lastPoint, nextPoint) < MIN_POINT_DISTANCE) {
        return;
      }

      appendPointToCurrentStroke(nextPoint);
    },
    [appendPointToCurrentStroke],
  );

  const finishStroke = useCallback(() => {
    if (isCompleteRef.current) {
      return;
    }

    if (currentStrokeRef.current.length < 2) {
      currentStrokeRef.current = [];
      setCurrentStroke([]);
      return;
    }

    const nextStrokes = [...strokesRef.current, currentStrokeRef.current];
    strokesRef.current = nextStrokes;
    setStrokes(nextStrokes);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
  }, []);

  const panResponder: PanResponderInstance = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isCompleteRef.current,
        onStartShouldSetPanResponderCapture: () => !isCompleteRef.current,
        onMoveShouldSetPanResponder: () => !isCompleteRef.current,
        onMoveShouldSetPanResponderCapture: () => !isCompleteRef.current,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: beginStroke,
        onPanResponderMove: moveStroke,
        onPanResponderRelease: finishStroke,
        onPanResponderTerminate: finishStroke,
      }),
    [beginStroke, finishStroke, moveStroke],
  );

  useEffect(() => {
    if (writer.characterState.status === "resolved" && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setIsTransitioning(false);
    }
  }, [writer.characterState.status]);

  useEffect(() => {
    setIsTransitioning(true);
    hasInitializedRef.current = false;
    resetAttemptState();
    setShowOutline(false);
    setShowGrid(showGridRef.current);
  }, [character, resetAttemptState]);

  useEffect(() => {
    if (writer.characterState.status !== "rejected") {
      return;
    }

    const callback = onUnavailable || onSkip;
    if (!callback) {
      return;
    }

    const timer = setTimeout(() => {
      callback();
    }, 1000);
    return () => clearTimeout(timer);
  }, [writer.characterState.status, onUnavailable, onSkip]);

  useEffect(() => {
    if (writer.characterState.status !== "pending") {
      return;
    }

    const callback = onUnavailable || onSkip;
    if (!callback) {
      return;
    }

    const timer = setTimeout(() => {
      callback();
    }, LOADER_PENDING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [character, writer.characterState.status, onUnavailable, onSkip]);

  const handleToggleOutline = useCallback(() => {
    setShowOutline((prev) => !prev);
  }, []);

  const handleToggleGrid = useCallback(() => {
    setShowGrid((prev) => {
      const next = !prev;
      showGridRef.current = next;
      return next;
    });
  }, []);

  const handleReplayCorrect = useCallback(() => {
    if (
      writer.characterState.status !== "resolved" ||
      isAnimating ||
      replayMode === "user"
    ) {
      return;
    }

    clearUserReplayTimer();
    setReplayMode("character");
    setReplayStrokes([]);
    setReplayCurrentStroke([]);
    setIsAnimating(true);
    writer.animator.animateCharacter({
      strokeDuration: 500,
      delayBetweenStrokes: 400,
      onComplete: () => {
        setIsAnimating(false);
        setReplayMode("none");
      },
    });
  }, [
    clearUserReplayTimer,
    isAnimating,
    replayMode,
    writer.animator,
    writer.characterState.status,
  ]);

  const handleReplayMine = useCallback(() => {
    if (isAnimating || replayMode === "user") {
      return;
    }
    const snapshot = strokesRef.current.map((stroke) =>
      stroke.map((point) => ({ ...point })),
    );
    if (snapshot.length === 0) {
      return;
    }

    clearUserReplayTimer();
    cancelAnimationRef.current();
    setIsAnimating(false);
    setReplayMode("user");
    setReplayStrokes([]);
    setReplayCurrentStroke([]);

    let strokeIndex = 0;

    const runStroke = () => {
      if (strokeIndex >= snapshot.length) {
        setReplayMode("none");
        setReplayCurrentStroke([]);
        setReplayStrokes([]);
        userReplayTimerRef.current = null;
        return;
      }

      const stroke = snapshot[strokeIndex];
      let pointIndex = 1;
      setReplayCurrentStroke(stroke.slice(0, 1));

      const drawNextPoint = () => {
        if (pointIndex >= stroke.length) {
          setReplayStrokes((prev) => [...prev, stroke]);
          setReplayCurrentStroke([]);
          strokeIndex += 1;
          userReplayTimerRef.current = setTimeout(runStroke, 120);
          return;
        }

        setReplayCurrentStroke(stroke.slice(0, pointIndex + 1));
        pointIndex += 1;
        userReplayTimerRef.current = setTimeout(drawNextPoint, 16);
      };

      userReplayTimerRef.current = setTimeout(drawNextPoint, 16);
    };

    runStroke();
  }, [clearUserReplayTimer, isAnimating, replayMode]);

  const handleClear = useCallback(() => {
    clearUserReplayTimer();
    setReplayMode("none");
    setReplayStrokes([]);
    setReplayCurrentStroke([]);
    setStrokes([]);
    strokesRef.current = [];
    setCurrentStroke([]);
    currentStrokeRef.current = [];
  }, [clearUserReplayTimer]);

  const handleSubmit = useCallback(() => {
    if (writer.characterState.status !== "resolved") {
      return;
    }

    clearUserReplayTimer();
    setReplayMode("none");
    setReplayStrokes([]);
    setReplayCurrentStroke([]);

    if (currentStrokeRef.current.length >= 2) {
      const nextStrokes = [...strokesRef.current, currentStrokeRef.current];
      strokesRef.current = nextStrokes;
      setStrokes(nextStrokes);
      setCurrentStroke([]);
      currentStrokeRef.current = [];
    }

    const evaluation = evaluateFreehandAttempt(
      writer.characterState.data.strokes as StrokeLike[],
      strokesRef.current,
      leniency,
      canvasSize,
    );

    const resultData: KanjiFreehandQuizResult = {
      totalMistakes: evaluation.totalMistakes,
      character,
      similarityPercent: evaluation.details.similarityPercent,
      isCorrect: evaluation.isCorrect,
      decisionDetails: evaluation.details,
    };
    completionDataRef.current = resultData;
    setResult(evaluation);
    setIsComplete(true);
    onSubmissionStateChange?.(true);
    isCompleteRef.current = true;

    if (evaluation.isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [
    canvasSize,
    character,
    clearUserReplayTimer,
    leniency,
    onSubmissionStateChange,
    writer.characterState,
  ]);

  const handleRetry = useCallback(() => {
    resetAttemptState();
  }, [resetAttemptState]);

  const handleNext = useCallback(() => {
    if (!completionDataRef.current) {
      return;
    }
    clearUserReplayTimer();
    setReplayMode("none");
    setReplayStrokes([]);
    setReplayCurrentStroke([]);
    onComplete?.(completionDataRef.current);
    onNext?.();
  }, [clearUserReplayTimer, onComplete, onNext]);

  useEffect(() => {
    if (!result) {
      summaryAnimation.setValue(0);
      return;
    }

    summaryAnimation.setValue(0);
    Animated.timing(summaryAnimation, {
      toValue: 1,
      duration: 520,
      useNativeDriver: false,
    }).start();
  }, [result, summaryAnimation]);

  const gridColor = theme.isDark
    ? "rgba(255,255,255,0.15)"
    : "rgba(0,0,0,0.1)";
  const userStrokeColor = theme.isDark ? "#ffffff" : "#111111";
  const canvasBackground = theme.isDark ? "#1a1a1a" : "#fafafa";
  const canvasShadowColor = theme.isDark ? "#000" : "#333";
  const summaryMaxHeight = Math.max(120, Math.min(190, screenHeight * 0.22));

  if (isTransitioning || writer.characterState.status === "pending") {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.canvasContainer,
            {
              width: canvasSize,
              height: canvasSize,
              backgroundColor: canvasBackground,
              shadowColor: canvasShadowColor,
            },
          ]}
        >
          {showGrid && (
            <GridOverlay size={canvasSize} color={gridColor} />
          )}
          <View style={styles.loadingInner}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (writer.characterState.status === "rejected") {
    const errorCallback = onUnavailable || onSkip;
    const hasReplacement = !!onUnavailable;

    return (
      <View style={styles.container}>
        <View
          style={[
            styles.canvasContainer,
            {
              width: canvasSize,
              height: canvasSize,
              backgroundColor: canvasBackground,
              shadowColor: canvasShadowColor,
            },
          ]}
        >
          <View style={styles.errorInnerContainer}>
            <Ionicons
              name={hasReplacement ? "swap-horizontal" : "alert-circle"}
              size={48}
              color={hasReplacement ? theme.primary : theme.error}
            />
            <Text
              style={[
                styles.errorText,
                { color: hasReplacement ? theme.textColor : theme.error },
              ]}
            >
              Stroke data not available
            </Text>
            <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>
              {character}
            </Text>
            <Text style={[styles.autoSkipText, { color: theme.textSecondary }]}>
              {hasReplacement
                ? "Finding another kanji..."
                : "Skipping automatically..."}
            </Text>
          </View>
        </View>
        {errorCallback && (
          <TouchableOpacity
            style={[styles.skipNowButton, { backgroundColor: theme.primary }]}
            onPress={errorCallback}
          >
            <Ionicons name="arrow-forward" size={18} color="#fff" />
            <Text style={styles.skipButtonText}>
              {hasReplacement ? "Next" : "Skip Now"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const resultDetails = result?.details;
  const isCorrect = result?.isCorrect ?? false;
  const completionColor = isCorrect ? "#4caf50" : "#f44336";

  const renderStroke = (stroke: FreehandPoint[], prefix: string) => {
    const segments = [];
    for (let i = 1; i < stroke.length; i += 1) {
      const previous = stroke[i - 1];
      const current = stroke[i];
      segments.push(
        <Line
          key={`${prefix}.seg.${i}`}
          x1={previous.x}
          y1={previous.y}
          x2={current.x}
          y2={current.y}
          stroke={userStrokeColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={(previous.width + current.width) / 2}
        />,
      );
    }

    if (stroke.length === 1) {
      const point = stroke[0];
      segments.push(
        <Circle
          key={`${prefix}.dot`}
          cx={point.x}
          cy={point.y}
          r={point.width / 2}
          fill={userStrokeColor}
        />,
      );
    }

    return segments;
  };

  const renderDecisionBar = ({
    label,
    value,
    threshold,
    requirementText,
    passes,
    mode,
  }: {
    label: string;
    value: number;
    threshold: number;
    requirementText: string;
    passes: boolean;
    mode: "min" | "max";
  }) => {
    const domain = mode === "min" ? 100 : Math.max(value, threshold, 1);
    const valuePercent = clamp((value / domain) * 100, 0, 100);
    const thresholdPercent = clamp((threshold / domain) * 100, 0, 100);
    const animatedWidth = summaryAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", `${valuePercent}%`],
    });

    return (
      <View key={label} style={styles.metricBlock}>
        <View style={styles.metricHeader}>
          <Text style={[styles.metricLabel, { color: theme.textColor }]}>
            {label}
          </Text>
          <Text
            style={[
              styles.metricValue,
              { color: passes ? "#4caf50" : "#f44336" },
            ]}
          >
            {mode === "min" ? `${value}%` : value}
          </Text>
        </View>

        <View
          style={[
            styles.metricTrack,
            { backgroundColor: theme.isDark ? "#161616" : "#f0f2f5" },
          ]}
        >
          <Animated.View
            style={[
              styles.metricFill,
              {
                backgroundColor: passes ? "#4caf50" : "#f44336",
                width: animatedWidth,
              },
            ]}
          />
          <View
            style={[
              styles.metricRequirement,
              { left: `${thresholdPercent}%` },
            ]}
          />
        </View>

        <View style={styles.metricFooter}>
          <Text style={[styles.metricRequirementText, { color: theme.textSecondary }]}>
            {requirementText}
          </Text>
          <Text style={[styles.metricRequirementText, { color: theme.textSecondary }]}>
            {passes ? "Pass" : "Fail"}
          </Text>
        </View>
      </View>
    );
  };

  const renderStrokeDeltaBar = (details: FreehandDecisionDetails) => {
    const expected = details.expectedStrokeCount;
    const drawn = details.drawnStrokeCount;
    const allowedDelta = details.thresholds.maxStrokeDelta;
    const visualDelta = Math.max(2, allowedDelta * 2);
    const rangeMin = Math.max(0, expected - visualDelta);
    const rangeMax = Math.max(expected + visualDelta, drawn + 1);
    const rangeSize = Math.max(1, rangeMax - rangeMin);
    const toPercent = (value: number) =>
      clamp(((value - rangeMin) / rangeSize) * 100, 0, 100);

    const passStart = toPercent(expected - allowedDelta);
    const passEnd = toPercent(expected + allowedDelta);
    const exactPosition = toPercent(expected);
    const drawnPosition = toPercent(drawn);
    const animatedFillWidth = summaryAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", `${drawnPosition}%`],
    });

    return (
      <View style={styles.metricBlock}>
        <View style={styles.metricHeader}>
          <Text style={[styles.metricLabel, { color: theme.textColor }]}>
            Stroke delta
          </Text>
          <Text
            style={[
              styles.metricValue,
              { color: details.checks.strokeCount ? "#4caf50" : "#f44336" },
            ]}
          >
            {details.strokeDelta}
          </Text>
        </View>

        <View
          style={[
            styles.metricTrack,
            { backgroundColor: theme.isDark ? "#161616" : "#f0f2f5" },
          ]}
        >
          <Animated.View
            style={[
              styles.strokeDeltaFill,
              {
                width: animatedFillWidth,
                backgroundColor: details.checks.strokeCount ? "#4caf50" : "#f44336",
              },
            ]}
          />
          <View
            style={[
              styles.strokeDeltaPassZone,
              {
                left: `${passStart}%`,
                width: `${Math.max(0, passEnd - passStart)}%`,
                backgroundColor: details.checks.strokeCount
                  ? "rgba(76,175,80,0.3)"
                  : "rgba(255,152,0,0.25)",
              },
            ]}
          />
          <View style={[styles.strokeDeltaExactMark, { left: `${exactPosition}%` }]} />
          <View
            style={[
              styles.strokeDeltaDrawnMark,
              {
                left: `${drawnPosition}%`,
                backgroundColor: details.checks.strokeCount ? "#4caf50" : "#f44336",
              },
            ]}
          />
        </View>

        <View style={styles.strokeDeltaAxisRow}>
          <Text style={[styles.strokeDeltaAxisText, { color: theme.textSecondary }]}>
            {rangeMin}
          </Text>
          <Text style={[styles.strokeDeltaAxisText, { color: theme.textSecondary }]}>
            target {expected}
          </Text>
          <Text style={[styles.strokeDeltaAxisText, { color: theme.textSecondary }]}>
            {rangeMax}
          </Text>
        </View>

        <View style={styles.metricFooter}>
          <Text style={[styles.metricRequirementText, { color: theme.textSecondary }]}>
            Accept zone {Math.max(0, expected - allowedDelta)} to {expected + allowedDelta}
          </Text>
          <Text style={[styles.metricRequirementText, { color: theme.textSecondary }]}>
            {details.checks.strokeCount ? "Pass" : "Fail"}
          </Text>
        </View>
      </View>
    );
  };

  const isCharacterReplayActive = replayMode === "character";
  const isUserReplayActive = replayMode === "user";
  const shouldHideHandwriting = isCharacterReplayActive;
  const displayedStrokes = isUserReplayActive ? replayStrokes : strokes;
  const displayedCurrentStroke = isUserReplayActive
    ? replayCurrentStroke
    : currentStroke;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.canvasContainer,
          {
            width: canvasSize,
            height: canvasSize,
            backgroundColor: canvasBackground,
            shadowColor: canvasShadowColor,
            borderWidth: isComplete ? 3 : 0,
            borderColor: isComplete ? completionColor : "transparent",
          },
        ]}
      >
        {showGrid && (
          <GridOverlay size={canvasSize} color={gridColor} />
        )}

        <Svg
          width={canvasSize}
          height={canvasSize}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {!shouldHideHandwriting &&
            displayedStrokes.map((stroke, strokeIndex) =>
              renderStroke(stroke, `stroke.${strokeIndex}`),
            )}
          {!shouldHideHandwriting && renderStroke(displayedCurrentStroke, "current")}
        </Svg>

        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <View
            style={{
              width: CANVAS_INNER_SIZE,
              height: CANVAS_INNER_SIZE,
              transform: [{ scale: hanziScale }],
              transformOrigin: "top left",
              overflow: "hidden",
              marginTop: DRAWABLE_TOP_MARGIN,
            }}
          >
            <HanziWriter
              writer={writer}
              style={styles.writer}
              loading={<View />}
              error={<View />}
            >
              <HanziWriter.Svg>
                {showOutline && (
                  <HanziWriter.Outline
                    color={theme.isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)"}
                  />
                )}
                {(isComplete || isAnimating) && (
                  <HanziWriter.Character
                    color={
                      isComplete
                        ? isCorrect
                          ? "rgba(76,175,80,0.34)"
                          : "rgba(244,67,54,0.34)"
                        : theme.isDark
                          ? "#fff"
                          : "#111"
                    }
                  />
                )}
              </HanziWriter.Svg>
            </HanziWriter>
          </View>
        </View>

        {!isComplete && (
          <View
            style={styles.gestureLayer}
            {...panResponder.panHandlers}
          />
        )}

        {isComplete && (
          <View style={styles.completionOverlay}>
            <View style={styles.completionBadge}>
              <Ionicons
                name={isCorrect ? "checkmark-circle" : "close-circle"}
                size={32}
                color={completionColor}
              />
            </View>
          </View>
        )}
      </View>

      <View
        style={[
          styles.progressBadge,
          {
            backgroundColor: isComplete
              ? completionColor
              : theme.isDark
                ? "#333"
                : "#fff",
          },
        ]}
      >
        {isComplete && resultDetails ? (
          <>
            <Text style={[styles.progressText, { color: "#fff" }]}>
              <Text style={{ fontWeight: "700" }}>
                {isCorrect ? "Correct!" : "Incorrect"}
              </Text>
            </Text>
            <Text style={[styles.mistakesText, { color: "rgba(255,255,255,0.9)" }]}>
              Similarity {resultDetails.similarityPercent}%
            </Text>
          </>
        ) : (
          <Text style={[styles.progressText, { color: theme.textColor }]}>
            Freehand mode
          </Text>
        )}
      </View>

      {isComplete && resultDetails && (
        <View
          style={[
            styles.decisionCard,
            {
              backgroundColor: theme.isDark ? "#222" : "#fff",
              borderColor: theme.border,
              maxHeight: summaryMaxHeight,
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.decisionContent}
          >
            <Text style={[styles.decisionTitle, { color: theme.textColor }]}>
              Decision Summary
            </Text>

            {renderDecisionBar({
              label: "Similarity",
              value: resultDetails.similarityPercent,
              threshold: resultDetails.thresholds.minSimilarityPercent,
              requirementText: `Minimum ${resultDetails.thresholds.minSimilarityPercent}%`,
              passes: resultDetails.checks.similarity,
              mode: "min",
            })}

            {renderDecisionBar({
              label: "Coverage",
              value: resultDetails.coveragePercent,
              threshold: resultDetails.thresholds.minCoveragePercent,
              requirementText: `Minimum ${resultDetails.thresholds.minCoveragePercent}%`,
              passes: resultDetails.checks.coverage,
              mode: "min",
            })}

            {renderStrokeDeltaBar(resultDetails)}

            <Text style={[styles.metricHint, { color: theme.textSecondary }]}>
              Stroke match: {resultDetails.strokeMatchPercent}%
            </Text>
          </ScrollView>
        </View>
      )}

      {isComplete ? (
        <View style={styles.completionControls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: theme.isDark ? "#2a2a2a" : "#f5f5f5",
                borderColor: theme.border,
              },
            ]}
            onPress={handleReplayCorrect}
            disabled={isAnimating || isUserReplayActive}
          >
            <Ionicons
              name={isAnimating && isCharacterReplayActive ? "hourglass" : "play"}
              size={20}
              color={
                isAnimating || isUserReplayActive
                  ? theme.textSecondary
                  : theme.textColor
              }
            />
            <Text
              style={[
                styles.controlButtonText,
                {
                  color:
                    isAnimating || isUserReplayActive
                      ? theme.textSecondary
                      : theme.textColor,
                },
              ]}
            >
              {isAnimating && isCharacterReplayActive
                ? "Playing..."
                : "Replay Correct"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: theme.isDark ? "#2a2a2a" : "#f5f5f5",
                borderColor: theme.border,
              },
            ]}
            onPress={handleReplayMine}
            disabled={isAnimating || isCharacterReplayActive || strokes.length === 0}
          >
            <Ionicons
              name={isUserReplayActive ? "hourglass" : "brush-outline"}
              size={20}
              color={
                isAnimating || isCharacterReplayActive || strokes.length === 0
                  ? theme.textSecondary
                  : theme.textColor
              }
            />
            <Text
              style={[
                styles.controlButtonText,
                {
                  color:
                    isAnimating || isCharacterReplayActive || strokes.length === 0
                      ? theme.textSecondary
                      : theme.textColor,
                },
              ]}
            >
              {isUserReplayActive ? "Playing..." : "Replay Mine"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: "#ff9800" }]}
            onPress={handleRetry}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.nextButtonText}>
              {isCorrect ? "Redraw" : "Retry"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: "#4caf50" }]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.controls}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  backgroundColor: showGrid ? theme.primary : theme.isDark ? "#2a2a2a" : "#f5f5f5",
                  borderColor: showGrid ? theme.primary : theme.border,
                },
              ]}
              onPress={handleToggleGrid}
            >
              <Ionicons
                name="grid-outline"
                size={20}
                color={showGrid ? "#fff" : theme.textColor}
              />
              <Text
                style={[
                  styles.controlButtonText,
                  { color: showGrid ? "#fff" : theme.textColor },
                ]}
              >
                Grid
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  backgroundColor: showOutline ? theme.primary : theme.isDark ? "#2a2a2a" : "#f5f5f5",
                  borderColor: showOutline ? theme.primary : theme.border,
                },
              ]}
              onPress={handleToggleOutline}
            >
              <Ionicons
                name={showOutline ? "eye" : "eye-outline"}
                size={20}
                color={showOutline ? "#fff" : theme.textColor}
              />
              <Text
                style={[
                  styles.controlButtonText,
                  { color: showOutline ? "#fff" : theme.textColor },
                ]}
              >
                Outline
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  backgroundColor: theme.isDark ? "#2a2a2a" : "#f5f5f5",
                  borderColor: theme.border,
                },
              ]}
              onPress={handleClear}
              disabled={strokes.length === 0 && currentStroke.length === 0}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={theme.textColor}
              />
              <Text style={[styles.controlButtonText, { color: theme.textColor }]}>
                Clear
              </Text>
            </TouchableOpacity>

            {onSkip && (
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  {
                    backgroundColor: theme.isDark ? "#2a2a2a" : "#f5f5f5",
                    borderColor: theme.border,
                  },
                ]}
                onPress={onSkip}
              >
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={theme.textColor}
                />
                <Text style={[styles.controlButtonText, { color: theme.textColor }]}>
                  Skip
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.submitRow}>
            <TouchableOpacity
              style={[
                styles.nextButton,
                styles.submitButton,
                {
                  backgroundColor: theme.primary,
                },
              ]}
              onPress={handleSubmit}
            >
              <Ionicons name="checkmark-done" size={20} color="#fff" />
              <Text style={styles.nextButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
  },
  canvasContainer: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    position: "relative",
  },
  writer: {
    flex: 1,
  },
  gestureLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  loadingInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
  },
  errorSubtext: {
    marginTop: 4,
    fontSize: 32,
    fontWeight: "bold",
  },
  errorInnerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  autoSkipText: {
    marginTop: 16,
    fontSize: 14,
    fontStyle: "italic",
  },
  skipNowButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  skipButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  progressBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressText: {
    fontSize: 14,
  },
  mistakesText: {
    fontSize: 12,
    fontWeight: "500",
  },
  decisionCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    width: "100%",
    overflow: "hidden",
  },
  decisionContent: {
    padding: 10,
  },
  decisionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  metricBlock: {
    marginBottom: 10,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  metricTrack: {
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
  },
  metricFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  metricRequirement: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    marginLeft: -1,
    backgroundColor: "#ffb300",
  },
  strokeDeltaPassZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  strokeDeltaFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    opacity: 0.65,
  },
  strokeDeltaExactMark: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    marginLeft: -1,
    backgroundColor: "#ffb300",
  },
  strokeDeltaDrawnMark: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 3,
    marginLeft: -1.5,
    borderRadius: 2,
  },
  strokeDeltaAxisRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  strokeDeltaAxisText: {
    fontSize: 10,
  },
  metricFooter: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricRequirementText: {
    fontSize: 10,
  },
  metricHint: {
    marginTop: 4,
    fontSize: 11,
    fontStyle: "italic",
  },
  controls: {
    flexDirection: "row",
    marginTop: 16,
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  completionControls: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  submitRow: {
    marginTop: 12,
    width: "100%",
    alignItems: "center",
  },
  submitButton: {
    minWidth: 190,
    justifyContent: "center",
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  controlButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  completionOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 30,
  },
  completionBadge: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    padding: 4,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
