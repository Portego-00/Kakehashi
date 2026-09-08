import compactData from "emojibase-data/en/compact.json";
import shortcodeData from "emojibase-data/en/shortcodes/emojibase.json";

export type NotebookEmoji = { emoji: string; label: string; group: number };

type EmojiData = {
  unicode: string;
  hexcode: string;
  label: string;
  group?: number;
  order?: number;
  tags?: string[];
  emoticon?: string;
  skins?: EmojiData[];
};

export const EMOJI_GROUPS: { id: number; label: string }[] = [
  { id: 0, label: "Smileys & emotion" },
  { id: 1, label: "People & body" },
  { id: 2, label: "Components" },
  { id: 3, label: "Animals & nature" },
  { id: 4, label: "Food & drink" },
  { id: 5, label: "Travel & places" },
  { id: 6, label: "Activities" },
  { id: 7, label: "Objects" },
  { id: 8, label: "Symbols" },
  { id: 9, label: "Flags" },
];

const data: EmojiData[] = compactData;
const shortcodes: Record<string, string | string[]> = shortcodeData;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f\ufe0e\ufe0f]/g, "").toLowerCase().replace(/[_:\-]+/g, " ").trim();
}

function aliases(hexcode: string): string[] {
  const value = shortcodes[hexcode];
  return typeof value === "string" ? [value] : value ?? [];
}

// Keep skin and multi-person variants searchable using their parent's keywords too.
const catalog = data.flatMap((parent) => [parent, ...(parent.skins ?? [])].map((entry) => ({
  value: { emoji: entry.unicode, label: entry.label, group: entry.group ?? parent.group ?? 2 },
  order: entry.order ?? Number.MAX_SAFE_INTEGER,
  searchText: normalize([
    entry.unicode, entry.label, entry.emoticon ?? "", ...(parent.tags ?? []),
    ...aliases(parent.hexcode), ...aliases(entry.hexcode),
  ].join(" ")),
}))).sort((a, b) => a.order - b.order);

const suggestions = ["📖", "✍️", "🌸", "🍵", "🗾", "🏯", "🦊", "🎋", "🌊", "🍁", "🧭", "🗻", "💡", "🚀", "🪴", "✨"];

export const SUGGESTED_EMOJIS: NotebookEmoji[] = suggestions.flatMap((emoji) => {
  const match = catalog.find((entry) => normalize(entry.value.emoji) === normalize(emoji));
  return match ? [match.value] : [];
});

export function searchEmojis(query: string, group?: number): NotebookEmoji[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return catalog.filter((entry) => (group === undefined || entry.value.group === group)
    && terms.every((term) => entry.searchText.includes(term))).map((entry) => entry.value);
}
