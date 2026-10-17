# Anki answer layout regression

Run from the repository root:

```sh
sh scripts/anki-answer-layout/run.sh
```

Requires installed repository dependencies, Node.js, CMake, and a C++20 compiler
(Xcode Command Line Tools on macOS). It builds the Yoga sources bundled with
React Native; it installs no packages and removes its temporary build directory.
If macOS has mismatched Xcode and Command Line Tools SDKs, select Xcode's SDK:

```sh
SDKROOT="$(xcrun --sdk macosx --show-sdk-path)" sh scripts/anki-answer-layout/run.sh
```

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
the card inside the pane. Context hints fill all available space above the card
before reveal; long hints scroll while leaving space for the answer. Context
hints yield space as the answer expands, retaining a 120-point subject viewport. Crowded
600- and 480-point panes include three metadata chips (104 points) and pinned
Replay controls (42 points). The metadata overlays the sentence viewport above
the banner; its measured height is reserved around the subject and at the end
of the scrolling content. Sentences must remain visible beside the chips, and
the answer must use the remaining available height.
Text/composition
content is represented by deterministic heights, so this checks native flex
layout rather than font rendering, touch interaction, revealed buttonless mode,
or screenshot appearance. A failure exits 1.
