import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import type ReviewQuestionScreen from '../../src/components/ReviewQuestionScreen';
import type ReviewResultsScreen from '../../src/components/ReviewResultsScreen';
import { loadExtraStudySessionState, saveExtraStudySessionState } from '../../src/utils/extraStudySessionPersistence';
import CustomReviewScreen from '../(app)/custom-review';
import {
  getAllAssignmentsCached,
  getStudyMaterials,
  getSubjects,
} from '../../src/utils/api';
import { getAllSubjects } from '../../src/utils/cache';
import { useAuthStore, useSettingsStore } from '../../src/utils/store';

const mockUseLocalSearchParams = jest.fn();
let mockReviewProps: React.ComponentProps<typeof ReviewQuestionScreen>;
let mockResultsProps: React.ComponentProps<typeof ReviewResultsScreen>;

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('../../src/utils/api', () => ({
  getAllAssignmentsCached: jest.fn(),
  getSubjects: jest.fn(),
  getStudyMaterials: jest.fn(),
}));

jest.mock('../../src/utils/cache', () => ({
  getAllSubjects: jest.fn(),
}));

jest.mock('../../src/utils/extraStudySessionPersistence', () => ({
  EXTRA_STUDY_SESSION_STORAGE_KEYS: {
    CUSTOM_REVIEW: 'extra_study_session:custom_review',
  },
  clearExtraStudySessionState: jest.fn().mockResolvedValue(undefined),
  loadExtraStudySessionState: jest.fn().mockResolvedValue(null),
  saveExtraStudySessionState: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/utils/store', () => ({
  useAuthStore: jest.fn(),
  useSettingsStore: jest.fn(),
}));

jest.mock('../../src/utils/theme', () => ({
  useTheme: jest.fn(() => ({
    theme: {
      backgroundColor: '#ffffff',
      border: '#dddddd',
      isDark: false,
      primary: '#7c3aed',
      secondary: '#7c3aed',
      textColor: '#111111',
      textLight: '#999999',
      textSecondary: '#555555',
    },
  })),
}));

jest.mock('../../src/components/ReviewResultsScreen', () => {
  const React = jest.requireActual('react');
  const { Text, TouchableOpacity, View } = jest.requireActual('react-native');

  return function MockReviewResultsScreen(props: React.ComponentProps<typeof ReviewResultsScreen>) {
    mockResultsProps = props;
    return <View>
      <Text>Custom review results</Text>
      <TouchableOpacity onPress={props.onRedo} accessibilityLabel="Redo">
        <Text>Redo</Text>
      </TouchableOpacity>
    </View>;
  };
});

