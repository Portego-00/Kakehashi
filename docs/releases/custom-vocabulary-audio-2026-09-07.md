# Custom vocabulary audio — 2026-09-07

Published at **2026-09-07T20:10:59.841Z**: 565 Shizuka recordings across 49 packs, totaling **19,144,323 bytes**. All 565 were newly uploaded to the public `custom-vocabulary-audio` bucket in project `zcvoxqcvobgvcwcrqytz`.

The [publication manifest](../../web/src/features/custom-srs/audio-publication.generated.json) identifies every selected recording by vocabulary ID, reading, byte size, immutable object path, and SHA-256. Its release SHA-256 is `5cd1700860553382d3fb23fe2c2663a076f967393271455256cf28ba53de6da0`. The [generation manifest](../../research/data/custom-vocabulary-audio-manifest.json) remains unchanged, with SHA-256 `1cefe8b45feb10f5c8d6340d0bee264a08d94ab347bbc32b03f168b2113a49af`.

## Verification and selected corrections

- Every public object was downloaded without credentials and verified against its exact local hash, size, `audio/mpeg` content type, and one-year cache policy.
- Independent checks matched all 565 manifest entries and sampled the four corrected words plus two retained originals.
- The corrections selected for 一喜一憂, 冷凍, 登頂, and 冠婚葬祭 use reviewed Shizuka v3 takes. The approved original recordings for 洞察 and 包装 were retained.
- Web playback of どうぞ displayed Shizuka, used the exact public MP3, and played to completion without an audio error. This was a playback check, not a pronunciation certification.
- Existing storage policies were inspected before upload. No application table, database function, storage policy, paid plan, or add-on was changed by publication. No production app deployment was performed.

The owner accepted the six flagged selections and the remaining screened batch. This does not assert individual human listening to all recordings or native/pitch-accent certification. Publication relied on owner confirmation, not independent verification of a provider license grant. The [hosting guide](../custom-vocabulary-audio-hosting.md#release-state-and-rights) records the outstanding commercial-licensing requirements.

Full receipts, exact-hash approvals, transcripts, candidates, and original backups are retained in the private operator archive under `output/custom-vocabulary-audio/`, outside Git. These are not shipped to clients. The public bucket contains only the selected MP3s; preserve a separate backup of the source archive.
