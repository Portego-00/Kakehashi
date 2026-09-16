import React, { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Switch, View } from 'react-native';
import { Action, Icon, KeyboardTextInput, Label, Sheet } from './design';
import { useConversationTheme } from './conversation-theme';
import { pickLearningBackup, shareLearningBackup } from './backup-files';
import { MeaningLanguages } from './languages';
import { ConversationVoices, voiceName } from './conversation-voices';
import { normalizeLiveVoice } from './voices';
import { conversationLicenseNotices, type ConversationLicenseNotice } from './license-notices';
import { AI_CONSENT_VERSION, type useConversation } from './use-conversation';

export type ConversationController = ReturnType<typeof useConversation>;
export function MeaningChoices({ selected, onSelect }: { selected: string; onSelect: (name: string) => void }) {
  const { colors, styles } = useConversationTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {MeaningLanguages.all.map(name => <Pressable key={name} accessibilityRole={Platform.OS === 'ios' ? 'button' : 'radio'} accessibilityLabel={name} accessibilityState={{ selected: selected === name }} onPress={() => onSelect(name)}
      style={[styles.action, { backgroundColor: selected === name ? colors.butter : colors.paper, borderColor: selected === name ? colors.orange : colors.border }]}><Label>{name}</Label></Pressable>)}
  </View>;
}
export function ConversationSettings({ visible, onClose, controller: c }: { visible: boolean; onClose: () => void; controller: ConversationController }) {
  const { colors, styles } = useConversationTheme();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'key' | null>(null);
  const [showMeaningLanguage, setShowMeaningLanguage] = useState(false);
  const [showVoices, setShowVoices] = useState(false);
  const [importText, setImportText] = useState<string | null>(null);
  const [showLicenses, setShowLicenses] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<ConversationLicenseNotice | null>(null);
  const perform = async (action: () => void | Promise<void>, success?: string) => {
    setBusy(true); setError(null); setMessage(null);
    try { await action(); if (success) setMessage(success); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'That could not be completed. Please try again.'); }
    finally { setBusy(false); }
  };
  const minutes = c.sessions.reduce((sum, session) => sum + session.voiceSeconds, 0) / 60;
  const usage = c.sessions.reduce((sum, session) => ({ input: sum.input + session.inputTokens, output: sum.output + session.outputTokens, searches: sum.searches + session.searchCalls }), { input: 0, output: 0, searches: 0 });
  return <>
    <Sheet title="Conversation settings" visible={visible} onClose={() => { setKey(''); setShowVoices(false); setShowMeaningLanguage(false); setShowLicenses(false); setSelectedLicense(null); onClose(); }}>
      {c.isRunning ? <Label style={styles.secondary}>End your conversation before changing your key or learning data.</Label> : null}
      <View style={styles.section}>
        <Label style={styles.subheading}>Your languages</Label>
        <View accessible accessibilityLabel="Practice language: Japanese" style={{ gap: 4, paddingVertical: 8 }}><Label>Practice language</Label><Label style={styles.secondary}>Japanese · 日本語</Label></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose translation and explanation language" onPress={() => setShowMeaningLanguage(true)} style={[styles.row, { justifyContent: 'space-between', minHeight: 48 }]}><View><Label>Translations and explanations</Label><Label style={styles.secondary}>{c.preferences.meaningLanguage}</Label></View><Icon name="chevron-forward" size={18} /></Pressable>
        <View style={[styles.row, { justifyContent: 'space-between' }]}><Label style={{ flex: 1 }}>Show meaning</Label><Switch accessibilityLabel="Show meaning subtitles" value={c.preferences.meaningVisible} onValueChange={meaningVisible => c.updatePreferences({ meaningVisible })} trackColor={{ false: colors.border, true: colors.orange }} ios_backgroundColor={colors.border} thumbColor={Platform.OS === 'ios' ? undefined : c.preferences.meaningVisible ? colors.onPrimary : colors.secondary} /></View>
      </View>
      <View style={styles.divider} />
      <View style={styles.section}>
        <Label style={styles.subheading}>Make it yours</Label>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose Japanese voice" onPress={() => setShowVoices(true)} style={[styles.row, { justifyContent: 'space-between', minHeight: 52 }]}><View style={{ flex: 1 }}><Label>Japanese voice</Label><Label style={styles.secondary}>{voiceName(normalizeLiveVoice(c.preferences.voice))} · listen and choose</Label></View><Icon name="chevron-forward" size={18} /></Pressable>
        <Label style={styles.secondary}>Interests to bring into your conversations</Label>
        <KeyboardTextInput accessibilityLabel="Your interests" placeholder="Food, films, travel, everyday life…" placeholderTextColor={colors.muted} value={c.preferences.interests} onChangeText={interests => c.updatePreferences({ interests })} maxLength={500} multiline style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} />
        <Label>Conversation length</Label>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{[5, 10, 15, 20, 30, 60].map(sessionMinutes => <Pressable key={sessionMinutes} disabled={c.isRunning} accessibilityRole={Platform.OS === 'ios' ? 'button' : 'radio'} accessibilityLabel={`${sessionMinutes} minutes`} accessibilityState={{ selected: c.preferences.sessionMinutes === sessionMinutes }} onPress={() => c.updatePreferences({ sessionMinutes })} style={[styles.action, { paddingHorizontal: 15, backgroundColor: c.preferences.sessionMinutes === sessionMinutes ? colors.butter : colors.paper }]}><Label>{sessionMinutes} min</Label></Pressable>)}</View>
      </View>
      <View style={styles.divider} />
      <View style={styles.section}>
        <Label style={styles.subheading}>OpenAI connection</Label>
        <View style={[styles.row, { justifyContent: 'space-between' }]}><Label style={{ flex: 1 }}>Allow OpenAI processing for practice</Label><Switch accessibilityLabel="Allow OpenAI processing" value={c.preferences.aiConsentVersion === AI_CONSENT_VERSION} onValueChange={allowed => c.updatePreferences({ aiConsentVersion: allowed ? AI_CONSENT_VERSION : null })} trackColor={{ false: colors.border, true: colors.orange }} ios_backgroundColor={colors.border} thumbColor={Platform.OS === 'ios' ? undefined : c.preferences.aiConsentVersion === AI_CONSENT_VERSION ? colors.onPrimary : colors.secondary} /></View>
        <Label style={styles.secondary}>When you practise, your WaniKani level and relevant study items are sent to OpenAI with your microphone audio, conversation text, and conversation learning context to tailor your Japanese practice. Your WaniKani key stays in Kakehashi.</Label>
        <Label style={styles.secondary}>Use an OpenAI project key with GPT-Live-1 and GPT-5.6 Luna access. API usage is billed to your OpenAI project.</Label>
        <Label style={styles.secondary}>{Platform.OS === 'web' ? 'On web, your key stays in memory for this visit.' : 'Your key is saved securely on this device and sent only to OpenAI.'} It is never included in a backup.</Label>
        {c.hasKey ? <Label style={{ fontWeight: '700' }}>API key saved</Label> : null}
        <KeyboardTextInput accessibilityLabel="OpenAI API key" placeholder={c.hasKey ? 'Enter a replacement key' : 'sk-…'} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="none" value={key} onChangeText={setKey} editable={!c.isRunning && !busy} style={styles.input} />
        <Action title={c.hasKey ? 'Replace key' : 'Save key'} primary disabled={!key.trim() || c.isRunning || busy} onPress={() => void perform(async () => { await c.saveKey(key); setKey(''); }, 'Your key is saved. You can start a conversation.')} />
        {c.hasKey ? <Action title="Remove saved key" disabled={c.isRunning || busy} destructive onPress={() => setConfirm('key')} /> : null}
        <Action title="OpenAI usage" icon="open-outline" compact onPress={() => void Linking.openURL('https://platform.openai.com/usage')} />
      </View>
      <View style={styles.divider} />
      <View style={styles.section}>
        <Label style={styles.subheading}>Learning records</Label>
        <Label style={styles.secondary}>Conversation history and vocabulary are saved on this device, separately for each Kakehashi account.</Label>
        <Action title="Export learning backup" icon="share-outline" disabled={busy || c.isRunning} onPress={() => void perform(() => shareLearningBackup(c.exportData()))} />
        <Action title="Import learning backup" icon="download-outline" disabled={busy || c.isRunning} onPress={() => void perform(async () => { const json = await pickLearningBackup(); if (json) setImportText(json); })} />
        <Action title="Delete all conversation learning" icon="trash-outline" destructive disabled={busy || c.isRunning} onPress={() => setConfirm('delete')} />
      </View>
      <View style={styles.divider} />
      <View style={styles.section}>
        <Label style={styles.subheading}>Usage</Label>
        <Label selectable>{minutes.toFixed(1)} voice minutes · {c.sessions.length} conversations</Label>
        <Label selectable>Practice voice estimate: ${(minutes * 0.05).toFixed(2)} USD</Label>
        <Label selectable style={styles.secondary}>{usage.input.toLocaleString()} input tokens · {usage.output.toLocaleString()} output tokens · {usage.searches} web searches</Label>
        <Label style={styles.secondary}>Voice time may be estimated if a connection ended unexpectedly. The conversation timer is not a billing cap. Voice previews are included with the app and incur no API charges.</Label>
        <Label style={styles.secondary}>Uses $0.05/min, checked 15 September 2026. Translation, teaching and search cost extra. Interrupted requests may be billed without a usage record here.</Label>
        <Action title="Current API pricing" icon="open-outline" compact onPress={() => void Linking.openURL('https://developers.openai.com/api/docs/pricing')} />
      </View>
      <View style={styles.section}>
        <Label style={styles.subheading}>About this feature</Label>
        <Label style={styles.secondary}>Based on Mural, copyright 2026 Hackmamba, under the MIT license. The interface and learning system have been adapted for Kakehashi. Nunito is licensed under the SIL Open Font License.</Label>
        <Label style={styles.secondary}>During practice, microphone audio, conversation text, your WaniKani level and relevant study items, conversation learning context, and requested searches are sent to OpenAI. Your WaniKani key stays in Kakehashi. Raw audio is not saved by Kakehashi. AI replies and learning estimates can be mistaken.</Label>
        <Action title="Mural source and license" icon="open-outline" compact onPress={() => void Linking.openURL('https://github.com/Chuloo/mural')} />
        <Action title="Open-source licenses" icon="document-text-outline" compact onPress={() => setShowLicenses(true)} />
      </View>
      {busy ? <ActivityIndicator color={colors.secondary} /> : null}
      {error ? <Label selectable accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Label> : null}
      {message ? <Label selectable accessibilityLiveRegion="polite">{message}</Label> : null}
    </Sheet>
    <ConversationVoices visible={visible && showVoices} onClose={() => setShowVoices(false)} controller={c} />
    <Sheet title="Translation language" visible={showMeaningLanguage} onClose={() => setShowMeaningLanguage(false)}>
      <MeaningChoices selected={c.preferences.meaningLanguage} onSelect={meaningLanguage => { c.updatePreferences({ meaningLanguage }); setShowMeaningLanguage(false); }} />
    </Sheet>
    <Sheet title={confirm === 'key' ? 'Remove your API key?' : 'Delete your learning records?'} visible={confirm !== null} onClose={() => setConfirm(null)}>
      <Label>{confirm === 'key' ? 'Your conversations and vocabulary will remain. You can save a key again whenever you want.' : 'This deletes the conversations, vocabulary evidence, and progress for all conversation languages on this account. Export a backup first if you want to keep them.'}</Label>
      <Action title={confirm === 'key' ? 'Remove key' : 'Delete learning records'} destructive onPress={() => { const choice = confirm; setConfirm(null); void perform(() => choice === 'key' ? c.clearKey() : c.deleteLearningData(), choice === 'key' ? 'API key removed.' : 'Learning records deleted.'); }} />
      <Action title="Cancel" onPress={() => setConfirm(null)} />
    </Sheet>
    <Sheet title="Import this backup?" visible={importText !== null} onClose={() => setImportText(null)}>
      <Label>Existing conversations are kept. New conversations from the backup are added by ID. Your current preferences and API key stay unchanged.</Label>
      <Action title="Import backup" primary onPress={() => { const json = importText; setImportText(null); if (json) void perform(() => c.importData(json), 'Backup imported.'); }} />
      <Action title="Cancel" onPress={() => setImportText(null)} />
    </Sheet>
    <Sheet title="Open-source licenses" visible={visible && showLicenses} onClose={() => { setSelectedLicense(null); setShowLicenses(false); }}>
      <Label style={styles.secondary}>Full notices for the conversation feature are included here and can be read offline.</Label>
      {conversationLicenseNotices.map(notice => <Pressable key={notice.id} accessibilityRole="button" accessibilityLabel={`${notice.name}, ${notice.license}`} onPress={() => setSelectedLicense(notice)} style={[styles.row, { justifyContent: 'space-between', minHeight: 52, paddingVertical: 8 }]}>
        <View style={{ flex: 1, gap: 4 }}><Label>{notice.name}</Label><Label style={styles.secondary}>{notice.license}</Label></View><Icon name="chevron-forward" size={18} />
      </Pressable>)}
    </Sheet>
    <Sheet title={selectedLicense?.name ?? 'License'} visible={visible && showLicenses && selectedLicense !== null} onClose={() => setSelectedLicense(null)}>
      {selectedLicense ? <>
        {selectedLicense.note ? <Label selectable style={styles.secondary}>{selectedLicense.note}</Label> : null}
        <Label selectable style={{ fontSize: 14, lineHeight: 22 }}>{selectedLicense.text}</Label>
        <Action title="View upstream source" icon="open-outline" compact onPress={() => void Linking.openURL(selectedLicense.source)} />
      </> : null}
    </Sheet>
  </>;
}
