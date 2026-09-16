import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../utils/theme';
import { canAccessConversation } from './access';
import { ConversationOrb } from './conversation-orb';

type ConversationHomeEntryProps = {
  username?: string | null;
  signedIn: boolean;
  previewMode?: boolean;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
};

/** The widget shares the visual orb; audio and learning state load only on the destination. */
export function ConversationHomeEntry(props: ConversationHomeEntryProps) {
  if (!props.signedIn || !canAccessConversation(props.username)) return null;
  return <AuthorizedConversationHomeEntry {...props} />;
}

function AuthorizedConversationHomeEntry({ previewMode = false, style, active = true }: ConversationHomeEntryProps) {
  const { theme } = useTheme();
  const focused = useIsFocused();
  const { width, fontScale } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState<number>();
  const [applicationState, setApplicationState] = useState(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setApplicationState);
    return () => subscription.remove();
  }, []);
  const animate = active && focused && applicationState === 'active' && !previewMode;
  // Keep complete words legible beside the orb as widget width and text size change.
  const minimumRowWidth = 112 + 12 + 18 * 2 + 132 * fontScale;
  const stacked = (cardWidth ?? width - 32) < minimumRowWidth;
  const measure = (event: LayoutChangeEvent) => setCardWidth(event.nativeEvent.layout.width);
  const cardStyle = [styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }, stacked && styles.stacked, style];
  const content = <>
    <View style={[styles.copy, stacked && { flex: 0, width: '100%' }]}>
      <Text style={[styles.title, { color: theme.textColor }]}>Japanese conversation</Text>
      <Text style={[styles.description, { color: theme.textSecondary }]}>Turn what you’re learning into a conversation.</Text>
      <View style={styles.action}>
        <Text style={[styles.actionLabel, { color: theme.primary }]}>Let’s talk</Text>
        <Ionicons name="arrow-forward" size={17} color={theme.primary} accessible={false} />
      </View>
    </View>
    <View pointerEvents="none" style={styles.orb}>
      <ConversationOrb size={112} active={animate} />
    </View>
  </>;

  if (previewMode) return <View accessible accessibilityLabel="Japanese conversation preview" onLayout={measure} style={cardStyle}>{content}</View>;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel="Open Japanese conversation"
    accessibilityHint="Opens Talk, Themes, and Words"
    onLayout={measure}
    onPress={() => router.push('/conversation')}
    style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.8 : 1 }]}
  >{content}</Pressable>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, minHeight: 174, marginBottom: 16, borderRadius: 16, borderWidth: 1 },
  stacked: { flexDirection: 'column-reverse' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '700' },
  description: { marginTop: 8, fontSize: 13, lineHeight: 19 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  actionLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  orb: { width: 112, height: 120, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
});
