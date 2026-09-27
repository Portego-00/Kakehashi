# Branch web release — 22 September 2026

Deployed and promoted to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_C7teQcaxmCNzM87DgSqXmSczBoTS`
- Immutable URL: https://kakehashi-6r497l4ib-portego-00s-projects.vercel.app
- Previous production: `dpl_2TsiVLRTPECyuKUgKa9JR7BZQm8P`
- Project: `prj_G8n90lvFlVuIEFz6lyAytvXohImQ` (`kakehashi-web`)
- Source branch: `f/fixes`, including its uncommitted web changes.

The release includes all 66 changed web files in the final branch snapshot. Mixed Bunpro/WaniKani reviews now keep the answer field, shared SRS notice, and keyboard hint in stable positions across providers and answer states. Bunpro stage hydration and save-error handling are included, along with the branch's settings, community, ordering, and activity changes.

The source was reconstructed from the previous production deployment and merged with the branch to preserve newer live fixes, including shared review feedback, daily lesson limits, hidden answers, and vacation-safe activity history. The source snapshot was frozen while other tasks continued editing the branch. All 1,086 uploaded file hashes match the tested release. The only prior-production file omitted is generated `web/tsconfig.tsbuildinfo`.

Validation: the initial branch suite passed 2,704 tests. The reconstructed release suite passed 2,710 tests; omitted catalog test fixtures were supplied for a successful 12-test recheck. Final review integration passed all 183 focused tests and TypeScript checking. All six browser geometry checks passed at 1512, 1024, and 768 pixels, including hidden/compact SRS and voice answers. One inherited lint error remains: the React purity rule flags `Date.now()` in Bunpro's async advance event handler identically in the frozen branch and release; three unrelated existing warnings remain.

Vercel's production build reached READY. The staged login returned HTTP 200. Production was rechecked immediately before promotion and still pointed to the expected previous deployment. After promotion, the canonical domain resolved to this exact READY deployment, login and reviews returned HTTP 200, and live review CSS contained the new layout. Four guarded browser smoke tests passed against production, covering review settings/controls, answer preservation, and demo lessons. All real review writes were intercepted; no unmatched writes occurred.

Evidence: `output/branch-web-2026-09-22/`. The tested integration source is `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-branch-web-release-lue55f5j`; the uploaded source snapshot is `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-branch-web-deploy-4j2wsf46`. The branch snapshot and file hashes are recorded in the source audit. No database, environment, native-app release, Git commit, or Git push changes were made.
