import { Dimensions } from "react-native";

import { AnswerCheckerResult } from "../../utils/answerChecker";

const screenDimensions = Dimensions.get("window");

export const width = screenDimensions.width;
export const height = screenDimensions.height;
export const ANSWER_INPUT_FONT_SIZE = Math.min(width * 0.045, 18);
export const ANSWER_INPUT_HEIGHT = 52;
export const ANDROID_AUTOFOCUS_DELAY_MS = 200;
export const SKIP_CUE_VISIBLE_MS = 2000;
export const SRS_CARD_WIDTH = 170;
export const SRS_CARD_COMPACT_WIDTH = 138;
export const SRS_CARD_SIDE_OFFSET = 18;
export const TOP_STATUS_POPUP_OFFSET = 138;
export const PAUSED_SHORTCUT_GUARD_MS = 300;
export const ANSWERED_ITEM_RADICAL_SIZE = 34;
export const BUTTONLESS_TAP_MOVE_TOLERANCE_PX = 14;
export const BUTTONLESS_SWIPE_TRIGGER_PX = 56;
export const BUTTONLESS_VERTICAL_DOMINANCE_RATIO = 1.2;
export const IOS_SUSPICIOUS_KEYBOARD_HEIGHT_RATIO = 0.9;
export const VOCABULARY_AUDIO_MAX_PLAYBACK_MS = 15000;
export const DARK_MODE_MEANING_BANNER_BG = "#b8b8b8";
export const DARK_MODE_MEANING_BANNER_TEXT = "#1f1f1f";
export const DARK_MODE_READING_BANNER_BG = "#2b2b2b";
export const FLOATING_REVIEW_TOOL_BUTTON_SIZE = 40;
export const FLOATING_REVIEW_TOOL_BUTTON_RADIUS =
  FLOATING_REVIEW_TOOL_BUTTON_SIZE / 2;
export const FLOATING_REVIEW_TOOL_BUTTON_TOP_WITH_WRAP_UP = 184;
export const FLOATING_REVIEW_TOOL_BUTTON_TOP_WITHOUT_WRAP_UP = 140;
export const FLOATING_REVIEW_TOOL_BUTTON_GAP = 8;
export const FLOATING_REVIEW_TOOL_BUTTON_RIGHT = 16;

export const RETRYABLE_ANSWER_RESULTS = new Set<AnswerCheckerResult>([
  AnswerCheckerResult.OtherKanjiReading,
  AnswerCheckerResult.WrongReadingType,
  AnswerCheckerResult.MismatchingOkurigana,
  AnswerCheckerResult.ContainsInvalidCharacters,
  AnswerCheckerResult.IsKanjiButWantReading,
  AnswerCheckerResult.IsReadingButWantMeaning,
  AnswerCheckerResult.IsMeaningButWantReading,
  AnswerCheckerResult.IncorrectNConversion,
]);

export const KANJI_CHARACTER_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF]/;
export const KANA_CHARACTER_REGEX = /[\u3040-\u309F\u30A0-\u30FF]/;
export const TRANSCRIPT_PUNCTUATION_REGEX =
  /[。、，,．\.!?！？:：;；'"`´「」『』（）\(\)\[\]【】{}…・]/g;
export const DIGIT_SEQUENCE_REGEX = /\d+/g;
export const ARABIC_NUMBER_REGEX = /^\d+$/;
export const KANJI_DIGITS = [
  "",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
];
export const LARGE_NUMBER_UNITS = ["", "万", "億", "兆", "京"];
export const VOICE_READING_SCRIPT_MISMATCH_ERROR =
  "Recognized kanji text instead of kana. Please try speaking the reading again.";
