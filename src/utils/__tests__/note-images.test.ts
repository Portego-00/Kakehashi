import { joinNoteImages, normalizeNoteImageUrl, splitNoteImages } from "../../../shared/note-images";

describe("note image storage", () => {
  it("round-trips formatted text, whitespace, and multiple URLs between clients", () => {
    const text = '  Use <b>橋</b> & <a href="wk://subject/440">bridge</a>\n';
    const images = ["https://example.com/image?width=100&label=%22bridge%22", "https://example.com/tall.png"];
    expect(splitNoteImages(joinNoteImages(text, images))).toEqual({ text, images });
  });
  it("supports image-only notes and removing the last image", () => {
    expect(splitNoteImages(joinNoteImages("", ["https://example.com/a.png"]))).toEqual({ text: "", images: ["https://example.com/a.png"] });
    expect(joinNoteImages("", [])).toBe("");
  });
  it.each(["plain text\n", '&lt;img src="https://example.com/a.png"&gt;', '<img src="javascript:alert(1)">', '<img src="https://example.com/a.png" onerror="alert(1)">'])("leaves existing or unrecognized text untouched: %s", (text) => {
    expect(splitNoteImages(text)).toEqual({ text, images: [] });
  });
  it.each(["javascript:alert(1)", "data:image/png;base64,a", "file:///a.png", "//example.com/a.png", "https://user:password@example.com/a.png", "https://example.com/\na.png", "not a URL"])("rejects invalid or non-public URL schemes: %s", (url) => {
    expect(normalizeNoteImageUrl(url)).toBeNull();
    expect(() => joinNoteImages("note", [url])).toThrow();
  });
  it("normalizes pasted URLs and escapes attribute delimiters", () => {
    expect(normalizeNoteImageUrl(" https://example.com/橋.png ")).toBe("https://example.com/%E6%A9%8B.png");
    const url = 'https://example.com/a.png?x=1&y=<b>"';
    const stored = joinNoteImages("text", [url]);
    expect(stored).toContain("&amp;");
    expect(splitNoteImages(stored).images).toEqual([normalizeNoteImageUrl(url)]);
  });
});
