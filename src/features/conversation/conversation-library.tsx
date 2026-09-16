import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Linking, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Action, Icon, IconName, KeyboardFlatList, KeyboardTextInput, Label, RecallBars, Sheet } from './design';
import { useConversationTheme } from './conversation-theme';
import { dateFromSeconds, getPassages, projectLearner, safeSourceURL, translationKey } from './model';
import { ConversationController } from './conversation-settings';
import { ConversationTheme, TopicBrief, WordState } from './types';
import { pinyin, segmentWords } from './text-support';

const themeIcons: Record<string, IconName> = {
  weekend: 'sunny-outline', walk: 'leaf-outline', dinner: 'restaurant-outline', home: 'home-outline', friends: 'people-outline', film: 'film-outline', books: 'book-outline', design: 'pencil-outline', travelstories: 'globe-outline', restaurant: 'wine-outline', neighbours: 'business-outline', future: 'paper-plane-outline', today: 'newspaper-outline',
  coffee: 'cafe-outline', introductions: 'hand-left-outline', day: 'sunny-outline', work: 'briefcase-outline', family: 'people-outline', groceries: 'basket-outline', travel: 'train-outline', food: 'restaurant-outline', hobbies: 'color-palette-outline', music: 'musical-notes-outline', films: 'film-outline', cabin: 'home-outline', outdoors: 'leaf-outline', weather: 'partly-sunny-outline', health: 'heart-outline', plans: 'calendar-outline', memories: 'camera-outline', opinions: 'chatbubbles-outline', stories: 'book-outline', news: 'newspaper-outline', traditions: 'sparkles-outline', technology: 'laptop-outline', dreams: 'moon-outline', surprises: 'gift-outline',
};

export function WordText({ text, languageID, showPinyin, onLookup, large = false, centered = false }: { text: string; languageID: string; showPinyin?: boolean; onLookup: (word: string, sentence: string) => void; large?: boolean; centered?: boolean }) {
  const { styles } = useConversationTheme();
  const pieces = useMemo(() => segmentWords(text, languageID), [text, languageID]);
  return <View style={{ gap: 8 }}>
    <Label selectable style={{ fontSize: large ? 27 : 18, lineHeight: large ? 37 : 28, fontWeight: large ? '600' : '400', textAlign: centered ? 'center' : 'left' }}>
      {pieces.map((piece, index) => piece.isWord ? <Label key={index} onPress={() => onLookup(piece.text, text)} accessibilityRole="button" accessibilityLabel={`Look up ${piece.text}`} style={{ fontSize: large ? 27 : 18, lineHeight: large ? 37 : 28, fontWeight: large ? '600' : '400' }}>{piece.text}</Label> : piece.text)}
    </Label>
    {languageID === 'zh' && showPinyin !== false ? <Label selectable style={[styles.secondary, { textAlign: centered ? 'center' : 'left' }]}>{pinyin(text)}</Label> : null}
  </View>;
}

