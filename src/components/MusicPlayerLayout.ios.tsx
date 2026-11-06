import type { MusicPlayerLayoutProps } from "./MusicPlayerLayout";
import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { ArrangementView, Host, ZStack } from "@expo/ui/swift-ui";
import {
  arrangementViewStyle,
  frame,
  onGeometryChange,
  onHingeChange,
  splitArrangementLayoutRatio,
} from "@expo/ui/swift-ui/modifiers";
import {
  getFoldedPlayerFrames,
  type PlayerNativeFrame,
  type PlayerNativeFrames,
} from "./music-player-geometry";

export const supportsPlayerArrangement =
  Platform.OS === "ios" && Number.parseFloat(String(Platform.Version)) >= 27.1;

type ProbeFrames = PlayerNativeFrames & { container?: PlayerNativeFrame };

function FoldAwarePlayerLayout({
  video,
  lyrics,
  preferredVideoRatio,
  onVideoLayout,
  onNativeGeometryChange,
  onArrangementChange,
}: MusicPlayerLayoutProps) {
  const [{ partiallyOpen, frames }, setProbe] = useState<{
    partiallyOpen: boolean;
    frames: ProbeFrames;
  }>({ partiallyOpen: false, frames: {} });
  const panes = partiallyOpen ? getFoldedPlayerFrames(frames) : null;
  const arranged = panes !== null;

  const recordFrame = useCallback((part: keyof ProbeFrames, rect: PlayerNativeFrame) => {
    setProbe((current) => {
      const previous = current.frames[part];
      if (previous && previous.x === rect.x && previous.y === rect.y &&
          previous.width === rect.width && previous.height === rect.height) {
        return current;
      }
      return { ...current, frames: { ...current.frames, [part]: rect } };
    });
  }, []);

  useEffect(() => {
    onArrangementChange?.(arranged);
    if (arranged && frames.primary && frames.secondary) {
      onNativeGeometryChange?.("primary", frames.primary);
      onNativeGeometryChange?.("secondary", frames.secondary);
    }
  }, [arranged, frames, onArrangementChange, onNativeGeometryChange]);

  const fill = frame({ maxWidth: Infinity, maxHeight: Infinity });
  const paneStyle = (rect: PlayerNativeFrame) => ({
    position: "absolute" as const,
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  });

  return (
    <View style={styles.fill}>
      {/* Measure the system's fold-aware panes without reparenting the playing WebView. */}
      <View
        style={styles.probe}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Host style={styles.fill} ignoreSafeArea="all" colorScheme="dark">
          <ZStack modifiers={[
            fill,
            onGeometryChange((rect) => recordFrame("container", rect)),
            onHingeChange((_, context) => {
              const next = context.hinge?.status === "partiallyOpen";
              setProbe((current) => next === current.partiallyOpen ? current : {
                partiallyOpen: next,
                // A new fold must supply fresh pane frames, even if size stays the same.
                frames: { container: current.frames.container },
              });
            }),
          ]}>
            {partiallyOpen ? (
              <ArrangementView modifiers={[arrangementViewStyle("split"), fill]}>
                <ArrangementView.Primary>
                  <ZStack modifiers={[
                    fill,
                    splitArrangementLayoutRatio({ idealVertical: preferredVideoRatio }),
                    onGeometryChange((rect) => recordFrame("primary", rect)),
                  ]}>{null}</ZStack>
                </ArrangementView.Primary>
                <ArrangementView.Secondary>
                  <ZStack modifiers={[
                    fill,
                    onGeometryChange((rect) => recordFrame("secondary", rect)),
                  ]}>{null}</ZStack>
                </ArrangementView.Secondary>
              </ArrangementView>
            ) : null}
          </ZStack>
        </Host>
      </View>
      <View
        testID="music-video-pane"
        style={panes ? paneStyle(panes.primary) : undefined}
        onLayout={onVideoLayout}
      >
        {video}
      </View>
      <View
        testID="music-lyrics-pane"
        style={panes ? paneStyle(panes.secondary) : styles.fill}
      >
        {lyrics}
      </View>
    </View>
  );
}

/** Ordinary phones and flat/closed Duo displays retain the existing vertical player flow. */
export function MusicPlayerLayout(props: MusicPlayerLayoutProps) {
  if (!props.useArrangement) {
    return <>{props.video}{props.lyrics}</>;
  }
  return <FoldAwarePlayerLayout {...props} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0, minWidth: 0 },
  probe: { ...StyleSheet.absoluteFill, opacity: 0 },
});
