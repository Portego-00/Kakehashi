import { CoachMarkStep } from "../components/CoachMarks";

/**
 * Tutorial steps for the Songs tab screen
 * These steps introduce users to the music discovery features
 */
export const SONGS_TUTORIAL_STEPS: Omit<CoachMarkStep, "target">[] = [
  {
    id: "songs-welcome",
    title: "Welcome to Music!",
    description:
      "Discover Japanese songs and learn vocabulary through lyrics. Let me show you around!",
    position: "bottom",
    icon: "musical-notes",
  },
  {
    id: "songs-search",
    title: "Search for Songs",
    description:
      "Search for any Japanese song by title or artist. We'll find it on Spotify and fetch the lyrics for you.",
    position: "bottom",
    icon: "search",
  },
  {
    id: "songs-categories",
    title: "Discover Music",
    description:
      "Browse curated categories like New Releases, Popular J-Pop, and Anime soundtracks to find new music.",
    position: "top",
    icon: "albums",
  },
];

/**
 * Tutorial steps for the Song Lyrics screen
 * These steps explain the lyrics viewing and override features
 */
export const LYRICS_TUTORIAL_STEPS: Omit<CoachMarkStep, "target">[] = [
  {
    id: "lyrics-welcome",
    title: "Song Lyrics",
    description:
      "View lyrics synced to the music with vocabulary from your WaniKani level highlighted!",
    position: "bottom",
    icon: "document-text",
  },
  {
    id: "lyrics-sync",
    title: "Synced Lyrics",
    description:
      "When available, lyrics scroll automatically with the music. You can disable it here.",
    position: "bottom",
    icon: "sync",
    pointerPosition: "left",
  },
  {
    id: "lyrics-settings",
    title: "Fix Mismatched Content",
    description:
      "Sometimes the wrong video or lyrics are matched. Tap here to manually search and select the correct YouTube video or lyrics.",
    position: "bottom",
    icon: "warning",
    important: true,
    pointerPosition: "left",
  },
  {
    id: "lyrics-vocabulary",
    title: "Learn Vocabulary",
    description:
      "Tap any highlighted word to see its meaning, reading, and WaniKani level. Words above your level show a badge.",
    position: "bottom",
    icon: "school",
  },
];

/**
 * Tutorial steps for the Translator screen
 * These steps explain the translation and WaniKani highlight features
 */
export const TRANSLATOR_TUTORIAL_STEPS: Omit<CoachMarkStep, "target">[] = [
  {
    id: "translator-welcome",
    title: "Welcome to Translator!",
    description:
      "Translate between English and Japanese, and discover WaniKani vocabulary in your text.",
    position: "bottom",
    icon: "language",
  },
  {
    id: "translator-input",
    title: "Enter Text",
    description:
      "Type or paste text here. Use the swap button to switch between English→Japanese and Japanese→English.",
    position: "bottom",
    icon: "create",
  },
  {
    id: "translator-highlights",
    title: "WaniKani Study Mode",
    description:
      "When viewing Japanese text, tap this button to highlight vocabulary and kanji from WaniKani. Tap any highlighted word to see its details!",
    position: "bottom",
    icon: "school",
    important: true,
    pointerPosition: "top",
  },
];

/**
 * AsyncStorage keys for tutorial completion tracking
 */
export const TUTORIAL_STORAGE_KEYS = {
  SONGS_COMPLETED: "tutorial_songs_completed_v1",
  LYRICS_COMPLETED: "tutorial_lyrics_completed_v1",
  TRANSLATOR_COMPLETED: "tutorial_translator_completed_v1",
} as const;
