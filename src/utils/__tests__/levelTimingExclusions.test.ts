import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  getLevelTimingExcludedStorageKey,
  loadLevelTimingExcludedLevels,
  saveLevelTimingExcludedLevels,
  subscribeLevelTimingExcludedLevels,
} from "../levelTimingExclusions";
import { permanentStorage } from "../permanentStorage";

jest.mock("../permanentStorage", () => ({
  permanentStorage: {
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

const asyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const durableStorage = permanentStorage as unknown as {
  getString: jest.Mock;
  set: jest.Mock;
};

describe("levelTimingExclusions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asyncStorage.getItem.mockResolvedValue(null);
    asyncStorage.setItem.mockResolvedValue(undefined);
    durableStorage.getString.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads from durable storage before checking legacy AsyncStorage", async () => {
    durableStorage.getString.mockReturnValue(JSON.stringify([3, "2", 2, 1.8]));

    await expect(loadLevelTimingExcludedLevels("user-1")).resolves.toEqual([
      1, 2, 3,
    ]);

    expect(asyncStorage.getItem).not.toHaveBeenCalled();
  });

  it("migrates legacy AsyncStorage values into durable storage", async () => {
    const storageKey = getLevelTimingExcludedStorageKey("user-1");
    asyncStorage.getItem.mockResolvedValue(JSON.stringify([7, 4, 4]));

    await expect(loadLevelTimingExcludedLevels("user-1")).resolves.toEqual([
      4, 7,
    ]);

    expect(durableStorage.set).toHaveBeenCalledWith(storageKey, "[4,7]");
  });

  it("saves normalized levels to durable storage and mirrors them to AsyncStorage", async () => {
    const storageKey = getLevelTimingExcludedStorageKey("user-1");
    const listener = jest.fn();
    const unsubscribe = subscribeLevelTimingExcludedLevels(listener);

    await saveLevelTimingExcludedLevels(
      "user-1",
      [9, 3.6, 9, 0] as unknown as number[]
    );

    expect(durableStorage.set).toHaveBeenCalledWith(storageKey, "[3,9]");
    expect(asyncStorage.setItem).toHaveBeenCalledWith(storageKey, "[3,9]");
    expect(listener).toHaveBeenCalledWith("user-1", [3, 9]);

    unsubscribe();
  });
});
