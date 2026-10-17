import { File } from "expo-file-system";
import { selectTranslationPackage } from "../import-file";
import { MAX_PACKAGE_BYTES } from "../resolver";
import data from "../../../../tests/fixtures/translation-packages/tr-learning-pilot.json";
jest.mock("expo-file-system", () => ({File: {pickFileAsync: jest.fn()}}));
it("accepts JSON supplied as a picked file", async () => {
  (File.pickFileAsync as jest.Mock).mockResolvedValueOnce({size: 1000, text: async () => JSON.stringify(data)});
  expect((await selectTranslationPackage())?.version).toBe(data.version);
});
it("returns without importing when the picker is cancelled", async () => {
  (File.pickFileAsync as jest.Mock).mockRejectedValueOnce(new Error("User cancelled"));
  expect(await selectTranslationPackage()).toBeNull();
});
it("rejects an oversized file before reading it", async () => {
  const text = jest.fn();
  (File.pickFileAsync as jest.Mock).mockResolvedValueOnce({size: MAX_PACKAGE_BYTES + 1, text});
  await expect(selectTranslationPackage()).rejects.toThrow("20 MB");
  expect(text).not.toHaveBeenCalled();
});
it("rejects invalid contents independently of file name or MIME type", async () => {
  (File.pickFileAsync as jest.Mock).mockResolvedValueOnce({size: 100, name: "translations.json", text: async () => "not json"});
  await expect(selectTranslationPackage()).rejects.toThrow("JSON");
});
