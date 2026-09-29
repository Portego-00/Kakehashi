import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { requestStreakReview } from "../streakReviewPromptService";

jest.mock("expo-store-review", () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

const storage = new Map<string, string>();
const firstKey = "rate_app_streak_prompted_user";
const secondKey = "rate_app_streak_100_prompted_user";

beforeEach(() => {
  jest.resetAllMocks();
  storage.clear();
  jest.mocked(AsyncStorage.multiGet).mockImplementation(async (keys) =>
    keys.map((key) => [key, storage.get(key) ?? null]),
  );
  jest.mocked(AsyncStorage.multiSet).mockImplementation(async (entries) => {
    entries.forEach(([key, value]) => storage.set(key, value));
  });
  jest.mocked(AsyncStorage.multiRemove).mockImplementation(async (keys) => {
    keys.forEach((key) => storage.delete(key));
  });
  jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(StoreReview.requestReview).mockResolvedValue(undefined);
});

it("requests separately at five and 100 days, without repeating either milestone", async () => {
  expect(await requestStreakReview("user", 4)).toBe(false);
  expect(await requestStreakReview("user", 5)).toBe(true);
  expect(storage.get(firstKey)).toBe("true");
  expect(storage.has(secondKey)).toBe(false);
  expect(await requestStreakReview("user", 99)).toBe(false);
  expect(await requestStreakReview("user", 100)).toBe(true);
  expect(storage.get(secondKey)).toBe("true");
  expect(await requestStreakReview("user", 200)).toBe(false);
  expect(await requestStreakReview("user", 5)).toBe(false);
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(2);
});

it.each([100, 200])("requests once and consumes both milestones on first opening at %i days", async (streak) => {
  jest.mocked(StoreReview.requestReview).mockImplementation(async () => {
    expect(storage.get(firstKey)).toBe("true");
    expect(storage.get(secondKey)).toBe("true");
  });
  expect(await requestStreakReview("user", streak)).toBe(true);
  expect(await requestStreakReview("user", streak)).toBe(false);
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
});

it("honors the legacy cache and keeps milestones separate between users", async () => {
  storage.set(firstKey, "true");
  expect(await requestStreakReview("user", 99)).toBe(false);
  expect(await requestStreakReview("user", 150)).toBe(true);
  expect(await requestStreakReview("other-user", 5)).toBe(true);
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(2);
});

it("does not consume milestones when store review is unavailable", async () => {
  jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(false);
  expect(await requestStreakReview("user", 200)).toBe(false);
  expect(storage.size).toBe(0);
  expect(StoreReview.requestReview).not.toHaveBeenCalled();
});

it.each([false, true])("allows retry after failure while preserving prior prompts: %s", async (previouslyPrompted) => {
  if (previouslyPrompted) storage.set(firstKey, "true");
  jest.mocked(StoreReview.requestReview).mockRejectedValueOnce(new Error("Unavailable"));
  await expect(requestStreakReview("user", 200)).rejects.toThrow("Unavailable");
  expect(storage.has(firstKey)).toBe(previouslyPrompted);
  expect(storage.has(secondKey)).toBe(false);
  expect(await requestStreakReview("user", 200)).toBe(true);
  expect(storage.get(firstKey)).toBe("true");
  expect(storage.get(secondKey)).toBe("true");
});
