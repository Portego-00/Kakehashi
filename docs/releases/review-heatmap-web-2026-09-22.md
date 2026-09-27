# Review heatmap vacation fix — 22 September 2026

Deployed and promoted to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_2TsiVLRTPECyuKUgKa9JR7BZQm8P`
- Immutable URL: https://kakehashi-cni5639st-portego-00s-projects.vercel.app
- Previous production: `dpl_3bh5Mdh2s6vdnEyqoS91ybFrUVhg`
- Project: `prj_G8n90lvFlVuIEFz6lyAytvXohImQ` (`kakehashi-web`)

Assignment update timestamps no longer count as historical study activity. Vacation rescheduling therefore cannot create a false heatmap spike. Dashboard and analytics share a calculation that counts lesson, Guru and burn milestones once per assignment per local day. The displayed description identifies these milestones; complete historical review counts remain unavailable from WaniKani's API.

The release was reconstructed from all 1,078 current production source files. Eight files changed and two were added; no existing file was removed. The merge preserves production's daily lesson limit behavior and its regression test, which were absent from the local checkout. Every one of the 1,080 uploaded source hashes matches the tested release.

Validation: nine release-copy test suites passed all 84 tests, including the 3,352-item vacation-update regression and active/completed-vacation dashboard cases. TypeScript and focused lint passed. Vercel's production build reached READY. The protected staged login returned HTTP 200 with the expected login shell. Production was rechecked immediately before promotion to avoid overwriting an intervening deployment.

After promotion, the canonical domain resolved to this exact READY deployment and login returned HTTP 200. The live browser demo dashboard rendered the new milestone description, all 265 daily cells, and a working day-details tooltip. Verification used the sample account and did not submit real reviews.

Evidence: `output/review-heatmap-2026-09-22/`. The verified release source is `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-heatmap-release-giims_7d`, also recorded in `/tmp/kakehashi-heatmap-release-path`. No database, environment, native-app deployment, Git commit, or Git push changes were made.