export function ThemesPage({ controller: c, onTalk }: { controller: ConversationController; onTalk: () => void }) {
  const { colors, panels, styles } = useConversationTheme();
  const { width, fontScale } = useWindowDimensions();
  const columns = fontScale > 1.5 || width < 350 ? 1 : width > 700 ? 3 : 2;
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [themeQuery, setThemeQuery] = useState('');
  const [topic, setTopic] = useState<TopicBrief | null>(null);
  const [topicSearch, setTopicSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topicRequest = useRef(0);
  useEffect(() => () => { topicRequest.current++; }, []);
  const closeTopicSearch = () => {
    topicRequest.current++;
    setSearching(false);
    setTopicSearch(false);
  };
  const categories = useMemo(() => ['All', ...new Set(c.language.themes.map(theme => theme.category))], [c.language.themes]);
  const themes = c.language.themes.filter(theme => (category === 'All' || theme.category === category) && `${theme.title} ${theme.subtitle} ${theme.category}`.toLowerCase().includes(themeQuery.toLowerCase()));
  const choose = (theme: ConversationTheme | null) => { Keyboard.dismiss(); if (theme?.id === 'today') { setTopicSearch(true); return; } c.chooseTheme(theme); onTalk(); };
  const search = async () => {
    if (!query.trim() || searching) return;
    const request = ++topicRequest.current;
    Keyboard.dismiss(); setSearching(true); setError(null);
    try {
      const result = await c.currentTopic(query.trim());
      if (request === topicRequest.current) setTopic(result);
    }
    catch (failure) { if (request === topicRequest.current) setError(failure instanceof Error ? failure.message : 'This topic could not be found.'); }
    finally { if (request === topicRequest.current) setSearching(false); }
  };
  return <>
    <KeyboardFlatList key={columns} data={themes} numColumns={columns} keyExtractor={theme => theme.id} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 12 }} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
      ListHeaderComponent={<View style={{ gap: 18, marginBottom: 12 }}>
        <Label accessibilityRole="header" style={styles.heading}>What’s on your mind?</Label>
        <Label style={styles.secondary}>Same friend. Somewhere new.</Label>
        <Pressable accessibilityRole="button" onPress={() => choose(null)} style={[styles.row, { backgroundColor: colors.butter, borderRadius: 22, padding: 22 }]}><Icon name="chatbubbles-outline" size={30} /><View style={{ flex: 1 }}><Label style={styles.subheading}>Just talk</Label><Label style={styles.secondary}>A little of whatever is on your mind.</Label></View><Icon name="arrow-forward" size={20} /></Pressable>
        <KeyboardTextInput accessibilityLabel="Search conversation themes" value={themeQuery} onChangeText={setThemeQuery} placeholder="Find a theme…" placeholderTextColor={colors.muted} style={styles.input} clearButtonMode="while-editing" />
        <ScrollView horizontal keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {categories.map(item => <Pressable key={item} accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'} accessibilityLabel={`${item} themes`} accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={[styles.action, { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: category === item ? colors.butter : colors.paper }]}><Label style={{ fontSize: 14 }}>{item}</Label></Pressable>)}
        </ScrollView>
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.subtitle}`} onPress={() => choose(item)} style={({ pressed }) => ({ flex: 1, maxWidth: `${100 / columns}%`, minHeight: 165, gap: 12, borderRadius: 24, padding: 19, backgroundColor: panels[item.colorIndex % panels.length], opacity: pressed ? 0.65 : 1 })}>
        <Icon name={themeIcons[item.id] ?? 'chatbubble-outline'} size={28} />
        <View style={{ gap: 5 }}><Label style={{ fontSize: 19, fontWeight: '700' }}>{item.title}</Label><Label style={{ fontSize: 13, lineHeight: 19, color: colors.secondary }}>{item.subtitle}</Label></View>
        {c.selectedTheme?.id === item.id ? <Icon name="checkmark-circle" size={19} /> : null}
      </Pressable>} />
    <Sheet title="The world today" visible={topicSearch} onClose={closeTopicSearch}>
      <Label style={styles.heading}>A fresh conversation.</Label>
      <Label style={styles.secondary}>What would you like to talk about? Find a current topic with sources, then talk it through.</Label>
      <KeyboardTextInput accessibilityLabel="Current conversation topic" value={query} onChangeText={setQuery} placeholder={c.language.topicPlaceholder} placeholderTextColor={colors.muted} style={styles.input} maxLength={300} returnKeyType="search" onSubmitEditing={() => void search()} />
      <Action title={searching ? 'Finding a topic…' : 'Find a topic'} icon="search-outline" disabled={!query.trim() || !c.hasKey} busy={searching} onPress={() => void search()} />
      {!c.hasKey ? <Label style={styles.secondary}>Save your OpenAI key in settings to search.</Label> : null}
      {error ? <Label accessibilityRole="alert" selectable style={{ color: colors.danger }}>{error}</Label> : null}
    </Sheet>
    <Sheet title="A current topic" visible={topic !== null} onClose={() => setTopic(null)}>
      {topic ? <><Label style={styles.subheading}>{topic.query}</Label><Label style={styles.secondary}>Retrieved {dateFromSeconds(topic.retrievedAt).toLocaleString()}</Label><Label selectable style={{ lineHeight: 25 }}>{topic.text}</Label><SourceLinks topic={topic} /><Action title="Let's talk about this" primary icon="chatbubbles-outline" onPress={() => { c.discuss(topic); setTopic(null); onTalk(); }} /></> : null}
    </Sheet>
  </>;
}
export function SourceLinks({ topic }: { topic: TopicBrief }) {
  const { styles } = useConversationTheme();
  return <View style={{ gap: 10 }}>{topic.sources.map(source => {
    const url = safeSourceURL(source);
    return url ? <Pressable key={source.url} accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={[styles.row, { minHeight: 44 }]}><Icon name="open-outline" size={18} /><Label style={{ flex: 1, textDecorationLine: 'underline' }}>{source.title}</Label></Pressable> : null;
  })}</View>;
}

export function WordsPage({ controller: c, onHistory, onLookup }: { controller: ConversationController; onHistory: () => void; onLookup: (word: string, sentence: string) => void }) {
  const { colors, styles } = useConversationTheme();
  const [query, setQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [word, setWord] = useState<WordState | null>(null);
  const allWords = useMemo(() => projectLearner(c.archive.sessions, c.language.id, []).words, [c.archive.sessions, c.language.id]);
  const words = (showHidden ? allWords.filter(item => c.preferences.hiddenWords.includes(item.id)) : c.learner.words).filter(item => `${item.lemma} ${item.meaning}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <KeyboardFlatList data={words} keyExtractor={item => item.id} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 22, paddingBottom: 30 }}
      ListHeaderComponent={<View style={{ gap: 18, marginBottom: 22 }}>
        <Label accessibilityRole="header" style={styles.heading}>Your words.</Label>
        <Label style={styles.secondary}>Familiar words, ready for another conversation.</Label>
        <View style={{ padding: 21, borderRadius: 22, backgroundColor: colors.butter, gap: 10 }}>
          <Label style={styles.subheading}>{c.learner.levelLabel}</Label>
          <Label style={styles.secondary}>{c.learner.observationCount > 0 ? c.learner.nextGoal : 'Your first conversations help us find a comfortable place to start.'}</Label>
          <Label style={{ fontSize: 12, color: colors.secondary }}>{c.learner.observationCount} observations · A provisional learning estimate</Label>
          {c.learner.capabilities.map(capability => <View key={capability} style={styles.row}><Icon name="checkmark" size={18} /><Label style={{ flex: 1, fontSize: 14 }}>{capability}</Label></View>)}
        </View>
        <Action title="Your conversations" icon="chatbubbles-outline" onPress={onHistory} />
        <View style={styles.row}><KeyboardTextInput accessibilityLabel="Search vocabulary" value={query} onChangeText={setQuery} placeholder="Find a word…" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} clearButtonMode="while-editing" /><Pressable accessibilityRole="button" accessibilityLabel={showHidden ? 'Show learning words' : 'Show hidden words'} onPress={() => setShowHidden(!showHidden)} style={styles.close}><Icon name={showHidden ? 'eye-off-outline' : 'eye-outline'} /></Pressable></View>
        <Label style={styles.secondary}>{showHidden ? 'Hidden words' : `${words.length} words in ${c.language.name}`}</Label>
      </View>}
      ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: 35, gap: 14 }}><Icon name="book-outline" size={42} color={colors.secondary} /><Label style={styles.subheading}>{query ? 'No matching words' : showHidden ? 'No hidden words' : 'Your words will appear here.'}</Label><Label style={[styles.secondary, { textAlign: 'center', maxWidth: 300 }]}>{query ? 'Try a word or its meaning.' : 'Start a conversation. Useful words and moments of recall are saved as you practise.'}</Label></View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => setWord(item)} style={[styles.row, { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1, gap: 4 }}><Label style={{ fontSize: 21, fontWeight: '600' }}>{item.lemma}</Label><Label style={styles.secondary}>{item.meaning}</Label></View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}><RecallBars count={item.bars} /><Label style={{ fontSize: 11, color: colors.secondary }}>{item.label}</Label></View>
      </Pressable>}
      ListFooterComponent={allWords.length ? <Label style={[styles.secondary, { fontSize: 12, marginTop: 24 }]}>Recall bars describe repeated practice across days and contexts. They are not a memory test score or a language certificate.</Label> : null} />
    <Sheet title={word?.lemma ?? 'Word'} visible={word !== null} onClose={() => setWord(null)}>
      {word ? <><Label style={styles.heading}>{word.lemma}</Label>{c.language.id === 'zh' && c.preferences.showPinyin !== false ? <Label>{pinyin(word.lemma)}</Label> : null}<Label style={{ fontSize: 21 }}>{word.meaning}</Label><RecallBars count={word.bars} /><Label style={styles.subheading}>{word.label}</Label><Label style={styles.secondary}>{word.explanation}</Label>{word.example ? <WordText text={word.example} languageID={c.language.id} showPinyin={c.preferences.showPinyin} onLookup={onLookup} /> : null}<Label style={styles.secondary}>{word.independentCount} independent uses · Last practised {dateFromSeconds(word.lastSeen).toLocaleDateString()}</Label><Action title="Explain this word" icon="sparkles-outline" disabled={!c.hasKey} onPress={() => { setWord(null); onLookup(word.lemma, word.example); }} /><Action title={c.preferences.hiddenWords.includes(word.id) ? 'Bring back into practice' : 'Hide from practice'} icon="eye-off-outline" onPress={() => { c.toggleHiddenWord(word.id); setWord(null); }} /></> : null}
    </Sheet>
  </>;
}

