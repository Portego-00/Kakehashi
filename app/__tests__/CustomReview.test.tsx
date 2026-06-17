import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import CustomReviewScreen from '../(app)/custom-review';
import {
  getAllAssignmentsCached,
  getStudyMaterials,
  getSubjects,
} from '../../src/utils/api';
import { getAllSubjects } from '../../src/utils/cache';
import { useAuthStore, useSettingsStore } from '../../src/utils/store';

const mockUseLocalSearchParams = jest.fn();

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
  const { Text } = jest.requireActual('react-native');

  return function MockReviewResultsScreen() {
    return <Text>Custom review results</Text>;
  };
});

jest.mock('../../src/components/ReviewQuestionScreen', () => {
  const React = jest.requireActual('react');
  const { Text, TouchableOpacity, View } = jest.requireActual('react-native');

  return function MockReviewQuestionScreen({
    isWrapUpAvailable,
    isWrapUpMode,
    remainingSubjectsCount,
    onWrapUp,
  }: {
    isWrapUpAvailable?: boolean;
    isWrapUpMode?: boolean;
    remainingSubjectsCount?: number;
    onWrapUp?: () => void;
  }) {
    return (
      <View>
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
});
