# Community images and Markdown — 2026-09-24

The web issue and reply composers now share an editor with image selection, clipboard paste, drag and drop, and Write/Preview tabs. Images are limited to 4 MB each; posting and draft deletion are disabled during uploads. Upload failures preserve the draft and explain the failure. The preview and published content use the same Markdown renderer, including lists, emphasis, code blocks, tables, links, and media.

Two rendering bugs were reproduced before the fix: the hand-written Markdown parser truncated image URLs containing parentheses, and native HEIC attachments were sent directly to browsers without conversion. The attachment in issue `d60898ac-e04f-4c78-8ec7-2fcf5134b721` was available from storage but used HEIC. It now decodes into a 1620 × 2160 WebP image.

`POST /community/media` requires a verified WaniKani session, same-origin requests, and per-address/per-user rate limits. It reads a bounded binary body, decodes/re-encodes images, and writes public attachments using the existing server-only Supabase credential and native issue buckets. It does not change database or storage policies. Image dimensions are capped at 40 million pixels, including a check before HEIC pixel allocation.

`GET /community/media` converts existing HEIC/HEIF attachments. The source is restricted to configured public issue buckets in the configured Supabase project, with redirects disabled. Successful conversions are cached. Broken external attachments show a download link instead of a broken image icon. Raw HTML and executable URL protocols are not rendered.

Validation: 56 focused community/editor/route tests, eight desktop/mobile browser checks, focused lint, TypeScript, and a production build. Browser checks cover image insertion, loaded preview images, Markdown formatting, retained drafts, and horizontal overflow. The existing HEIC attachment was also fetched and converted through the real server endpoint.

The release uses the exact uploaded source of Bunpro deployment `dpl_6EXH7GVEzcCXZr33aTKTSwRYMU9a`, preserving 1,097 files byte-for-byte while overlaying 15 community files. A first HEAD-based deployment was cancelled before release after detecting the concurrent production change. Unrelated news and Bunpro workspace edits were not copied into the community overlay.

Deployed as `dpl_7Q3hj3prnsPwvr6EfnamteRY83um` and verified READY at https://kakehashiapp.com. Live Chromium checks confirmed the original HEIC image, reply preview, and an authenticated image upload followed by a loaded new-issue preview. Unauthenticated uploads returned 401. No issues or comments were posted. A temporary 4 × 4 test image remains unreferenced in storage because public credentials cannot delete it; its exact URL is recorded in `output/community-media-2026-09-24/smoke-test-asset.json`.
