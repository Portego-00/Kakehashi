import { describe, expect, it } from "vitest";
import { EMOJI_GROUPS, searchEmojis, SUGGESTED_EMOJIS } from "./emoji-catalog";

describe("notebook emoji catalog", () => {
  it("offers the full catalog, including flags, multi-person variants, and Emoji 17 additions", () => {
    const emojis = searchEmojis("");
    expect(emojis.length).toBeGreaterThan(3900);
    expect(new Set(emojis.map((entry) => entry.emoji)).size).toBe(emojis.length);
    expect(searchEmojis("japan")).toContainEqual({ emoji: "🇯🇵", label: "flag: Japan", group: 9 });
    expect(searchEmojis("holding hands light skin tone medium skin tone").length).toBeGreaterThan(0);
    expect(searchEmojis("orca")).toContainEqual({ emoji: "🫍", label: "orca", group: 3 });
  });

  it("finds names, CLDR keywords, and familiar shortcodes without case or separator sensitivity", () => {
    expect(searchEmojis("cherry blossom").map((entry) => entry.emoji)).toContain("🌸");
    expect(searchEmojis("cya").map((entry) => entry.emoji)).toContain("👋");
    expect(searchEmojis(" :MOUNT_FUJI: ").map((entry) => entry.emoji)).toContain("🗻");
    expect(searchEmojis(":thumbsup:")).toContainEqual({ emoji: "👍\uFE0F", label: "thumbs up", group: 1 });
  });

  it("finds pasted emoji and skin variants, including inherited search keywords", () => {
    expect(searchEmojis("👋🏽")).toEqual([{ emoji: "👋🏽", label: "waving hand: medium skin tone", group: 1 }]);
    expect(searchEmojis("cya medium skin tone").map((entry) => entry.emoji)).toContain("👋🏽");
    expect(searchEmojis("❤").map((entry) => entry.emoji)).toContain("❤️");
  });

  it("filters by every category while preserving the complete searchable library", () => {
    expect(EMOJI_GROUPS.flatMap((group) => searchEmojis("", group.id))).toHaveLength(searchEmojis("").length);
    expect(searchEmojis("japan", 9)).toContainEqual({ emoji: "🇯🇵", label: "flag: Japan", group: 9 });
    expect(searchEmojis("japan", 9).every((entry) => entry.group === 9)).toBe(true);
    expect(searchEmojis("japan", 4).every((entry) => entry.group === 4)).toBe(true);
    expect(searchEmojis("there-is-no-emoji-with-this-name")).toEqual([]);
  });

  it("provides varied notebook suggestions from the same selectable catalog", () => {
    expect(SUGGESTED_EMOJIS).toHaveLength(16);
    expect(new Set(SUGGESTED_EMOJIS.map((entry) => entry.group)).size).toBeGreaterThan(3);
    expect(SUGGESTED_EMOJIS.map((entry) => entry.emoji)).toEqual(expect.arrayContaining(["📖", "🌸", "🧭", "🍵"]));
  });
});
