# Anki answer layout regression

Run from the repository root:

```sh
sh scripts/anki-answer-layout/run.sh
```

Requires installed repository dependencies, Node.js, CMake, and a C++20 compiler
(Xcode Command Line Tools on macOS). It builds the Yoga sources bundled with
React Native; it installs no packages and removes its temporary build directory.

The harness reads the current `ReviewQuestionScreen.tsx` style objects and sizing
condition, and checks that the sizing overrides are attached to the prompt and
card. It models the prompt ScrollView's flexible content wrapper and measured
character child, native ScrollView defaults, and Yoga's native errata.

Before reveal, in both standard and buttonless mode, the character must be
centered in the space above the answer banner. Revealing a taller answer/pitch
panel must move the character upward. These checks use the source's actual
reveal condition rather than assuming when sizing styles apply.

In a 390 × 600 pane, answers of 120 and 260 points must fit without scrolling;
a 650-point answer must scroll while keeping the 120-point prompt visible and
the card inside the pane. Short context hints must fit; long hints must respect
their scroll-region limit while leaving space for the answer. Text/composition
content is represented by deterministic heights, so this checks native flex
layout rather than font rendering, touch interaction, revealed buttonless mode,
or screenshot appearance. A failure exits 1.
