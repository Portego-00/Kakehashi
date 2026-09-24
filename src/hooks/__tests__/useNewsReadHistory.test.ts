import AsyncStorage from "@react-native-async-storage/async-storage";

const easy = { id: "easy:101", source: "easy" as const };
const regular = { id: "101", source: "regular" as const };

beforeEach(() => {
  jest.resetModules();
});

it("restores history before serializing concurrent changes and keeps sources distinct", async () => {
  const storage =
    require("@react-native-async-storage/async-storage") as typeof AsyncStorage;
  storage.getItem = jest.fn().mockResolvedValue(JSON.stringify(["easy:older"]));
  const saved: string[] = [];
  storage.setItem = jest.fn(async (_key: string, value: string) => {
    saved.push(value);
  });
  const { setNewsRead } = require("../useNewsReadHistory");
  await Promise.all([
    setNewsRead(easy, true),
    setNewsRead(regular, true),
    setNewsRead(easy, false),
  ]);
  expect(JSON.parse(saved[saved.length - 1])).toEqual([
    "easy:older",
    "regular:101",
  ]);
});

it("recovers malformed history and retries a failed write without losing changes", async () => {
  const storage =
    require("@react-native-async-storage/async-storage") as typeof AsyncStorage;
  storage.getItem = jest.fn().mockResolvedValue("broken json");
  storage.setItem = jest
    .fn()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValue(undefined);
  const { setNewsRead } = require("../useNewsReadHistory");
  await expect(setNewsRead(easy, true)).rejects.toThrow("disk full");
  await setNewsRead(regular, true);
  expect(storage.setItem).toHaveBeenLastCalledWith(
    "kakehashi:news-read:v1",
    JSON.stringify(["regular:101"]),
  );
});
