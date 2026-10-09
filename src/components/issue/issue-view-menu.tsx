import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassButton } from "../GlassButton";
import { useTheme } from "../../utils/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const modifiers = Platform.OS === "ios" ? require("@expo/ui/swift-ui/modifiers") : null;

export type IssueView = "open" | "closed" | "activity";
const labels: Record<IssueView, string> = { open: "Open", closed: "Closed", activity: "My activity" };

export function IssueViewMenu({ selected, counts, onSelect }: { selected: IssueView; counts: { open: number | null; closed: number | null; activity: number }; onSelect: (view: IssueView) => void }) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const iconColor = theme.isDark ? theme.headerText : "#111111";
  const options: IssueView[] = ["open", "closed", "activity"];
  const select = (view: IssueView) => { Keyboard.dismiss(); onSelect(view); };
  const label = (view: IssueView) => `${labels[view]}${counts[view] == null || (view === "activity" && !counts[view]) ? "" : ` (${counts[view]})`}`;
  const badge = counts.activity > 0 ? <View pointerEvents="none" style={[styles.badge, { backgroundColor: theme.cardBackground }]}><Text style={[styles.badgeText, { color: theme.primary }]}>{counts.activity > 999 ? "999+" : counts.activity}</Text></View> : null;
  const trigger = <View style={styles.trigger}>
    <GlassButton iconName="options-outline" iconSize={22} iconColor={iconColor} />
    {badge}
  </View>;

  if (SwiftUI && modifiers) return <View style={styles.trigger} onTouchStart={Keyboard.dismiss}>
    <SwiftUI.Host matchContents style={styles.trigger}>
      <SwiftUI.Menu modifiers={[modifiers.accessibilityLabel(`Community views, ${labels[selected]}`)]} label={<SwiftUI.Image systemName="line.3.horizontal.decrease" size={22} color={iconColor} modifiers={[modifiers.frame({ width: 44, height: 44 }), modifiers.glassEffect({ glass: { variant: "clear", interactive: true, tint: `${theme.headerBackground}40` }, shape: "circle" })]} />}
      >
        {options.map((view) => <SwiftUI.Button key={view} label={label(view)} systemImage={selected === view ? "checkmark" : undefined} onPress={() => select(view)} />)}
      </SwiftUI.Menu>
    </SwiftUI.Host>
    {badge}
  </View>;

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Community views, ${labels[selected]}`} onPress={() => { Keyboard.dismiss(); setVisible(true); }}>{trigger}</Pressable>
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
        <View style={[styles.menu, { backgroundColor: theme.cardBackground }]}>
          {options.map((view) => <Pressable key={view} accessibilityRole="menuitem" accessibilityState={{ selected: selected === view }} style={styles.option} onPress={() => { setVisible(false); select(view); }}>
            <Text style={[styles.optionText, { color: theme.textColor }]}>{label(view)}</Text>
            {selected === view ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : null}
          </Pressable>)}
        </View>
      </Pressable>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { width: 44, height: 44 },
  badge: { position: "absolute", right: -3, top: -3, borderRadius: 8, paddingHorizontal: 4, minWidth: 16, height: 16, justifyContent: "center", alignItems: "center" },
  badgeText: { fontSize: 10, fontWeight: "700", fontVariant: ["tabular-nums"] },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)", padding: 16, paddingTop: 140, alignItems: "flex-end" },
  menu: { minWidth: 240, borderRadius: 8, paddingVertical: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 48, paddingHorizontal: 16 },
  optionText: { flex: 1, fontSize: 16 },
});