jest.mock('../../src/components/ReviewQuestionScreen', () => {
  const React = jest.requireActual('react');
  const { Text, TouchableOpacity, View } = jest.requireActual('react-native');

  return function MockReviewQuestionScreen(props: React.ComponentProps<typeof ReviewQuestionScreen>) {
    mockReviewProps = props;
    const {
    isWrapUpAvailable,
    isWrapUpMode,
    remainingSubjectsCount,
    onWrapUp,
    } = props;
    return (
      <View>
        <Text testID="custom-review-question">{props.questionType}</Text>
        {isWrapUpMode ? (
          <TouchableOpacity onPress={onWrapUp}>
            <Text>Wrapping Up ({remainingSubjectsCount} left)</Text>
          </TouchableOpacity>
        ) : isWrapUpAvailable ? (
          <TouchableOpacity onPress={onWrapUp}>
            <Text>Wrap Up ({remainingSubjectsCount} left)</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };
});

describe('CustomReview Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadExtraStudySessionState as jest.Mock).mockResolvedValue(null);

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      apiToken: 'test-token',
    });

    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      ankiCardMode: false,
      ankiGroupQuestions: false,
      ankiCardModeScope: 'both',
      acceptUserSynonymsAsAnswers: false,
      customReviewOrder: 'lowestLevelFirst',
      backToBackQuestions: false,
      reviewQuestionOrderEnabled: false,
      meaningFirst: true,
    });

    (getStudyMaterials as jest.Mock).mockResolvedValue({
      data: [],
    });
    (getSubjects as jest.Mock).mockResolvedValue({
      data: [],
    });
  });

  it.each([
    ['standard', false], ['standard', true],
    ['flashcard', false], ['flashcard', true],
  ] as const)('uses the selected %s mode with grouping preference %s', async (reviewMode, groupQuestions) => {
    const settings = {
      ankiCardMode: reviewMode === 'standard',
      ankiCardModeScope: 'reading',
      ankiGroupQuestions: groupQuestions,
      customReviewOrder: 'lowestLevelFirst',
      backToBackQuestions: true,
      reviewQuestionOrderEnabled: true,
      meaningFirst: true,
    };
    (useSettingsStore as unknown as jest.Mock).mockReturnValue(settings);
    mockUseLocalSearchParams.mockReturnValue({ subjectIds: '1001', reviewMode });
    (getAllSubjects as jest.Mock).mockResolvedValue([{
      id: 1001, object: 'kanji', data: { level: 1, characters: '漢',
        meanings: [{ meaning: 'Chinese', primary: true }],
        readings: [{ reading: 'かん', primary: true }],
      },
    }]);
    (getAllAssignmentsCached as jest.Mock).mockResolvedValue({ data: [] });
    const screen = render(<CustomReviewScreen />);
    await screen.findByTestId('custom-review-question');
    expect(mockReviewProps.ankiSettingsOverride).toEqual({
      enabled: reviewMode === 'flashcard', scope: 'both', groupQuestions,
    });

    const grouped = reviewMode === 'flashcard' && groupQuestions;
    act(() => {
      const question = mockReviewProps;
      question.onAnswer(question.item, 'meaning', true, false, grouped);
      if (grouped) question.onAnswer(question.item, 'reading', true, false, true);
    });
    if (!grouped) {
      expect(mockReviewProps.questionType).toBe('reading');
      act(() => mockReviewProps.onAnswer(mockReviewProps.item, 'reading', true, false, false));
    }
    await screen.findByText('Custom review results');
    expect(mockResultsProps.progress.answeredCount).toBe(grouped ? 1 : 2);
    expect(settings.ankiCardMode).toBe(reviewMode === 'standard');
    expect(settings.ankiCardModeScope).toBe('reading');
    fireEvent.press(screen.getByLabelText('Redo'));
    expect(mockReviewProps.ankiSettingsOverride).toEqual({
      enabled: reviewMode === 'flashcard', scope: 'both', groupQuestions,
    });
  });

  it.each([
    ['standard', false], ['flashcard', false], ['flashcard', true],
  ] as const)('resumes and redoes a saved %s session (grouped preference: %s)', async (reviewMode, groupQuestions) => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      ankiCardMode: false, ankiCardModeScope: 'reading', ankiGroupQuestions: groupQuestions,
      customReviewOrder: 'lowestLevelFirst',
    });
    mockUseLocalSearchParams.mockReturnValue({ subjectIds: '1001', reviewMode });
    (getAllSubjects as jest.Mock).mockResolvedValue([{
      id: 1001, object: 'kanji', data: { level: 1, characters: '漢',
        meanings: [{ meaning: 'Chinese', primary: true }],
        readings: [{ reading: 'かん', primary: true }],
      },
    }]);
    (getAllAssignmentsCached as jest.Mock).mockResolvedValue({ data: [] });
    const screen = render(<CustomReviewScreen />);
    await screen.findByTestId('custom-review-question');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      act(() => mockReviewProps.onExit?.());
      const continueLater = alert.mock.calls.at(-1)?.[2]?.find((button) => button.text === 'Continue Later');
      expect(continueLater).toBeDefined();
      await act(async () => { await continueLater?.onPress?.(); });
      const savedSession = jest.mocked(saveExtraStudySessionState).mock.calls.at(-1)?.[1];
      const expectedSettings = { enabled: reviewMode === 'flashcard', scope: 'both', groupQuestions };
      expect(savedSession).toMatchObject({
        ankiSettings: expectedSettings,
        sessionUsesAnkiGrouping: reviewMode === 'flashcard' && groupQuestions,
      });
      screen.unmount();
      (loadExtraStudySessionState as jest.Mock).mockResolvedValue(savedSession);
      (useSettingsStore as unknown as jest.Mock).mockReturnValue({
        ankiCardMode: reviewMode === 'standard', ankiCardModeScope: 'meaning',
        ankiGroupQuestions: !groupQuestions, customReviewOrder: 'lowestLevelFirst',
      });
      mockUseLocalSearchParams.mockReturnValue({ resume: 'true' });
      const resumed = render(<CustomReviewScreen />);
      await resumed.findByTestId('custom-review-question');
      expect(mockReviewProps.ankiSettingsOverride).toEqual(expectedSettings);
      const grouped = reviewMode === 'flashcard' && groupQuestions;
      for (let index = 0; index < 2 && resumed.queryByTestId('custom-review-question'); index += 1) {
        act(() => {
          const question = mockReviewProps;
          question.onAnswer(question.item, question.questionType, true, false, grouped);
          if (grouped) question.onAnswer(question.item, 'reading', true, false, true);
        });
      }
      await resumed.findByText('Custom review results');
      fireEvent.press(resumed.getByLabelText('Redo'));
      expect(mockReviewProps.ankiSettingsOverride).toEqual(expectedSettings);
    } finally {
      alert.mockRestore();
    }
  });

  it.each([false, true])('restarts the whole session with fresh answers and progress (grouped: %s)', async (grouped) => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      ankiCardMode: grouped,
      ankiGroupQuestions: grouped,
      ankiCardModeScope: 'both',
      customReviewOrder: 'lowestLevelFirst',
      backToBackQuestions: true,
      reviewQuestionOrderEnabled: true,
      meaningFirst: true,
    });
    const subjects = [1001, 1002].map((id) => ({
      id, object: 'kanji', data: { level: id - 1000, characters: '漢',
        meanings: [{ meaning: 'Chinese', primary: true }],
        readings: [{ reading: 'かん', primary: true }],
      },
    }));
    mockUseLocalSearchParams.mockReturnValue({ subjectIds: '1001,1002', resume: 'false' });
    (getAllSubjects as jest.Mock).mockResolvedValue(subjects);
    (getAllAssignmentsCached as jest.Mock).mockResolvedValue({ data: [] });
    const screen = render(<CustomReviewScreen />);
    await screen.findByTestId('custom-review-question');
    expect(mockReviewProps.item.subject.id).toBe(1001);

    const answer = (correct: boolean) => act(() => {
      const question = mockReviewProps;
      if (grouped) {
        question.onAnswer(question.item, 'meaning', correct, !correct, true);
        question.onAnswer(question.item, 'reading', correct, !correct, true);
      } else {
        question.onAnswer(question.item, question.questionType, correct, !correct, false);
      }
    });
    const finish = async () => {
      for (let index = 0; index < 8 && screen.queryByTestId('custom-review-question'); index += 1) {
        answer(true);
      }
      await screen.findByText('Custom review results');
    };

    answer(false);
    await finish();
    expect(mockResultsProps.reviewItems.some((item) => item.meaningIncorrect > 0)).toBe(true);

    for (let repetition = 0; repetition < 2; repetition += 1) {
      fireEvent.press(screen.getByLabelText('Redo'));
      expect(screen.queryByText('Custom review results')).toBeNull();
      expect(mockReviewProps.item.subject.id).toBe(1001);
      expect(mockReviewProps.currentItem).toBe(0);
      expect(mockReviewProps.totalItems).toBe(2);
      expect(mockReviewProps.correctAnswersCount).toBe(0);
      await finish();
      expect(mockResultsProps.progress.completedItems).toBe(2);
      expect(mockResultsProps.progress.answeredCount).toBe(grouped ? 2 : 4);
      expect(mockResultsProps.reviewItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ subjectId: 1001, meaningIncorrect: 0, readingIncorrect: 0 }),
        expect.objectContaining({ subjectId: 1002, meaningIncorrect: 0, readingIncorrect: 0 }),
      ]));
    }
    expect(getAllSubjects).toHaveBeenCalledTimes(1);
    expect(getAllAssignmentsCached).toHaveBeenCalledTimes(1);
  });

  it('restarts a resumed session without needing route subject IDs', async () => {
    mockUseLocalSearchParams.mockReturnValue({ resume: 'true' });
    const subject = { id: 1001, object: 'radical', data: { level: 1, characters: '一',
      meanings: [{ meaning: 'ground', primary: true }],
    } };
    (loadExtraStudySessionState as jest.Mock).mockResolvedValue({
      reviewItems: [{ id: 1001, assignmentId: -1001, subjectId: 1001, subject,
        meaningDone: false, readingDone: false, meaningIncorrect: 1, readingIncorrect: 0,
      }],
      activeQueue: [{ itemId: 1001, type: 'meaning' }],
      currentQuestion: { itemId: 1001, type: 'meaning' },
      progress: { totalItems: 1, answeredCount: 1 },
      isWrapUpMode: true,
      sessionUsesAnkiGrouping: false,
    });
    const screen = render(<CustomReviewScreen />);
    await screen.findByTestId('custom-review-question');
    expect(mockReviewProps.item.subject.id).toBe(1001);
    act(() => mockReviewProps.onAnswer(mockReviewProps.item, 'meaning', true, false, false));
    await screen.findByText('Custom review results');
    fireEvent.press(screen.getByLabelText('Redo'));
    expect(mockReviewProps.isWrapUpMode).toBe(false);
    expect(mockReviewProps.correctAnswersCount).toBe(0);
    act(() => mockReviewProps.onAnswer(mockReviewProps.item, 'meaning', true, false, false));
    await screen.findByText('Custom review results');
    expect(mockResultsProps.reviewItems[0].meaningIncorrect).toBe(0);
    expect(mockResultsProps.progress.completedItems).toBe(1);
    expect(getAllSubjects).not.toHaveBeenCalled();
  });

  it('should toggle custom review wrap up back to the full queue', async () => {
    const subjects = Array.from({ length: 12 }, (_, index) => ({
      id: 1001 + index,
      object: 'kanji',
      data: {
        characters: `漢${index}`,
        level: 1,
        meanings: [
          { meaning: `Chinese ${index}`, primary: true },
        ],
        readings: [
          { reading: 'かん', primary: true },
        ],
        character_images: [],
        pronunciation_audios: [],
      },
    }));
    const assignments = subjects.map((subject, index) => ({
      id: 123 + index,
      data: {
        subject_id: subject.id,
        subject_type: 'kanji',
        srs_stage: 1,
        available_at: null,
      },
    }));

    mockUseLocalSearchParams.mockReturnValue({
      subjectIds: subjects.map((subject) => subject.id).join(','),
      resume: 'false',
    });
    (getAllSubjects as jest.Mock).mockResolvedValue(subjects);
    (getAllAssignmentsCached as jest.Mock).mockResolvedValue({
      data: assignments,
    });

    const { getByText } = render(<CustomReviewScreen />);

    await waitFor(() => {
      expect(getByText('Wrap Up (12 left)')).toBeTruthy();
    });

    fireEvent.press(getByText('Wrap Up (12 left)'));

    await waitFor(() => {
      expect(getByText('Wrapping Up (10 left)')).toBeTruthy();
    });

    fireEvent.press(getByText('Wrapping Up (10 left)'));

    await waitFor(() => {
      expect(getByText('Wrap Up (12 left)')).toBeTruthy();
    });
  });

  it.each([[false, true], [true, false], [false, false]])('retries a grouped practice mistake (%s/%s) once (#111)', async (meaningCorrect, readingCorrect) => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue({
      ankiCardMode: true, ankiGroupQuestions: true, ankiCardModeScope: 'both',
      customReviewOrder: 'lowestLevelFirst', backToBackQuestions: false,
    });
    const subject = { id: 1001, object: 'vocabulary', data: { level: 1, characters: '先日',
      meanings: [{ meaning: 'the other day', primary: true }], readings: [{ reading: 'せんじつ', primary: true }],
    } };
    mockUseLocalSearchParams.mockReturnValue({ subjectIds: '1001', resume: 'false' });
    (getAllSubjects as jest.Mock).mockResolvedValue([subject]);
    (getAllAssignmentsCached as jest.Mock).mockResolvedValue({ data: [{ id: 12, data: { subject_id: 1001, srs_stage: 1 } }] });
    const screen = render(<CustomReviewScreen />);
    await waitFor(() => expect(mockReviewProps?.item.subject.id).toBe(1001));
    const first = mockReviewProps;
    act(() => {
      first.onAnswer(first.item, 'meaning', meaningCorrect, !meaningCorrect, true);
      first.onAnswer(first.item, 'reading', readingCorrect, !readingCorrect, true);
    });
    expect(screen.queryByText('Custom review results')).toBeNull();
    expect(mockReviewProps.currentItem).toBe(1);
    expect(mockReviewProps.correctAnswersCount).toBe(0);
    const retry = mockReviewProps;
    act(() => {
      retry.onAnswer(retry.item, 'meaning', true, false, true);
      retry.onAnswer(retry.item, 'reading', true, false, true);
    });
    await screen.findByText('Custom review results');
  });
});
