import type { SettingsArtworkName } from "../../ui/settings/artwork";
export const SETTINGS_CATEGORIES: readonly {
  id: string;
  title: string;
  description: string;
  icon: SettingsArtworkName;
  sections: readonly string[];
  group: string;
}[] = [
  {
    id: "reviews",
    title: "Reviews",
    description: "Answer modes, review order and feedback",
    icon: "reviews",
    sections: ["reviews"],
    group: "Study",
  },
  {
    id: "lessons",
    title: "Lessons",
    description: "Daily pace, ordering and lesson layout",
    icon: "lessons",
    sections: ["lessons"],
    group: "Study",
  },
  {
    id: "vocabulary",
    title: "Vocabulary & kanji",
    description: "Context, stroke practice and item details",
    icon: "kanji",
    sections: ["vocabContext", "kanji", "subjectDetails", "subjectLists"],
    group: "Study",
  },
  {
    id: "bunpro",
    title: "Bunpro",
    description: "Connection and grammar review preferences",
    icon: "bunpro",
    sections: ["bunproReviews"],
    group: "Study",
  },
  {
    id: "reading",
    title: "Reading & listening",
    description: "News, lyrics, voices and music playback",
    icon: "reader",
    sections: ["readingDefaults", "voice", "musicPlayback"],
    group: "Study",
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "Theme, text, navigation and widgets",
    icon: "appearance",
    sections: ["appearance", "theme", "widgets"],
    group: "Personalize",
  },
  {
    id: "reminders",
    title: "Reminders & haptics",
    description: "Notifications and feedback on your device",
    icon: "notify",
    sections: ["notifications", "haptic"],
    group: "Personalize",
  },
  {
    id: "profile",
    title: "Profile & notes",
    description: "Your avatar, connections and note editor",
    icon: "profile",
    sections: ["profile", "notes"],
    group: "Account & app",
  },
  {
    id: "data",
    title: "Data & progress",
    description: "Cache maintenance and level summaries",
    icon: "storage",
    sections: ["dataStorage", "levelRecap"],
    group: "Account & app",
  },
  {
    id: "support",
    title: "Help & account",
    description: "Feedback, support and your account",
    icon: "support",
    sections: ["support", "patreon", "account"],
    group: "Account & app",
  },
  {
    id: "developer",
    title: "Developer tools",
    description: "Restricted diagnostics and API history",
    icon: "settings",
    sections: ["apiDebug"],
    group: "Account & app",
  },
];
