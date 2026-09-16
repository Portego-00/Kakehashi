import type { LiveVoice } from './voices';

/** Mural archive v2 field names and Apple-reference-date timestamps are preserved. */
export type Speaker = 'user' | 'assistant';
export type EvidenceKind = 'exposure' | 'understanding' | 'assisted' | 'independent' | 'lapse';
export type Outcome = 'success' | 'partial' | 'breakdown' | 'uncertain';

export interface Fragment {
  id: string;
  revision: number;
  previousTexts: string[];
  speaker: Speaker;
  text: string;
  startMS: number;
  endMS: number;
  receivedAt: number;
  meaningVisible: boolean;
  typed: boolean;
}

export interface Passage {
  id: string;
  speaker: Speaker;
  fragments: Fragment[];
  text: string;
  revisionKey: string;
  startMS: number;
  endMS: number;
}

export interface WordProposal {
  lemma: string;
  meaning: string;
  form: string;
  kind: EvidenceKind;
  confidence: number;
  sourceIDs: string[];
  quote: string;
  language: string;
}

export interface Assessment {
  passageID: string;
  revisionKey: string;
  outcome: Outcome;
  suggestedLevel: number;
  nextGoal: string;
  capability: string;
  words: WordProposal[];
  createdAt: number;
  context: string;
}

export interface SourceLink { title: string; url: string }
export interface TopicBrief {
  id: string;
  languageID: string;
  query: string;
  text: string;
  sources: SourceLink[];
  retrievedAt: number;
}

export interface SessionRecord {
  id: string;
  languageID: string;
  providerID?: string | null;
  startedAt: number;
  endedAt?: number | null;
  themeID?: string | null;
  title: string;
  fragments: Fragment[];
  assessments: Assessment[];
  translations: Record<string, string>;
  topics: TopicBrief[];
  voiceSeconds: number;
  usageFinal: boolean;
  inputTokens: number;
  outputTokens: number;
  searchCalls: number;
  endReason?: string | null;
}

export interface Preferences {
  learningLanguageID: string;
  voice: LiveVoice;
  meaningVisible: boolean;
  meaningLanguage: string;
  sessionMinutes: number;
  hiddenWords: string[];
  interests: string;
  hasOnboarded: boolean;
  aiConsentVersion?: number | null;
  showPinyin?: boolean;
}
export interface Archive { schemaVersion: 2; sessions: SessionRecord[]; preferences: Preferences }

export interface WordState {
  id: string;
  lemma: string;
  meaning: string;
  form: string;
  example: string;
  bars: number;
  understandingCount: number;
  independentCount: number;
  lastSeen: number;
  dueAt: number;
  label: string;
  explanation: string;
}
export interface LearnerState {
  challenge: number;
  observationCount: number;
  nextGoal: string;
  capabilities: string[];
  words: WordState[];
  levelLabel: string;
}

export interface ConversationTheme {
  id: string;
  title: string;
  subtitle: string;
  symbol: string;
  category: string;
  situation: string;
  colorIndex: number;
}
export interface LanguageModule {
  id: string;
  name: string;
  nativeName: string;
  variety: string;
  locale: string;
  greeting: string;
  greetingWord: string;
  speechGuidance: string;
  writingGuidance: string;
  lemmaGuidance: string;
  teachingFocus: string[];
  topicPlaceholder: string;
  lookupUnavailableReply: string;
  themeOverrides: Record<string, ConversationTheme>;
  themes: ConversationTheme[];
  defaultTitle: string;
  talkTitle: string;
  settingsTitle: string;
}

/** Private recovery metadata, deliberately omitted from shareable archives. */
export interface FinalAssessmentTicket {
  sessionID: string;
  passageID: string;
  revisionKey: string;
  attempts: number;
  lastAttemptAt?: number | null;
}
