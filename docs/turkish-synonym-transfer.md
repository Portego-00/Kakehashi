# Optional Turkish synonym transfer

Settings → Appearance → Add Turkish synonyms to WaniKani opens a separate account
workflow. Display supports other languages; account transfer currently supports
Turkish only because normalization and duplicate comparison use Turkish casing.
An imported v3 package must declare display-and-synonyms and explicit reviewed
synonymAnswers. Primary/alternative display meanings are never inferred as answers.
Legacy packages and other languages remain display-only.

Choose levels, radical/kanji/vocabulary types and learning/unstarted/burned states.
Review the paginated preview and deselect any topic or answer. Already-present
answers are not selected; topics without new answers are hidden by default.
The final confirmation summarizes all selected pages and the account. Preview
fetches fresh subjects and study materials but does not write. It needs a token
with study-material creation/update permissions to perform a confirmed transfer.

The app does not certify the linguistic correctness of imported answers. The
publisher's review marker is not a trust boundary. Users must inspect suggestions
before accepting them. Answer grading continues to use the normal WaniKani/user
synonym behavior; there is no arbitrary local JSON answer acceptance path.

Confirmed writes are serialized and recheck account, current source, study state,
package identity and allowed selections. Existing synonyms are preserved. A local
account-scoped journal records receipts before moving to the next item. Pause
stops between writes; resume after restart requires user action. Changing the
account or package blocks further additions until a fresh preview is confirmed.

Undo removes only additions confirmed by this journal, preserves other personal
synonyms and cancels unprocessed work. Uncertain writes are blocked rather than
treated as proven additions to remove. Undo is journal-based and does not require
the original imported package. Concurrent external edits to the same synonym are
inherently ambiguous; inspect the result when using multiple clients.

All automated transfer checks use mocked API calls. No actual account transfer
was performed while preparing this PR. The earlier personal prototype was tested
by its user for pause/resume and undo; the newly isolated upstream branch still
needs maintainer/device review before release.
