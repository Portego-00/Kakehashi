/* eslint-disable @typescript-eslint/no-require-imports -- Reload the store between persistence tests. */
import type AsyncStorage from "@react-native-async-storage/async-storage";
import type { NewsItem } from "../../services/NhkNewsService";

const article: NewsItem = {
  id: "easy:101", source: "easy", title: "日本のニュース", link: "https://nhkeasier.com/story/101/",
  guid: "https://nhkeasier.com/story/101/", pubDate: "2026-10-02T08:00:00Z",
  imageUrl: null, audioUrl: null, contentHtml: "<p>Saved full article</p>", isFullArticle: true,
};

beforeEach(() => { jest.resetModules(); });

it("keeps full snapshots, restores old stories, and serializes concurrent saves across sources", async () => {
  const storage = require("@react-native-async-storage/async-storage") as typeof AsyncStorage;
  storage.getItem = jest.fn().mockResolvedValue(JSON.stringify([{ ...article, id: "easy:older" }]));
  storage.setItem = jest.fn().mockResolvedValue(undefined);
  const { setNewsSaved, loadSavedNews } = require("../useSavedNews");
  await Promise.all([
    setNewsSaved(article, true),
    setNewsSaved({ ...article, id: "regular:101", source: "regular" }, true),
    setNewsSaved(article, false),
  ]);
  expect(await loadSavedNews()).toEqual([
    { ...article, id: "regular:101", source: "regular" },
    { ...article, id: "easy:older" },
  ]);
});

it("does not change bookmarks on failed writes and supports retrying and removing", async () => {
  const storage = require("@react-native-async-storage/async-storage") as typeof AsyncStorage;
  storage.getItem = jest.fn().mockResolvedValue("broken json");
  storage.setItem = jest.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
  const { setNewsSaved, loadSavedNews } = require("../useSavedNews");
  await expect(setNewsSaved(article, true)).rejects.toThrow("disk full");
  expect(await loadSavedNews()).toEqual([]);
  await setNewsSaved(article, true);
  expect(await loadSavedNews()).toEqual([article]);
  await setNewsSaved(article, false);
  expect(await loadSavedNews()).toEqual([]);
});
