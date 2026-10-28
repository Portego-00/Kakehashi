import type { MusicPlayerLayoutProps } from "./MusicPlayerLayout";
import { Platform, StyleSheet, View } from "react-native";
import { ArrangementView, Host, RNHostView, ZStack } from "@expo/ui/swift-ui";
import {
  arrangementViewStyle,
  frame,
  splitArrangementLayoutRatio,
  onGeometryChange,
} from "@expo/ui/swift-ui/modifiers";

export const supportsPlayerArrangement =
  Platform.OS === "ios" && Number.parseFloat(String(Platform.Version)) >= 27.1;

/** Keep both panes mounted while the system adapts them around the display's fold. */
export function MusicPlayerLayout({
  video,
  lyrics,
  useArrangement,
  preferredVideoRatio,
  onVideoLayout,
  onNativeGeometryChange,
}: MusicPlayerLayoutProps) {
  if (!useArrangement) {
    return <>{video}{lyrics}</>;
  }

  const fill = frame({ maxWidth: Infinity, maxHeight: Infinity });

  return (
    <Host style={styles.fill} ignoreSafeArea="all" colorScheme="dark">
      <ArrangementView modifiers={[arrangementViewStyle("split"), fill]}>
        <ArrangementView.Primary>
          <ZStack
            modifiers={[
              fill,
              splitArrangementLayoutRatio({ idealVertical: preferredVideoRatio }),
              onGeometryChange((rect) => onNativeGeometryChange?.("primary", rect)),
            ]}
          >
            <RNHostView>
              <View style={styles.fill} onLayout={onVideoLayout}>
                {video}
              </View>
            </RNHostView>
          </ZStack>
        </ArrangementView.Primary>
        <ArrangementView.Secondary>
          <ZStack
            modifiers={[
              fill,
              onGeometryChange((rect) => onNativeGeometryChange?.("secondary", rect)),
            ]}
          >
            <RNHostView>
              <View style={styles.fill}>{lyrics}</View>
            </RNHostView>
          </ZStack>
        </ArrangementView.Secondary>
      </ArrangementView>
    </Host>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, minHeight: 0, minWidth: 0 } });
