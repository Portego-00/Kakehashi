import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addCustomContextSentence,
  deleteCustomContextSentence,
  getAllCustomContextSentences,
  getCustomContextSentenceCount,
  getCustomContextSentenceStorageKey,
  getCustomContextSentencesForSubject,
  updateCustomContextSentence,
  upsertCustomContextSentence,
} from "../customContextSentenceService";
import {
  CUSTOM_CONTEXT_SENTENCE_VERSION,
  type CreateCustomContextSentenceInput,
} from "../../types/customContextSentence";

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const USER_A = "wanikani-user-a";
const USER_B = "wanikani-user-b";
const TIMESTAMP = "2026-08-31T10:00:00.000Z";

const makeInput = (
  overrides: Partial<CreateCustomContextSentenceInput> = {},
): CreateCustomContextSentenceInput => ({
  subjectId: 440,
  japanese: "猫が好きです。",
  kana: "ねこがすきです。",
  english: "I like cats.",
  displayMode: "kanji",
  ...overrides,
});

describe("customContextSentenceService", () => {
  let storedValues: Map<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    storedValues = new Map<string, string>();
    mockedAsyncStorage.getItem.mockImplementation(async (key) =>
      storedValues.get(key) ?? null,
    );
    mockedAsyncStorage.setItem.mockImplementation(async (key, value) => {
      storedValues.set(key, value);
    });
  });

  it("treats malformed payloads as empty and salvages valid trimmed records", async () => {
    const storageKey = getCustomContextSentenceStorageKey(USER_A);
    storedValues.set(storageKey, "not-json");

    await expect(getAllCustomContextSentences(USER_A)).resolves.toEqual([]);

    storedValues.set(
      storageKey,
      JSON.stringify({
        version: CUSTOM_CONTEXT_SENTENCE_VERSION,
        sentences: [
          null,
          { id: "missing-fields" },
          {
            version: 99,
            id: "future-version",
            subjectId: 440,
            japanese: "猫",
            kana: "ねこ",
            english: "cat",
            displayMode: "kanji",
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
          {
            id: "  valid-id  ",
            subjectId: 440,
            japanese: "  猫が好きです。  ",
            kana: "  ねこがすきです。  ",
            english: "  I like cats.  ",
            displayMode: "unsupported",
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
      }),
    );

    await expect(getAllCustomContextSentences(USER_A)).resolves.toEqual([
      {
        version: CUSTOM_CONTEXT_SENTENCE_VERSION,
        id: "valid-id",
        subjectId: 440,
        japanese: "猫が好きです。",
        kana: "ねこがすきです。",
        english: "I like cats.",
        displayMode: "kanji",
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ]);
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("trims input and rejects missing or invalid values", async () => {
    const added = await addCustomContextSentence(
      `  ${USER_A}  `,
      makeInput({
        japanese: "  毎日勉強します。  ",
        kana: "  まいにちべんきょうします。  ",
        english: "  I study every day.  ",
        displayMode: "kana",
      }),
    );

    expect(added).toMatchObject({
      japanese: "毎日勉強します。",
      kana: "まいにちべんきょうします。",
      english: "I study every day.",
      displayMode: "kana",
    });
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      getCustomContextSentenceStorageKey(USER_A),
      expect.any(String),
    );

    await expect(
      addCustomContextSentence("   ", makeInput()),
    ).rejects.toThrow("WaniKani user ID");
    await expect(
      addCustomContextSentence(USER_A, makeInput({ subjectId: 0 })),
    ).rejects.toThrow("positive integer");
    await expect(
      addCustomContextSentence(USER_A, makeInput({ japanese: "   " })),
    ).rejects.toThrow("japanese is required");
    await expect(
      addCustomContextSentence(USER_A, makeInput({ kana: "   " })),
    ).rejects.toThrow("kana is required");
    await expect(
      addCustomContextSentence(USER_A, makeInput({ english: "   " })),
    ).rejects.toThrow("english is required");
    await expect(
      addCustomContextSentence(
        USER_A,
        makeInput({ displayMode: "romaji" as "kanji" }),
      ),
    ).rejects.toThrow("displayMode");

    await expect(getCustomContextSentenceCount(USER_A)).resolves.toBe(1);
  });

  it("isolates records by WaniKani user ID", async () => {
    await addCustomContextSentence(
      USER_A,
      makeInput({ english: "User A sentence" }),
    );
    await addCustomContextSentence(
      USER_B,
      makeInput({ english: "User B sentence" }),
    );

    const [userASentences, userBSentences] = await Promise.all([
      getAllCustomContextSentences(USER_A),
      getAllCustomContextSentences(USER_B),
    ]);

    expect(userASentences.map((sentence) => sentence.english)).toEqual([
      "User A sentence",
    ]);
    expect(userBSentences.map((sentence) => sentence.english)).toEqual([
      "User B sentence",
    ]);
    expect(getCustomContextSentenceStorageKey(USER_A)).not.toBe(
      getCustomContextSentenceStorageKey(USER_B),
    );
  });

  it("supports subject reads, counts, update, upsert, and delete", async () => {
    const first = await addCustomContextSentence(USER_A, makeInput());
    const second = await addCustomContextSentence(
      USER_A,
      makeInput({
        subjectId: 990,
        japanese: "犬も好きです。",
        kana: "いぬもすきです。",
        english: "I like dogs too.",
      }),
    );

    await expect(getCustomContextSentenceCount(USER_A)).resolves.toBe(2);
    await expect(getCustomContextSentenceCount(USER_A, 440)).resolves.toBe(1);
    await expect(
      getCustomContextSentencesForSubject(USER_A, 990),
    ).resolves.toEqual([second]);

    const updated = await updateCustomContextSentence(USER_A, first.id, {
      english: "  Cats are my favorite.  ",
      displayMode: "kana",
    });
    expect(updated).toMatchObject({
      id: first.id,
      english: "Cats are my favorite.",
      displayMode: "kana",
      createdAt: first.createdAt,
    });

    const upsertedExisting = await upsertCustomContextSentence(USER_A, {
      id: first.id,
      ...makeInput({ english: "I really like cats." }),
    });
    expect(upsertedExisting).toMatchObject({
      id: first.id,
      english: "I really like cats.",
      createdAt: first.createdAt,
    });

    const upsertedNew = await upsertCustomContextSentence(USER_A, {
      id: "manual-id",
      ...makeInput({ subjectId: 1234, english: "A new sentence." }),
    });
    expect(upsertedNew.id).toBe("manual-id");
    await expect(getCustomContextSentenceCount(USER_A)).resolves.toBe(3);

    await expect(
      updateCustomContextSentence(USER_A, "missing", { english: "No-op" }),
    ).resolves.toBeNull();
    await expect(
      deleteCustomContextSentence(USER_A, first.id),
    ).resolves.toBe(true);
    await expect(
      deleteCustomContextSentence(USER_A, first.id),
    ).resolves.toBe(false);
    await expect(getCustomContextSentenceCount(USER_A)).resolves.toBe(2);
  });

  it("preserves unrelated records when updating and deleting", async () => {
    const target = await addCustomContextSentence(USER_A, makeInput());
    const unrelated = await addCustomContextSentence(
      USER_A,
      makeInput({
        subjectId: 991,
        japanese: "鳥が飛びます。",
        kana: "とりがとびます。",
        english: "A bird flies.",
      }),
    );

    await updateCustomContextSentence(USER_A, target.id, {
      english: "I love cats.",
    });
    await deleteCustomContextSentence(USER_A, target.id);

    await expect(getAllCustomContextSentences(USER_A)).resolves.toEqual([
      unrelated,
    ]);
  });

  it("serializes concurrent additions per user without losing records", async () => {
    mockedAsyncStorage.getItem.mockImplementation(async (key) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return storedValues.get(key) ?? null;
    });
    mockedAsyncStorage.setItem.mockImplementation(async (key, value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      storedValues.set(key, value);
    });

    const additions = Array.from({ length: 16 }, (_, index) =>
      addCustomContextSentence(
        USER_A,
        makeInput({
          subjectId: 500 + index,
          japanese: `例文${index}`,
          kana: `れいぶん${index}`,
          english: `Example ${index}`,
        }),
      ),
    );
    const added = await Promise.all(additions);
    const stored = await getAllCustomContextSentences(USER_A);

    expect(stored).toHaveLength(16);
    expect(new Set(stored.map((sentence) => sentence.id)).size).toBe(16);
    expect(stored.map((sentence) => sentence.english)).toEqual(
      Array.from({ length: 16 }, (_, index) => `Example ${index}`),
    );
    expect(new Set(added.map((sentence) => sentence.id)).size).toBe(16);
  });
});
