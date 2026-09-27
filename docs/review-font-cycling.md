# Mobile review font cycling

With **Jitai (Font Randomizer)** enabled, the font button on a character review
normally switches between the question's initially randomized font and Source Han
Sans JP. The original font stays the same when switching back.

To cycle through all selected fonts, open **Settings → Review Settings → Advanced
settings** and enable **Cycle through all Jitai fonts** under Jitai. This setting
is off by default, including for existing users, and is saved between sessions.
When enabled, the button cycles through:

1. The question's initially randomized font.
2. Source Han Sans JP, unless it was already the initial font. It remains available
   here even when it is excluded from the randomizer's selection.
3. Every remaining selected font in selection order, without duplicates.
4. Back to the initial font.

Selected bundled, downloaded, and imported fonts participate. Downloaded fonts
must finish loading successfully before they can be displayed. Tapping the font
button while they load immediately shows Source Han Sans JP. Cycling preserves
the question's initial random choice. Submitting an answer or moving to another
question resets the cycle position.

The button is available for character prompts while Jitai is enabled. Audio and
text override prompts retain their existing behavior.

## Validation

The component tests cover both toggle modes, cycle order, wrapping, Source Han Sans starting first
or being unselected, downloaded and imported fonts, loading failures, and disabled
randomization. The review screen tests exercise the button and question resets.
The settings tests cover advanced visibility, the default, persistence, and
loading settings saved before this option existed.

```sh
npm test -- --runInBand --runTestsByPath src/components/__tests__/ReviewPromptCharacters.fonts.test.tsx src/components/__tests__/ReviewQuestionScreen.submissionOccurrence.test.tsx src/utils/__tests__/jitaiFonts.test.ts src/features/settings/sections/__tests__/ReviewSettingsSection.jitai.test.tsx
```
