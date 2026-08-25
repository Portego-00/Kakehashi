import { describe, expect, it } from "vitest";
import { extractReadableTextFromHtml, findCueAt, parseLrc, parseSrt, parseTimestamp, plainLyricsToLines } from "../parsers";

describe("subtitle and content parsers", () => {
  it("parses SRT blocks, multiline cues, HTML formatting, and comma milliseconds", () => {
    const cues = parseSrt(`1\n00:00:01,250 --> 00:00:03,500\n<b>今日は</b>いい天気です。\n二行目です。\n\n2\n00:00:04.000 --> 00:00:05.250 position:50%\nまた明日。`);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ startMs: 1250, endMs: 3500, text: "今日はいい天気です。\n二行目です。" });
    expect(cues[1].startMs).toBe(4000);
    expect(findCueAt(cues, 3499)?.id).toBe(cues[0].id);
    expect(findCueAt(cues, 3500)).toBeNull();
    expect(findCueAt(cues, 4200)?.text).toBe("また明日。");
  });

  it("ignores broken cues and understands minute-only timestamps", () => {
    expect(parseTimestamp("02:03.45")).toBe(123450);
    expect(parseTimestamp("bad")).toBeNull();
    expect(parseSrt("1\n00:00:03,000 --> 00:00:02,000\nbroken")).toEqual([]);
  });

  it("removes subtitle navigation and music symbols before analysis", () => {
    const cues = parseSrt("1\n00:00:01,000 --> 00:00:03,000\n♪ → 今日は晴れです。 ↵ ♫");
    expect(cues[0]?.text).toBe("今日は晴れです。");
  });

  it("removes wave-dash music markers and drops marker-only cues", () => {
    const cues = parseSrt(`1
00:00:01,000 --> 00:00:02,000
〜

2
00:00:03,000 --> 00:00:04,000
～ （馬車の音）

3
00:00:05,000 --> 00:00:06,000
〰 それじゃ行こうか。`);
    expect(cues.map((cue) => cue.text)).toEqual(["（馬車の音）", "それじゃ行こうか。"]);
  });

  it("parses LRC with duplicate timestamps and stable end times", () => {
    const lines = parseLrc("[00:01.20][00:03.450]同じ歌詞\n[01:05]最後の行");
    expect(lines.map((line) => line.startMs)).toEqual([1200, 3450, 65000]);
    expect(lines[0].endMs).toBe(3450);
    expect(lines[2].endMs).toBe(70000);
  });

  it("turns plain lyrics into predictable practice timing", () => {
    expect(plainLyricsToLines("一行\n\n二行")).toEqual([
      { id: "plain-0", startMs: 0, endMs: 5000, text: "一行" },
      { id: "plain-1", startMs: 5000, endMs: 10000, text: "二行" },
    ]);
  });

  it("extracts readable text while excluding active and navigational content", () => {
    const text = extractReadableTextFromHtml("<header>Menu</header><article><h1>日本の話</h1><p>今日は晴れです。</p><script>alert(1)</script><p>散歩します。</p></article>");
    expect(text).toContain("日本の話");
    expect(text).toContain("今日は晴れです。");
    expect(text).toContain("散歩します。");
    expect(text).not.toContain("Menu");
    expect(text).not.toContain("alert");
  });
});
