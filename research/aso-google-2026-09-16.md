# Google Play ASO research for Kakehashi

Research date: 16 September 2026. Priority: United States; secondary: Spain. Package: `com.portego00.kakehashi`.

This memo distinguishes verified public facts, Play Console facts supplied by the main audit, and recommendations. Public web listings and search-engine results are **not measurements of native Play Store search position**. The exact country, device, account, language and search surface must accompany any native ranking measurement.

## What the evidence says

Google says search weighs relevance to the query heavily, while charts weigh popularity heavily. Ranking also considers app quality and how users respond to results. Metadata, including title, description and category, helps Google understand the app. Results vary with device, location and user context. Consequently, more ratings than another app cannot establish that Kakehashi should outrank it, and no metadata change can guarantee first position for every user. [Google: App Discovery and Ranking](https://support.google.com/googleplay/android-developer/answer/9958766?hl=en)

“Does not appear” needs two separate investigations: whether the app is eligible for that user's device/account/country, and whether it is sufficiently prominent for the query. Google recommends confirming production publication and device compatibility, and recognizes that title, developer and description influence search. Open the exact listing on the affected device before treating this solely as an ASO problem. [Google: App visibility and discovery issues](https://support.google.com/googleplay/android-developer/answer/9042516?hl=en)

## Kakehashi facts from the main audit

The main agent inspected the signed-in Play Console and supplied these observations on 16 September 2026:

| Field | Observed value |
|---|---|
| Live app name | `Kakehashi` — 9/30 characters |
| Short description | `Wanikani Companion App` — 22/80 characters |
| Full description | 2,083/4,000 characters; broad bridge/“ultimate” introduction |
| Listing language | Only en-US supplied |
| Console listing-metadata timestamp | 11 July 2026; distinct from the public app-update date below |
| Phone screenshots | Six |
| Store listing experiments | None |
| Displayed country ratings | US 5.0; Spain 4.8; default 4.969 |
| Last 28 days of ratings | Eight, all five-star |
| Active production release | 1.4.8, version code 38 |
| Distribution | 177 countries; United States and Spain explicitly Targeted |
| Live target/minimum Android API | Target 36; minimum 24+ |
| Supported devices | 18,837 |
| Published Features panel | camera, faketouch, microphone, screen.portrait; autofocus was not shown |
| Release size | App size 89.1 MB; DEX bundle 62.4 MB |
| Optimization warning | DEX obfuscation 1%; Console says fix by February 2027 and warns of possible visibility/publishing impact |
| New-release crash/ANR data | Unavailable, not zero |

Additional Console observations supplied by the main audit:

| Report and period | Observation |
|---|---|
| Grow, 19 August–15 September 2026 | 7.37K device impressions: 7.25K Explore, 114 Paid/direct |
| Grow, same period | 105 acquisitions: 24 Explore, 60 Paid/direct, 21 unattributed |
| Store listings, 16 August–12 September 2026 | 237 visitors; 97 unique user install clicks; 41% listing CTR |

The two reports have different periods and measures; do not divide these figures into a combined funnel. In Grow, Paid/direct includes branded/navigational search and Explore can include category search. The absence of a separate Search row therefore **does not mean zero search traffic**. The store-listings report has a separate search-source definition. [Google: reporting definitions](https://support.google.com/googleplay/android-developer/answer/9859173?hl=en)

These are private Console observations, not publicly reproducible links. The absence of WaniKani from the title is a clear relevance and recognition opportunity; it is **not proof of the cause of missing search results**. WaniKani already appears in the short description. Title wording should be improved while eligibility and search performance are checked independently.

The main agent also opened the [public US Google Play listing](https://play.google.com/store/apps/details?id=com.portego00.kakehashi&hl=en_US&gl=US) in Chrome. It displayed Kakehashi, 5.0 stars, 36 header reviews / 33 phone reviews, a 100+ download band, and an app-update date of 14 September 2026. The signed-in page reported availability on that user's devices; this is personalized evidence, not universal compatibility. Its first three screenshots promote kanji/SRS, flexible pacing and text/voice/camera search, using subject-detail, dashboard and search screens. They visibly use iPhone Dynamic Island mockups on the Android listing.

**Creative recommendation:** replace those mockups with captures of the supported Android experience, leading with actual WaniKani reviews and lessons. Keep reading, listening and search as differentiators afterward. This is a concrete recognition/conversion hypothesis; neither the mockups nor the current screenshot order prove a search-ranking penalty.

### Query-specific web search observation

The main audit compared two searches in the same signed-in Chrome context on 16 September 2026, with a United States/English page footer and `gl=US&hl=en`. The [WaniKani web query](https://play.google.com/store/search?q=wanikani&c=apps&hl=en&gl=US) returned 20 app entries without Kakehashi, while the [Kakehashi web query](https://play.google.com/store/search?q=kakehashi&c=apps&hl=en&gl=US) returned this app as the lead result. This supports query-specific retrieval/prominence trouble and rules out universal catalog absence in that context. It is not a native-device ranking measurement; the URL/footer does not establish the signed-in account's country, and absence from 20 entries does not establish absence from every possible result set.

## Current public competitors

The following public pages rendered United States/English in their footers. Counts can change; header review counts and device-specific counts sometimes differ. Download bands are broad historical totals, not current install velocity or US-only installs. No native rank is asserted here.

| App | Public snapshot | Positioning relevant to this audit |
|---|---|---|
| [Smouldering Durtles](https://play.google.com/store/apps/details?id=com.smouldering_durtles.wk) | 4.9 stars; 204 header reviews / 195 phone reviews; 10K+ downloads; updated 16 July 2026 | WaniKani absent from title, but explicit in opening and short summary. Leads with lessons/reviews, then offline review, self-study and customization. Clear independent-app disclaimer. |
| [ウーパールーパー (WaniKani companion)](https://play.google.com/store/apps/details?id=com.barandiaran.ruupa) | 4.8 stars; 31 header reviews / 30 phone reviews; 10K+ downloads; updated 2 April 2026 | WaniKani in title, opening and short summary. Lessons/reviews first; then progress, dashboard and sync. Makes account and API-token requirements explicit. |
| [Mina](https://play.google.com/store/apps/details?id=com.codejockie.mina) | No rating count displayed in retrieved page; 500+ downloads; updated 4 August 2026 | Broad Japanese-study introduction; WaniKani named in account requirement near the end. Short summary emphasizes reviews, tracking and design. |
| [Hakubun](https://play.google.com/store/apps/details?id=io.hakubun.app) | No rating count displayed in retrieved page; 1K+ downloads; updated 26 October 2024 | WaniKani in opening and short summary; specific review/lesson controls and typo tolerance. |
| [WaniDoku](https://play.google.com/store/apps/details?id=com.nononsenseapps.wanidoku) | 100+ downloads; updated 1 May 2021 | A narrower adjacent tool: WaniKani context-sentence notifications. It is not a full lessons/reviews substitute. |

Flaming Durtles should not be used as a verified current native-store competitor. Its original developer's [WaniKani community thread](https://community.wanikani.com/t/no-longer-maintained-flaming-durtles-android-app-with-offline-support/38400) is labeled no longer maintained. Its linked Play page could not be retrieved in this research. That retrieval failure alone does not establish country/device availability or an exact removal date.

**Interpretation:** some established competitors have more historical Android distribution, and several communicate the query's main job—WaniKani lessons and reviews—immediately. Public metadata alone cannot reveal why one outranks another. Smouldering Durtles also illustrates why having WaniKani in the title is not a necessary condition for discovery.

## Highest-priority metadata recommendation

Google's limits are 30 characters for app name, 80 for short description and 4,000 for full description. A separate localized app name can be provided per language. There is no Apple-style keyword field in this product-details schema. [Google: Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)

Recommended title: **Kakehashi for WaniKani** — 22 characters. An alternative with explicit search intent is **Kakehashi: WaniKani Reviews** — 27 characters. The first is cleaner and leaves lessons and other features in scope. This is a recommendation to improve clear relevance and recognition, not a promise about exact algorithmic weighting.

Recommended short description, 75 characters:

> WaniKani reviews and lessons, plus Japanese reading and listening practice.

Suggested opening for the full description:

> Keep up with your WaniKani lessons and reviews, then use what you learn in real Japanese. Kakehashi connects your study progress with reading and listening practice so you can build a daily routine in one app.

Then explain concrete review/lesson controls, progress, reading/listening, and requirements in that order. Verify every feature against the live Android build before publishing. Keep a clear statement that it is an independent companion, not affiliated with or endorsed by WaniKani or Tofugu.

Google recommends accurate, succinct descriptions and warns against repetition, misleading affiliations, anonymous testimonials and ranking claims. Do not add competitor-name lists, blocks of keywords, “#1,” or claims of being the official app. Use screenshots of actual supported experiences, with localized text for languages explicitly supported. [Google: Best practices for your store listing](https://support.google.com/googleplay/android-developer/answer/13393723?hl=en)

For Spain, add a carefully reviewed es-ES listing after en-US is corrected. Preserve the service name WaniKani. Lead with “lecciones y repasos de WaniKani”; communicate that the study content/account experience may use English where applicable. Translation alone is not evidence of improved ranking. Evaluate it as a separate audience and conversion improvement.

## Eligibility and quality checks before blaming the algorithm

1. **Live production and distribution — checked:** version 1.4.8 (38) is active in production, with 177 countries including US and Spain Targeted. The simple explanations of no production release or these countries being untargeted are therefore unsupported. Still open the exact Play URL on affected devices and record any availability message; device/account-specific eligibility remains distinct from query ranking. [Google: App visibility and discovery issues](https://support.google.com/googleplay/android-developer/answer/9042516?hl=en)

2. **Target API — checked:** the live artifact targets API 36 and has minimum API 24. It meets the current mobile target requirement. Policy effective 31 August 2026 requires existing mobile apps to target API 35 or higher for availability to new users on newer Android versions; new apps/updates require API 36 or higher. There is no evidence of a target-API visibility restriction here. [Google: Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)

3. **Device filtering — partly checked:** Console reports 18,837 supported devices and shows camera, faketouch, microphone and screen.portrait in the published Features panel; **autofocus was not shown**. The local source manifest requests CAMERA without optional camera/autofocus declarations, while Google documents that camera permissions can imply hardware requirements. Do not turn that general rule into a claim that the published bundle requires autofocus. Inspect the exact affected model's device-catalog exclusion reason and, if needed, the merged release manifest. Any unnecessary camera/microphone requirements are an availability improvement to investigate, especially for some tablets/Chromebooks; they do not explain missing results on a confirmed compatible phone. [Android: uses-feature and Play filtering](https://developer.android.com/guide/topics/manifest/uses-feature-element)

4. **Core vitals — incomplete:** new-release crash/ANR data was unavailable in Console. This does not establish zero crashes or a clean stability record. Inspect the last 28 days globally and for important devices. Google says thresholds can reduce discoverability: user-perceived crashes at 1.09% overall or 8% per phone model; user-perceived ANRs at 0.47% overall or 8% per phone model. Lack of available data means insufficient samples under the selected filters. Avoid claiming a quality penalty without observed evidence. [Google: Android vitals](https://support.google.com/googleplay/android-developer/answer/9844486?hl=en)

5. **DEX optimization — observed future requirement:** Console reports 1% DEX obfuscation, 62.4 MB of DEX and an 89.1 MB app size, with a fix-by-February-2027 warning. Google's announced threshold applies to apps above 10 MB DEX and requires at least 25% each for optimization, shrinking and obfuscation from February 2027. Plan and validate an optimized release before that deadline. **This future-dated warning is not evidence of a current ranking penalty.** [Google: technical quality requirements](https://support.google.com/googleplay/android-developer/answer/17492799?hl=en), [Android: visibility enforcement timing](https://developer.android.com/games/optimize/vitals)

## Measurement and testing plan

As of June/July 2026, Google changed store-listing performance reporting toward **unique install/open/pre-registration clicks and listing CTR**, replacing legacy acquisition/conversion measures. Use current Console labels and export dates. Country is based on the user's Google account; language is the device language. Search-term breakdowns can show terms used before a listing visit, but are not a report of every query impression or absolute native search rank. Branded search and generic/category search can be classified differently, so inspect both search and explore rather than treating all query traffic as one bucket. [Google: Understand and grow your app's user base](https://support.google.com/googleplay/android-developer/answer/9859173?hl=en)

Recommended baseline, kept separate for US and Spain:

- Fixed query set: `wanikani`, `wanikani app`, `wanikani companion`, `kakehashi`.
- Record native organic position with a consistent device/account/language, separating sponsored results. Record “not found in first N results” instead of claiming not indexed.
- Export at least the previous 28 days of listing visitors, unique install clicks/CTR, country, language, available search terms, plus actual new-user installs and retention from their respective reports.
- Change the title/short description as a focused intervention after baseline and eligibility checks. Log the exact publication date. Compare subsequent equivalent periods and note releases, campaigns and seasonality; a before/after comparison alone is not causal proof.
- Once enough traffic exists, test one screenshot or description hypothesis at a time. “WaniKani lessons/reviews first” is the first creative hypothesis; reading/listening becomes the differentiator after that recognition step.

Google supports one default graphics experiment or up to five localized experiments concurrently. The current setup allows up to two variants and target metrics based on unique install/open/pre-registration clicks. Text experiments cover descriptions; the listed assets do not include the app title. Use the estimated sample/time requirement and accept “more data needed” where traffic is sparse. A listing experiment measures user response to assets, not organic search-position lift. [Google: Run A/B tests on your store listing](https://support.google.com/googleplay/android-developer/answer/12053285?hl=en)

Google also offers custom listings targeted to search-keyword bundles, with tailored app names, descriptions and assets. A WaniKani-specific listing is useful if the main listing must retain broader Japanese-study positioning. It is a way to present relevant content to an audience, not a documented switch that forces query inclusion or first rank. Custom listings require their own translations. [Google: Create custom store listings](https://support.google.com/googleplay/android-developer/answer/9867158?hl=en)

For sustainable review growth, use the native in-app review flow after sufficient experience and a natural completion point, without incentives or asking whether the user likes the app first. Google's review dialog is quota-limited and may not appear. Treat review solicitation as feedback collection, not a guarantee of ranking. [Android: In-app reviews](https://developer.android.com/guide/playcore/in-app-review)

## Remaining unknowns

- Native Play query results in the exact US/Spain account and device contexts described by the user.
- Compatibility of the particular devices/accounts where search fails, and detailed exclusion reasons for unsupported models. Production, US/Spain targeting and target API have been verified.
- Query-specific traffic and whether WaniKani is reported with adequate volume.
- Kakehashi's Android install velocity, retained active users, conversion relative to peers and vitals.
- Whether stronger WaniKani positioning increases qualified installs while retaining the broader reading/listening audience.

The defensible objective is to become the strongest, consistently discoverable result for the target audience, with rising qualified search traffic and retained users. “First result always” is not a controllable or verifiable universal outcome.
