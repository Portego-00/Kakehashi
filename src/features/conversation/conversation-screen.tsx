import { useIsFocused } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Keyboard, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-screens/experimental';
import { ConversationOrb } from './conversation-orb';
import { ConversationLearningContext } from './conversation-learning-context';
import { Action, CircleAction, Icon, KeyboardTextInput, Label, Sheet, SheetProvider } from './design';
import { useConversationTheme } from './conversation-theme';
import { ConversationHistory, SourceLinks, ThemesPage, WordsPage, WordText } from './conversation-library';
import { ConversationSettings, MeaningChoices } from './conversation-settings';
import { getLanguage, MeaningLanguages } from './languages';
import { AI_CONSENT_VERSION } from './use-conversation';
import { ConversationRuntimeProvider, useConversationRuntime, type ConversationRuntime } from './conversation-runtime';
import { pinyin } from './text-support';
import { dateFromSeconds, translationKey } from './model';

export type ConversationPage = 'talk' | 'themes' | 'words';
type ConversationScreenProps = { accountId: string; onExit?: () => void | Promise<void>; page?: ConversationPage; onNavigate?: (page: ConversationPage) => void; navigationMode?: 'standalone' | 'native' | 'tabs' };
function ConversationFrame({ children, navigationMode, bottom = false }: { children: React.ReactNode; navigationMode: ConversationScreenProps['navigationMode']; bottom?: boolean }) {
  const { colors } = useConversationTheme();
  const style = { flex: 1, backgroundColor: colors.cream };
  // Native tabs contribute their full UITabBar inset through the screens frame.
  if (navigationMode === 'native') return <NativeSafeAreaView edges={{ top: true, bottom: true, left: true, right: true }} style={style}>{children}</NativeSafeAreaView>;
  return <SafeAreaView edges={bottom ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']} style={style}>{children}</SafeAreaView>;
}
export function ConversationScreen(props: ConversationScreenProps) {
  const runtime = useConversationRuntime();
  return runtime ? <ConversationScreenWithRuntime {...props} runtime={runtime} />
    : <ConversationRuntimeProvider accountId={props.accountId} onExit={props.onExit}><ConnectedConversationScreen {...props} /></ConversationRuntimeProvider>;
}
function ConnectedConversationScreen(props: ConversationScreenProps) {
  const runtime = useConversationRuntime();
  if (!runtime) throw new Error('Conversation screen requires a runtime.');
  return <ConversationScreenWithRuntime {...props} runtime={runtime} />;
}
function ConversationScreenWithRuntime(props: ConversationScreenProps & { runtime: ConversationRuntime }) {
  const focused = useIsFocused();
  return <SheetProvider active={focused}><ConversationScreenContent {...props} /></SheetProvider>;
}
function ConversationScreenContent({ runtime, page: controlledPage, onNavigate, navigationMode = 'standalone' }: ConversationScreenProps & { runtime: ConversationRuntime }) {
  const { colors, styles } = useConversationTheme();
  const focused = useIsFocused();
  useEffect(() => { if (!focused) Keyboard.dismiss(); return () => Keyboard.dismiss(); }, [focused]);
  const { controller: c, exiting, exit, exitError, clearExitError } = runtime;
  const [applicationState, setApplicationState] = useState(AppState.currentState);
  const foreground = applicationState === 'active';
  useEffect(() => { const subscription = AppState.addEventListener('change', setApplicationState); return () => subscription.remove(); }, []);
  const [fontsLoaded, fontError] = useFonts({
    ConversationNunito: require('./assets/nunito-regular.ttf'),
    ConversationNunitoSemiBold: require('./assets/nunito-semibold.ttf'),
    ConversationNunitoBold: require('./assets/nunito-bold.ttf'),
    ConversationNunitoExtraBold: require('./assets/nunito-extrabold.ttf'),
  });
  const { width, height, fontScale } = useWindowDimensions();
  const [localPage, setLocalPage] = useState<ConversationPage>('talk');
  const page = controlledPage ?? localPage;
  const navigate = (destination: ConversationPage) => { Keyboard.dismiss(); if (onNavigate) onNavigate(destination); else if (navigationMode === 'standalone') setLocalPage(destination); };
  const [settings, setSettings] = useState(false);
  const [history, setHistory] = useState(false);
  const [transcript, setTranscript] = useState(false);
  const [sources, setSources] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const draftInput = useRef<TextInput>(null);
  const [sending, setSending] = useState(false);
  const [lookup, setLookup] = useState<{ word: string; sentence: string; answer?: string; error?: string } | null>(null);
  const lookupRequest = useRef(0);
  const [meaningLanguage, setMeaningLanguage] = useState('English');
  const welcomeLanguage = getLanguage('ja');
  const [localError, setLocalError] = useState<string | null>(null);
  const compact = height < 950;
  const latestAssistant = [...c.passages].reverse().find(p => p.speaker === 'assistant');
  const latestUser = [...c.passages].reverse().find(p => p.speaker === 'user');
  const isBusy = exiting || c.connection === 'connecting' || c.connection === 'closing';
  const isVoice = c.connection === 'active' && c.voiceSession;
  const activeSpeech = isVoice && c.outputLevel > 0.02;
  const activeListening = isVoice && !c.isMuted;
  const run = async (action: () => void | Promise<void>) => {
    clearExitError();
    setLocalError(null);
    try { await action(); } catch (failure) { setLocalError(failure instanceof Error ? failure.message : 'Please try again.'); }
  };
  const homeControl = exit ? <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" accessibilityState={{ disabled: exiting, busy: exiting }} disabled={exiting} onPress={() => { Keyboard.dismiss(); setLocalError(null); void exit(); }} style={({ pressed }) => [styles.row, { minHeight: 44, flexShrink: 0, gap: 2, paddingRight: 4, opacity: pressed || exiting ? 0.5 : 1 }]}>
    {exiting ? <ActivityIndicator size="small" color={colors.secondary} /> : <Icon name="chevron-back" size={18} />}
    <Label numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', flexShrink: 0, minWidth: 46 * fontScale }}>Home</Label>
  </Pressable> : null;
  const showLookup = async (word: string, sentence: string) => {
    const request = ++lookupRequest.current;
    setLookup({ word, sentence });
    try { const answer = await c.lookup(word, sentence); if (lookupRequest.current === request) setLookup({ word, sentence, answer }); }
    catch (failure) { if (lookupRequest.current === request) setLookup({ word, sentence, error: failure instanceof Error ? failure.message : 'Could not look up this word.' }); }
  };
  const start = () => {
    if (exiting) return;
    if (!c.hasKey) { setSettings(true); return; }
    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void run(c.start);
  };
  const send = async () => {
    if (!draft.trim() || sending || exiting) return;
    clearExitError();
    setLocalError(null);
    if (!c.hasKey) { setTyping(false); setSettings(true); return; }
    setSending(true);
    try { if (await c.sendTyped(draft.trim())) { setDraft(''); setTyping(false); } }
    catch (failure) { setLocalError(failure instanceof Error ? failure.message : 'Your reply could not be sent.'); }
    finally { setSending(false); }
  };
  const status = c.connection === 'connecting' ? 'Connecting…' : c.connection === 'closing' ? 'Saving your conversation…' : activeSpeech ? 'Your partner is speaking' : activeListening ? 'Listening to you' : isVoice ? 'Microphone muted' : c.working ? 'Thinking…' : c.connection === 'failed' ? 'Let’s try again' : c.connection === 'ended' ? 'A little more confident.' : c.session?.fragments.length ? 'Take your time' : 'Ready when you are';
  if (c.loading || (!fontsLoaded && !fontError)) return <ConversationFrame navigationMode={navigationMode} bottom>
    <View style={{ paddingHorizontal: 22, paddingVertical: 10, alignItems: 'flex-start' }}>{homeControl}</View>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}><ActivityIndicator color={colors.secondary} /><Label>Getting ready…</Label>{localError || exitError ? <Label accessibilityRole="alert" style={{ color: colors.danger }}>{localError ?? exitError}</Label> : null}</View>
  </ConversationFrame>;
  if (!c.preferences.hasOnboarded) return <ConversationFrame navigationMode={navigationMode} bottom>
    <View style={{ paddingHorizontal: 22, paddingTop: 8, alignItems: 'flex-start' }}>{homeControl}</View>
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 22, maxWidth: 660, alignSelf: 'center', width: '100%', paddingBottom: 40 }}>
      <Label accessibilityRole="header" style={styles.heading}>Japanese conversation</Label>
      <View style={{ alignItems: 'center', gap: 10 }}><ConversationOrb size={110} active={focused && foreground} /><Label style={{ fontSize: 38, fontWeight: '700' }}>{welcomeLanguage.greeting}</Label><Label style={styles.secondary}>{MeaningLanguages.greeting(meaningLanguage)}</Label></View>
      <Label style={styles.secondary}>Practise Japanese at your pace, with conversations informed by your learning in Kakehashi.</Label>
      <View style={styles.section}>
        <Label style={styles.subheading}>Translations and explanations</Label>
        <Label style={styles.secondary}>English is selected to start. Choose the language you prefer for help; your conversation partner speaks Japanese.</Label>
        <MeaningChoices selected={meaningLanguage} onSelect={setMeaningLanguage} />
      </View>
      <View style={{ padding: 20, borderRadius: 20, backgroundColor: colors.butter, gap: 12 }}>
        <Label style={styles.subheading}>Your learning and OpenAI</Label>
        <Label style={styles.secondary}>When you practise, your WaniKani level and relevant study items are sent to OpenAI, along with your microphone audio, conversation text, and conversation learning context. This helps tailor your Japanese practice. Your WaniKani key stays in Kakehashi. Kakehashi saves your conversation learning on this device and does not save raw audio.</Label>
        <Label style={styles.secondary}>You’ll enter your own OpenAI API key in settings. OpenAI bills usage separately. AI replies and learning feedback can be mistaken.</Label>
      </View>
    </ScrollView>
    <View style={{ padding: 20, paddingTop: 10, backgroundColor: colors.cream }}>
      {localError || exitError ? <Label accessibilityRole="alert" style={{ color: colors.danger, marginBottom: 12 }}>{localError ?? exitError}</Label> : null}
      <Action title="Agree and start learning" primary disabled={exiting} onPress={() => { c.updatePreferences({ learningLanguageID: 'ja', meaningLanguage, hasOnboarded: true, aiConsentVersion: AI_CONSENT_VERSION }); setSettings(true); }} />
    </View>
  </ConversationFrame>;

  return <ConversationFrame navigationMode={navigationMode} bottom={navigationMode === 'standalone'}>
    <View collapsable={false} style={{ flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, paddingHorizontal: 22, paddingVertical: 10 }}>
        <View style={[styles.row, { gap: 10, flexShrink: 0 }]}>{homeControl}<Pressable accessibilityRole="button" accessibilityLabel="Talk home" onPress={() => navigate('talk')} style={[styles.row, { gap: 8, flexShrink: 0 }]}><View style={{ width: 15, height: 15, backgroundColor: colors.orange, borderRadius: 9 }} /><Label style={{ fontSize: 28, fontWeight: '800', letterSpacing: -1 }}>talk</Label></Pressable></View>
        <View style={{ flexDirection: 'row', gap: 10, flexShrink: 0, marginLeft: 'auto' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Conversation history" style={styles.close} onPress={() => setHistory(true)}><Icon name="time-outline" size={23} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Conversation settings" style={styles.close} onPress={() => setSettings(true)}><Icon name="options-outline" size={25} /></Pressable>
        </View>
      </View>
      {page === 'talk' ? <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a conversation theme" onPress={() => navigate('themes')} style={{ backgroundColor: colors.butter, borderRadius: 25, paddingHorizontal: 19, paddingVertical: 10, marginBottom: compact ? 10 : 20 }}><Label style={{ fontSize: 13, color: colors.secondary }}>{c.selectedTheme?.title ?? c.language.talkTitle}</Label></Pressable>
        <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={isVoice ? 'Interrupt your conversation partner' : 'Start voice conversation'} disabled={isBusy} onPress={isVoice ? c.interrupt : start}>
            <ConversationOrb size={Math.min(width * 0.69, compact ? height < 780 ? 180 : 215 : 265)} energy={Math.max(c.inputLevel, c.outputLevel)} listening={activeListening || activeSpeech} active={focused && foreground && page === 'talk'} />
          </Pressable>
          <Label accessibilityLiveRegion="polite" style={{ color: colors.secondary, fontSize: 14, marginTop: 6 }}>{status}</Label>
        </View>
        <View style={{ width: '100%', maxWidth: 620, gap: 10, paddingVertical: latestAssistant ? 15 : compact ? 10 : 25, minHeight: latestAssistant ? 100 : compact ? 95 : 135, justifyContent: 'center' }}>
          {latestAssistant ? <WordText text={latestAssistant.text} languageID={c.language.id} showPinyin={c.preferences.showPinyin} large centered onLookup={(word, sentence) => void showLookup(word, sentence)} /> : <Label selectable style={{ fontSize: 43, fontWeight: '600', textAlign: 'center' }}>{c.language.greeting}</Label>}{!latestAssistant && c.language.id === 'zh' && c.preferences.showPinyin !== false ? <Label style={{ color: colors.secondary, textAlign: 'center' }}>{pinyin(c.language.greeting)}</Label> : null}
          {c.preferences.meaningVisible ? <>
            {c.translating ? <ActivityIndicator color={colors.secondary} size="small" /> : <Label selectable style={{ fontSize: latestAssistant ? 17 : 21, lineHeight: 26, color: colors.secondary, textAlign: 'center' }}>{latestAssistant ? c.meaning : MeaningLanguages.greeting(c.preferences.meaningLanguage)}</Label>}
            {c.meaningError ? <Pressable accessibilityRole="button" onPress={c.retryMeaning}><Label style={{ fontSize: 13, textAlign: 'center', color: colors.danger }}>Meaning unavailable · Tap to retry</Label></Pressable> : null}
          </> : null}
          {latestUser ? <Label selectable numberOfLines={3} style={{ marginTop: 3, color: colors.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>You · {latestUser.text}</Label> : null}
        </View>
        {c.error || localError || exitError ? <View accessibilityRole="alert" style={{ width: '100%', backgroundColor: colors.errorSurface, borderRadius: 15, padding: 15, gap: 9, marginBottom: 15 }}><Label selectable style={{ color: colors.danger, fontSize: 14 }}>{localError ?? exitError ?? c.error}</Label><View style={styles.row}><Action title="Settings" compact onPress={() => setSettings(true)} /><Action title="Dismiss" compact onPress={() => { c.clearError(); clearExitError(); setLocalError(null); }} /></View></View> : null}
        {c.notice ? <Label selectable accessibilityLiveRegion="polite" style={[styles.secondary, { marginBottom: 14, textAlign: 'center' }]}>{c.notice}</Label> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: width < 360 ? 14 : 23, paddingTop: 12 }}>
          <CircleAction title="Meaning" icon={c.preferences.meaningVisible ? 'chatbox-ellipses' : 'chatbox-ellipses-outline'} selected={c.preferences.meaningVisible} onPress={() => c.updatePreferences({ meaningVisible: !c.preferences.meaningVisible })} />
          <CircleAction title={isVoice ? c.isMuted ? 'Unmute microphone' : 'Mute microphone' : 'Start voice conversation'} main icon={isVoice && c.isMuted ? 'mic-off-outline' : 'mic-outline'} onPress={isVoice ? c.toggleMute : start} disabled={isBusy} busy={isBusy} />
          <CircleAction title={c.isRunning ? 'End' : 'Transcript'} icon={c.isRunning ? 'call-outline' : 'chatbubble-outline'} disabled={!c.isRunning && !c.passages.length} onPress={() => c.isRunning ? void run(() => c.stop()) : setTranscript(true)} />
        </View>
        <Label style={{ fontSize: 13, color: colors.secondary, marginTop: 16, textAlign: 'center' }}>{isVoice ? c.isMuted ? 'Microphone muted' : 'Microphone on' : 'Microphone off'}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => setTyping(true)} style={[styles.row, { padding: 12, gap: 8 }]}><Icon name="keypad-outline" size={17} /><Label style={{ fontSize: 14 }}>Type instead</Label></Pressable>
          {c.connection === 'active' && c.session?.fragments.length ? <Pressable accessibilityRole="button" disabled={isBusy || c.working} onPress={() => void run(c.help)} style={[styles.row, { padding: 12, gap: 8 }]}><Icon name="sparkles-outline" size={17} /><Label style={{ fontSize: 14 }}>A little help</Label></Pressable> : <Label style={{ fontSize: 13, color: colors.secondary }}>{c.preferences.meaningLanguage} is welcome, too.</Label>}
        </View>
        <ConversationLearningContext context={c.learningContext} running={c.isRunning} onStart={start} />
        {c.session?.topics.some(topic => topic.sources.length > 0) ? <Pressable accessibilityRole="button" onPress={() => setSources(true)} style={[styles.row, { padding: 8, gap: 6 }]}><Icon name="link-outline" size={16} /><Label style={{ fontSize: 13, color: colors.secondary }}>Sources</Label></Pressable> : null}
        {c.passages.length ? <View style={{ flexDirection: 'row', gap: 20 }}><Pressable accessibilityRole="button" onPress={() => setTranscript(true)} style={{ padding: 8 }}><Label style={{ fontSize: 13, color: colors.secondary }}>View transcript</Label></Pressable>{!c.isRunning ? <Pressable accessibilityRole="button" onPress={c.reset} style={{ padding: 8 }}><Label style={{ fontSize: 13, color: colors.secondary }}>New conversation</Label></Pressable> : null}</View> : null}
      </ScrollView> : page === 'themes' ? <ThemesPage controller={c} onTalk={() => navigate('talk')} /> : <WordsPage controller={c} onHistory={() => setHistory(true)} onLookup={(word, sentence) => void showLookup(word, sentence)} />}
      {navigationMode === 'standalone' ? <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignSelf: 'center', width: '92%', maxWidth: 480, padding: 4, marginTop: 3, marginBottom: 12, borderRadius: 34, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border }}>
        {(['talk', 'themes', 'words'] as const).map(item => <Pressable key={item} accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'} accessibilityLabel={item === 'talk' ? 'Talk' : item === 'themes' ? 'Themes' : 'Words'} accessibilityState={{ selected: page === item }} onPress={() => navigate(item)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10, borderRadius: 30, backgroundColor: page === item ? colors.selection : 'transparent', opacity: pressed ? 0.6 : 1 })}><Icon name={item === 'talk' ? 'pulse' : item === 'themes' ? 'grid' : 'book'} size={22} /><Label style={{ fontSize: 12, fontWeight: page === item ? '800' : '500' }}>{item === 'talk' ? 'Talk' : item === 'themes' ? 'Themes' : 'Words'}</Label></Pressable>)}
      </View> : null}
    </View>
    <ConversationSettings visible={settings} onClose={() => setSettings(false)} controller={c} />
    <ConversationHistory visible={history} onClose={() => setHistory(false)} controller={c} onLookup={(word, sentence) => void showLookup(word, sentence)} />
    <Sheet title="Transcript" visible={transcript} onClose={() => setTranscript(false)}>
      {c.passages.map(passage => <View key={passage.id} style={{ gap: 8, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}><Label style={{ color: colors.secondary, fontSize: 13, fontWeight: '700' }}>{passage.speaker === 'user' ? 'You' : 'Conversation partner'}</Label><WordText text={passage.text} languageID={c.language.id} showPinyin={c.preferences.showPinyin} onLookup={(word, sentence) => void showLookup(word, sentence)} />{c.preferences.meaningVisible && c.session?.translations[translationKey(passage, c.preferences.meaningLanguage)] ? <Label selectable style={styles.secondary}>{c.session.translations[translationKey(passage, c.preferences.meaningLanguage)]}</Label> : null}</View>)}
      {c.session?.topics.map(topic => <View key={topic.id} style={styles.section}><Label style={styles.subheading}>{topic.query}</Label><Label selectable style={styles.secondary}>{topic.text}</Label><SourceLinks topic={topic} /></View>)}
      {!c.passages.length ? <Label style={styles.secondary}>Your conversation will appear here.</Label> : null}
    </Sheet>
    <Sheet title="Conversation sources" visible={sources} onClose={() => setSources(false)}>
      {c.session?.topics.map(topic => <View key={topic.id} style={styles.section}><Label style={styles.subheading}>{topic.query}</Label><Label style={styles.secondary}>Retrieved {dateFromSeconds(topic.retrievedAt).toLocaleString()}</Label><Label selectable style={{ lineHeight: 25 }}>{topic.text}</Label><SourceLinks topic={topic} /></View>)}
    </Sheet>
    <Sheet title="Type a reply" visible={typing} onClose={() => setTyping(false)} onShow={() => draftInput.current?.focus()}>
          <Label style={styles.secondary}>Write in {c.language.name}, or use {c.preferences.meaningLanguage} if you need a hand.</Label>
          <KeyboardTextInput ref={draftInput} accessibilityLabel="Your reply" value={draft} onChangeText={setDraft} placeholder="Say a little something…" placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 140, textAlignVertical: 'top' }]} multiline maxLength={3000} editable={!sending} />
          {localError || c.error ? <Label accessibilityRole="alert" style={{ color: colors.danger }}>{localError ?? c.error}</Label> : null}
          <Action title={sending ? 'Sending…' : 'Send reply'} primary icon="arrow-up" busy={sending} disabled={!draft.trim()} onPress={() => void send()} />
    </Sheet>
    <Sheet title={lookup?.word ?? 'Word meaning'} visible={lookup !== null} onClose={() => { lookupRequest.current++; setLookup(null); }}>
      {lookup ? <><Label selectable style={styles.heading}>{lookup.word}</Label>{c.language.id === 'zh' && c.preferences.showPinyin !== false ? <Label style={styles.secondary}>{pinyin(lookup.word)}</Label> : null}<Label selectable style={styles.secondary}>{lookup.sentence}</Label>{lookup.answer ? <Label selectable style={{ fontSize: 18, lineHeight: 28 }}>{lookup.answer}</Label> : lookup.error ? <><Label accessibilityRole="alert" selectable style={{ color: colors.danger }}>{lookup.error}</Label><Action title="Try again" onPress={() => void showLookup(lookup.word, lookup.sentence)} /></> : <ActivityIndicator color={colors.secondary} />}</> : null}
    </Sheet>
  </ConversationFrame>;
}
