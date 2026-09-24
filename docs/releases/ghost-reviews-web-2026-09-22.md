# Web review errors and ghost reviews — 22 September 2026

Deployed and promoted to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_3xX18kEzBaa9ygXiGmqthMrMM9VN`
- Immutable URL: https://kakehashi-r6kbgy7ke-portego-00s-projects.vercel.app
- Previous production: `dpl_C7teQcaxmCNzM87DgSqXmSczBoTS`
- Project: `prj_G8n90lvFlVuIEFz6lyAytvXohImQ` (`kakehashi-web`)

The release includes all 70 current changed or untracked web/shared source paths. It preserves the newer production changes to shared review feedback, audio, hidden answers, daily lesson limits, settings, community, and activity history. The prior production source was verified against all 1,086 deployed file hashes before applying changes from the frozen branch snapshot. Three overlaps were resolved while preserving both changes. All 1,087 uploaded source hashes match the release snapshot; no existing production source was removed.

Bunpro ghost and self-study reviews now use their respective submission endpoints and separate identities. Failed saves keep the answer and original error visible with Retry save and Continue without saving. Authentication errors and three consecutive save failures pause continuation. Answers explicitly continued without saving remain marked as unconfirmed, including in results and paginated queues. Multiple-blank sentence rendering changes are also included.

Validation: release TypeScript passed; lint passed with zero errors and three existing warnings. All 2,777 non-skipped unit tests were verified, with one test skipped. The isolated community rate-limit test needed `COMMUNITY_LOCAL_STORE=1` because the release copy intentionally has no development environment file. All seven browser review regressions passed, including explicit continuation after a 500, preserved drafts, and visible error controls. Vercel's production build reached READY and the protected staged login returned HTTP 200.

Production was rechecked immediately before promotion to ensure that no intervening deployment was overwritten. After promotion, the canonical domain resolved to this exact READY deployment; login and reviews returned HTTP 200.

All four guarded live browser checks passed, covering settings, draft preservation, automatic progression, review controls, and demo lessons. Browser fixtures intercepted account and review mutations; other writes were blocked except creation of the public demo session. No real reviews were submitted.

Evidence: `output/web-release-2026-09-22-ghost-reviews/`. The tested release is `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-ghost-web-release-rzyc74lu`; the uploaded snapshot is `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-ghost-web-deploy-wq97tqp5`. No database migration, production environment change, native-app release, Git commit, or Git push was performed.
