# Bunpro web analytics

Updated 2026-09-21. Retains the Portego-only rollout. The existing encrypted, account-bound HttpOnly cookie supplies the key; the browser never receives it.

## Current endpoint inventory

Sources: the current public JavaScript bundles served by the official [dashboard](https://bunpro.jp/dashboard) and [profile statistics](https://bunpro.jp/profile/stats), cross-checked against Kakehashi's mobile wrapper. These are early-access frontend endpoints, not a published stable API specification. This is the complete statistics inventory found in those two current pages; undisclosed endpoints may exist.

All paths below are GET requests under `https://api.bunpro.jp/api/frontend`.

| Endpoint | Available information | Validation / use |
| --- | --- | --- |
| `/user_stats/base_stats` | Days studied, streak, weekly dates, grammar/vocab studied, last session and badges | Live key verified; overview and weekly calendar |
| `/user_stats/activity_daily` | Grammar/vocab daily review counts, returned date range | Live verified; review activity chart |
| `/user_stats/activity_hourly` | Hourly activity | Found in official dashboard client |
| `/user_stats/forecast_daily` | Later today, tomorrow, and dated grammar/vocab counts | Live verified; solid bar chart |
| `/user_stats/forecast_hourly` | Hourly scheduled workload | Official dashboard and mobile client |
| `/user_stats/srs_level_overview` | Five stages plus ghosts/self-study, separately for grammar/vocab | Live verified; two honeycomb cards and exact counts |
| `/user_stats/jlpt_progress_mixed` | Separate grammar/vocab N5–N1 stage counts and available totals | Live verified; separate JLPT cards |
| `/user_stats/total_review_stats` | Per-domain, per-JLPT total/correct/incorrect/accuracy/global average | Live verified; domain accuracy weighted by answer counts |
| `/user_stats/total_cram_stats` | Session count, total/average time, questions, correct/incorrect/accuracy | Live verified; practice summary when sessions exist |
| `/user_stats/review_heatmap` | Sparse daily grammar/vocab/mixed review counts over a longer history | Live verified; review calendar |
| `/user_stats/new_content_heatmap` | Sparse daily grammar/vocab/mixed new-content counts | Live verified; documented for future lesson analytics |
| `/user_stats/accuracy_over_time` | Date → percentage or null | Live verified; no speculative series displayed |
| `/user_stats/streak_over_time` | Date → streak statistic or null | Live verified; no speculative series displayed |
| `/user_stats/last_done_reviews` | Recent review-attempt details | Found in official profile client |
| `/user_stats/learned_content` | Learned content; supports `?period=last_month` | Found in official profile client |
| `/user_stats/troubled_content` | Difficult content; supports `?period=last_month` | Found in official profile client |
| `/user_stats/learn_queue` | Upcoming learning content | Found in official profile client |
| `/user_stats/review_queue` | Upcoming review content and next-review times | Found in official profile client |
| `/user_stats/srs_level_details` | Paginated stage items | Official client uses `level`, `reviewable_type`, `page` |
| `/user_stats/srs_ghost_level_details` | Ghost details | Official client uses `reviewable_type` |
| `/user_stats/srs_self_study_level_details` | Paginated self-study details | Official client uses `reviewable_type`, `page` |
| `/user/due` | Grammar/vocabulary due now | Live verified; direct review links |

`reviewable_type` is `GrammarPoint` or `Vocab` in the official SRS detail client. Public share and teacher variants also exist, but are outside this account's dashboard scope.

### Two bugs discovered through live validation

The mobile wrapper's `/user_stats/review_activity` no longer yielded usable history. The current web client uses `/user_stats/activity_daily`, which returned valid history with the connected key. The web dashboard now uses that endpoint.

Forecast keys include `later` and `tomorrow`, not just ISO dates. Those buckets previously disappeared during date parsing. They now appear as “Later today” and “Tomorrow”, separately from overdue reviews.

## Presentation and semantics

Grammar and vocabulary have separate headline counts, SRS compositions, stage rows, review links, accuracy, and JLPT progress. Filters can isolate either track. The overall streak retains its true scope. Weekday labels and dates are parsed from the actual API dates, replacing the erroneous first-character labels.

Honeycomb cells represent approximately 0.5% of the corresponding track, allocated with largest remainders; exact values remain in the adjacent rows. They do not represent individual items. Solid bars retain proportional heights and exact values in chart tables. The review calendar labels absent sparse entries “No recorded reviews”; it does not equate review days with the broader study streak (which also includes lessons/cram).

Bunpro's current SRS tiles use the same official no-text logo mark in all five stages, differentiated by color. The vector in `BunproStageIcon.tsx` comes from the official dashboard's logo component, not invented stage symbols.

Unavailable and empty resources produce no empty chart cards. Valid zeros remain real values. Requests and schemas are independent; authentication errors still propagate. Review accuracy is calculated from total correct / total answers, never from an average of JLPT percentages or the current queue. No historical deltas are invented.

## Validation

The user explicitly authorized using the connected key and Chrome. Verified live statistics through the existing authenticated local server and compared grammar/vocabulary totals and streak dates with the signed-in official Chrome dashboard. Temporary local diagnostic responses contained only statistics, no credentials; diagnostic writes were removed after inspection.

Automated tests cover authorization, partial/malformed responses, hidden empty charts, date labels, forecast aliases, proportional tile allocation, weighted totals, and source/filter navigation. Browser checks cover light/dark and widths 320–1440px with synthetic data. The key and live personal responses are not included in fixtures or source control.
