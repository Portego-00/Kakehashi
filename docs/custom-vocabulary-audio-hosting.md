# Custom vocabulary pronunciation hosting

## Setup verified on 2026-09-07

**Public upload completed at 20:10:59 UTC on 2026-09-07:** 565 newly uploaded MP3s / 49 packs / 19,144,323 bytes, including the four owner-approved corrections. Every object passed full unauthenticated public hash, size, MIME and cache verification. The app publication index now contains all 565 verified recordings. [Release summary](releases/custom-vocabulary-audio-2026-09-07.md). No app production deployment was performed.

Post-publication checks passed: all 565 index entries match the catalog and audited local recordings; six independently sampled public downloads match the approved bytes; 51 web and 24 native audio integration tests pass; web typecheck passes. The local web どうぞ details page displayed Shizuka and completed one playback of its exact public Supabase MP3 without an audio error. This verifies playback, not a pronunciation judgment.

The `custom-vocabulary-audio` bucket was created and read back in the existing linked project `zcvoxqcvobgvcwcrqytz`. Its public setting, MP3-only type restriction, and 1 MiB per-file cap match the configuration below. No other bucket, application table, database function, or RLS policy was modified. No paid plan, new project, or add-on was enabled.

A read-only query through the project's SQL Editor reverified live `storage.objects` security at **19:55:50 UTC**, immediately before publication. The exact query and results are retained in the private operator archive at `output/custom-vocabulary-audio/qa/storage-security-2026-09-07T195550Z.md`:

- Row-level security is enabled.
- Neither `anon` nor `authenticated` bypasses RLS.
- All six existing policies are explicitly limited to `issue-media` or `manga-ocr-source`; none grants a client access to write, update, delete, or list this audio bucket.
- The audio bucket contained **zero objects before upload**. No policies were changed during this inspection.

This is a point-in-time inspection, not a permanent guarantee: recheck policies if storage permissions change. No write probe or disposable object was needed.

Web and native playback are implemented against the shared publication index. Local development origins are configured in ignored environment files. For a deployed web build set `NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL`; for an Expo build/update set `EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL`, both to `https://zcvoxqcvobgvcwcrqytz.supabase.co`. These are public origins, not credentials. They are bundled at build time, so a rebuild/update is required after changing them. No production app deployment was performed.

The web player loads only on playback, with existing autoplay settings respected. The native playback adapters reuse the managed disk cache and provide an opt-in prefetch helper capped at 20 words for future custom-session integration. Adding the native pack/session screens is separate from this audio release. No entire-library download runs in the background, and custom subjects are not inserted into WaniKani's queues or subject index.

## Design and cost

Reuse the existing Supabase project and its Storage CDN. The dedicated public bucket is `custom-vocabulary-audio`; the app reads a small, generated publication index and plays public MP3 URLs directly. There is no new database table, RPC, Edge Function, application-server proxy, signed-URL service, or per-play authenticated API call.

The current local collection is **565 MP3s / 49 packs / 19,144,323 bytes (19.14 MB)**. That is about 33.88 KB per word on average. Only the chosen per-word MP3s belong in Storage—not sidecars, candidate takes, transcripts, local audits, or original-download backups.

Objects use immutable, content-addressed paths:

```text
v1/<pack-id>/<word-id>/<sha256-of-mp3-bytes>.mp3
```

Each upload is `audio/mpeg`, with `Cache-Control: max-age=31536000`. Approved corrections get a new hash/path and a new index entry, never an overwritten cached object. This follows Supabase's recommendation to use new paths when replacing content. [Standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)

