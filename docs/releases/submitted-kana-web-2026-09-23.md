# Submitted kana — 23 September 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_619icn3rJN3gJtFCyCftphNrh6aJ`
- Immutable URL: https://kakehashi-3jkoy5f2t-portego-00s-projects.vercel.app
- Previous production: `dpl_DiuACFKgVvFbEbrrBDi6UbWaar9B`

Typed kana retains unfinished syllables while editing: `chian` displays `ちあn`. Submitting now finalizes the input to `ちあん`, and the field and answer checker both receive that value. Applied to WaniKani, Bunpro, custom SRS, and typed kana practice questions. English meaning and multiple-choice answers retain their existing behavior. Bunpro also retains the finalized value for save-error restoration.

Validation: six component regressions reproduced the original mismatch before the fix. The four component suites passed (251 tests), including correct and incorrect results and unchanged English meaning input. All three kana helper tests passed after correcting a punctuation expectation to match the existing converter. TypeScript and scoped lint passed. Two browser tests verified real typing and submission for WaniKani and Bunpro. Three guarded production browser checks passed: trailing-n submission and the details shortcut at two desktop widths. Account writes were mocked or blocked.

The release was reconstructed from verified production source, with only this task's changes merged in. Ten existing files changed, one test file was added, and none were removed. All 1,092 uploaded file hashes match the tested snapshot. The staged build reached READY and login returned HTTP 200. Production remained on the expected previous deployment before promotion; the canonical domain now resolves to the new READY deployment.

Evidence: `output/submitted-kana-2026-09-23/`. Tested source: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-kana-release-ib46gr3u`. Uploaded snapshot: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-kana-deploy-uvw1wxh4`.
