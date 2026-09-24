# Bunpro widget recovery — 24 September 2026

Deployed to https://kakehashiapp.com.

- Deployment: `dpl_rLiXUZhFUxx4R6FJuLDuWdkrTrxv`
- Previous production: `dpl_2Meh1tqZwAFvos9ZuYJbA8YjWfh3`

Production request logs showed intermittent HTTP 401 responses immediately after a successful key connection, followed by successful reads after refresh. The originating cause of the intermittent rejection remains unconfirmed. Regressions reproduced no automatic first-load recovery and Retry re-fetching a healthy card, allowing a new failure to leave the warning visible alongside cached counts.

Read-only dashboard counts now retry transient failures up to twice, including intermittent 401 responses, with bounded delays. Manual Retry only retries failed queries and disables while fetching. Errors identify the affected card; persistent errors remain visible. No review or lesson mutation retry behavior changed.

All nine widget tests passed, including initial rejection recovery, failed-card-only retry, and persistent-failure bounds. Type checking and scoped lint passed. All 1,100 uploaded file hashes matched the production-based snapshot. Vercel reached READY, staged and live login returned HTTP 200, and the canonical domain was verified on the release. No user key was re-entered or real study action submitted during verification.

Evidence: `output/bunpro-recovery-2026-09-24/`.
