import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supportsNativeTabs } from "./nativeTabs";

export type TabId =
  | "home"
  | "progress"
  | "news"
  | "songs"
  | "items"
  | "analytics"
  | "epubs"
  | "videos"
  | "mangas"
  | "notebooks";

interface TabInfo {
  id: TabId;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  sfIcon?: string;
  isRequired?: boolean;
  isClusterable?: boolean; // Can be clustered inside progress
  requiresFeatureFlag?: boolean;
}

export const TAB_INFO: TabInfo[] = [
  {
    id: "home",
    label: "Home",
    description: "Dashboard with reviews, lessons, and progress",
    icon: "home",
    sfIcon: "house.fill",
    isRequired: true,
  },
  {
    id: "progress",
    label: "Level",
    description: "Current level progress and SRS stages",
    icon: "trending-up",
    sfIcon: "chart.line.text.clipboard.fill",
    isRequired: true,
  },
  {
    id: "items",
    label: "Items",
    description: "Browse all radicals, kanji, and vocabulary",
    icon: "library",
    sfIcon: "square.stack.3d.up.fill",
    isClusterable: true,
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Detailed statistics and review history",
    icon: "analytics",
    sfIcon: "chart.bar.fill",
    isClusterable: true,
  },
  {
    id: "epubs",
    label: "Books",
    description: "EPUB library and reader",
    icon: "book",
    sfIcon: "book.closed.fill",
  },
  {
    id: "videos",
    label: "Video",
    description: "Video player with transcripts and WaniKani/JPDB integration",
    icon: "videocam",
    sfIcon: "play.square.fill",
  },
  {
    id: "mangas",
    label: "Manga",
    description: "CBZ/PDF manga reader with OCR sentence and word lookup",
    icon: "bookmarks",
    sfIcon: "books.vertical.fill",
  },
  {
    id: "notebooks",
    label: "Notebooks",
    description: "Study notes, linked vocabulary, and shared notebook pages",
    icon: "document-text",
    sfIcon: "note.text",
  },
  {
    id: "news",
    label: "News",
    description: "Latest updates from WaniKani",
    icon: "newspaper",
    sfIcon: "newspaper.fill",
  },
  {
    id: "songs",
    label: "Music",
    description: "Japanese songs for learning",
    icon: "musical-notes",
    sfIcon: "music.note.list",
    requiresFeatureFlag: true,
  },
];

export function getMaxTabsForDevice(): number {
  if (Platform.OS !== "ios") {
    return 5;
  }

  return supportsNativeTabs() ? 4 : 5;
}

export function partitionTabs(order: readonly string[], maxTabs: number, showSongs: boolean, showManga: boolean) {
  const selected = new Set(["home", "progress", ...order]);
  const enabled = TAB_INFO.filter(tab => selected.has(tab.id)
    && (tab.id !== "songs" || showSongs)
    && (tab.id !== "mangas" || showManga));
  const hasOverflow = enabled.length > maxTabs;
  const direct = enabled.slice(0, hasOverflow ? maxTabs - 1 : maxTabs);
  return { direct, overflow: enabled.slice(direct.length), enabled };
}
