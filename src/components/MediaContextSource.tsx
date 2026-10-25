import React, { lazy, Suspense, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { canUseYouGlish } from "../features/youglish/player";
import { useAuthStore, useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";

// Defer native WebView initialization until this source is opened in Metro.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YouGlishContextPlayer = lazy<typeof import("./YouGlishContextPlayer").default>(async () => require("./YouGlishContextPlayer"));

export function MediaContextSource({ query, active = true, onYouGlishSelect, children }: {
  query: string;
  active?: boolean;
  onYouGlishSelect?: () => void;
  children: ReactNode;
}) {
  const { userData } = useAuthStore();
  const { showYouGlishContext } = useSettingsStore();
  const { theme } = useTheme();
  const [source, setSource] = useState<"immersionkit" | "youglish">("immersionkit");
  const enabled = canUseYouGlish(userData?.username, showYouGlishContext);
  const showYouGlish = enabled && source === "youglish";

  if (!enabled) return <>{children}</>;

  return <View style={enabled ? styles.container : undefined}>
    {enabled ? <View accessibilityRole="tablist" accessibilityLabel="Context source" style={[styles.tabs, { borderColor: theme.border }]}>
      {(["immersionkit", "youglish"] as const).map((item) => <TouchableOpacity
        key={item}
        accessibilityRole="tab"
        accessibilityState={{ selected: showYouGlish === (item === "youglish") }}
        onPress={() => { if (item === "youglish") onYouGlishSelect?.(); setSource(item); }}
        style={[styles.tab, { borderBottomColor: showYouGlish === (item === "youglish") ? theme.primary : "transparent" }]}
      ><Text style={[styles.label, { color: showYouGlish === (item === "youglish") ? theme.textColor : theme.textSecondary }]}>{item === "youglish" ? "YouGlish" : "ImmersionKit"}</Text></TouchableOpacity>)}
    </View> : null}
    {showYouGlish ? active && query.trim() ? <Suspense fallback={<ActivityIndicator accessibilityLabel="Loading YouGlish player" color={theme.primary} />}><YouGlishContextPlayer key={query} query={query} onPlaybackStart={onYouGlishSelect} /></Suspense> : null : children || <Text style={{ color: theme.textSecondary }}>ImmersionKit examples are turned off in settings.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 16, marginBottom: 16 },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderBottomWidth: 2 },
  label: { fontSize: 15, fontWeight: "600" },
});
