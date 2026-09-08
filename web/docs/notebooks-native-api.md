# Mobile notebook API

The React Native app uses `GET` and `POST /api/notebooks/native` on the web app's origin. This endpoint shares the browser notebook model, server storage implementation, limits, and optimistic revisions. It needs no new database table or migration beyond the existing notebook migrations in [notebooks-storage.md](./notebooks-storage.md).

For the app's endpoint environment variable, simulator setup, bundled editor, and draft recovery behavior, see [Mobile notebooks](notebooks-mobile.md).

Mobile access is currently limited to the WaniKani account whose verified username is `Portego`, ignoring case and surrounding whitespace. This restriction is enforced on the server as well as in mobile navigation. It does not change access to the existing browser `/api/notebooks` endpoint.

## Authentication and ownership

Every native request sends `Authorization: Bearer <WaniKani API token>`. The server verifies that token through the existing WaniKani `/v2/user` verifier, then derives the opaque owner ID through the same `waniKaniUserId` helper used by the browser. No client-supplied username or owner ID is accepted as proof of identity. Native requests do not authenticate with browser cookies or demo sessions.

The verifier coalesces concurrent requests and caches successful WaniKani verification for five minutes. A token revocation or username change may therefore take up to five minutes to be reflected. WaniKani network requests have a ten-second timeout. Only the server sends Supabase service credentials to storage; the device sends its existing WaniKani token to the trusted web app origin.

Keep authentication in native code. The embedded BlockNote view receives document data and editor callbacks, not WaniKani tokens or Supabase credentials. Browser cross-origin access is not enabled for this endpoint.

## Read and write contract

GET returns:

```json
{
  "available": true,
  "accountId": "verified-opaque-wanikani-id",
  "state": { "version": 1, "pages": [], "sentences": [] },
  "revision": -1,
  "limits": {
    "maxBytes": 1048576,
    "maxPages": 200,
    "maxSentences": 1500,
    "maxPageBytes": 262144
  }
}
```

POST accepts the existing `NotebookMutation` JSON defined in `web/src/features/notebooks/model.ts`, with `Content-Type: application/json`. Every POST must also include `X-Notebook-Account` copied from the most recent authenticated GET for that token. A missing or mismatched header returns HTTP 409 with `code: "account_changed"` before reading or applying the mutation. The header guards stale client state after an account switch; the verified token still determines ownership.

Successful POST returns the same envelope as GET and, where applicable, `sentenceId`. The server applies the exact existing mutations to the same account document. Page and sentence revision conflicts return HTTP 409 with `code: "conflict"`; clients must preserve the draft and reload or ask the user to resolve the conflict. Reusing caller-generated IDs preserves the existing idempotent creation/append behavior after uncertain network responses.

An unconfigured storage backend returns `{ available: false, accountId, state: null, revision: -1, limits }`; GET has HTTP 200 and POST has HTTP 503. Failed saves must not be shown as successful saves.

## Errors and request limits

All responses use `Cache-Control: private, no-store, max-age=0`, `Vary: Authorization`, and `X-Content-Type-Options: nosniff`. Errors do not expose upstream response text, account details, credentials, or storage internals.

| HTTP | Code | Client behavior |
| --- | --- | --- |
| 401 | `unauthorized` | Require a valid WaniKani sign-in. |
| 403 | `forbidden` | Hide mobile notebooks for this account. |
| 409 | `account_changed` | Discard the stale account envelope and reload for the active token. |
| 409 | `conflict` | Keep the draft and resolve the newer remote revision. |
| 400 / 415 | `invalid` | Correct an invalid, excessive, or non-JSON request. |
| 413 | `limit` | Reduce content to fit the account/page limits. |
| 429 | `rate_limited` | Honor the numeric `Retry-After` header. |
| 503 | `unavailable` | Keep the draft and offer retry. |

The route applies the existing process-local opaque rate limiter: up to 240 reads or 600 writes per token per ten minutes, plus 1,200 total requests per client address per ten minutes before upstream verification. These are per server process, not a distributed global quota. Request bodies are bounded to the smaller of the configured account limit plus 16 KiB and the absolute 4 MiB cap. Body reading aborts when the request is cancelled or after ten seconds. Storage requests retain their existing twelve-second per-request timeout and bounded optimistic retries.

The endpoint integration tests cover verified reads and writes against the existing server store, opaque ownership, Portego gating, missing/rejected tokens, forged client identity, account-switch headers, stale page revisions, private responses, sanitized failures, request limits, cancellation, and unavailable storage.