Public CDN URLs have no read-authorization checks and can share cache hits across users. Browser caching reduces repeated downloads; CDN caching alone does **not** make bandwidth free. The app should load audio when played, not fetch all packs on the dashboard. Both browser and CDN caches may evict content. [Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals), [browser-cache optimization](https://supabase.com/docs/guides/storage/production/scaling)

Storage volume is small; traffic is the variable to watch. For illustration, 1,000 fresh downloads of the entire current collection would transfer about **19.14 GB**, before protocol overhead and excluding any cache reuse. No account quota, remaining allowance, paid-plan purchase, or guaranteed zero-cost claim is assumed. Check the existing organization's usage and cached/uncached egress meters as adoption grows. [Bandwidth and storage egress](https://supabase.com/docs/guides/storage/serving/bandwidth)

## Release state and rights

The owner approved the four presented takes and chose public release in response to the rights-qualified question. The private operator archive retains the exact-hash release record at `output/custom-vocabulary-audio/public-release-approval-2026-09-07.json`, including the distinction between owner attestation and independently verified licensing. The app must not synthesize unverified URLs or show broken playback controls: its publication index is updated only after verified upload.

ElevenLabs Free-plan output is not commercially licensed. Upgrading later does not retroactively license existing output. Before a commercial/production release, regenerate under terms that permit the intended use (including checking any voice/model/Beta restrictions), or obtain explicit rights covering the exact recordings. Do not spend credits, purchase a plan, or manufacture approvals merely to bypass this gate. [ElevenLabs publishing and licensing](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform)

Every selected audio file needs the release owner's quality acceptance bound to its SHA-256 hash. The owner accepted six flagged selections (two retained originals and four replacement takes), and accepted the other 559 as part of the screened batch. This is not a claim of individual listening to all 565 recordings. Automated transcription is useful screening, not native-pronunciation or pitch-accent certification. The private operator archive's `qa/public-release-qa-2026-09-07.md` binds each current file to the applicable evidence; the earlier listening queue remains historical evidence.

## Repository and backups

Commit the app integration, `audio-publication.generated.json`, source manifest, operator scripts/tests, and concise release summary. Do not commit generated MP3s, candidate takes, original-download backups, sidecars, transcripts, or private approval records. The entire `output/custom-vocabulary-audio/` directory is intentionally ignored; keep it backed up separately. Supabase contains only the selected public recordings, not the complete source/QA archive.

A fresh checkout can run the audio unit tests without this local directory. Generation, auditing, and publishing are explicit operator workflows that require the local recordings and evidence; an absent archive is not a reason to regenerate or spend credits automatically.

## Bucket configuration and security

The create-only setup operation requires:

```json
{
  "id": "custom-vocabulary-audio",
  "name": "custom-vocabulary-audio",
  "public": true,
  "allowed_mime_types": ["audio/mpeg"],
  "file_size_limit": 1048576
}
```

The 1 MiB per-object cap comfortably fits short vocabulary clips and rejects accidentally selected large files. Supabase enforces configured bucket size/type restrictions. [Bucket configuration](https://supabase.com/docs/guides/storage/buckets/creating-buckets)

Public here means anyone with the URL may play/download the shared recording. It does not mean clients should be able to upload, overwrite, delete, or list objects. Before release, inspect the project's existing `storage.objects` policies for broad grants that also match this bucket. Storage denies client writes by default without a policy, but a pre-existing bucket-independent policy could already allow them. This tool does not inspect or rewrite RLS policies and makes no assumption that the project's defaults are intact. Do not apply broad policy changes that could disrupt other buckets. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

The publisher runs only as an operator command. It reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from its environment; never put the service/secret key in `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, app source, browser state, a committed `.env`, the approval file, command-line arguments, or logs. Use the established secure operator environment to provide it. The tool accepts a service-role JWT or a modern `sb_secret_` key, not a public/anonymous key. It restricts privileged requests to the exact HTTPS `<project-ref>.supabase.co` origin specified separately by the operator and rejects redirects. Public verification requests contain no API key, Authorization header, or cookies.

## Operator workflow

Run from the repository root with Node.js 20 or newer. No additional package installation is required.

### 1. Local dry-run (the default)

```sh
node research/publish-custom-vocabulary-audio.mjs
```

This performs **zero network requests and zero file writes**. It validates the source manifest, requires a matching complete strict decode audit, reads only the selected canonical MP3s, hashes their current bytes, checks each approval, and prints a compact count/size/blocker summary. With no approval supplied it correctly reports 565 checked / 0 approved / 565 blocked; with the current explicit owner-approval file it reports 565 approved / 0 blocked.

The default files are:

- Source identities: `research/data/custom-vocabulary-audio-manifest.json`
- Exact-file integrity evidence: `output/custom-vocabulary-audio/audio-audit.json`
- Audio root: `output/custom-vocabulary-audio/split audios`
- Published index: `web/src/features/custom-srs/audio-publication.generated.json`

After generating or replacing any file, refresh the strict local audit before attempting publication:

```sh
node research/audit-custom-vocabulary-audio.mjs \
  --audio-dir "output/custom-vocabulary-audio/split audios" \
  --strict \
  --report output/custom-vocabulary-audio/audio-audit.json
```

### 2. Explicit, create-only bucket setup

With the operator credentials already securely available in the environment:

```sh
node research/publish-custom-vocabulary-audio.mjs \
  --ensure-bucket \
  --project-ref zcvoxqcvobgvcwcrqytz
```

This creates only the dedicated empty bucket and reads it back. If it already exists, exact compatible configuration is required; the tool does not mutate it. It does not upload audio, create a new Supabase project, change a plan, touch existing application tables/functions, or add policies. The command can safely be rerun to inspect/reconcile a previously completed creation. Unexpected responses stop the operation rather than triggering a blind write retry.

### 3. Record explicit approval for exact final takes

An operator supplies a local approval JSON file after rights and listening review are actually resolved. This **illustrative template is intentionally unapproved and cannot authorize an upload**:

```json
{
  "schemaVersion": 1,
  "releaseId": "replace-with-reviewed-release-id",
  "publicDistribution": false,
  "approvedBy": "",
  "approvedAt": "",
  "entries": {
    "conversation-douzo": {
      "sha256": "replace-with-exact-approved-mp3-sha256",
      "license": {
        "approved": false,
        "commercialUse": false,
        "evidence": ""
      },
      "pronunciation": {
        "approved": false,
        "reviewedBy": "",
        "reviewedAt": "",
        "evidence": ""
      }
    }
  }
}
```

Replace the blank evidence with a meaningful, reviewable reference to generation rights/receipts and the listening decision. Dates must be ISO timestamps. Mark flags true only with the owner's authorization and supporting evidence. An approval for a previous hash cannot approve a regenerated file. The document is local operator evidence; it is not uploaded or included in the client publication index. The tool validates that explicit attestations exist, not the legal sufficiency or truth of their contents.

Preview exactly the intended selection:

```sh
node research/publish-custom-vocabulary-audio.mjs \
  --ids conversation-douzo \
  --approval /absolute/path/to/release-approval.json
```

### 4. Explicit publish, verify, then release the app

```sh
node research/publish-custom-vocabulary-audio.mjs \
  --upload \
  --all \
  --approval /absolute/path/to/release-approval.json \
  --project-ref zcvoxqcvobgvcwcrqytz
```

Use `--ids word-id,word-id` instead of `--all` for a reviewed subset. Every selected word must be approved before the tool sends any request. It then:

1. Validates the existing bucket; missing buckets require the separate setup step.
2. Takes an exclusive local publication lock.
3. Reads each public object without authentication. Existing objects must match exact hash, size, MIME type, and long-lived cache policy before they are skipped.
4. Uploads missing MP3s sequentially, explicitly disabling upsert. No existing object is overwritten or deleted.
5. Downloads and hash-checks each uploaded object through its public URL. Duplicate-object races are resolved by the same verification.
6. Only after **all selected files** pass, atomically replaces the local publication JSON. Unselected published entries are retained. New approved hashes update the word's index entry but leave old immutable objects untouched.

Publish the resulting reviewed index through the normal app deployment workflow. The tool does not deploy the app. Public URLs use Supabase's documented `/storage/v1/object/public/<bucket>/<path>` format. [Serving public assets](https://supabase.com/docs/guides/storage/serving/downloads)

If upload, verification, or connectivity fails, the previous publication index remains unchanged. Already uploaded objects remain available for a later idempotent rerun; do not delete them or blindly retry writes. If the index was edited during upload, that edit is preserved and the publisher stops. An interrupted process can leave a `.publish.lock`; inspect active processes and the exact lock before removing it. There is deliberately no automated lock-breaking, object deletion, or bucket mutation.

## Optional private staging before public release

`research/stage-custom-vocabulary-audio.mjs` is a separate operator-only staging tool. It targets **only** `custom-vocabulary-audio-private`, with `public: false`, `audio/mpeg` as the only allowed type, and the same 1 MiB object limit. Implementation and mocked tests do not create this bucket or upload anything; live staging requires an explicit operator action.

Private staging is not a public release, license approval, or pronunciation certification. It leaves the public bucket, publisher approval gates, app publication index, database tables/functions, and all RLS policies unchanged. The app cannot play staged files through its public-audio integration. The tool never creates public or signed URLs.

**Before any live staging**, inspect the existing `storage.objects` RLS configuration and policies for grants that also match this new bucket. `public: false` alone does not establish owner-only access: broad `SELECT` policies can still grant `anon` or ordinary `authenticated` users access through Storage. The operator must check that unauthenticated access is denied for any existing staged objects, then repeat that negative-access check for newly staged objects; also evaluate ordinary authenticated access against the intended private scope. The staging client does **not** perform this policy audit or negative-access probe, and must not be described as doing so. Do not rewrite broad policies as part of this task. [Supabase access control](https://supabase.com/docs/guides/storage/security/access-control)

Run a local preview first; this is the default, needs no credentials, and makes **zero network requests and zero file writes**:

```sh
node research/stage-custom-vocabulary-audio.mjs
```

After operator authorization and the privacy preflight, these are the separate, explicit remote operations:

```sh
node research/stage-custom-vocabulary-audio.mjs \
  --ensure-bucket --project-ref zcvoxqcvobgvcwcrqytz

node research/stage-custom-vocabulary-audio.mjs \
  --upload --all --project-ref zcvoxqcvobgvcwcrqytz
```

Use `--ids word-id,word-id` instead of `--all` for a subset. The same securely supplied `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` operator environment is used; no credentials belong in arguments, logs, app code, or receipt files. Bucket creation is create-only and rejects any existing non-private or incompatible bucket rather than modifying it.

The staging tool reuses the strict local audit and content-addressed object paths. It uploads canonical MP3s only, disables upsert, sends no automatic retries, and verifies complete remote bytes through authenticated `GET /storage/v1/object/authenticated/<bucket>/<path>` requests. Existing objects are reused only after exact size, MIME and SHA-256 checks. It uses no app proxy, signed-URL service, or additional database table; private staging is a small separate stored copy, not a claim of free bandwidth. [Supabase private downloads](https://supabase.com/docs/guides/storage/serving/downloads)

After each successfully verified object, a local `output/custom-vocabulary-audio/private-staging/receipt.json` is atomically merged under an exclusive lock. The receipt stores the private bucket/project, immutable object identity, verification time and **pending public-release issues**, never license/listening approvals or playable URLs. Successful prefixes remain resumable after a later failure; changed receipts, hash collisions and interrupted locks require reconciliation, never an automatic overwrite. New hashes retain earlier staged versions. Nothing updates the public app index, even after all files are privately staged.

## Verification

```sh
node --test research/publish-custom-vocabulary-audio.test.mjs
node --test research/stage-custom-vocabulary-audio.test.mjs
```

The mocked-network tests cover public reads without credentials, exact-origin checks, rejected redirects, fail-closed license/QA gates, immutable collisions, bucket creation/configuration checks, download hash verification, failed uploads, concurrent edits, and idempotent resume. No test contacts Supabase or spends credits.

The separate private tests cover zero-write/zero-network dry-run, create-only private configuration, authenticated-only hash readback, no public/signed requests or index mutations, retained release issues, wrong MIME/size/hash failures, partial-failure resume, immutable receipt collisions, external edits, symlink/lock safety, and credential-redacted failures. They do not substitute for the live policy/access preflight above.
