import { Subject } from '../../types/wanikani';
import {
  AnswerCheckerResult,
  checkAnswerWithDetails,
} from '../answerChecker';

function buildSubject(overrides: Partial<Subject>): Subject {
  return {
    id: 1,
    object: 'vocabulary',
    data: {
      characters: '大人',
      meanings: [{ meaning: 'adult', primary: true, accepted_answer: true }],
      readings: [{ reading: 'おとな', primary: true, accepted_answer: true }],
      ...overrides.data,
    },
    ...overrides,
  };
}

describe('answerChecker reading validation', () => {
  it('returns WrongReadingType for non-primary kanji readings by default', () => {
    const subject = buildSubject({
      object: 'kanji',
      data: {
        characters: '日',
        meanings: [{ meaning: 'day', primary: true, accepted_answer: true }],
        readings: [
          { reading: 'にち', primary: true, type: 'onyomi', accepted_answer: true },
          { reading: 'じつ', primary: false, type: 'onyomi', accepted_answer: true },
        ],
      },
    });

    const result = checkAnswerWithDetails('じつ', subject, 'reading');

    expect(result).toBe(AnswerCheckerResult.WrongReadingType);
  });

  it('accepts non-primary on\'yomi when the setting is enabled', () => {
    const subject = buildSubject({
      object: 'kanji',
      data: {
        characters: '日',
        meanings: [{ meaning: 'day', primary: true, accepted_answer: true }],
        readings: [
          { reading: 'にち', primary: true, type: 'onyomi', accepted_answer: true },
          { reading: 'じつ', primary: false, type: 'onyomi', accepted_answer: true },
        ],
      },
    });

    const result = checkAnswerWithDetails(
      'じつ',
      subject,
      'reading',
      undefined,
      { acceptAnyKanjiOnyomiReading: true },
    );

    expect(result).toBe(AnswerCheckerResult.Precise);
  });

  it('returns IsKanjiButWantReading when user enters subject kanji instead of reading', () => {
    const subject = buildSubject({});

    const result = checkAnswerWithDetails('大人', subject, 'reading');

    expect(result).toBe(AnswerCheckerResult.IsKanjiButWantReading);
  });

  it('returns IsKanjiButWantReading when matching characters with/without leading wave dash', () => {
    const subject = buildSubject({
      data: {
        characters: '〜中',
        meanings: [{ meaning: 'during', primary: true, accepted_answer: true }],
        readings: [{ reading: 'ちゅう', primary: true, accepted_answer: true }],
      },
    });

    const result = checkAnswerWithDetails('中', subject, 'reading');

    expect(result).toBe(AnswerCheckerResult.IsKanjiButWantReading);
  });

  it('still returns ContainsInvalidCharacters for non-kana non-kanji input on reading', () => {
    const subject = buildSubject({});

    const result = checkAnswerWithDetails('abc123', subject, 'reading');

    expect(result).toBe(AnswerCheckerResult.ContainsInvalidCharacters);
  });

  it('still accepts valid reading input', () => {
    const subject = buildSubject({});

    const result = checkAnswerWithDetails('おとな', subject, 'reading');

    expect(result).toBe(AnswerCheckerResult.Precise);
  });

  it('returns OtherKanjiReading for single-kanji vocabulary when answer matches a kanji reading only', () => {
    const subject = buildSubject({
      data: {
        characters: '生',
        meanings: [{ meaning: 'raw', primary: true, accepted_answer: true }],
        readings: [{ reading: 'なま', primary: true, accepted_answer: true }],
      },
    });

    const result = checkAnswerWithDetails(
      'せい',
      subject,
      'reading',
      undefined,
      { singleKanjiReadings: { 生: ['せい', 'しょう', 'い', 'う'] } },
    );

    expect(result).toBe(AnswerCheckerResult.OtherKanjiReading);
  });

  it('does not return OtherKanjiReading for multi-kanji vocabulary', () => {
    const subject = buildSubject({});

    const result = checkAnswerWithDetails(
      'だい',
      subject,
      'reading',
      undefined,
      { singleKanjiReadings: { 大: ['だい', 'たい', 'おお'] } },
    );

    expect(result).toBe(AnswerCheckerResult.Incorrect);
  });

  it('falls back to Incorrect when kanji lookup is unavailable', () => {
    const subject = buildSubject({
      data: {
        characters: '生',
        meanings: [{ meaning: 'raw', primary: true, accepted_answer: true }],
        readings: [{ reading: 'なま', primary: true, accepted_answer: true }],
      },
    });

    const result = checkAnswerWithDetails('せい', subject, 'reading');

    expect(result).toBe(AnswerCheckerResult.Incorrect);
  });
});
