import { useIsFocused } from '@react-navigation/native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, View } from 'react-native';
import { useAuthStore } from '../../utils/store';
import { Icon, Label, Sheet } from './design';
import { useConversationTheme } from './conversation-theme';
import type { ConversationController } from './conversation-settings';
import { getBundledVoicePreview } from './voice-preview-samples';
import { LIVE_VOICES, normalizeLiveVoice, type LiveVoice } from './voices';

export const voiceName = (voice: string) => voice.charAt(0).toUpperCase() + voice.slice(1);

export function ConversationVoices({ visible, onClose, controller: c }: { visible: boolean; onClose(): void; controller: ConversationController }) {
  return <Sheet title="Japanese voice" visible={visible} onClose={onClose}>
    {visible ? <VoiceChoices controller={c} /> : null}
  </Sheet>;
}
export function VoiceChoices({ controller: c }: { controller: ConversationController }) {
  const { colors, styles } = useConversationTheme();
  const focused = useIsFocused();
  const [busy, setBusy] = useState<LiveVoice | null>(null);
  const [playing, setPlaying] = useState<LiveVoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const sequence = useRef(0);
  const mounted = useRef(true);
  const player = useRef<AudioPlayer | null>(null);
  const listener = useRef<{ remove(): void } | null>(null);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = useCallback((update = true) => {
    sequence.current++;
    clearTimeout(playbackTimer.current);
    listener.current?.remove(); listener.current = null;
    try { player.current?.pause(); } catch { /* Audio may already have been interrupted. */ }
    try { player.current?.remove(); } catch { /* The native player may already be released. */ }
    player.current = null;
    if (update && mounted.current) { setBusy(null); setPlaying(null); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state !== 'active') stop(); });
    // Audio setup must not continue after account identity changes.
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.userData?.id !== previous.userData?.id || state.apiToken !== previous.apiToken) stop();
    });
    return () => { mounted.current = false; subscription.remove(); unsubscribe(); stop(false); };
  }, [stop]);
  useEffect(() => { if (!focused || !foreground || c.isRunning) stop(); }, [focused, foreground, c.isRunning, stop]);
  useEffect(() => () => stop(), [c.accountId, stop]);

  const preview = async (voice: LiveVoice) => {
    if (busy === voice || playing === voice) { stop(); return; }
    stop(); setError(null);
    if (!focused || !foreground || c.isRunning) return;
    const generation = sequence.current;
    const current = () => mounted.current && sequence.current === generation;
    setBusy(voice);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, allowsRecording: false, interruptionMode: 'doNotMix' });
      if (!current()) return;
      const playback = createAudioPlayer(getBundledVoicePreview(voice), { updateInterval: 100 });
      player.current = playback;
      let started = false;
      const failPlayback = () => {
        if (current()) { stop(); setError('This included preview could not play. Please try again.'); }
      };
      listener.current = playback.addListener('playbackStatusUpdate', status => {
        if (!current()) return;
        if (status.playbackState === 'failed') { failPlayback(); return; }
        if (status.playing && !started) {
          started = true;
          clearTimeout(playbackTimer.current);
          // Release a player that stalls or is interrupted without a finish event.
          playbackTimer.current = setTimeout(failPlayback, status.duration > 0 ? Math.min(60000, status.duration * 1000 + 5000) : 45000);
          setBusy(null); setPlaying(voice);
        }
        if (status.didJustFinish) stop();
      });
      playbackTimer.current = setTimeout(failPlayback, 12000);
      playback.play();
    } catch {
      if (!current()) return;
      stop();
      setError('This included preview could not play. Please try again.');
    }
  };
  return <View style={{ gap: 16 }}>
    <Label style={styles.secondary}>Choose the voice for your Japanese conversations. Changes apply to your next voice session.</Label>
    <Label style={styles.secondary}>{Platform.OS === 'web' ? 'Previews use included recordings, with no API key or charges.' : 'Previews are included with the app and play offline, with no API key or charges.'}</Label>
    <Label style={styles.secondary}>OpenAI reference recordings are in English, or Portuguese for Bossa and Tempo. Some use earlier speech models, so Japanese delivery may vary. Your conversations stay in Japanese.</Label>
    {c.isRunning ? <Label style={styles.secondary}>End your conversation to listen to previews.</Label> : null}
    {error ? <Label selectable accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Label> : null}
    {LIVE_VOICES.map(voice => {
      const selected = normalizeLiveVoice(c.preferences.voice) === voice;
      const active = busy === voice || playing === voice;
      return <View key={voice} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable accessibilityRole={Platform.OS === 'ios' ? 'button' : 'radio'} accessibilityLabel={`Use ${voiceName(voice)} voice`} accessibilityState={{ selected }} onPress={() => { stop(); c.updatePreferences({ voice }); }} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, opacity: pressed ? 0.6 : 1 })}>
          <Icon name={selected ? 'checkmark-circle' : 'ellipse-outline'} color={selected ? colors.orange : colors.muted} size={23} />
          <View style={{ flex: 1 }}><Label style={{ fontWeight: selected ? '700' : '400' }}>{voiceName(voice)}{voice === 'marin' ? ' · default' : ''}</Label></View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${active ? 'Stop' : 'Preview'} ${voiceName(voice)}`} accessibilityState={{ disabled: c.isRunning, busy: busy === voice }} disabled={c.isRunning} onPress={() => void preview(voice)} style={({ pressed }) => ({ minWidth: 68, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: c.isRunning ? 0.4 : pressed ? 0.6 : 1 })}>
          {busy === voice ? <ActivityIndicator color={colors.secondary} /> : <Icon name={active ? 'stop-circle-outline' : 'play-circle-outline'} size={28} />}
          <Label style={{ fontSize: 11, color: colors.secondary }}>{busy === voice ? 'Cancel' : active ? 'Stop' : 'Preview'}</Label>
        </Pressable>
      </View>;
    })}
  </View>;
}
