# Optional translation packages

Settings → Appearance → Advanced settings → Translation package → Import translation file.
Review the package language, version and item counts, then choose Use this package.
Activation replaces the current package; files are not merged. Disable the switch
to show English, or remove the package to delete its local copy. No package is
bundled or downloaded automatically. App UI and answer grading remain unchanged.

## Format and matching

`translation-packages/example-tr-v3.json` is a small Turkish example; the JSON
schema describes format v3. Display accepts language identifiers such as `tr`,
`fr`, `pt-BR` and `zh-Hant`. Other languages preserve author casing; Turkish
meaning labels use Turkish initials. Format v1/v2 imports remain display-compatible.
The parser in `src/features/translation-packages/resolver.ts` is authoritative.

Each subject is keyed by WaniKani ID and includes its original type, characters,
English meanings and Japanese readings. These fields must match the live subject
before translations appear. Image-only radicals use null characters in v2/v3.
Examples match both original Japanese and English text, independent of order.
Only entries marked editorial-reviewed are displayed; the marker is a publisher
claim, not an app verification of translation accuracy or a digital signature.
Source hashes are metadata, not a substitute for matching the actual source.

Files are limited to 20 MB, 12,000 subjects and 40,000 examples. Imports are
validated before chunked storage and atomic activation. A malformed file or failed
activation leaves the previous package active. Missing, draft or source-mismatched
translations fall back to English. Optional mnemonic and hint fields require
format v4; v1–v3 packages retain their existing behavior.

## Display coverage

Meaning and example sections in subject details and lessons; related radical,
kanji and vocabulary cards; reading examples; similar kanji; lesson List View;
Items, subject lists, critical/burned/unlocked lists and review result cards use
the package. Detail meanings reveal original English inline on request. Compact
lists use the translated primary meaning without an extra toggle. Sentence
translation and usage explanation are separate; original English is optional.

## Optional mnemonic fields (format v4)

Format v4 adds an optional `mnemonics` object to each subject. The independently
optional keys are `meaningMnemonic`, `readingMnemonic`, `meaningHint` and
`readingHint`. Each contains the exact original `source` string (including markup),
its metadata `sourceSha256`, the `translation` and `reviewStatus`. See
`translation-packages/translation-package-v4.schema.json`. Radical and kana
vocabulary entries cannot have reading fields. The runtime parser is authoritative.

Only editorial-reviewed fields with an exact current source and matching subject
identity, meanings and readings appear. Each field falls back independently.
Hashes are metadata, not signatures. No mnemonic translations are bundled.
Older applications must continue to receive v3 files until they support v4.

For example, a subject may contain only a meaning mnemonic:

```json
{
  "mnemonics": {
    "meaningMnemonic": {
      "source": "The exact original mnemonic, including its tags.",
      "sourceSha256": "<SHA-256 of the original UTF-8 text>",
      "translation": "The translated mnemonic, with its relevant tags preserved.",
      "reviewStatus": "draft"
    }
  }
}
```

This is an authoring sketch, not an importable package or reviewed content. Use
the real original and its 64-character lowercase checksum. Keep translations and
their second review separately in the author's working data before publishing
an `editorial-reviewed` field. A missing field is preferable to an empty placeholder.

Subject details, lesson sections, the legacy subject tabs and expanded radical
components use their existing text renderers and mnemonic tag colors. A translated
section can switch to its original English in the same place. Personal notes,
mnemonic illustrations, third-party stories and answer grading are untouched.
Importing a v4 package does not authorize account writes; optional synonym transfer
retains the existing explicit confirmation workflow.

Package authors should preserve `<radical>`, `<kanji>`, `<vocabulary>`, `<reading>`,
`<ja>` and `<em>` markup. These are native text tokens, not executable HTML. A
changed original requires a new review; do not translate or replace raw API data.

## Account changes are separate

Importing or enabling a package does not write to WaniKani and does not locally
accept imported translations as correct review answers. The additional Turkish
synonym transfer workflow is documented separately. Its code is a separate commit
so the display feature can be reviewed independently.

## Tests

Run the project's Jest setup with:

```sh
npx jest --runInBand --testPathPattern="src/features/translation-packages/__tests__" --testPathIgnorePatterns="/output/"
```

Legacy compatibility fixtures are test data, not runtime imports. The small v3
example exercises radical, image-only radical, kanji, vocabulary and kana records.
Tests cover other package languages, exact source matching, fallback, activation
failure, restart persistence, inline originals and explicit account writes.

## Opt-in boundary

Translations default to off. Importing a file only previews it; choosing **Use this package** activates it on this device. Turning it off keeps the file but restores the existing English text and layouts. The settings entry remains available to opt in later.

Study screens do not hydrate packages while disabled. Summary lists validate against the complete subject that produced each current item, without loading a separate catalog snapshot. Review grading, scheduling, existing manual synonym saves, and Bunpro flows retain their existing behavior.
