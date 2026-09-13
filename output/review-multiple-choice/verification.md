# Multiple choice verification

Tested on September 4, 2026, using the running iPhone 17 Pro simulator (iOS 26.3) and the current Metro bundle.

The simulator was signed out, so a temporary local harness rendered the actual ReviewQuestionScreen and ReviewSettingsSection with sample vocabulary and the real settings store. The harness was removed afterward, and its catalog and review preferences were restored.

Verified in the simulator:
- Enable multiple choice from the review screen and see four related kana options.
- Select a correct reading and advance once.
- Select an incorrect reading, see the correction controls, and mark it incorrect. Accuracy updates correctly.
- Answer a meaning question using related school vocabulary.
- Display choices in light and dark appearance.
- Keep the prompt visible at 300% app text size while the answer list scrolls.
- Disable multiple choice in Review Settings, return to typing, enter gakkou, and grade the converted がっこう correctly.
- Enable Anki alongside multiple choice; reveal and self-grade with the original Anki controls.

Automated validation: 20 tests passed across the review component, choice generation, and independent setting behavior. ESLint passed for all changed source and test files. The full repository type check still reports existing errors outside the changed files; it reports no errors in the implementation files.

Choice generation excludes alternate readings, meanings, whitelist meanings, and user synonyms from distractors. If four plausible options cannot be produced from local data, the question falls back to typing with an explanation. Custom questions requiring Japanese characters or custom accepted readings continue using their existing input.

Screenshots include the temporary simulator QA toolbar:
- reading-light.png
- meaning-dark.png
- settings-dark.png

Earlier Portego-only follow-up (superseded September 5): reused isPortegoUsername for both the settings row and review-screen availability. Verified with simulated Portego, Other, and signed-out identities on the iPhone simulator. All 17 targeted access/review/settings tests and ESLint passed. The temporary identity harness was removed after testing.

September 5 public availability and panel polish:
- Removed the username restriction from the settings toggle and review screen.
- Added Multiple Choice Reviews to the current 1.4.9 patch notes.
- Kept the four answer cards unchanged and placed them on a white/light or black/dark background directly under the meaning/reading header, with rounded lower corners matching Anki.
- Verified reading and meaning panels in both light and dark appearance on the iPhone 17 Pro simulator (iOS 26.3), using the current Metro bundle and a temporary fixture route rendering the real components.
- Verified the settings toggle while signed out, switching to typing and back, correct reading grading, incorrect meaning grading, and scrolling to the fourth card at 300% app text size while the prompt stays visible.
- All 25 tests passed across review behavior, choice generation, setting persistence, and patch notes. Targeted ESLint and whitespace checks passed.
- Restored the simulator catalog, review preferences, and theme, then removed the temporary route.

Current screenshots (include the temporary simulator QA toolbar): panel-reading-light.png, panel-meaning-dark.png, public-settings-dark.png, and panel-large-text.png.
