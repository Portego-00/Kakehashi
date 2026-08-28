import { describe, expect, it, vi } from "vitest";
import {
  adjustEpubCaretToTappedCharacter,
  buildEpubWordSelection,
  epubLookupTextSources,
  epubRangesForOffsets,
  epubTextEntries,
  nearestEpubTermRange,
} from "./epub-word-selection";

describe("EPUB word selection", () => {
  it("maps a word across ruby base nodes without including its reading", () => {
    const chapter = document.implementation.createHTMLDocument("Ruby chapter");
    chapter.body.innerHTML = `<p id="story"><ruby>小<rt>ちい</rt></ruby>さいかばんと<ruby>大<rt>たい</rt>切<rt>せつ</rt></ruby>な本</p>`;
    const paragraph = chapter.getElementById("story")!;
    const rubyBase = paragraph.querySelector("ruby")!.firstChild as Text;
    const selection = buildEpubWordSelection(chapter, chapter.body, rubyBase, 0, "tap-1");

    expect(selection?.joinedText).toBe("小さいかばんと大切な本");
    expect(selection?.joinedText).not.toContain("ちい");
    expect(selection?.request.surface).toBe("小さい");
    expect(selection?.request.text).toContain("大切");

    const selectedRange = nearestEpubTermRange(selection!.joinedText, "小さい", selection!.absoluteIndex)!;
    expect(epubRangesForOffsets(selection!, selectedRange.start, selectedRange.end).map((range) => range.toString())).toEqual(["小", "さい"]);
  });

  it("maps a tap on ruby reading text back to the base word", () => {
    const chapter = document.implementation.createHTMLDocument("Ruby reading tap");
    chapter.body.innerHTML = `<p><ruby>大<rt>たい</rt>切<rt>せつ</rt></ruby>です</p>`;
    const reading = chapter.querySelector("rt")!.firstChild as Text;
    const selection = buildEpubWordSelection(chapter, chapter.body, reading, 0, "tap-2");

    expect(selection?.request.surface).toBe("大切");
    expect(selection?.joinedText).toBe("大切です");
  });

  it("does not create a word selection for punctuation", () => {
    const chapter = document.implementation.createHTMLDocument("Punctuation tap");
    chapter.body.innerHTML = `<p>猫。犬</p>`;
    const text = chapter.querySelector("p")!.firstChild as Text;

    expect(buildEpubWordSelection(chapter, chapter.body, text, 1, "tap-3")).toBeNull();
  });

  it("rejects the nearest caret when the tap is in blank page space", () => {
    const chapter = document.implementation.createHTMLDocument("Blank tap");
    chapter.body.innerHTML = `<p>学校</p>`;
    const text = chapter.querySelector("p")!.firstChild as Text;
    let rangeOffset = 0;
    const documentWithRects = {
      createRange: vi.fn(() => ({
        setStart: (_node: Text, offset: number) => { rangeOffset = offset; },
        setEnd: vi.fn(),
        getClientRects: () => rangeOffset === 0
          ? [{ left: 10, right: 30, top: 10, bottom: 30, width: 20, height: 20 }]
          : [{ left: 30, right: 50, top: 10, bottom: 30, width: 20, height: 20 }],
      })),
    } as unknown as Document;

    expect(adjustEpubCaretToTappedCharacter(documentWithRects, { node: text, offset: 0 }, 20, 20)).toEqual({ node: text, offset: 0 });
    expect(adjustEpubCaretToTappedCharacter(documentWithRects, { node: text, offset: 0 }, 100, 100)).toBeNull();
  });

  it("chooses the repeated surface nearest the tapped character", () => {
    expect(nearestEpubTermRange("猫と犬と猫", "猫", 5)).toEqual({ start: 4, end: 5 });
    expect(nearestEpubTermRange("猫と犬と猫", "猫", 0)).toEqual({ start: 0, end: 1 });
  });

  it("keeps split inline text in document order", () => {
    const chapter = document.implementation.createHTMLDocument("Split nodes");
    chapter.body.innerHTML = `<p>昔々、<span>山の</span><strong>向こう</strong>へ。</p>`;

    expect(epubTextEntries(chapter.querySelector("p")!).joinedText).toBe("昔々、山の向こうへ。");
  });

  it("preprocesses nested paragraphs once without folding them into their wrapper", () => {
    const chapter = document.implementation.createHTMLDocument("Paragraph sources");
    chapter.body.innerHTML = `<div id="story">
      <p>最初の段落。</p>
      <p><ruby>次<rt>つぎ</rt></ruby>の段落。</p>
    </div>`;

    expect(epubLookupTextSources(chapter.body).map((source) => source.text)).toEqual([
      "最初の段落。",
      "次の段落。",
    ]);
  });
});
