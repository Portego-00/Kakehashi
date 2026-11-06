import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { canUseYouGlish, readYouGlishMessage, youGlishPlayerDocument, youGlishSearchUrl } from "../../../../src/features/youglish/player";

describe("YouGlish boundary", () => {
  it("requires an explicit opt-in and Portego identity", () => {
    expect(canUseYouGlish(" Portego ", true)).toBe(true);
    expect(canUseYouGlish("Other", true)).toBe(false);
    expect(canUseYouGlish("Portego", undefined)).toBe(false);
    expect(canUseYouGlish(undefined, true)).toBe(false);
  });

  it("passes Japanese words safely to the official widget without autoplay", () => {
    const query = '家族</script><script>window.injected=true</script>';
    const fetch = vi.fn();
    const widget = vi.fn(function () { return { fetch }; });
    const dom = new JSDOM(youGlishPlayerDocument(query, false), { runScripts: "dangerously" });
    Object.assign(dom.window, { YG: { Widget: widget } });
    (dom.window as unknown as { onYouglishAPIReady: () => void }).onYouglishAPIReady();
    expect(fetch).toHaveBeenCalledWith(query, "japanese");
    expect(widget).toHaveBeenCalledWith("player", expect.objectContaining({ autoStart: 0 }));
    expect((dom.window as unknown as { injected?: boolean }).injected).toBeUndefined();
    dom.window.close();
  });

  it("encodes external lookups and rejects malformed or unrelated messages", () => {
    expect(youGlishSearchUrl(" 家族 ")).toBe("https://youglish.com/pronounce/%E5%AE%B6%E6%97%8F/japanese");
    expect(readYouGlishMessage({ channel: "other", type: "error" })).toBeNull();
    expect(readYouGlishMessage({ channel: "kakehashi-youglish", type: "height", value: Infinity })).toBeNull();
    expect(readYouGlishMessage({ channel: "kakehashi-youglish", type: "results", value: -1 })).toBeNull();
  });
});
