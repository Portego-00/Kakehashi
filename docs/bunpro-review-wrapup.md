# Bunpro review completion after a miss

Investigated on 29 September 2026 after four corrected grammar reviews reappeared after a mixed session.

A read-only capture of Kakehashi's queue response showed all four grammar items in `pending_wrapup`: う-Verb (Negative-Past), ので, な-Adjective + Noun, and か. Their resource type was `review`, their `ghost_count` was zero, and their `review_misses` was one. They spanned streaks 0, 2, 4, and 6. No account answers were submitted during diagnosis.

Bunpro's public [review client](https://bunpro.jp/reviews) was inspected, including its [quiz bundle](https://bunpro.jp/_next/static/chunks/8546-89b7fc50f78bf588.js). The client separates fresh questions from `pending_wrapup` missed questions, but submits their answers to the same type-specific update endpoint with the current correctness. Regular review wrapup does not use a ghost endpoint or require a separate wrapup payload flag (the cram API has its own flag).

Kakehashi saved the first miss, added the item to its handled set, and suppressed the subsequent correct submission. Local completion therefore left Bunpro waiting for wrapup. The fix tracks confirmed misses separately and submits the first correct retry through the existing endpoint. Additional local misses do not repeat the initial grade. Results keep the original incorrect grade and update the final saved stage rather than adding a second result. Beginner 0 and lesson first-correct handling is preserved.

Regression coverage exercises miss/miss/correct in mixed mode at several stages, a fresh session loading no remaining items, preserved first-attempt accuracy, and failed wrapup saves with either retry or explicit continuation without saving. Existing ghost, lesson, mixed-provider, and API routing checks are included in validation.

Reproduction command: `npm --prefix web test -- src/features/bunpro/BunproReviews.test.tsx -t "clears Bunpro's pending wrapup"`. Before the fix, the assertion that the remote wrapup queue was empty failed (`expected true to be false`) after the UI reported completion.
