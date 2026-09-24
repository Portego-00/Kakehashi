import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { searchImmersionKit, type ImmersionKitSentence } from "../../services/immersionKitService";
import { useAuthStore, useSettingsStore } from "../../utils/store";
import { useTheme } from "../../utils/theme";
import { useBunproAudio } from "../../hooks/useBunproAudio";

export function BunproContext({ query }: { query: string }) {
  const { theme } = useTheme();
  const { immersionKitAnimes, myAnimeListUsername, hideContextSentenceTranslations, hideContextSentenceTranslationsCompletely } = useSettingsStore();
  const level = useAuthStore((state) => state.userData?.level);
  const audio = useBunproAudio();
  const [scenes, setScenes] = useState<ImmersionKitSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(10);
  const [translations, setTranslations] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setScenes([]);
    setVisible(10);
    setTranslations(new Set());
    searchImmersionKit(query, {
      exactMatch: true, category: "anime", limit: 50,
      selectedAnimes: immersionKitAnimes, myAnimeListUsername, userLevel: level,
    }).then(({ results }) => {
      if (!cancelled) setScenes(results);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [query, immersionKitAnimes, myAnimeListUsername, level, attempt]);

  return <View style={styles.container}>
    <Text accessibilityRole="header" style={[styles.heading, { color: theme.textColor }]}>Anime context</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Loading anime context" color={theme.textColor} /> : failed ? <View>
      <Text style={{ color: theme.textSecondary }}>Could not load anime scenes.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}><Text style={[styles.action, { color: theme.textColor }]}>Retry</Text></TouchableOpacity>
    </View> : scenes.length === 0 ? <Text style={{ color: theme.textSecondary }}>No matching ImmersionKit scene was found for this word and source selection.</Text> : null}
    {scenes.slice(0, visible).map((scene) => <View key={scene.id} style={[styles.scene, { borderColor: theme.border }]}>
      <View style={styles.row}>
        <Text style={[styles.source, { color: theme.textColor }]}>{scene.title.replace(/_/g, " ")}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${audio.playingKey === scene.id ? "Stop" : "Play"} anime clip from ${scene.title}`} disabled={!scene.audio || audio.loadingKey === scene.id} onPress={() => void audio.play(scene.id, [scene.audio])} style={styles.play}>
          {audio.loadingKey === scene.id ? <ActivityIndicator color={theme.textColor} /> : <Ionicons name={audio.playingKey === scene.id ? "stop" : "play"} size={20} color={scene.audio ? theme.textColor : theme.textSecondary} />}
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        {scene.imageUrl ? <Image source={{ uri: scene.imageUrl }} accessibilityLabel={`Scene from ${scene.title}`} style={styles.image} /> : null}
        <View style={styles.copy}>
          <Text selectable style={[styles.japanese, { color: theme.textColor }]}>{scene.sentence.split(query).map((part, index) => <React.Fragment key={index}>{index ? <Text style={styles.highlight}>{query}</Text> : null}{part}</React.Fragment>)}</Text>
          {!hideContextSentenceTranslationsCompletely ? !hideContextSentenceTranslations || translations.has(scene.id) ? <Text selectable style={{ color: theme.textSecondary }}>{scene.translation}</Text> : <TouchableOpacity accessibilityRole="button" onPress={() => setTranslations((previous) => new Set(previous).add(scene.id))}><Text style={[styles.action, { color: theme.textSecondary }]}>Show translation</Text></TouchableOpacity> : null}
        </View>
      </View>
    </View>)}
    {visible < scenes.length ? <TouchableOpacity accessibilityRole="button" onPress={() => setVisible((count) => count + 10)}><Text style={[styles.action, { color: theme.textColor }]}>Show more scenes</Text></TouchableOpacity> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  heading: { fontSize: 20, fontWeight: "700" },
  scene: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  source: { flex: 1, fontSize: 15, fontWeight: "600" },
  play: { padding: 10 },
  image: { width: 100, height: 75, borderRadius: 4 },
  copy: { flex: 1, gap: 8 },
  japanese: { fontSize: 18, lineHeight: 28 },
  highlight: { fontWeight: "700", textDecorationLine: "underline" },
  action: { paddingVertical: 12, fontSize: 15 },
});
