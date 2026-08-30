/**
 * The JLPT bank and engine are intentionally shared with the web client.
 * Keeping one source of truth prevents the native and web mock structures,
 * timings, scoring, and generated question history from drifting apart.
 */
export {
  advanceJlptSession,
  answerCurrentJlptQuestion,
  answerForQuestion,
  createJlptSession,
  currentJlptQuestionId,
  expireJlptSection,
  jlptListeningPlaybackScript,
  pauseJlptSession,
  recordJlptListeningPlay,
  releaseJlptListeningPlay,
  remainingSectionSeconds,
  resumeJlptSession,
  scoreJlptSession,
  startNextJlptSection,
  waniKaniKanjiInsight,
} from "../../../web/src/features/jlpt/engine";
export { jlptQuestionSemanticKey } from "../../../web/src/features/jlpt/editorial";
export { loadJlptQuestionBank } from "../../../web/src/features/jlpt/questions";
export {
  approximateMockQuestionCount,
  JLPT_MOCK_STRUCTURES,
  OFFICIAL_TYPE_LABELS,
  SKILL_LABELS,
} from "../../../web/src/features/jlpt/structure";
export {
  JLPT_BANK_VERSION,
  JLPT_LEVELS,
} from "../../../web/src/features/jlpt/types";
export type {
  JlptAnswer,
  JlptLevel,
  JlptPerformanceSlice,
  JlptQuestion,
  JlptQuizMode,
  JlptSession,
  JlptSessionResult,
  JlptSkill,
} from "../../../web/src/features/jlpt/types";
