# Review details disclosure — 23 September 2026

Deployed to [kakehashiapp.com](https://kakehashiapp.com).

- Deployment: `dpl_FCoVtXj4BDgeJKPM4SbfwrQibERY`
- Immutable URL: https://kakehashi-p7viht0xj-portego-00s-projects.vercel.app
- Previous production: `dpl_3xX18kEzBaa9ygXiGmqthMrMM9VN`

Opening WaniKani details, Bunpro Info, or Bunpro Alternatives now contracts the desktop prompt and gently scrolls enough to expose the panel's beginning. Closing the last panel restores the original layout and scroll position. Reduced-motion preferences are respected. The stable answer, SRS, and keyboard-hint positions remain unchanged while panels are closed.

The regression came from the fixed desktop prompt row having no expanded-details state, together with the missing viewport reveal behavior. Bunpro Alternatives now uses the same disclosure component as details. Multiple open panels share the original scroll position so closing one panel does not prematurely restore the full prompt.

Validation: all 145 targeted unit tests, TypeScript, and scoped lint passed. All 13 browser regressions passed; the six disclosure checks were repeated successfully after adding shared scroll restoration, including both panels open together, normal motion at 1024 pixels, and reduced motion at 1512 pixels. Existing stable-layout and save-error regressions passed. Two guarded WaniKani disclosure tests also passed against production. Browser fixtures intercepted review submissions; no real reviews were saved.

The release was reconstructed from verified current production source. Exactly five files changed; none were removed. All 1,087 uploaded file hashes match the tested snapshot. The staged build reached READY, login returned HTTP 200, and production was unchanged immediately before promotion. The canonical domain then resolved to this READY deployment.

Evidence: `output/review-disclosure-2026-09-23/`. Tested source: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-disclosure-release-dmgd3ssk`. Uploaded snapshot: `/var/folders/7r/rt1k66h94s50640q2ykc0vyw0000gn/T/kakehashi-disclosure-deploy-ia6jrznv`.
