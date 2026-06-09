import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Tests for the lesson queue management logic from lessons.tsx
 *
 * Queue Architecture:
 * - masterQueue: Contains ALL questions for the batch
 * - activeQueue: Contains up to ACTIVE_QUEUE_SIZE (10) questions being worked on
 * - The first ACTIVE_QUEUE_SIZE items are in BOTH queues initially (overlap)
 * - Items beyond ACTIVE_QUEUE_SIZE are "pending" - only in masterQueue
 * - Refill moves pending items from masterQueue to activeQueue
 */

// Constants matching lessons.tsx
const ACTIVE_QUEUE_SIZE = 10;
const REFILL_THRESHOLD = 3;

// Type definitions
interface Question {
  type: "meaning" | "reading";
  itemId: number;
}

interface QueueState {
  masterQueue: Question[];
  activeQueue: Question[];
}

// Helper to generate questions (simplified from lessons.tsx)
const generateQuestions = (count: number, includeBothTypes: boolean = true): Question[] => {
  const questions: Question[] = [];
  for (let i = 0; i < count; i++) {
    questions.push({ type: "meaning", itemId: i });
    if (includeBothTypes) {
      questions.push({ type: "reading", itemId: i });
    }
  }
  return questions;
};

// Initialize queue state (matches lessons.tsx initializeReviewQueue)
const initializeQueues = (questions: Question[]): QueueState => {
  return {
    masterQueue: [...questions],
    activeQueue: questions.slice(0, Math.min(ACTIVE_QUEUE_SIZE, questions.length)),
  };
};

/**
 * The refill function - this is the logic we're testing
 * Extracted from lessons.tsx for testability
 */
const refillActiveQueueIfNeeded = (
  currentActiveQueue: Question[],
  masterQueue: Question[]
): { newActiveQueue: Question[]; newMasterQueue: Question[] } => {
  if (
    currentActiveQueue.length <= REFILL_THRESHOLD &&
    masterQueue.length > ACTIVE_QUEUE_SIZE
  ) {
    const needed = ACTIVE_QUEUE_SIZE - currentActiveQueue.length;
    const startIndex = ACTIVE_QUEUE_SIZE;
    const endIndex = Math.min(startIndex + needed, masterQueue.length);
    const toAdd = masterQueue.slice(startIndex, endIndex);

    if (toAdd.length > 0) {
      const newActiveQueue = [...currentActiveQueue, ...toAdd];
      const newMasterQueue = [
        ...masterQueue.slice(0, ACTIVE_QUEUE_SIZE),
        ...masterQueue.slice(endIndex),
      ];
      return { newActiveQueue, newMasterQueue };
    }
  }
  return { newActiveQueue: currentActiveQueue, newMasterQueue: masterQueue };
};

/**
 * Check if session should complete (matches lessons.tsx logic)
 */
const shouldSessionComplete = (
  activeQueueLength: number,
  masterQueueLength: number
): boolean => {
  return activeQueueLength <= 1 && masterQueueLength <= ACTIVE_QUEUE_SIZE;
};

/**
 * Simulate moving to next question (correct answer)
 */
const moveToNextQuestion = (state: QueueState): QueueState => {
  const newActiveQueue = state.activeQueue.slice(1);
  const result = refillActiveQueueIfNeeded(newActiveQueue, state.masterQueue);
  return {
    activeQueue: result.newActiveQueue,
    masterQueue: result.newMasterQueue,
  };
};

/**
 * Simulate requeuing a question (incorrect answer)
 */
const requeueQuestion = (state: QueueState, insertPosition: number = -1): QueueState => {
  const currentQuestion = state.activeQueue[0];
  const queueWithoutCurrent = state.activeQueue.slice(1);

  // Insert at specified position or random position (avoiding 0)
  const position = insertPosition >= 0
    ? insertPosition
    : (queueWithoutCurrent.length > 0 ? Math.floor(queueWithoutCurrent.length / 2) + 1 : 0);

  const newActiveQueue = [...queueWithoutCurrent];
  newActiveQueue.splice(Math.min(position, newActiveQueue.length), 0, { ...currentQuestion });

  const result = refillActiveQueueIfNeeded(newActiveQueue, state.masterQueue);
  return {
    activeQueue: result.newActiveQueue,
    masterQueue: result.newMasterQueue,
  };
};

