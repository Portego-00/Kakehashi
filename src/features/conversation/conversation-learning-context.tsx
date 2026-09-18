import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Action, Icon, Label, Sheet } from './design';
import { useConversationTheme } from './conversation-theme';
import { emptyKakehashiContext, type KakehashiContext } from './learning-context';

export function ConversationLearningContext({ context = emptyKakehashiContext(), running, onStart }: { context?: KakehashiContext; running: boolean; onStart(): void }) {
  const { colors, styles } = useConversationTheme();
  const [expanded, setExpanded] = useState(false);
  const title = context.status === 'loading' ? 'Loading WaniKani…'
    : context.status === 'unavailable' ? 'WaniKani unavailable'
      : context.status === 'idle' ? 'Practise with your WaniKani words'
        : `WaniKani${context.level !== null ? ` · Level ${context.level}` : ''}${context.status !== 'partial' || context.words.length ? ` · ${context.words.length} studied words` : ''}${context.status === 'partial' ? ' · Partly loaded' : ''}`;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="WaniKani practice context" onPress={() => setExpanded(true)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', maxWidth: 620, marginTop: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 })}>
      {context.status === 'loading' ? <ActivityIndicator size="small" color={colors.secondary} /> : <Icon name="book-outline" size={18} color={colors.secondary} />}
      <Label accessibilityLiveRegion="polite" style={{ flex: 1, color: colors.secondary, fontSize: 14 }}>{title}</Label><Icon name="chevron-forward" size={16} color={colors.secondary} />
    </Pressable>
    <Sheet title="Your WaniKani practice" visible={expanded} onClose={() => setExpanded(false)}>
      <Label selectable>{context.message}</Label>
      {context.level !== null ? <Label style={styles.subheading}>WaniKani level {context.level}</Label> : null}
      {context.words.length ? <>
        <Label style={styles.secondary}>These studied words were loaded for this conversation. Your partner is asked to use a few naturally while following your topic.</Label>
        {context.words.map(word => <View key={word.id} style={{ gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Label selectable style={{ fontSize: 23, fontWeight: '600' }}>{word.characters}</Label>
          {word.readings.length ? <Label selectable style={styles.secondary}>{word.readings.join(' · ')}</Label> : null}
          <Label selectable>{word.meanings.join('; ')}</Label>
        </View>)}
        <Label style={styles.secondary}>Readings and English meanings come from WaniKani. This is a small sample of lessons you have started, not a fluency score.</Label>
      </> : null}
      <Label style={styles.secondary}>During practice, the tutor can also look up due or difficult items, readings, meanings and example sentences when relevant. Ask “Can we practise words from my WaniKani level?”</Label>
      <Label style={styles.secondary}>This connection is read-only. Conversation practice does not submit WaniKani reviews or change your SRS progress. Your WaniKani key stays in Kakehashi.</Label>
      {!running ? <Action title="Start with my WaniKani words" primary onPress={() => { setExpanded(false); onStart(); }} /> : null}
    </Sheet>
  </>;
}
