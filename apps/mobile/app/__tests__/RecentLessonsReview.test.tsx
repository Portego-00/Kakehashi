import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { getStudyMaterials } from '../../src/utils/api';
import { useDashboardData } from '../../src/hooks/useDashboardData';
import { useAuthStore } from '../../src/utils/store';
import RecentLessonsReview from '../(app)/recent-lessons-review';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({ days: '7' })),
}));

jest.mock('../../src/utils/api', () => ({
  getStudyMaterials: jest.fn(),
}));

jest.mock('../../src/contexts/AuthContext', () => ({
  useSession: jest.fn(() => ({ isLoading: false })),
}));

jest.mock('../../src/hooks/useDashboardData', () => ({
  useDashboardData: jest.fn(),
}));

jest.mock('../../src/utils/store', () => ({
  useAuthStore: jest.fn(),
  useSettingsStore: jest.fn(() => ({
    ankiCardMode: false,
    ankiGroupQuestions: false,
    ankiCardModeScope: 'both',
    acceptUserSynonymsAsAnswers: false,
    reviewQuestionOrderEnabled: false,
    meaningFirst: true,
  })),
}));

jest.mock('../../src/utils/theme', () => ({
  useTheme: jest.fn(() => ({
    theme: {
      primary: '#7c3aed',
    },
  })),
}));

jest.mock('../../src/components/ReviewQuestionScreen', () => {
  const React = jest.requireActual('react');
  const { Text, TextInput, TouchableOpacity, View } = jest.requireActual('react-native');

  return function MockReviewQuestionScreen({
    item,
    questionType,
  }: {
    item: {
      subject: {
        object: string;
        data: {
          characters?: string | null;
          meanings: { meaning: string; primary?: boolean }[];
        };
      };
    };
    questionType: 'meaning' | 'reading';
  }) {
    const [answer, setAnswer] = React.useState('');
    const [feedback, setFeedback] = React.useState<'correct' | 'incorrect' | null>(null);
    const correctAnswer =
      item.subject.data.meanings.find((meaning) => meaning.primary)?.meaning ||
      item.subject.data.meanings[0]?.meaning ||
      '';

    return (
      <View>
        <Text>{questionType === 'meaning' ? 'Meaning' : 'Reading'}</Text>
        <Text>{item.subject.object === 'kanji' ? 'Kanji' : item.subject.object}</Text>
        <Text>{item.subject.data.characters}</Text>
        <TextInput
          placeholder={questionType === 'meaning' ? 'Enter meaning...' : 'Enter reading...'}
          value={answer}
          onChangeText={setAnswer}
        />
        <TouchableOpacity
          onPress={() => {
            setFeedback(
              answer.trim().toLowerCase() === correctAnswer.toLowerCase()
                ? 'correct'
                : 'incorrect',
            );
          }}
        >
          <Text>Submit</Text>
        </TouchableOpacity>
        {feedback === 'correct' ? <Text>Correct! - Next</Text> : null}
        {feedback === 'incorrect' ? (
          <View>
            <Text>Incorrect - Next</Text>
            <Text>Correct answer:</Text>
            <Text>{correctAnswer}</Text>
          </View>
        ) : null}
      </View>
    );
  };
});

jest.mock('../../src/components/RecentLessonsResultsScreen', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return function MockRecentLessonsResultsScreen() {
    return <Text>Recent lessons results</Text>;
  };
});

jest.mock('../../src/utils/reviewUtils', () => ({
  prepareReviewData: jest.fn((subjects, assignments) => {
    // Simple mock implementation that returns a formatted review item
    return [
      {
        id: 0,
        subjectId: 1001,
        assignmentId: 123,
        characters: '漢',
        meanings: [
          { meaning: 'Chinese', primary: true },
        ],
        readings: [
          { reading: 'かん', primary: true },
        ],
        type: 'kanji',
        meaningQuestion: {
          type: 'meaning',
          itemId: 0,
        },
        readingQuestion: {
          type: 'reading',
          itemId: 0,
        }
      }
    ];
  }),
  shuffleArray: jest.fn(arr => arr), // Return array unchanged for predictability
}));

// Mock the answer checker to make testing easier
jest.mock('../../src/utils/answerChecker', () => ({
  isAnswerCorrect: jest.fn((answer, _subject, taskType) => {
    if (taskType === 'meaning' && answer.toLowerCase() === 'chinese') {
      return true;
    }
    if (taskType === 'reading' && answer === 'かん') {
      return true;
    }
    return false;
  }),
}));

describe('RecentLessonsReview Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup auth store mock
    (useAuthStore as jest.Mock).mockReturnValue({
      apiToken: 'test-token',
    });

    (useDashboardData as jest.Mock).mockReturnValue({
      isLoading: false,
      dashboardData: {
        assignments: [
          {
            id: 123,
            data: {
              subject_id: 1001,
              subject_type: 'kanji',
              srs_stage: 1,
              started_at: new Date().toISOString(),
              burned_at: null,
              passed_at: null,
            }
          }
        ],
        subjects: [
          {
            id: 1001,
            object: 'kanji',
            data: {
              characters: '漢',
              level: 1,
              meanings: [
                { meaning: 'Chinese', primary: true },
              ],
              readings: [
                { reading: 'かん', primary: true },
              ],
              character_images: [],
              pronunciation_audios: [],
            }
          }
        ],
      },
    });

    (getStudyMaterials as jest.Mock).mockResolvedValue({
      data: [],
    });
  });

  it('should render loading state initially', () => {
    (useDashboardData as jest.Mock).mockReturnValueOnce({
      isLoading: true,
      dashboardData: {
        assignments: [],
        subjects: [],
      },
    });

    const { getByText } = render(<RecentLessonsReview />);
    expect(getByText('Loading recent lessons...')).toBeTruthy();
  });

  it('should load review items and display the first question', async () => {
    const { getByText, getByPlaceholderText } = render(<RecentLessonsReview />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(getByText('漢')).toBeTruthy();
    });
    
    // Verify question is displayed
    expect(getByText('Meaning')).toBeTruthy();
    expect(getByText('Kanji')).toBeTruthy();
    expect(getByText('漢')).toBeTruthy();
    expect(getByPlaceholderText('Enter meaning...')).toBeTruthy();
  });

  it('should handle correct answers properly', async () => {
    const { getByText, getByPlaceholderText } = render(<RecentLessonsReview />);
    
    await waitFor(() => {
      expect(getByText('漢')).toBeTruthy();
    });
    
    // Enter a correct answer
    const inputField = getByPlaceholderText('Enter meaning...');
    fireEvent.changeText(inputField, 'chinese');
    
    // Submit answer
    fireEvent.press(getByText('Submit'));
    
    // Verify correct feedback
    await waitFor(() => {
      expect(getByText('Correct! - Next')).toBeTruthy();
    });
  });

  it('should handle incorrect answers properly', async () => {
    const { getByText, getByPlaceholderText } = render(<RecentLessonsReview />);
    
    await waitFor(() => {
      expect(getByText('漢')).toBeTruthy();
    });
    
    // Enter an incorrect answer
    const inputField = getByPlaceholderText('Enter meaning...');
    fireEvent.changeText(inputField, 'wrong');
    
    // Submit answer
    fireEvent.press(getByText('Submit'));
    
    // Verify incorrect feedback and showing correct answer
    await waitFor(() => {
      expect(getByText('Incorrect - Next')).toBeTruthy();
      expect(getByText('Correct answer:')).toBeTruthy();
      expect(getByText('Chinese')).toBeTruthy();
    });
  });
});
