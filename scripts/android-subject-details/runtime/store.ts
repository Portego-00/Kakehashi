import { create } from 'zustand';
export const useAuthStore = create(() => ({ apiToken: "isolated-fixture-token", userData: { id: 'android-issue-110', username: 'Issue example', level: 8 } }));
export const useSettingsStore = create((set) => ({
  ankiCardMode: false, ankiGroupQuestions: true, ankiCardModeScope: 'both',
  ankiAskIncorrectPart: false,
  setAnkiAskIncorrectPart: (enabled: boolean) => set({ ankiAskIncorrectPart: enabled }),
  setAnkiGroupQuestions: (enabled: boolean) => set({ ankiGroupQuestions: enabled }),
  setAnkiCardModeScope: (scope: string) => set({ ankiCardModeScope: scope }),
  ankiHideAnswerCompletely: false, ankiButtonlessMode: false,
  reviewMultipleChoiceEnabled: false, reviewCharacterFontScale: 1, reviewInputFontScale: 1,
  ankiShowOtherAcceptedAnswersAndUserSynonyms: false, ankiShowReplayAudioButton: false,
  ankiShowWaniKaniGrammarTags: false, ankiShowKanjiComposition: false,
  ankiShowPitchAccentNumbers: false, ankiShowPitchAccentGraph: false,
  autoplayVocabularyAudio: false, vocabularyAudioVoice: 'female',
  allowSkippingReviews: true, disableAutoProgressOnWrong: true,
  disableAutoProgressOnCloseAnswer: false, disableAutoProgressOnCorrect: false,
  acceptUserSynonymsAsAnswers: false, showAddSynonymButton: false,
  jitaiEnabled: false, jitaiCycleAllFonts: false, jitaiSelectedFontIds: [],
  autoSwitchKeyboard: false, voiceReviewAnswersEnabled: false,
  showAnswerStopSubjectDetails: true, showReviewItemLevelAndSrsStage: false,
  showJLPTLevel: false, reviewAnimatePreviousQuestion: false,
  reviewSearchButtonEnabled: false, srsProgressionCardDisplayMode: 'hidden',
  visuallySimilarKanjiSource: 'wanikani', hapticFeedbackEnabled: true,
  radicalColor: '#3c9bff', kanjiColor: '#fa1f62', vocabularyColor: '#9c38d9',
  homeStudyPacePlannerEnabled: true, dailyLessonLimit: 30,
  reviewBatchSize: 40, reviewBatchSizeEnabled: true,
  forecastShowSubjectColors: false, showSimilarVocabulary: true, showPitchAccent: true, showPatternsOfUse: true, showSingleKanjiVocabularySimilarKanji: true, showMediaContextSentences: false,
  immersionKitAnimes: [], showVocabularyFrequency: false,
  appTextSizeScale: 1,
  setReviewMultipleChoiceEnabled: (enabled: boolean) => set({ reviewMultipleChoiceEnabled: enabled }),
}));
export const usePreviewTextScale = create(() => ({ scale: 1 }));

export const useCustomSrsStore = create(() => ({}));
