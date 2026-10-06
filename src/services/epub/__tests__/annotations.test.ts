import AsyncStorage from "@react-native-async-storage/async-storage";
import { epubAnnotations, type EpubAnnotation } from "../annotations";

const annotation: EpubAnnotation = {
  id: "highlight-1", kind: "highlight", page: 3, text: "日本語", createdAt: 100,
  passage: { start: { sectionId: "chapter-1", offset: 2 }, end: { sectionId: "chapter-1", offset: 5 } },
};

describe("EPUB annotations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("persists text anchors and isolates each book", async () => {
    await epubAnnotations.save("book-a", [annotation]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("epub-annotations:book-a", JSON.stringify([annotation]));
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify([annotation])).mockResolvedValueOnce(null);
    expect(await epubAnnotations.load("book-a")).toEqual([annotation]);
    expect(await epubAnnotations.load("book-b")).toEqual([]);
  });

  it("surfaces a failed write and lets a later attempt succeed", async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(epubAnnotations.save("book-a", [annotation])).rejects.toThrow("storage unavailable");
    await expect(epubAnnotations.save("book-a", [])).resolves.toBeUndefined();
  });

  it("removes the book's saved passages", async () => {
    await epubAnnotations.removeBook("book-a");
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("epub-annotations:book-a");
  });

  it("reports corrupt storage instead of returning data that can crash the reader", async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('{"unexpected":"object"}');
    await expect(epubAnnotations.load("book-a")).rejects.toThrow("Invalid EPUB annotation data");
  });
});
