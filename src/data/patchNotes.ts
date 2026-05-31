export type PatchNoteChangeType = "feature" | "improvement" | "fix" | "design";

export type PatchNoteChange = {
  type: PatchNoteChangeType;
  title: string;
  description?: string;
  link?: {
    route: string;
    params?: Record<string, string>;
    label: string;
  };
};

export type PatchNote = {
  version: string;
  date: string; // ISO date string
  changes: PatchNoteChange[];
};

// Color and icon configuration for each change type
export const CHANGE_TYPE_CONFIG: Record<
  PatchNoteChangeType,
  { icon: string; label: string; color: string; backgroundColor: string }
> = {
  feature: {
    icon: "sparkles",
    label: "New",
    color: "#9333EA",
    backgroundColor: "rgba(147, 51, 234, 0.15)",
  },
  improvement: {
    icon: "trending-up",
    label: "Improved",
    color: "#3B82F6",
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  fix: {
    icon: "bug",
    label: "Fixed",
    color: "#22C55E",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  design: {
    icon: "color-palette",
    label: "Design",
    color: "#EC4899",
    backgroundColor: "rgba(236, 72, 153, 0.15)",
  },
};

// Get the current patch notes version (latest version)
export const getCurrentPatchNotesVersion = (): string => {
  return PATCH_NOTES[0]?.version ?? "0.0.0";
};

// Patch notes data - add new entries at the TOP of this array
export const PATCH_NOTES: PatchNote[] = [
  {
    version: "1.2.71",
    date: "2026-05-31",
    changes: [
      {
        type: "fix",
        title: "Practice Mistakes Navigation",
        description:
          "Constellation exit no longer ends Practice Mistakes review.",
      },
      {
        type: "feature",
        title: "Reader Tooltip Reveal Settings",
        description: "Added tap-to-reveal settings for tooltip meanings and readings.",
      },
    ],
  },
  {
    version: "1.2.70",
    date: "2026-05-29",
    changes: [
      {
        type: "feature",
        title: "Offline Lessons and Reviews",
        description:
          "Lessons and reviews now keep working without a connection. Progress is saved locally, synced when you're back online.",
      },
    ],
  },
  {
    version: "1.2.69",
    date: "2026-05-28",
    changes: [
      {
        type: "feature",
        title: "Choose Your Update Experience",
        description:
          "Added an Updates setting so you can choose whether OTA updates block startup, wait only briefly, download for the next app open, or show a Home banner. A few days ago OTA checks became slower; even though that is resolved now, this gives you a fallback if it happens again.",
        link: {
          route: "/settings",
          params: { scrollTo: "updates" },
          label: "Open Update Settings",
        },
      },
    ],
  },
  {
    version: "1.2.68",
    date: "2026-05-25",
    changes: [
      {
        type: "feature",
        title: "Kakehashi is Open Source",
        description:
          "Kakehashi is now open source, with a new GitHub entry in Settings for reading the code, starring the repo, or contributing.",
      },
    ],
  },
  {
    version: "1.2.67",
    date: "2026-05-24",
    changes: [
      {
        type: "fix",
        title: "Skipped Review Ordering",
        description:
          "Skipped reviews now keep meaning and reading questions spaced out unless back-to-back mode is enabled.",
      },
    ],
  },
  {
    version: "1.2.66",
    date: "2026-05-21",
    changes: [
      {
        type: "fix",
        title: "Review Type Ordering",
        description:
          "Most overdue reviews now stay grouped by radical, kanji, and vocabulary when item type order is enabled.",
      },
    ],
  },
  {
    version: "1.2.65",
    date: "2026-05-19",
    changes: [
      {
        type: "feature",
        title: "Lock Screen Review Widget",
        description:
          "Added a Lock Screen widget for checking available reviews at a glance.",
      },
      {
        type: "feature",
        title: "Android Japanese Keyboard Switching",
        description:
          "Added Android support for automatically requesting a Japanese keyboard for reading and writing inputs, matching the existing iOS behavior.",
      },
      {
        type: "feature",
        title: "Review Character Size",
        description:
          "Added a review setting to adjust the size of the large Japanese prompt while keeping the current size as the default.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
    ],
  },
  {
    version: "1.2.64",
    date: "2026-05-16",
    changes: [
      {
        type: "feature",
        title: "Review Answer Pause Details",
        description:
          "Added a review setting to show subject details below the answer field when reviews stop after correct, close, or incorrect answers.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
    ],
  },
  {
    version: "1.2.63",
    date: "2026-05-15",
    changes: [
      {
        type: "fix",
        title: "Today's Study Counts",
        description:
          "Today's Study now keeps completed lessons from increasing the reviews count.",
      },
      {
        type: "feature",
        title: "Single-Kanji Vocab Similar Kanji",
        description:
          "Added an optional setting to show visually similar kanji on single-kanji vocabulary details and lessons.",
      },
    ],
  },
  {
    version: "1.2.62",
    date: "2026-05-14",
    changes: [
      {
        type: "improvement",
        title: "Subject Lists Shortcuts",
        description:
          "Added quicker entry points for managing Subject Lists from Extra Study and as an optional Home dashboard widget.",
      },
    ],
  },
  {
    version: "1.2.61",
    date: "2026-05-11",
    changes: [
      {
        type: "improvement",
        title: "Easier Settings Navigation",
        description:
          "Settings navigation is now easier to use, even with many options.",
      },
      {
        type: "feature",
        title: "Lesson Picker View Mode Setting",
        description:
          "Added a lesson setting to choose card or list view for the lesson picker.",
        link: {
          route: "/settings",
          params: { scrollTo: "lessons" },
          label: "Open Lesson Settings",
        },
      },
    ],
  },
  {
    version: "1.2.60",
    date: "2026-05-08",
    changes: [
      {
        type: "design",
        title: "Context Sentence Practice Redesign",
        description:
          "Redesigned Context Sentence Practice with a centered sentence + translation layout, Bunpro-style writing input, optional JPDB sentence breakdown, and stop-after-answer review flow.",
      },
      {
        type: "improvement",
        title: "Writing Mode Kana Support",
        description:
          "Writing mode now accepts hiragana input for vocabulary answers, even when not using a Japanese keyboard.",
      },
      {
        type: "improvement",
        title: "Review Forecast Table Now Row",
        description:
          "Review Forecast table mode now includes a Now row so current available reviews are shown as a clear anchor.",
      },
    ],
  },
  {
    version: "1.2.59",
    date: "2026-05-07",
    changes: [
      {
        type: "feature",
        title: "Hiragana Vocab Quiz",
        description:
          "Added a new Extra Study mode that shows vocabulary prompts in hiragana and asks for the English meaning.",
      },
    ],
  },
  {
    version: "1.2.58",
    date: "2026-05-03",
    changes: [
      {
        type: "feature",
        title: "Crossword Extra Study Mode",
        description:
          "Added a new Crossword mode in Extra Study where you solve hiragana clues from English meanings.",
      },
    ],
  },
  {
    version: "1.2.57",
    date: "2026-04-30",
    changes: [
      {
        type: "feature",
        title: "Interleave Lesson Types",
        description:
          "Added a Lesson Order option to proportionally mix radicals, kanji, and vocabulary through the queue.",
      },
      {
        type: "feature",
        title: "Review Search Button Setting",
        description:
          "Added a review setting to show a Search button below Wrap Up, opening a dedicated search screen with standard back navigation.",
      },
    ],
  },
  {
    version: "1.2.56",
    date: "2026-04-28",
    changes: [
      {
        type: "feature",
        title: "Review Forecast SRS Breakdown Mode",
        description:
          "Review Forecast charts can now be color-split by SRS stage groups (Apprentice, Guru, Master, Enlightened).",
      },
    ],
  },
  {
    version: "1.2.55",
    date: "2026-04-27",
    changes: [
      {
        type: "feature",
        title: "Continue Later for Extra Study",
        description:
          "Extra Study sessions can now be suspended with Continue Later and resumed next time, with a prompt to resume or discard saved progress.",
      },
    ],
  },
  {
    version: "1.2.54",
    date: "2026-04-26",
    changes: [
      {
        type: "feature",
        title: "Constellation Pinch Zoom",
        description:
          "Constellation view now supports pinch-to-zoom.",
      },
    ],
  },
  {
    version: "1.2.53",
    date: "2026-04-24",
    changes: [
      {
        type: "feature",
        title: "Hide Kana Vocabulary in Lessons",
        description:
          "Added a lesson setting to exclude kana vocabulary from lessons and lesson counts.",
        link: {
          route: "/settings",
          params: { scrollTo: "lessons" },
          label: "Open Lesson Settings",
        },
      },
      {
        type: "improvement",
        title: "Level + SRS Stage in Selection Lists",
        description:
          "Custom Review, Custom Lessons, and Subject List search rows now show each item as Level • SRS stage",
      },
    ],
  },
  {
    version: "1.2.52",
    date: "2026-04-22",
    changes: [
      {
        type: "feature",
        title: "Video Caption Analysis (Beta)",
        description:
          "Added a Video tab for subtitle-driven analysis and history. Enable it in Customize Tabs. For full JPDB parsing/grammar quality, add your JPDB API key in Settings (without it, fallback WaniKani matching is used).",
        link: {
          route: "/tab-settings",
          label: "Customize Tabs",
        },
      },
      {
        type: "fix",
        title: "Kana Input Long Vowel Space Mapping",
        description:
          "In review kana input, typed spaces now convert to ー (long vowel mark) during romaji-to-kana conversion.",
      },
    ],
  },
  {
    version: "1.2.51",
    date: "2026-04-18",
    changes: [
      {
        type: "feature",
        title: "Pause on Close Answer",
        description:
          "Added a review setting to pause on fuzzy-close meaning answers so you can mark them correct or incorrect.",
      },
      {
        type: "design",
        title: "Review Forecast Redesign",
        description:
          "Updated card styling and chart bars to match the new analytics look.",
      },
      {
        type: "feature",
        title: "Split SRS Breakdown Widgets",
        description:
          "You can now split SRS Breakdown into separate graph and breakdown widgets.",
      },
      {
        type: "feature",
        title: "Lesson Order Settings",
        description:
          "Added lesson order settings so you can choose how upcoming lessons are prioritized.",
      },
    ],
  },
  {
    version: "1.2.50",
    date: "2026-04-16",
    changes: [
      {
        type: "feature",
        title: "Review Stats by Level",
        description:
          "Review Stats now lets you check exact meaning, reading, and total accuracy for individual WaniKani levels.",
      },
      {
        type: "feature",
        title: "Arrow Key Lesson Navigation",
        description:
          "You can now move through lessons with arrow keys when using an external keyboard or on macOS.",
      },
      {
        type: "feature",
        title: "Spreadsheet Export for Summaries",
        description:
          "Level and subject summaries can now be exported to a spreadsheet from the settings screen.",
      },
    ],
  },
  {
    version: "1.2.49",
    date: "2026-04-13",
    changes: [
      {
        type: "feature",
        title: "SRS Stage Grouping Toggle",
        description:
          "Active Item Spread now supports grouping Apprentice I-IV and Guru I-II with an in-card toggle. Grouping is reflected in the graph, in-card Details, and the SRS details page.",
      },
    ],
  },
  {
    version: "1.2.48",
    date: "2026-04-10",
    changes: [
      {
        type: "feature",
        title: "Anki Replay Button Setting",
        description:
          "Added an Anki setting to show a Replay button after reveal, so you can replay vocabulary audio again when available.",
        link: {
          route: "/anki-settings",
          label: "Open Anki Settings",
        },
      },
    ],
  },
  {
    version: "1.2.47",
    date: "2026-04-09",
    changes: [
      {
        type: "feature",
        title: "Critical Items Quick Study Menu",
        description:
          "Added a tap menu in Critical Items to start Re-do lessons or Review Items using your currently filtered critical subjects.",
      },
      {
        type: "feature",
        title: "Skip Quiz in Custom Lessons",
        description: "Added a setting to skip the quiz step in custom lessons.",
        link: {
          route: "/settings",
          params: { scrollTo: "lessons" },
          label: "Open Lesson Settings",
        },
      },
      {
        type: "design",
        title: "SRS Breakdown Redesign",
        description:
          "Redesigned the SRS Breakdown in Analytics into a compact single-card widget with stage icons, dynamic graph scaling, per-bar values, and an animated in-card Details view.",
      },
      {
        type: "feature",
        title: "Learned Items Progress Rings",
        description:
          "Added a new Learned Items card under SRS Breakdown in Analytics, showing Radical/Kanji/Vocabulary Guru I+.",
      },
      {
        type: "improvement",
        title: "Level Timing Exclusions",
        description:
          "You can now tap completed level bars in Level Timing to exclude them from average, median, fastest, and slowest stats. Excluded levels are saved.",
      },
    ],
  },
  {
    version: "1.2.46",
    date: "2026-04-07",
    changes: [
      {
        type: "feature",
        title: "News Sorting Options",
        description:
          "Added sorting for Other News in the News tab: sort by Date (newest first) or Known Kanji % (highest first).",
      },
      {
        type: "feature",
        title: "Kanji Grid Heatmap",
        description:
          "Added a new Kanji Grid heatmap in Analytics to view all kanji sorted by SRS strength with color-coded progress.",
      },
    ],
  },
  {
    version: "1.2.45",
    date: "2026-04-06",
    changes: [
      {
        type: "fix",
        title: "Last-Answer Feedback Before Results",
        description:
          "Random Test, Meaning→Reading Test, Listening Practice, and Context Sentence Practice now wait briefly before opening results so you can see whether the final answer was correct or incorrect.",
      },
    ],
  },
  {
    version: "1.2.44",
    date: "2026-04-04",
    changes: [
      {
        type: "feature",
        title: "JPDB Lyrics Translation",
        description:
          "Song lyrics can now be translated line-by-line to English using your JPDB API key.",
      },
    ],
  },
  {
    version: "1.2.43",
    date: "2026-04-03",
    changes: [
      {
        type: "feature",
        title: "Similar Vocabulary Toggle",
        description:
          "Added a setting to show similar vocabulary in meaning and reading sections.",
        link: {
          route: "/settings",
          params: { scrollTo: "vocabContext" },
          label: "Open Settings",
        },
      },
      {
        type: "improvement",
        title: "Improved Vocabulary Parsing",
        description:
          "Upgraded vocabulary parsing for study readers with better vocabulary token detection using JPDB. Create an account at JPDB, set your API key in Settings, and you'll get better Vocabulary matches in News, EPUB reader, and Song lyrics, as well as optional grammar analysis.",
      },
      {
        type: "improvement",
        title: "Constellation Meaning Grouping",
        description:
          "Constellation now groups vocabulary around kanji reading clusters.",
      },
    ],
  },
  {
    version: "1.2.42",
    date: "2026-03-31",
    changes: [
      {
        type: "feature",
        title: "Buttonless Anki Mode",
        description:
          "Added an Anki option to hide action buttons after reveal: tap left to mark incorrect, tap right to mark correct, swipe up for details, and swipe down to skip.",
        link: {
          route: "/anki-settings",
          label: "Open Anki Settings",
        },
      },
      {
        type: "feature",
        title: "English to Japanese Kanji Option",
        description:
          "Meaning Reading Test now supports kanji subjects as an optional question type.",
      },
      {
        type: "feature",
        title: "Save Session Mistakes to Lists",
        description:
          "Review results now lets you add all mistakes to saved lists or create a new list in one tap.",
      },
    ],
  },
  {
    version: "1.2.41",
    date: "2026-03-30",
    changes: [
      {
        type: "improvement",
        title: "Automatic OTA Before Dashboard Load",
        description:
          "To avoid rate limits caused by loading the dashboard twice, OTA updates are now checked and applied automatically before the dashboard loads.",
      },
      {
        type: "design",
        title: "Critical Review Count Border",
        description: "Reviews count now gets a visible border when critical items are ready.",
      },
    ],
  },
  {
    version: "1.2.40",
    date: "2026-03-29",
    changes: [
      {
        type: "improvement",
        title: "Verb Conjugation Recognition",
        description:
          "Improved vocabulary recognition for conjugated verbs in News, Songs, Translator, and EPUB, with better tooltip/modal linking to the base WaniKani entry.",
      },
    ],
  },
  {
    version: "1.2.39",
    date: "2026-03-28",
    changes: [
      {
        type: "feature",
        title: "Mnemonic Illustrations Toggle",
        description:
          "Added a new setting to enable or disable radical mnemonic illustrations in subject details and lessons.",
      },
    ],
  },
  {
    version: "1.2.38",
    date: "2026-03-27",
    changes: [
      {
        type: "feature",
        title: "Subject Lists Device Sync",
        description:
          "Custom subject lists now sync across your devices.",
      },
      {
        type: "fix",
        title: "Anki SRS Indicator Alignment",
        description:
          "SRS indicator now stays aligned with the bottom Anki overlay row and avoids card overlap.",
      },
    ],
  },
  {
    version: "1.2.37",
    date: "2026-03-26",
    changes: [
      {
        type: "feature",
        title: "Review Item Level + SRS Stage",
        description:
          "New optional review setting to show each item's level and current SRS stage during reviews and extra study quizzes.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
      {
        type: "improvement",
        title: "Review Heatmap Past Year View",
        description:
          "Added a rolling Past year page between current and previous year, now shown by default in Review Activity.",
      },
      {
        type: "fix",
        title: "Anki Part-of-Speech Display",
        description:
          "Anki cards now show WaniKani part-of-speech info after reveal when enabled in Anki Settings.",
        link: {
          route: "/anki-settings",
          label: "Open Anki Settings",
        },
      },
      {
        type: "fix",
        title: "Random Test Progress Count",
        description:
          "Random Test now shows the correct selected test size in the top progress header instead of counting expanded meaning/reading prompts.",
      },
    ],
  },
  {
    version: "1.2.36",
    date: "2026-03-25",
    changes: [
      {
        type: "improvement",
        title: "Random Test Review-Style Results",
        description:
          "Random Test now uses review-style results with a mistakes tab, includes both meaning and reading when available, and follows your review grouping/back-to-back question settings.",
      },
    ],
  },
  {
    version: "1.2.35",
    date: "2026-03-24",
    changes: [
      {
        type: "feature",
        title: "Home Customization",
        description:
          "Customize your Home layout with widget ordering, visibility, and per-widget settings.",
        link: {
          route: "/home-customization-settings",
          label: "Open Home Customization",
        },
      },
      {
        type: "fix",
        title: "Level Timing Reset Markers",
        description:
          "Level timing now handles account resets correctly and shows reset markers on the chart.",
      },
    ],
  },
  {
    version: "1.2.34",
    date: "2026-03-23",
    changes: [
      {
        type: "fix",
        title: "Kana->Kanji Anki Reveal",
        description: "Shows kanji instead of reading in Anki mode.",
      },
      {
        type: "feature",
        title: "Anki Extra Answers Toggle",
        description:
          "Option to show other accepted answers and user synonyms on reveal.",
        link: {
          route: "/anki-settings",
          label: "Open Anki Settings",
        },
      },
      {
        type: "feature",
        title: "EPUB Reader (Beta)",
        description: "Added a new beta EPUB reader to read books inside the app.",
        link: {
          route: "/tab-settings",
          label: "Customize Tabs",
        },
      },
    ],
  },
  {
    version: "1.2.33",
    date: "2026-03-22",
    changes: [
      {
        type: "feature",
        title: "Patreon Support Option",
        description: "Added Patreon to the Support page for recurring support.",
      },
      {
        type: "fix",
        title: "Reviews Widget Live Refresh",
        description: "Reviews widget now updates correctly with new reviews.",
      },
      {
        type: "fix",
        title: "Single-Kanji Vocab Reading",
        description:
          "Single-kanji vocab now warns when you enter a kanji reading instead of the vocab reading.",
      },
      {
        type: "feature",
        title: "Kanji Pitch Accent Support",
        description:
          "Kanji Reading tab now shows pitch accents for On'yomi, Kun'yomi, and Nanori, with swipe navigation when multiple patterns are available.",
      },
      {
        type: "feature",
        title: "Vocabulary Patterns of Use",
        description:
          "Added optional Patterns of Use with selectable usage chips in Vocabulary details and lesson Context tabs.",
        link: {
          route: "/settings",
          params: { scrollTo: "vocabContext" },
          label: "Open Settings",
        },
      },
    ],
  },
  {
    version: "1.2.32",
    date: "2026-03-20",
    changes: [
      {
        type: "feature",
        title: "Configurable Review Wrap Up",
        description:
          "Set Wrap Up target to 5, 10, 15, or 20 subjects.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
      {
        type: "fix",
        title: "Paused Wrong-Answer Button Order",
        description:
          "Swapped Mark Incorrect and Mark Correct positions in stop-on-incorrect mode to match Anki layout.",
      },
      {
        type: "improvement",
        title: "Paused Review Skip Action",
        description:
          "Changed Ask Again to Skip in paused incorrect state and requeue without counting a wrong answer.",
      },
      {
        type: "feature",
        title: "Global Haptic Feedback Toggle",
        description:
          "Added a toggle to enable or disable haptic feedback across the app.",
      },
    ],
  },
  {
    version: "1.2.31",
    date: "2026-03-18",
    changes: [
      {
        type: "feature",
        title: "Subject Color Customization",
        description: "Set custom colors for radicals, kanji, and vocabulary.",
      },
      {
        type: "feature",
        title: "Card Style Customization",
        description: "Customize lesson, review, and streak card styles.",
      },
      {
        type: "improvement",
        title: "Level-Up Kanji Indicator",
        description:
          "Added a segmented bar for remaining kanji to Guru (90%) before level up.",
      },
      {
        type: "fix",
        title: "Daily Lesson Limit Step Alignment",
        description:
          "Daily lesson limit now snaps to your lesson batch size increments.",
      },
      {
        type: "improvement",
        title: "Lesson Reading Autoplay",
        description:
          "Added a setting to autoplay vocabulary audio when opening the Reading tab during lessons.",
      },
      {
        type: "fix",
        title: "Anki Skip Button Placement",
        description:
          "Moved the pre-reveal Skip button above the card to avoid overlap with answer actions.",
      },
      {
        type: "fix",
        title: "Anki Previous Answer Mini-Card",
        description:
          "Added the previous-answer mini-card in Anki mode after answering.",
      },
    ],
  },
  {
    version: "1.2.30",
    date: "2026-03-17",
    changes: [
      {
        type: "fix",
        title: "Intentional Exit for Study Sessions",
        description:
          "Disabled swipe-back in lessons, reviews, and extra study quizzes.",
      },
      {
        type: "feature",
        title: "Review Key Shortcuts (External Keyboard)",
        description:
          "Added customizable external-keyboard shortcuts for paused review states (mark incorrect/correct, ask again, add synonym, etc.).",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
      {
        type: "improvement",
        title: "Replay Audio During Paused Reviews",
        description:
          "Paused review cards now include a replay button with a replaying state indicator and shortcut support.",
      },
      {
        type: "feature",
        title: "Daily Reminder Notifications",
        description:
          "New daily review reminder notifications are now available in Settings.",
      },
      {
        type: "fix",
        title: "Lyrics Override in Error State",
        description:
          "Manual lyrics/video selection now works immediately even when auto-lyrics lookup fails.",
      },
    ],
  },
  {
    version: "1.2.29",
    date: "2026-03-16",
    changes: [
      {
        type: "feature",
        title: "Anki Answer Visibility",
        description:
          "Choose blurred or fully hidden answers in Anki mode.",
        link: {
          route: "/anki-settings",
          label: "Open Anki Settings",
        },
      },
      {
        type: "fix",
        title: "Vocabulary Type Filter",
        description:
          "Vocabulary filter now also includes kana vocabulary.",
      },
      {
        type: "fix",
        title: "Review Back Navigation Focus",
        description:
          "Fixed iPad/macOS focus mismatch when returning from subject details.",
      },
    ],
  },
  {
    version: "1.2.28",
    date: "2026-03-15",
    changes: [
      {
        type: "fix",
        title: "Recent Mistakes 24h Filter",
        description:
          "Fixed stale review-stat sync that could hide very recent mistakes from the 24h tab.",
      },
      {
        type: "fix",
        title: "Home Widget Theme Rendering",
        description:
          "Fixed home widget styling issues in Clear and Tinted theme modes.",
      },
      {
        type: "fix",
        title: "Lesson Picker Daily Limit",
        description:
          "Lesson Picker now shows all available lessons and warns when your selection goes over your daily limit.",
      },
    ],
  },
  {
    version: "1.2.27",
    date: "2026-03-14",
    changes: [
      {
        type: "feature",
        title: "iOS Home Screen Widgets (Beta)",
        description:
          "Added beta widgets on iOS so you can quickly check review timing, totals, and streaks.",
        link: {
          route: "/widget-settings",
          label: "Open Widget Settings",
        },
      },
      {
        type: "fix",
        title: "Background Audio Playback",
        description:
          "Other apps can now keep playing audio while Kakehashi plays audio.",
      },
      {
        type: "fix",
        title: "iPad Windowed Layout",
        description:
          "Fixed iPad split-view/window mode sizing so all buttons stay visible and tappable.",
      },
      {
        type: "improvement",
        title: "Question Order Override",
        description:
          "Added an option to always ask meaning-first or reading-first.",
        link: {
          route: "/review-order-settings",
          label: "Open Review Order",
        },
      },
      {
        type: "design",
        title: "New Themes: Sepia and Midnight",
        description:
          "Added two new theme presets: Sepia and Midnight.",
        link: {
          route: "/settings",
          label: "Open Settings",
        },
      },
    ],
  },
  {
    version: "1.2.26",
    date: "2026-03-11",
    changes: [
      {
        type: "feature",
        title: "Skip in Extra Study and Anki",
        description:
          "Skip now works in supported extra study sessions and Anki mode.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
      {
        type: "improvement",
        title: "Swipeable Detail Tabs",
        description:
          "You can now switch tabs by swiping in Radical, Kanji, and Vocabulary details.",
      },
    ],
  },
  {
    version: "1.2.25",
    date: "2026-03-10",
    changes: [
      {
        type: "feature",
        title: "More Vocabulary Audio Voice Modes",
        description:
          "Added Random and Both options for vocabulary autoplay voice selection.",
        link: {
          route: "/settings",
          label: "Open Settings",
        },
      },
      {
        type: "fix",
        title: "Constellation Radical Icons",
        description: "Fixed radical SVG fallback in constellation details.",
      },
    ],
  },
  {
    version: "1.2.24",
    date: "2026-03-09",
    changes: [
      {
        type: "feature",
        title: "Subject Lists",
        description:
          "You can now create and manage custom subject lists to use in extra study modes.",
        link: {
          route: "/settings",
          params: { scrollTo: "subjectLists" },
          label: "Open Settings",
        },
      },
    ],
  },
  {
    version: "1.2.23",
    date: "2026-03-08",
    changes: [
      {
        type: "feature",
        title: "Pitch Accent Visualization",
        description:
          "Added a pitch accent graph for vocabulary details and lesson pages, including accent type and downstep pattern.",
        link: {
          route: "/settings",
          params: { scrollTo: "vocabContext" },
          label: "Open Settings",
        },
      },
      {
        type: "feature",
        title: "Skip Reviews Setting",
        description:
          "Added an optional review setting to skip the current item (resets meaning/reading and moves it to the end).",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
      {
        type: "fix",
        title: "Notification Sync Crash on Some Devices",
        description:
          "Fixed a race condition in review badge/notification sync that could freeze navigation or crash the app on some non-iOS devices and iOS-on-Mac builds.",
      },
      {
        type: "improvement",
        title: "Extra Study Results",
        description:
          "Vocab Reading and Kana to Kanji now use the detailed review-style results screen with mistakes and item links.",
      },
      {
        type: "design",
        title: "Results Cards",
        description:
          "Now results show both reading and meaning. You can hide them to quickly re-quiz yourself on your mistakes.",
      },
      {
        type: "improvement",
        title: "Custom Study Queue Defaults",
        description:
          "Custom Review now defaults search to your current level range, and Custom Review/Lessons now respect review ordering and back-to-back settings.",
      },
      {
        type: "fix",
        title: "Vocabulary Audio Reading Filter",
        description:
          "Fixed hidden reading audio being picked and improved voice consistency.",
      },
    ],
  },
  {
    version: "1.2.22",
    date: "2026-03-07",
    changes: [
      {
        type: "improvement",
        title: "App loading improvements",
        description:
          "The app now loads faster.",
      },
    ],
  },
  {
    version: "1.2.21",
    date: "2026-03-06",
    changes: [
      {
        type: "feature",
        title: "Unguided Writing Test",
        description:
          "Added an unguided kanji writing mode that grades your answer only after you submit.",
        link: {
          route: "/writing-practice-config",
          label: "Open Writing Practice",
        },
      },
      {
        type: "fix",
        title: "Android UI Fixes",
        description:
          "Fixed several Android-only UI issues.",
      },
    ],
  },
  {
    version: "1.2.20",
    date: "2026-03-05",
    changes: [
      {
        type: "feature",
        title: "Review Ordering Settings",
        description:
          "Added a dedicated Review Order screen with multiple queue ordering modes, plus optional type grouping.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
    ],
  },
  {
    version: "1.2.19",
    date: "2026-03-04",
    changes: [
      {
        type: "feature",
        title: "Context Sentence Audio Playback Mode",
        description:
          "Added a new setting to choose manual or auto-play sentence audio in Context Sentence Practice (default is manual).",
        link: {
          route: "/context-sentence-practice-config",
          label: "Open Context Practice",
        },
      },
      {
        type: "feature",
        title: "Daily Lesson Limit",
        description:
          "Added a Lesson Settings option to cap how many lessons you can do per day.",
        link: {
          route: "/settings",
          params: { scrollTo: "lessons" },
          label: "Open Lesson Settings",
        },
      },
    ],
  },
  {
    version: "1.2.18",
    date: "2026-03-03",
    changes: [
      {
        type: "feature",
        title: "Listening Practice Audio Speed Control",
        description:
          "Added playback speed controls to listening questions (when Context Audio Speed Control is enabled in Settings).",
        link: {
          route: "/settings",
          label: "Open Settings",
        },
      },
      {
        type: "feature",
        title: "Context Sentence Practice Sentence Assist",
        description:
          "Added options to auto-play sentence TTS and hide translations until tap in Context Sentence Practice.",
        link: {
          route: "/context-sentence-practice-config",
          label: "Open Context Practice",
        },
      },
    ],
  },
  {
    version: "1.2.17",
    date: "2026-03-02",
    changes: [
      {
        type: "improvement",
        title: "Smarter Search",
        description:
          "Search now uses fuzzy matching and improved ranking in the Search tab.",
      },
    ],
  },
  {
    version: "1.2.16",
    date: "2026-03-01",
    changes: [
      {
        type: "fix",
        title: "Reading Autoplay Audio Coverage",
        description:
          "Autoplay vocabulary audio now works consistently in Recent Lessons Review and extra study reading sessions.",
      },
      {
        type: "fix",
        title: "Separate Meaning/Reading Notes on Subject Tabs",
        description:
          "Kanji and vocabulary detail pages now show note cards by tab: Meaning tab shows meaning notes and Reading tab shows reading notes, each saved independently.",
      },
      {
        type: "fix",
        title: "Kanji/Vocabulary Lesson Note Cards",
        description:
          "Lessons now support editable study notes: Meaning tabs show a meaning note card and Reading tabs show a reading note card for kanji and vocabulary.",
      },
      {
        type: "fix",
        title: "Kanji Lesson Similar Card Placement",
        description:
          "In kanji lessons, the Visually Similar Kanji section now appears directly under Radicals and above Stroke Order.",
      },
      {
        type: "feature",
        title: "Anki Mode Scope Selector",
        description:
          "Added a review setting to choose where Anki card mode applies: Both, Meaning only, or Reading only.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
      {
        type: "feature",
        title: "Hide Context Translations",
        description:
          "Added a vocabulary context setting to blur English translations in details and lessons until you tap to reveal.",
        link: {
          route: "/settings",
          label: "Open Settings",
        },
      },
      {
        type: "feature",
        title: "Context Sentence Audio Speed Control",
        description:
          "Added optional per-sentence playback speed controls for vocabulary context audio, including regular and media context sentences.",
        link: {
          route: "/settings",
          label: "Open Settings",
        },
      },
    ],
  },
  {
    version: "1.2.15",
    date: "2026-02-27",
    changes: [
      {
        type: "fix",
        title: "Lesson Review Autoplay Audio",
        description:
          "When vocabulary autoplay audio is enabled, lesson review questions now play pronunciation audio after a correct answer.",
      },
    ],
  },
  {
    version: "1.2.14",
    date: "2026-02-26",
    changes: [
      {
        type: "feature",
        title: "Voice Review Answers (Beta)",
        description:
          "New beta setting to answer review questions with speech recognition. Includes reading-focused recognition hints, stop-and-submit/retry controls while recording, and delayed auto-submit so detected answers remain visible briefly before grading.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
    ],
  },
  {
    version: "1.2.13",
    date: "2026-02-24",
    changes: [
      {
        type: "feature",
        title: "Pause on Correct Answer",
        description:
          "Added a new review setting to pause after correct answers and show accepted answers before moving on.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
      {
        type: "fix",
        title: "Recent Mistakes Hidden During Vacation Mode",
        description:
          "The dashboard now hides Recent Mistakes while vacation mode is active.",
      },
    ],
  },
  {
    version: "1.2.12",
    date: "2026-02-23",
    changes: [
      {
        type: "feature",
        title: "Level-Up Time Remaining",
        description:
          "Added expected time remaining to level up in the Level tab.",
      },
    ],
  },
  {
    version: "1.2.11",
    date: "2026-02-22",
    changes: [
      {
        type: "fix",
        title: "Context Sentence Cloze Matching",
        description:
          "Fixed cloze blanking for vocabulary forms that differ from sentence text, including entries with leading/trailing 〜 and common verb/adjective conjugations like 受かる → 受かった.",
      },
      {
        type: "fix",
        title: "Redesigned Stop on Wrong Popup",
        description:
          "The stop on wrong popup now shows a specific button to mark as incorrect.",
      },
    ],
  },
  {
    version: "1.2.10",
    date: "2026-02-21",
    changes: [
      {
        type: "feature",
        title: "Context Sentences Extra Study",
        description:
          "Added a new Extra Study mode that shows a sentence with one missing vocabulary word plus translation, and lets you answer in multiple choice or writing mode using WaniKani context sentences.",
        link: {
          route: "/context-sentence-practice-config",
          label: "Try Context Sentences",
        },
      },
      {
        type: "improvement",
        title: "Persistent Extra Study Configs",
        description:
          "All Extra Study mode settings now persist between sessions, and each mode keeps its own independent configuration.",
      },
    ],
  },
  {
    version: "1.2.8",
    date: "2026-02-20",
    changes: [
      {
        type: "feature",
        title: "Listening Practice Answer Mode",
        description:
          "Listening Practice now supports two vocabulary answer modes: multiple choice or writing. Writing mode requires Japanese keyboard switching and checks for the exact vocabulary form.",
        link: {
          route: "/listening-practice-config",
          label: "Open Listening Practice",
        },
      },
      {
        type: "fix",
        title: "Radical Lesson Synonyms",
        description:
          "In lessons, radical subjects now let you add and manage user synonyms directly from the first tab.",
      },
    ],
  },
  {
    version: "1.2.7",
    date: "2026-02-19",
    changes: [
      {
        type: "fix",
        title: "Accepted Answers Show User Synonyms",
        description:
          'When "Accept user synonyms as answers" is enabled, paused review cards now include your custom synonyms in the accepted meaning list.',
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
      {
        type: "improvement",
        title: "Clearer Review Input Placeholders",
        description:
          'Review answer fields now show "Your Response" for meaning questions and "答え" for reading questions.',
      },
    ],
  },
  {
    version: "1.2.6",
    date: "2026-02-17",
    changes: [
      {
        type: "feature",
        title: "Kana to Kanji Extra Study",
        description:
          "Added a new Extra Study mode where you see kana prompts and answer with vocabulary containing kanji. Kana-only vocabulary is excluded from this mode.",
        link: {
          route: "/kana-kanji-config",
          label: "Try Kana to Kanji",
        },
      },
      {
        type: "feature",
        title: "Auto Switch to Japanese Keyboard",
        description:
          "New setting to automatically switch to a Japanese keyboard for reading input, useful for kanji-focused study modes.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
    ],
  },
  {
    version: "1.2.5",
    date: "2026-02-16",
    changes: [
      {
        type: "feature",
        title: "Apple Music Sync Setting",
        description:
          "Added a new music playback setting to sync songs with Apple Music, including Apple Music login/refresh support in Settings.",
        link: {
          route: "/settings",
          label: "Open Music Settings",
        },
      },
    ],
  },
  {
    version: "1.2.4",
    date: "2026-02-15",
    changes: [
      {
        type: "feature",
        title: "Speech Recognition in Translator",
        description:
          "The speech recognition experience has been refreshed and integrated into the new Translator page, replacing the previous standalone flow.",
        link: {
          route: "/translator",
          label: "Try Translator",
        },
      },
    ],
  },
  {
    version: "1.2.3",
    date: "2026-02-12",
    changes: [
      {
        type: "feature",
        title: "App Usage Streak + Freeze",
        description:
          "New dashboard streak widget tracks daily app usage, adds a 1-per-7-days streak freeze with reload countdown, and includes the updated streak card visuals.",
      },
      {
        type: "improvement",
        title: "Tap to Copy Subject Characters",
        description:
          'Tap radical, kanji, and vocabulary characters in detail pages and lesson flow to copy them instantly, with a subtle animated "Copied!" tooltip confirmation.',
      },
    ],
  },
  {
    version: "1.2.2",
    date: "2026-02-11",
    changes: [
      {
        type: "feature",
        title: "Jitai Font Pool Management",
        description:
          "Choose exactly which fonts are used for randomized review text, and manage them from a dedicated Jitai fonts screen.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Open Review Settings",
        },
      },
      {
        type: "feature",
        title: "Downloadable Jitai Fonts",
        description:
          "Install additional Jitai fonts on demand and keep them saved locally, so the app bundle stays smaller.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Manage Fonts",
        },
      },
      {
        type: "improvement",
        title: "Quick Font Toggle During Reviews",
        description:
          "When Jitai is enabled, use the new icon under Wrap Up to temporarily show the default font for the current question, then switch back without re-rolling.",
      },
      {
        type: "fix",
        title: "Anki Autoplay Trigger Timing",
        description:
          "In Anki mode with vocabulary autoplay enabled, audio now plays when you reveal the answer instead of waiting until you tap Correct.",
      },
      {
        type: "improvement",
        title: "SRS Search Filtering",
        description: "Search and custom selection filters now show SRS.",
      },
    ],
  },
  {
    version: "1.2.1",
    date: "2026-02-10",
    changes: [
      {
        type: "feature",
        title: "AniList Sync",
        description:
          "Sync your AniList watched anime to filter Immersion Kit sentences. Works alongside MyAnimeList sync with reliable ID-based matching.",
        link: {
          route: "/immersion-kit-settings",
          params: { showSection: "anilist" },
          label: "Try AniList Sync",
        },
      },
      {
        type: "feature",
        title: "Niai Similar Kanji",
        description:
          "Switch to the Niai community database for visually similar kanji. Often more comprehensive than WaniKani's built-in data, especially for kanji that don't have similar kanji in WaniKani.",
        link: {
          route: "/settings",
          params: { scrollTo: "kanji" },
          label: "Try in Settings",
        },
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-02-09",
    changes: [
      {
        type: "feature",
        title: "Level Rewind",
        description:
          "Celebrate leveling up with an animated recap of your journey. See your time, accuracy, most missed items, star performers, and watch your radicals and kanji rain down.",
        link: {
          route: "/settings",
          params: { scrollTo: "levelRecap" },
          label: "View in Settings",
        },
      },
      {
        type: "feature",
        title: "Review Batch Size",
        description:
          "Limit how many reviews are loaded into each session. Choose a batch size from 5 to 100 to keep sessions manageable.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Enable in Settings",
        },
      },
      {
        type: "feature",
        title: "Listening Practice Auto-Play Toggle",
        description:
          "New setting to disable automatic audio playback between questions. Press play manually when you're ready.",
        link: {
          route: "/listening-practice-config",
          label: "Try Listening Practice",
        },
      },
      {
        type: "design",
        title: "Listening Practice Session Results",
        description:
          "Completely redesigned summary screen with detailed cards for each question — replay audio, see the anime screenshot, highlighted vocabulary in context, and your answers at a glance.",
      },
    ],
  },
  {
    version: "1.0.8",
    date: "2026-02-06",
    changes: [
      {
        type: "feature",
        title: "SRS Progression Indicator",
        description:
          "See your SRS level change in real-time when completing review items. Shows the new level and time until next review.",
      },
      {
        type: "improvement",
        title: "Smooth Lesson Navigation",
        description:
          "Swipe between lesson subjects with smooth transitions. When on the last tab, swiping continues to the next subject seamlessly.",
      },
      {
        type: "feature",
        title: "Single Page Lesson View",
        description:
          "New opt-in setting to display all lesson content in one scrollable page instead of tabs.",
        link: {
          route: "/settings",
          params: { scrollTo: "lessons" },
          label: "Enable in Settings",
        },
      },
    ],
  },
  {
    version: "1.0.7",
    date: "2026-02-05",
    changes: [
      {
        type: "feature",
        title: "Customizable Tab Bar",
        description:
          "Choose which tabs to show in your navigation bar. Show Items and Analytics as separate tabs, or keep them grouped in the Level tab.",
        link: {
          route: "/tab-settings",
          label: "Customize Tabs",
        },
      },
    ],
  },
  {
    version: "1.0.6",
    date: "2026-02-04",
    changes: [
      {
        type: "feature",
        title: "Follow System Appearance",
        description:
          "New theme option to automatically switch between light and dark mode based on your device settings.",
        link: {
          route: "/settings",
          label: "Try it in Settings",
        },
      },
      {
        type: "fix",
        title: "Lesson Quiz Repeating Questions",
        description:
          "Fixed a bug where questions would repeat indefinitely during lesson quizzes, even when answered correctly.",
      },
    ],
  },
  {
    version: "1.0.5",
    date: "2026-02-03",
    changes: [
      {
        type: "feature",
        title: "Stroke Strictness Setting",
        description:
          "Customize how strict stroke recognition is during writing practice.",
        link: {
          route: "/settings",
          params: { scrollTo: "kanji" },
          label: "Adjust in Settings",
        },
      },
      {
        type: "feature",
        title: "Back-to-Back Questions",
        description:
          "Skip the result screen and jump straight to the next question for faster review sessions.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Enable in Settings",
        },
      },
      {
        type: "feature",
        title: "Context in English→Japanese Quiz",
        description:
          "Now shows context sentences when practicing from English to Japanese.",
      },
      {
        type: "fix",
        title: "Cache Reliability",
        description:
          "Fixed issues that could cause cached data to become corrupted.",
      },
    ],
  },
  {
    version: "1.0.4",
    date: "2026-02-02",
    changes: [
      {
        type: "feature",
        title: "Katakana Madness",
        description:
          "Display on'yomi readings in katakana instead of hiragana for a more authentic experience.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Enable in Settings",
        },
      },
      {
        type: "feature",
        title: "Kanji Writing Practice",
        description:
          "Practice writing kanji with stroke order guidance and handwriting recognition.",
        link: {
          route: "/writing-practice-config",
          label: "Try Writing Practice",
        },
      },
    ],
  },
  {
    version: "1.0.3",
    date: "2026-01-31",
    changes: [
      {
        type: "feature",
        title: "User Synonyms",
        description:
          "Add your own synonyms to vocabulary items for more personalized learning.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Configure in Settings",
        },
      },
      {
        type: "fix",
        title: "Empty Review Card",
        description:
          "When there are no reviews left, show time till next review.",
      },
    ],
  },
  {
    version: "1.0.2",
    date: "2026-01-30",
    changes: [
      {
        type: "feature",
        title: "Recent Mistakes Widget",
        description:
          "New dashboard widget showing your recently missed items for quick review.",
      },
    ],
  },
  {
    version: "1.0.1",
    date: "2026-01-29",
    changes: [
      {
        type: "feature",
        title: "Customizable Lesson Batch Size",
        description:
          "Choose how many lessons to do at once to match your learning pace.",
        link: {
          route: "/settings",
          params: { scrollTo: "lessons" },
          label: "Adjust in Settings",
        },
      },
      {
        type: "feature",
        title: "Disable Auto-Progress on Wrong",
        description:
          "Option to manually advance after wrong answers for more thorough review.",
        link: {
          route: "/settings",
          params: { scrollTo: "reviews" },
          label: "Enable in Settings",
        },
      },
      {
        type: "design",
        title: "Improved Input UI",
        description:
          "Redesigned answer input based on user feedback for better usability.",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-01-28",
    changes: [
      {
        type: "feature",
        title: "Stroke Order Animation",
        description:
          "See animated stroke order for kanji to learn proper writing technique.",
      },
      {
        type: "fix",
        title: "Immersion Kit Anime Selection",
        description:
          "Fixed issues with selecting animes for context sentences.",
      },
      {
        type: "fix",
        title: "Cache Improvements",
        description: "Improved data caching for better offline experience.",
      },
    ],
  },
];
