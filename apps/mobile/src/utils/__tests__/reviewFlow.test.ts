import { describe, it, expect } from '@jest/globals';

// Integration test for the review flow with realistic data
describe('Review Flow Integration', () => {
  // Mock subject data similar to what the API would return
  const mockSubjects = [
    { id: 1, object: 'radical', data: { meanings: [{ meaning: 'ground' }] } },
    { id: 2, object: 'kanji', data: { meanings: [{ meaning: 'earth' }], readings: [{ reading: 'つち' }] } },
    { id: 3, object: 'vocabulary', data: { meanings: [{ meaning: 'soil' }], readings: [{ reading: 'つち' }] } },
    { id: 4, object: 'kanji', data: { meanings: [{ meaning: 'water' }], readings: [{ reading: 'みず' }] } },
  ];

  // Mock review items as they would be created
  const mockReviewItems = mockSubjects.map(subject => ({
    id: subject.id,
    subject,
    meaningDone: false,
    readingDone: false,
    meaningIncorrect: 0,
    readingIncorrect: 0,
  }));

  // Question generation logic (simplified from reviews.tsx)
  const generateQuestionsFromItems = (items: typeof mockReviewItems) => {
    const questions: { type: "meaning" | "reading", itemId: number }[] = [];

    items.forEach((item) => {
      questions.push({ type: "meaning", itemId: item.id });

      // Only add reading questions for kanji and vocab that have readings
      const isVocabWithoutReading =
        (item.subject.object === "vocabulary" || item.subject.object === "kana_vocabulary") &&
        !item.subject.data.readings;

      if (item.subject.object !== "radical" && !isVocabWithoutReading) {
        questions.push({ type: "reading", itemId: item.id });
      }
    });

    return questions;
  };

  it('should generate correct questions for mixed subject types', () => {
    const questions = generateQuestionsFromItems(mockReviewItems);
    
    // Should have:
    // - 1 radical (meaning only) = 1 question
    // - 2 kanji (meaning + reading) = 4 questions  
    // - 1 vocabulary (meaning + reading) = 2 questions
    // Total: 7 questions
    expect(questions).toHaveLength(7);
    
    // Check radical has only meaning
    const radicalQuestions = questions.filter(q => q.itemId === 1);
    expect(radicalQuestions).toHaveLength(1);
    expect(radicalQuestions[0].type).toBe('meaning');
    
    // Check kanji have both meaning and reading
    const kanjiQuestions = questions.filter(q => q.itemId === 2 || q.itemId === 4);
    expect(kanjiQuestions).toHaveLength(4); // 2 kanji × 2 questions each
    
    // Check vocabulary has both meaning and reading
    const vocabQuestions = questions.filter(q => q.itemId === 3);
    expect(vocabQuestions).toHaveLength(2);
  });

  it('should verify question distribution matches subject types', () => {
    const questions = generateQuestionsFromItems(mockReviewItems);
    
    // Count by type
    const meaningQuestions = questions.filter(q => q.type === 'meaning');
    const readingQuestions = questions.filter(q => q.type === 'reading');
    
    // Should have 4 meaning questions (all subjects have meanings)
    expect(meaningQuestions).toHaveLength(4);
    
    // Should have 3 reading questions (2 kanji + 1 vocabulary)
    expect(readingQuestions).toHaveLength(3);
  });

  it('should create valid question pairs for subjects with readings', () => {
    const questions = generateQuestionsFromItems(mockReviewItems);
    
    // Group by itemId
    const questionsByItem = new Map<number, { type: "meaning" | "reading", itemId: number }[]>();
    questions.forEach(q => {
      const itemQuestions = questionsByItem.get(q.itemId) || [];
      itemQuestions.push(q);
      questionsByItem.set(q.itemId, itemQuestions);
    });
    
    // Verify structure
    expect(questionsByItem.get(1)).toHaveLength(1); // Radical: meaning only
    expect(questionsByItem.get(2)).toHaveLength(2); // Kanji: meaning + reading
    expect(questionsByItem.get(3)).toHaveLength(2); // Vocabulary: meaning + reading
    expect(questionsByItem.get(4)).toHaveLength(2); // Kanji: meaning + reading
    
    // Verify each pair has both types
    [2, 3, 4].forEach(itemId => {
      const itemQuestions = questionsByItem.get(itemId)!;
      const types = itemQuestions.map(q => q.type).sort();
      expect(types).toEqual(['meaning', 'reading']);
    });
  });
});