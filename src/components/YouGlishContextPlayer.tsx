import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useIsFocused } from "expo-router/react-navigation";
import WebView from "react-native-webview";
import { readYouGlishMessage, youGlishPlayerDocument, youGlishSearchUrl } from "../features/youglish/player";
import { useTheme } from "../utils/theme";

export default function YouGlishContextPlayer({ query, onPlaybackStart }: { query: string; onPlaybackStart?: () => void }) {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  return focused && foreground ? <Player key={query} query={query} onPlaybackStart={onPlaybackStart} /> : null;
}

function Player({ query, onPlaybackStart }: { query: string; onPlaybackStart?: () => void }) {
  const { theme } = useTheme();
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [height, setHeight] = useState(440);
  const source = useMemo(() => ({ html: youGlishPlayerDocument(query, theme.isDark), baseUrl: "https://kakehashiapp.com/" }), [query, theme.isDark]);
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setStatus("error"), 25_000);
    return () => clearTimeout(timer);
  }, [attempt, status]);
  const openExternal = (url = youGlishSearchUrl(query)) => { void Linking.openURL(url).catch(() => setStatus("error")); };

  return <View style={styles.container}>
    {status === "loading" ? <View accessibilityRole="progressbar" accessibilityLabel="Loading YouGlish examples" style={styles.loading}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading YouGlish examples…</Text></View> : null}
    {status === "error" || status === "empty" ? <View style={styles.fallback}>
      <Text style={{ color: theme.textSecondary }}>{status === "empty" ? `No YouGlish examples found for “${query}”.` : "YouGlish could not load. Check your connection or open it in your browser."}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => { setStatus("loading"); setAttempt((value) => value + 1); }} style={styles.action}><Text style={{ color: theme.primary }}>Retry YouGlish</Text></TouchableOpacity>
    </View> : <WebView
      key={`${query}:${theme.isDark}:${attempt}`}
      testID="youglish-player"
      accessibilityLabel={`YouGlish Japanese examples for ${query}`}
      source={source}
      style={{ height, backgroundColor: theme.cardBackground }}
      originWhitelist={["*"]}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      allowsFullscreenVideo
      scrollEnabled={false}
      onError={() => setStatus("error")}
      onHttpError={(event) => { if (event.nativeEvent.url === source.baseUrl) setStatus("error"); }}
      onMessage={(event) => {
        try {
          const message = readYouGlishMessage(JSON.parse(event.nativeEvent.data));
          if (message?.type === "results") setStatus(message.value === 0 ? "empty" : "ready");
          else if (message?.type === "error") setStatus("error");
          else if (message?.type === "height" && message.value) setHeight(Math.min(1000, Math.max(300, message.value)));
          else if (message?.type === "playing") onPlaybackStart?.();
        } catch { /* Ignore messages from the embedded video and advertising frames. */ }
      }}
      onShouldStartLoadWithRequest={(request) => {
        if (!request.isTopFrame || request.url === "about:blank" || request.url === source.baseUrl) return true;
        if (/^https?:\/\//i.test(request.url)) openExternal(request.url);
        return false;
      }}
      onOpenWindow={(event) => { if (/^https?:\/\//i.test(event.nativeEvent.targetUrl)) openExternal(event.nativeEvent.targetUrl); }}
    />}
    <TouchableOpacity accessibilityRole="link" onPress={() => openExternal()} style={styles.action}><Text style={{ color: theme.primary }}>Open in YouGlish ↗</Text></TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  loading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  fallback: { gap: 8, paddingVertical: 12 },
  action: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
