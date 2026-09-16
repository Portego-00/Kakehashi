import content from './languages.generated.json';
import type { ConversationTheme, LanguageModule } from './types';

export const Themes: { shared: ConversationTheme[] } = { shared: content.themes };
type LanguageContent = Omit<LanguageModule, 'themes' | 'defaultTitle' | 'talkTitle' | 'settingsTitle'>;

const japanese: LanguageContent = {
  id: 'ja', name: 'Japanese', nativeName: '日本語', variety: 'Japan', locale: 'ja-JP',
  greeting: 'こんにちは！', greetingWord: 'こんにちは',
  speechGuidance: 'Use clear, natural Standard Japanese. Begin with friendly polite Japanese and adjust casual or formal register to the situation. Model mora timing, vowel length and geminate consonants naturally. Accept valid regional accents and vocabulary. Do not treat a regional difference or a non-native accent alone as an error, and do not infer pronunciation or pitch-accent accuracy from transcription alone.',
  writingGuidance: 'Write natural contemporary Japanese using appropriate kanji and kana, with standard Japanese punctuation and no unnecessary spaces. Accept kana where the learner does not yet know a kanji. The app offers pronunciation help separately; do not append romaji, furigana or translations to ordinary spoken replies. Use a register appropriate to the conversation.',
  lemmaGuidance: 'Give dictionary forms in Japanese: verbs in plain non-past form, adjectives in dictionary form, and nouns without particles unless they form a meaningful chunk. Preserve distinctions such as 食べる, 食べられる and 食べさせる. Keep the exact observed form and quote. Never infer spoken recall or pronunciation from typed kana or romaji. Use a stable concise English sense.',
  teachingFocus: [
    'Greetings, introductions and useful everyday chunks such as はじめまして, 私は and 〜をください.',
    'Everyday questions, polite present and past forms, は and が, common particles, numbers and counters.',
    'Connected stories, plain forms, て-form connections, descriptions, preferences and familiar situations.',
    'Reasons and opinions, relative clauses, conditionals, giving and receiving, and natural transitions between registers.',
    'Nuance, indirect requests, passive and causative forms, honorific language in context, idiomatic phrasing and regional variation.',
    'Flexible advanced discussion with precise natural Japanese, implication, tact and register suited to the relationship.',
  ],
  topicPlaceholder: 'Food, anime, travel, music, everyday life…',
  lookupUnavailableReply: '今は確認できませんでした。よければ、この話題について一般的なことを話しましょう。',
  themeOverrides: {
    coffee: { ...Themes.shared[0], title: 'コーヒーでも？', situation: '近所の喫茶店で会いましょう。自然な日本語で飲み物を注文し、学習者の一日や興味について話してください。店員には丁寧な言葉を使いましょう。' },
    groceries: { ...Themes.shared[5], title: '買い物に行こう', situation: '日本の商店街やスーパーで食材を買います。数量、値段、助数詞、丁寧な質問を自然に練習し、好きな料理について聞いてください。' },
    travel: { ...Themes.shared[6], title: '次の駅は', situation: '日本での旅行を一緒に計画します。行き先、交通、切符、道案内について話してください。最新の時刻表や運賃は確認せずに作らないでください。' },
    cabin: { ...Themes.shared[11], title: '週末のお出かけ', situation: '日本の町、海辺、山などへの週末旅行を想像し、一緒に行き先や食事、やりたいことを決めましょう。' },
    traditions: { ...Themes.shared[20], title: 'いつもの暮らし', situation: '日本での日常生活や行事について、学習者が知っている場所と比べながら話しましょう。日本の人や地域の習慣を一括りにせず、違いや多様性を尊重してください。' },
  },
};

function enrich(language: LanguageContent): LanguageModule {
  return {
    ...language,
    themes: Themes.shared.map((theme) => language.themeOverrides[theme.id] ?? theme),
    defaultTitle: `A little ${language.name}`,
    talkTitle: `A little everyday ${language.name}`,
    settingsTitle: `${language.name} · ${language.variety}`,
  };
}

const originals: LanguageContent[] = content.languages.map((language) => ({
  ...language,
  themeOverrides: Object.fromEntries(Object.entries(language.themeOverrides).filter((entry): entry is [string, ConversationTheme] => entry[1] !== undefined)),
}));
const all: LanguageModule[] = [japanese, ...originals].map(enrich);
export const LanguageRegistry = {
  defaultID: 'ja',
  all,
  get(id: string): LanguageModule | undefined { return all.find((language) => language.id === id); },
};
export const DEFAULT_LANGUAGE = all[0];
export const LANGUAGES = all;
export function getLanguage(id: string): LanguageModule { return LanguageRegistry.get(id) ?? DEFAULT_LANGUAGE; }

const greetings: Record<string, string> = {
  English: 'Hi!', French: 'Salut !', German: 'Hallo!', Spanish: '¡Hola!', Norwegian: 'Hei!',
  Portuguese: 'Olá!', Italian: 'Ciao!', 'Chinese (Simplified)': '你好！', Chinese: '你好！',
  Polish: 'Cześć!', Arabic: 'مرحبًا!', Ukrainian: 'Привіт!', Japanese: 'こんにちは！',
};
export const MeaningLanguages = {
  all: ['English', 'French', 'German', 'Spanish', 'Norwegian', 'Portuguese', 'Italian', 'Chinese (Simplified)', 'Polish', 'Arabic', 'Ukrainian', 'Japanese'],
  greeting(language: string): string { return greetings[language] ?? 'Hi!'; },
};
