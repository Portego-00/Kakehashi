import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  transferSubjectsBetweenLists,
  type TransferSubjectsBetweenListsParams,
} from "../subjectLists";

jest.mock("../../lib/supabase", () => ({
  supabase: {},
}));

jest.mock("../store", () => ({
  useAuthStore: {
    getState: () => ({ userData: null }),
  },
}));

const SUBJECT_LISTS_STORAGE_KEY = "subject_lists:v1";
const INITIAL_TIMESTAMP = "2026-01-01T00:00:00.000Z";
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

interface StoredSubjectListRecord {
  id: string;
  name: string;
  subjectIds: number[];
  createdAt: string;
  updatedAt: string;
  sortOrder: number;
  ownerUserId: string | null;
  deletedAt: string | null;
  syncStatus: "synced" | "pending_upsert" | "pending_delete";
}

function makeRecord(
  id: string,
  subjectIds: number[],
  sortOrder: number,
  overrides: Partial<StoredSubjectListRecord> = {}
): StoredSubjectListRecord {
  return {
    id,
    name: id,
    subjectIds,
    createdAt: INITIAL_TIMESTAMP,
    updatedAt: INITIAL_TIMESTAMP,
    sortOrder,
    ownerUserId: null,
    deletedAt: null,
    syncStatus: "synced",
    ...overrides,
  };
}

describe("transferSubjectsBetweenLists", () => {
  let storedValue: string | null;

  function seed(records: StoredSubjectListRecord[]): void {
    storedValue = JSON.stringify({ version: 3, lists: records });
  }

  function getStoredRecords(): StoredSubjectListRecord[] {
    if (!storedValue) {
      throw new Error("Expected a stored subject-list payload.");
    }
    return (JSON.parse(storedValue) as { lists: StoredSubjectListRecord[] }).lists;
  }

  function getStoredRecord(id: string): StoredSubjectListRecord {
    const record = getStoredRecords().find((entry) => entry.id === id);
    if (!record) {
      throw new Error(`Expected stored list ${id}.`);
    }
    return record;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    storedValue = null;
    mockedAsyncStorage.getItem.mockImplementation(async (key) =>
      key === SUBJECT_LISTS_STORAGE_KEY ? storedValue : null
    );
    mockedAsyncStorage.setItem.mockImplementation(async (key, value) => {
      if (key === SUBJECT_LISTS_STORAGE_KEY) {
        storedValue = value;
      }
    });
  });

  it("copies only normalized subjects that still belong to the source", async () => {
    seed([
      makeRecord("source", [3, 1, 2, 7], 0),
      makeRecord("destination", [9, 2], 1),
      makeRecord("unrelated", [50], 2),
    ]);

    const result = await transferSubjectsBetweenLists({
      sourceListId: "source",
      destinationListId: "destination",
      subjectIds: [2, 3, 3, 999, -4, Number.NaN, 1.9],
      mode: "copy",
    });

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("copy");
    expect(result?.transferredSubjectIds).toEqual([2, 3, 1]);
    expect(result?.sourceList.subjectIds).toEqual([3, 1, 2, 7]);
    expect(result?.destinationList.subjectIds).toEqual([9, 2, 3, 1]);
    expect(mockedAsyncStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);

    const source = getStoredRecord("source");
    const destination = getStoredRecord("destination");
    const unrelated = getStoredRecord("unrelated");
    expect(source).toMatchObject({
      subjectIds: [3, 1, 2, 7],
      updatedAt: INITIAL_TIMESTAMP,
      syncStatus: "synced",
    });
    expect(destination.subjectIds).toEqual([9, 2, 3, 1]);
    expect(destination.updatedAt).not.toBe(INITIAL_TIMESTAMP);
    expect(destination.syncStatus).toBe("pending_upsert");
    expect(unrelated).toMatchObject({
      subjectIds: [50],
      updatedAt: INITIAL_TIMESTAMP,
      syncStatus: "synced",
    });
  });

  it("moves subjects atomically and removes ones already in the destination", async () => {
    seed([
      makeRecord("source", [1, 2, 3, 4], 0),
      makeRecord("destination", [2, 8], 1),
    ]);

    const result = await transferSubjectsBetweenLists({
      sourceListId: "source",
      destinationListId: "destination",
      subjectIds: [2, 3],
      mode: "move",
    });

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("move");
    expect(result?.transferredSubjectIds).toEqual([2, 3]);
    expect(result?.sourceList.subjectIds).toEqual([1, 4]);
    expect(result?.destinationList.subjectIds).toEqual([2, 8, 3]);
    expect(mockedAsyncStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);

    const source = getStoredRecord("source");
    const destination = getStoredRecord("destination");
    expect(source.subjectIds).toEqual([1, 4]);
    expect(destination.subjectIds).toEqual([2, 8, 3]);
    expect(source.syncStatus).toBe("pending_upsert");
    expect(destination.syncStatus).toBe("pending_upsert");
    expect(source.updatedAt).toBe(destination.updatedAt);
  });

  it("does not write for an idempotent copy", async () => {
    seed([
      makeRecord("source", [1, 2], 0),
      makeRecord("destination", [2, 1], 1),
    ]);

    const result = await transferSubjectsBetweenLists({
      sourceListId: "source",
      destinationListId: "destination",
      subjectIds: [1, 2],
      mode: "copy",
    });

    expect(result).toMatchObject({
      mode: "copy",
      transferredSubjectIds: [1, 2],
      sourceList: { subjectIds: [1, 2] },
      destinationList: { subjectIds: [2, 1] },
    });
    expect(mockedAsyncStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("returns an empty transfer without writing when no requested subject is in the source", async () => {
    seed([
      makeRecord("source", [1, 2], 0),
      makeRecord("destination", [3], 1),
    ]);

    const result = await transferSubjectsBetweenLists({
      sourceListId: "source",
      destinationListId: "destination",
      subjectIds: [99, -1, Number.NaN],
      mode: "move",
    });

    expect(result).toMatchObject({
      mode: "move",
      transferredSubjectIds: [],
      sourceList: { subjectIds: [1, 2] },
      destinationList: { subjectIds: [3] },
    });
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it.each<TransferSubjectsBetweenListsParams>([
    {
      sourceListId: "missing",
      destinationListId: "destination",
      subjectIds: [1],
      mode: "move",
    },
    {
      sourceListId: "source",
      destinationListId: "missing",
      subjectIds: [1],
      mode: "move",
    },
    {
      sourceListId: "source",
      destinationListId: "deleted",
      subjectIds: [1],
      mode: "move",
    },
  ])("leaves the source untouched when either list is invalid: %p", async (params) => {
    seed([
      makeRecord("source", [1, 2], 0),
      makeRecord("destination", [], 1),
      makeRecord("deleted", [], 2, {
        deletedAt: "2026-02-01T00:00:00.000Z",
      }),
    ]);

    const originalValue = storedValue;
    const result = await transferSubjectsBetweenLists(params);

    expect(result).toBeNull();
    expect(mockedAsyncStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
    expect(storedValue).toBe(originalValue);
  });

  it("rejects a transfer to the source list before reading or writing", async () => {
    seed([makeRecord("source", [1, 2], 0)]);

    const result = await transferSubjectsBetweenLists({
      sourceListId: "source",
      destinationListId: "source",
      subjectIds: [1],
      mode: "move",
    });

    expect(result).toBeNull();
    expect(mockedAsyncStorage.getItem).not.toHaveBeenCalled();
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
