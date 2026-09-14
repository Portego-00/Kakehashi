# Anki answer layout regression

Run from the repository root:

```sh
sh scripts/anki-answer-layout/run.sh
```

Requires installed repository dependencies, Node.js, CMake, and a C++20 compiler
(Xcode Command Line Tools on macOS). It builds the Yoga sources bundled with
React Native; it installs no packages and removes its temporary build directory.

The harness reads the current `ReviewQuestionScreen.tsx` style objects and checks
that the revealed sizing overrides are attached to the prompt and card. It models
the standard revealed Anki layout with and without context hints, including the prompt's
flexible content wrapper, native ScrollView defaults, and Yoga's native errata.

In a 390 × 600 pane, answers of 120 and 260 points must fit without scrolling;
a 650-point answer must scroll while keeping the 120-point prompt visible and
the card inside the pane. Short context hints must fit; long hints must respect
their scroll-region limit while leaving space for the answer. Text/composition content is represented by deterministic
measured heights, so this checks native flex layout rather than font rendering,
touch interaction, buttonless mode, or screenshot appearance. A failure exits 1.