describe('Lesson Queue Logic', () => {
  describe('Queue Initialization', () => {
    it('should initialize with all questions in masterQueue', () => {
      const questions = generateQuestions(6); // 12 questions total
      const state = initializeQueues(questions);

      expect(state.masterQueue).toHaveLength(12);
      expect(state.activeQueue).toHaveLength(ACTIVE_QUEUE_SIZE);
    });

    it('should handle small batches (fewer than ACTIVE_QUEUE_SIZE)', () => {
      const questions = generateQuestions(3); // 6 questions total
      const state = initializeQueues(questions);

      expect(state.masterQueue).toHaveLength(6);
      expect(state.activeQueue).toHaveLength(6);
    });

    it('should handle exact ACTIVE_QUEUE_SIZE questions', () => {
      const questions = generateQuestions(5); // 10 questions total
      const state = initializeQueues(questions);

      expect(state.masterQueue).toHaveLength(10);
      expect(state.activeQueue).toHaveLength(10);
    });
  });

  describe('refillActiveQueueIfNeeded', () => {
    it('should not refill when activeQueue is above threshold', () => {
      const questions = generateQuestions(8); // 16 questions
      const state = initializeQueues(questions);

      // Active queue has 10 items, well above threshold of 3
      const result = refillActiveQueueIfNeeded(state.activeQueue, state.masterQueue);

      expect(result.newActiveQueue).toHaveLength(10);
      expect(result.newMasterQueue).toHaveLength(16);
    });

    it('should not refill when masterQueue has no pending items', () => {
      const questions = generateQuestions(5); // 10 questions (exactly ACTIVE_QUEUE_SIZE)
      const state = initializeQueues(questions);

      // Simulate answering until activeQueue has 2 items
      const smallActiveQueue = state.activeQueue.slice(0, 2);
      const result = refillActiveQueueIfNeeded(smallActiveQueue, state.masterQueue);

      // Should not refill because masterQueue.length (10) is not > ACTIVE_QUEUE_SIZE (10)
      expect(result.newActiveQueue).toHaveLength(2);
      expect(result.newMasterQueue).toHaveLength(10);
    });

    it('should refill when conditions are met', () => {
      const questions = generateQuestions(6); // 12 questions
      const state = initializeQueues(questions);

      // Simulate activeQueue down to 2 items
      const smallActiveQueue = state.activeQueue.slice(0, 2);
      const result = refillActiveQueueIfNeeded(smallActiveQueue, state.masterQueue);

      // Should add Q10, Q11 (the pending items)
      expect(result.newActiveQueue).toHaveLength(4); // 2 + 2 pending items
      // Master queue should shrink: keep first 10, remove items 10-11
      expect(result.newMasterQueue).toHaveLength(10);
    });

    it('should correctly update masterQueue after refill', () => {
      const questions = generateQuestions(6); // 12 questions
      const state = initializeQueues(questions);

      const smallActiveQueue = state.activeQueue.slice(0, 2);
      const result = refillActiveQueueIfNeeded(smallActiveQueue, state.masterQueue);

      // Verify the pending items were removed from masterQueue
      // masterQueue should now only have the base items (first 10)
      expect(result.newMasterQueue.length).toBeLessThanOrEqual(ACTIVE_QUEUE_SIZE);
    });

    it('should handle large batches with multiple refills needed', () => {
      const questions = generateQuestions(12); // 24 questions
      let state = initializeQueues(questions);

      expect(state.masterQueue).toHaveLength(24);
      expect(state.activeQueue).toHaveLength(10);

      // First refill: activeQueue at 3 items
      let smallActiveQueue = state.activeQueue.slice(0, 3);
      let result = refillActiveQueueIfNeeded(smallActiveQueue, state.masterQueue);

      // Should add 7 items (to reach ACTIVE_QUEUE_SIZE of 10)
      expect(result.newActiveQueue).toHaveLength(10);
      // masterQueue should be: first 10 + remaining pending (24 - 10 - 7 = 7)
      expect(result.newMasterQueue).toHaveLength(17); // 10 base + 7 remaining pending

      state = { activeQueue: result.newActiveQueue, masterQueue: result.newMasterQueue };

      // Second refill: activeQueue at 2 items
      smallActiveQueue = state.activeQueue.slice(0, 2);
      result = refillActiveQueueIfNeeded(smallActiveQueue, state.masterQueue);

      // Should add remaining 7 pending items (but only up to what's needed)
      expect(result.newActiveQueue).toHaveLength(9); // 2 + 7 remaining
      expect(result.newMasterQueue).toHaveLength(10); // Only base items left
    });

    it('should not add duplicate questions on repeated refills', () => {
      const questions = generateQuestions(6); // 12 questions
      let state = initializeQueues(questions);

      // First refill
      let smallActiveQueue = state.activeQueue.slice(0, 2);
      let result = refillActiveQueueIfNeeded(smallActiveQueue, state.masterQueue);
      state = { activeQueue: result.newActiveQueue, masterQueue: result.newMasterQueue };

      // Verify pending items (Q10, Q11) are now in activeQueue
      const pendingItemIds = [5]; // itemId 5 has questions at index 10, 11
      const addedQuestions = state.activeQueue.filter(q => q.itemId === 5);
      expect(addedQuestions.length).toBeGreaterThan(0);

      // Second refill attempt (should not add anything)
      smallActiveQueue = state.activeQueue.slice(0, 2);
      result = refillActiveQueueIfNeeded(smallActiveQueue, state.masterQueue);

      // masterQueue.length (10) is not > ACTIVE_QUEUE_SIZE (10), so no refill
      expect(result.newActiveQueue).toHaveLength(2);
      expect(result.newMasterQueue).toHaveLength(10);
    });
  });

  describe('Session Completion', () => {
    it('should complete when activeQueue is 1 and no pending items', () => {
      // 10 questions (exactly ACTIVE_QUEUE_SIZE)
      expect(shouldSessionComplete(1, 10)).toBe(true);
    });

    it('should complete when activeQueue is 0 and no pending items', () => {
      expect(shouldSessionComplete(0, 10)).toBe(true);
    });

    it('should not complete when there are pending items', () => {
      // 12 questions in masterQueue means 2 pending items
      expect(shouldSessionComplete(1, 12)).toBe(false);
    });

    it('should not complete when activeQueue has multiple items', () => {
      expect(shouldSessionComplete(5, 10)).toBe(false);
    });

    it('should complete for small batches', () => {
      // Only 6 questions total
      expect(shouldSessionComplete(1, 6)).toBe(true);
    });
  });

  describe('Full Flow Simulation', () => {
    it('should complete session with all correct answers (12 questions)', () => {
      const questions = generateQuestions(6); // 12 questions
      let state = initializeQueues(questions);
      let answeredCount = 0;

      while (state.activeQueue.length > 0) {
        // Count the answer (user has answered the current question)
        answeredCount++;

        // Check for completion - this happens in moveToNextQuestion AFTER user answers
        // but BEFORE removing from queue
        if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
          break;
        }

        state = moveToNextQuestion(state);

        // Safety check to prevent infinite loop
        if (answeredCount > 100) {
          throw new Error('Infinite loop detected');
        }
      }

      expect(answeredCount).toBe(12);
      expect(state.masterQueue.length).toBeLessThanOrEqual(ACTIVE_QUEUE_SIZE);
    });

    it('should complete session with all correct answers (20 questions)', () => {
      const questions = generateQuestions(10); // 20 questions
      let state = initializeQueues(questions);
      let answeredCount = 0;

      while (state.activeQueue.length > 0) {
        answeredCount++;

        if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
          break;
        }

        state = moveToNextQuestion(state);

        if (answeredCount > 100) {
          throw new Error('Infinite loop detected');
        }
      }

      expect(answeredCount).toBe(20);
    });

    it('should complete session with some incorrect answers', () => {
      const questions = generateQuestions(6); // 12 questions
      let state = initializeQueues(questions);
      let totalAttempts = 0;
      let incorrectCount = 0;

      // Answer first 3 questions wrong, then all correct
      while (state.activeQueue.length > 0) {
        if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
          break;
        }

        if (totalAttempts < 3) {
          // Wrong answer - requeue
          state = requeueQuestion(state);
          incorrectCount++;
        } else {
          // Correct answer
          state = moveToNextQuestion(state);
        }
        totalAttempts++;

        if (totalAttempts > 100) {
          throw new Error('Infinite loop detected');
        }
      }

      // Should complete eventually with extra attempts for incorrect answers
      expect(totalAttempts).toBeGreaterThan(12);
      expect(incorrectCount).toBe(3);
    });

    it('should handle repeated incorrect answers on same question', () => {
      const questions = generateQuestions(6); // 12 questions
      let state = initializeQueues(questions);
      let totalAttempts = 0;
      const firstQuestionId = state.activeQueue[0].itemId;
      let firstQuestionAttempts = 0;

      while (state.activeQueue.length > 0) {
        if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
          break;
        }

        const currentQuestion = state.activeQueue[0];

        // Get first question wrong 3 times
        if (currentQuestion.itemId === firstQuestionId && firstQuestionAttempts < 3) {
          state = requeueQuestion(state);
          firstQuestionAttempts++;
        } else {
          state = moveToNextQuestion(state);
        }
        totalAttempts++;

        if (totalAttempts > 100) {
          throw new Error('Infinite loop detected');
        }
      }

      expect(firstQuestionAttempts).toBe(3);
      // Session should still complete
      expect(state.masterQueue.length).toBeLessThanOrEqual(ACTIVE_QUEUE_SIZE);
    });

    it('should not create infinite loop with requeued questions after refill', () => {
      const questions = generateQuestions(6); // 12 questions
      let state = initializeQueues(questions);
      let totalAttempts = 0;

      // Answer correctly until refill triggers, then get some wrong
      while (state.activeQueue.length > 0) {
        if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
          break;
        }

        // After refill (when masterQueue shrinks), get 2 questions wrong
        const afterRefill = state.masterQueue.length <= ACTIVE_QUEUE_SIZE;
        if (afterRefill && totalAttempts < 15) {
          state = requeueQuestion(state);
        } else {
          state = moveToNextQuestion(state);
        }
        totalAttempts++;

        if (totalAttempts > 100) {
          throw new Error('Infinite loop detected - this was the original bug');
        }
      }

      // Should complete without infinite loop
      expect(totalAttempts).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single question batch', () => {
      const questions: Question[] = [{ type: "meaning", itemId: 0 }];
      let state = initializeQueues(questions);

      expect(state.activeQueue).toHaveLength(1);
      expect(shouldSessionComplete(1, 1)).toBe(true);
    });

    it('should handle batch with only radicals (meaning only)', () => {
      // 5 radicals = 5 meaning-only questions
      const questions = generateQuestions(5, false);
      let state = initializeQueues(questions);
      let answeredCount = 0;

      while (state.activeQueue.length > 0) {
        answeredCount++;

        if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
          break;
        }
        state = moveToNextQuestion(state);

        if (answeredCount > 50) {
          throw new Error('Infinite loop detected');
        }
      }

      expect(answeredCount).toBe(5);
    });

    it('should handle exactly ACTIVE_QUEUE_SIZE questions', () => {
      const questions = generateQuestions(5); // Exactly 10 questions
      let state = initializeQueues(questions);

      // No pending items, so refill should never trigger
      expect(state.masterQueue.length).toBe(ACTIVE_QUEUE_SIZE);

      let answeredCount = 0;
      while (state.activeQueue.length > 0) {
        answeredCount++;

        if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
          break;
        }

        const prevMasterLength = state.masterQueue.length;
        state = moveToNextQuestion(state);

        // Master queue should never change (no refills)
        expect(state.masterQueue.length).toBe(prevMasterLength);

        if (answeredCount > 50) {
          throw new Error('Infinite loop detected');
        }
      }

      expect(answeredCount).toBe(10);
    });

    it('should handle very large batch (50 questions)', () => {
      const questions = generateQuestions(25); // 50 questions
      let state = initializeQueues(questions);
      let answeredCount = 0;
      let refillCount = 0;

      while (state.activeQueue.length > 0) {
        answeredCount++;

        if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
          break;
        }

        const prevMasterLength = state.masterQueue.length;
        state = moveToNextQuestion(state);

        if (state.masterQueue.length < prevMasterLength) {
          refillCount++;
        }

        if (answeredCount > 200) {
          throw new Error('Infinite loop detected');
        }
      }

      expect(answeredCount).toBe(50);
      // Should have had multiple refills
      expect(refillCount).toBeGreaterThan(0);
    });

    it('should maintain queue integrity when questions are requeued at various positions', () => {
      const questions = generateQuestions(6); // 12 questions
      let state = initializeQueues(questions);

      // Track unique questions seen
      const seenQuestions = new Set<string>();
      let totalAttempts = 0;

      while (state.activeQueue.length > 0) {
        const current = state.activeQueue[0];
        const key = `${current.type}-${current.itemId}`;

        // Every 3rd question, answer wrong
        if (totalAttempts % 3 === 0 && totalAttempts < 12) {
          state = requeueQuestion(state, totalAttempts % state.activeQueue.length);
          totalAttempts++;
        } else {
          seenQuestions.add(key);
          totalAttempts++;

          if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
            break;
          }
          state = moveToNextQuestion(state);
        }

        if (totalAttempts > 100) {
          throw new Error('Infinite loop detected');
        }
      }

      // Should have seen all 12 unique questions
      expect(seenQuestions.size).toBe(12);
    });
  });

  describe('Regression Tests', () => {
    it('BUG FIX: should not add same items repeatedly from masterQueue', () => {
      const questions = generateQuestions(6); // 12 questions
      let state = initializeQueues(questions);

      // Simulate the bug scenario:
      // 1. Answer enough to trigger first refill
      // 2. Answer enough to trigger refill threshold again
      // 3. Verify same items aren't added twice

      // Answer 7 questions to get activeQueue to 3 items
      for (let i = 0; i < 7; i++) {
        state = moveToNextQuestion(state);
      }

      // At this point, refill should have triggered once
      // masterQueue should now be 10 items (no more pending)
      expect(state.masterQueue.length).toBe(10);

      // Answer more questions to get activeQueue small again
      for (let i = 0; i < 3; i++) {
        if (state.activeQueue.length > 1) {
          state = moveToNextQuestion(state);
        }
      }

      // Refill should NOT trigger again because masterQueue.length (10) is not > 10
      // This was the original bug - it would keep adding Q10, Q11 repeatedly
      expect(state.masterQueue.length).toBe(10);
    });

    it('BUG FIX: session should complete for batches > 10 questions', () => {
      const questions = generateQuestions(6); // 12 questions
      let state = initializeQueues(questions);
      let answeredCount = 0;

      while (state.activeQueue.length > 0) {
        answeredCount++;

        if (shouldSessionComplete(state.activeQueue.length, state.masterQueue.length)) {
          break;
        }
        state = moveToNextQuestion(state);

        // The original bug would cause this to never complete
        if (answeredCount > 50) {
          throw new Error('Session did not complete - possible infinite loop (original bug)');
        }
      }

      expect(answeredCount).toBe(12);
    });

    it('BUG FIX: masterQueue should shrink after refill', () => {
      const questions = generateQuestions(8); // 16 questions
      const state = initializeQueues(questions);

      expect(state.masterQueue.length).toBe(16);

      // Trigger refill
      const smallActiveQueue = state.activeQueue.slice(0, 2);
      const result = refillActiveQueueIfNeeded(smallActiveQueue, state.masterQueue);

      // The original bug: masterQueue never changed
      // The fix: masterQueue should shrink
      expect(result.newMasterQueue.length).toBeLessThan(16);
      expect(result.newMasterQueue.length).toBe(10); // Only base items remain
    });
  });
});
