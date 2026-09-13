# Vocabulary filter — native UI validation

Tested September 7, 2026 on an iPhone 17 Pro simulator running iOS 26.3, using the installed development build with the current application code.

The real Search, subject-list, LessonPicker, and note-linking components were exercised with a temporary local catalog of 22 subjects. Data/auth imports were temporarily replaced for these screens because the simulator was logged out. The temporary route, fixtures, and import replacements were removed afterward. No account or list changes were saved.

| Surface | Verified behavior |
| --- | --- |
| Search | Proper noun returns Japan and Tokyo; adding verbal noun also includes Study and Exercise; the Tokyo text query with proper noun returns Tokyo alone. Cancelling a pending clear preserves the four applied results. |
| Subject list — Browse | Proper noun shows Japan and Tokyo, with the active filter indicator and filtered bulk-action label. |
| Subject list — In List | The same selection shows Japan and Tokyo; clearing and applying restores the full list, including radicals and kanji. List membership stays at 22. |
| Lesson picker | Proper noun shows Japan and Tokyo. Select All produces “Start 2 Lessons.” No session was started. |
| Note subject linking | Proper noun shows Japan and Tokyo as link choices with an empty text query. No link was saved. |
| Keyboard | Type search, option selection, and dismissal tested using the iPhone software keyboard. Search now scrolls the type selector into view; the note dialog now stays above the keyboard. |

Two UI issues found during the run were fixed and visually retested: crowded Search options while typing, and the note filter dialog being covered by the keyboard.

After removing the temporary fixtures, all 23 focused tests across six suites passed, as did scoped ESLint and the whitespace check. The simulator's original pasteboard-sync and hardware-keyboard settings were restored; the temporary development server was stopped.

This run covers iOS native UI with sample data. Android, iPad, and live account synchronization were not exercised in this simulator pass. Web desktop and mobile browser checks were completed separately before this pass.

Screenshots:

- [Search: two selected types](search-two-types.jpg)
- [Search with the software keyboard](search-keyboard.jpg)
- [Subject list: proper nouns](list-proper-nouns.jpg)
- [Lesson picker: two selected lessons](lessons-proper-nouns.jpg)
- [Note linking: proper nouns](notes-proper-nouns.jpg)
- [Note dialog above the keyboard](notes-keyboard.jpg)
