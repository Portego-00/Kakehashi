import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  JLPT_BANK_VERSION,
  type JlptQuestion,
  type JlptSession,
} from "../domain";
import {
  jlptNativeHistoryKey,
  jlptNativeSessionKey,
  loadNativeJlptHistory,
  parseNativeJlptSession,
  rememberNativeJlptSelection,
  saveNativeJlptSession,
} from "../storage";

const question: JlptQuestion = {
  id: "n5-test",
  level: "N5",
  skill: "grammar",
  officialType: "grammar-form",
  provenance: {
    semanticKey: "grammar:test",
    variantIndex: 0,
    authorship: "controlled-variant",
    editorialStatus: "machine-validated",
    contentVersion: 1,
  },
  instruction: "Choose one.",
  stem: "テストです。",
  options: [
    { id: "1", label: "A" },
    { id: "2", label: "B" },
  ],
  correctOptionId: "1",
  explanation: "A is correct.",
};

const secondQuestion: JlptQuestion = {
  ...question,
  id: "n5-test-2",
  provenance: {
    ...question.provenance!,
    semanticKey: "grammar:test-2",
  },
};

const session: JlptSession = {
  version: 1,
  bankVersion: JLPT_BANK_VERSION,
  id: "session-1",
  level: "N5",
  mode: "quick",
  status: "paused",
  immediateFeedback: true,
  sectionQuestionIds: [[question.id]],
  currentSectionIndex: 0,
  currentQuestionIndex: 0,
  answers: [],
  listeningPlays: {},
  deadlineAt: null,
  remainingSeconds: null,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

describe("native JLPT storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scopes resumable sessions to the active account", async () => {
    await saveNativeJlptSession(41, session);
    await saveNativeJlptSession(99, session);

    expect(jlptNativeSessionKey(41)).not.toBe(jlptNativeSessionKey(99));
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      1,
      jlptNativeSessionKey(41),
      JSON.stringify(session),
    );
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      2,
      jlptNativeSessionKey(99),
      JSON.stringify(session),
    );
  });

  it("rejects stale banks and restores the listening play map", () => {
    expect(
      parseNativeJlptSession(JSON.stringify({ ...session, bankVersion: 1 })),
    ).toBeNull();
    const restored = parseNativeJlptSession(
      JSON.stringify({ ...session, listeningPlays: undefined }),
    );
    expect(restored?.listeningPlays).toEqual({});
  });

  it("persists exact and semantic history for unseen-first randomization", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await rememberNativeJlptSelection("account-a", "N5", [question]);

    const [, raw] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const saved = JSON.parse(raw);
    expect(saved.seenByLevel.N5).toEqual([question.id]);
    expect(saved.seenSemanticKeysByLevel.N5).toEqual(["grammar:test"]);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(raw);
    const history = await loadNativeJlptHistory("account-a", "N5");
    expect(history.questionIds).toEqual(new Set([question.id]));
    expect(history.semanticKeys).toEqual(new Set(["grammar:test"]));
    expect(jlptNativeHistoryKey("account-a")).toContain("account-a");
  });

  it("serializes overlapping history writes so a fast answer cannot erase the previous one", async () => {
    let stored: string | null = null;
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async () => stored);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (_key: string, value: string) => {
        stored = value;
      },
    );

    await Promise.all([
      rememberNativeJlptSelection("account-fast", "N5", [question]),
      rememberNativeJlptSelection("account-fast", "N5", [secondQuestion]),
    ]);

    const saved = JSON.parse(stored!);
    expect(saved.seenByLevel.N5).toEqual([question.id, secondQuestion.id]);
    expect(saved.seenSemanticKeysByLevel.N5).toEqual([
      "grammar:test",
      "grammar:test-2",
    ]);
  });
});