export function ConversationHistory({ visible, onClose, controller: c, onLookup }: { visible: boolean; onClose: () => void; controller: ConversationController; onLookup: (word: string, sentence: string) => void }) {
  const { colors, styles } = useConversationTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; sessionID: string; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const selected = c.archive.sessions.find(session => session.id === selectedId);
  const history = c.archive.sessions.filter(session => session.languageID === c.language.id && `${session.title} ${session.fragments.map(f => f.text).join(' ')}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.startedAt - a.startedAt);
  return <>
    <Sheet title="Your conversations" visible={visible} onClose={onClose} scroll={false}>
      <KeyboardFlatList data={history} keyExtractor={item => item.id} contentContainerStyle={{ padding: 22, paddingBottom: 40 }}
        ListHeaderComponent={<KeyboardTextInput accessibilityLabel="Search conversations" value={query} onChangeText={setQuery} placeholder="Find a conversation…" placeholderTextColor={colors.muted} style={[styles.input, { marginBottom: 16 }]} />}
        ListEmptyComponent={<Label style={styles.secondary}>Your {c.language.name} conversations will be saved here.</Label>}
        renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => setSelectedId(item.id)} style={{ gap: 5, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border }}><Label style={styles.subheading}>{item.title}</Label><Label style={styles.secondary}>{dateFromSeconds(item.startedAt).toLocaleDateString()} · {Math.ceil(item.voiceSeconds / 60)} min · {item.fragments.length} fragments</Label><Label numberOfLines={2} style={styles.secondary}>{item.fragments.filter(fragment => fragment.speaker === 'user').map(fragment => fragment.text).join(' ') || 'A conversation'}</Label></Pressable>} />
    </Sheet>
    <Sheet title={selected?.title ?? 'Conversation'} visible={!!selected} onClose={() => setSelectedId(null)}>
      {selected ? <>
        <Label style={styles.secondary}>{dateFromSeconds(selected.startedAt).toLocaleString()}</Label>
        {getPassages(selected).map(passage => <View key={passage.id} style={{ gap: 9, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Label style={{ fontWeight: '700', color: colors.secondary, fontSize: 13 }}>{passage.speaker === 'user' ? 'You' : 'Conversation partner'}</Label>
          <WordText text={passage.text} languageID={selected.languageID} showPinyin={c.preferences.showPinyin} onLookup={onLookup} />
          {c.preferences.meaningVisible && selected.translations[translationKey(passage, c.preferences.meaningLanguage)] ? <Label style={styles.secondary}>{selected.translations[translationKey(passage, c.preferences.meaningLanguage)]}</Label> : null}
          {passage.speaker === 'user' ? passage.fragments.map(fragment => <Action key={fragment.id} title={passage.fragments.length === 1 ? 'Correct transcript' : `Correct “${fragment.text.slice(0, 30)}…”`} icon="pencil-outline" compact disabled={c.isRunning} onPress={() => { setEditError(null); setEditing({ id: fragment.id, sessionID: selected.id, text: fragment.text }); }} />) : null}
        </View>)}
        {selected.topics.map(topic => <View key={topic.id}><Label style={styles.subheading}>{topic.query}</Label><Label selectable style={styles.secondary}>{topic.text}</Label><Label style={styles.secondary}>Retrieved {dateFromSeconds(topic.retrievedAt).toLocaleString()}</Label><SourceLinks topic={topic} /></View>)}
        <Action title="Delete conversation" icon="trash-outline" destructive disabled={c.isRunning} onPress={() => setDeletingId(selected.id)} />
      </> : null}
    </Sheet>
    <Sheet title="Correct your transcript" visible={editing !== null} onClose={() => setEditing(null)}>
      <Label style={styles.secondary}>Fix words that were transcribed incorrectly. Learning evidence based on the old wording will be removed.</Label>
      <KeyboardTextInput accessibilityLabel="Corrected transcript" value={editing?.text ?? ''} multiline onChangeText={text => setEditing(value => value ? { ...value, text } : null)} style={[styles.input, { minHeight: 150, textAlignVertical: 'top' }]} maxLength={12000} />
      {editError ? <Label style={{ color: colors.danger }}>{editError}</Label> : null}
      <Action title="Save correction" primary disabled={!editing?.text.trim()} onPress={() => {
        if (!editing) return;
        try { c.correctTranscript(editing.id, editing.text.trim(), editing.sessionID); setEditing(null); }
        catch (failure) { setEditError(failure instanceof Error ? failure.message : 'Could not save this correction.'); }
      }} />
    </Sheet>
    <Sheet title="Delete this conversation?" visible={deletingId !== null} onClose={() => setDeletingId(null)}>
      <Label>The conversation and its learning evidence will be deleted. Recall strength will be recalculated from your remaining conversations.</Label>
      <Action title="Delete conversation" destructive onPress={() => { if (deletingId) c.deleteSession(deletingId); setDeletingId(null); setSelectedId(null); }} />
      <Action title="Keep conversation" onPress={() => setDeletingId(null)} />
    </Sheet>
  </>;
}
