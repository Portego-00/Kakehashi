# Private vocabulary libraries

Users with custom SRS access can open **Custom vocabulary → Create or import vocabulary**, create a private deck, and add words or import UTF-8 CSV/TSV. New words enter lessons automatically and use the account’s scheduling settings (WaniKani-style by default).

The editor supports spelling, reading, multiple accepted meanings, parts of speech, meaning/reading notes and up to five bilingual example sentences. Imports provide column mapping, row validation, duplicate detection and a preview before saving. A downloadable template is included. Separate alternative meanings with `|`. Kanji words require a reading; kana-only words can omit it. Imports contain text only, not audio or images.

Limits: 100 decks and 10,000 words per account, including archived words; 1,000 rows and 2 MB per import. Duplicate spelling/reading pairs are skipped within a deck, including archived words. Reading comparison normalizes katakana/hiragana and Unicode width. Editing definitions preserves SRS progress; archiving removes words from queues and restoring resumes existing progress.

## Storage and privacy

This uses existing Supabase infrastructure, with separate account-owned definition rows rather than embedding the entire dictionary in every SRS write. Reads synchronize changed rows in pages of 200 and cache them in account-scoped IndexedDB. Study state remains in the existing SRS account and assignment tables. Large local progress outboxes are compressed; reload older open tabs after upgrading.

All API requests validate the sealed WaniKani session and existing custom-SRS access gate. Client account IDs must match that session. Tables have RLS enabled and no direct anonymous/authenticated grants; service-role RPCs enforce account ownership. Definitions and SRS enrollment change atomically. Revision checks prevent stale overwrites, and event IDs make retries idempotent. No dictionary content is sent to third-party generation services.

## Release

Apply `20260919000000_custom_srs_settings.sql` first, then `20260920000000_personal_vocabulary.sql`, and deploy the web changes. Use the existing Supabase server URL and service-role configuration. These migrations have not been applied to production by this implementation.

The existing feature rollout gate is preserved. Library management and studying private decks are implemented for the web app. Native clients preserve the added assignment fields but do not yet display the private library catalog.

## Validation

`npm --prefix web run test:custom-srs-db` exercises the real migration SQL in PGlite: atomic creation, ownership, duplicate detection, retry identity, stale updates, rollback, edit/archive/restore progress preservation and paginated reads. Vitest covers parsing, import/editor interactions, pagination validation, large outbox persistence, API authorization and the shared SRS behavior.
