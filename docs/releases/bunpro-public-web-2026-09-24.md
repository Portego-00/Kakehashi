# Bunpro access for all web accounts — 24 September 2026

Deployed to https://kakehashiapp.com.

- Deployment: `dpl_2Meh1tqZwAFvos9ZuYJbA8YjWfh3`
- Previous production: `dpl_HyLD64i9R2tFQKXt8Ah9ut5JgPid`
- Immutable URL: https://kakehashi-mu4kgnnu1-portego-00s-projects.vercel.app

Removes the Portego restriction from the shared client gate and verified server identity check. All signed-in accounts can connect their own Bunpro key and use the dashboard setup/study cards, settings, analytics, forecast, lessons, reviews, details, and mixed reviews. Demo mode remains excluded. Session verification and account-owned encrypted keys remain enforced. API-key links now go directly to https://bunpro.jp/settings/api.

The isolated release preserves the latest production lesson fix. All 250 Bunpro and mixed-review tests passed with ordinary-account coverage; type checking and scoped lint passed. All 1,100 uploaded files matched the release snapshot. Production build reached READY; staged and live login returned HTTP 200, unauthenticated Bunpro API access returned HTTP 401, and the canonical domain points to this deployment. No real review or lesson was submitted during verification.

Evidence: `output/bunpro-public-2026-09-24/`.
