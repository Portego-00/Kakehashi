# Additional app integrations: feasibility and value for Kakehashi

Research date: 23 October 2026. Sources are public first-party provider material, with one clearly identified third-party implementation precedent. No paid account, token, device-installed provider app, or negotiated partnership was available to test. Absence of published documentation is not proof that an integration is impossible.

The request comes from [Additional app integration](https://kakehashiapp.com/community/d1f09c1c-1467-4f61-9473-5cf889621084), read through the site's public community API. It proposes Kanji Study, Outlier, MaruMori, Japanese Conjugation City, JapanesePod101 and YouGlish. At inspection it had no replies. No live community content was changed.

Recommendation: prioritize a YouGlish external lookup and an Android Kanji Study handoff; investigate MaruMori's supported read API and Outlier licensing before committing to deeper integration. Conjugation City and JapanesePod101 are lower priorities as direct integrations. This ranking is a product judgment about incremental value relative to the local codebase, not measured demand or learning outcomes.

## Existing Kakehashi capabilities that affect the decision

The current checkout already contains optional kanji formation/etymology in details and lessons, stroke animations and writing-practice screens, ImmersionKit examples inside vocabulary details, and substantial Bunpro features with Kaijugation practice links. Some features have account/access gates; code presence does not prove public production availability. Relevant sources:

- [Kanji details](../src/components/KanjiDetails.tsx), [lesson etymology](../src/components/KanjiLessonEtymologySection.tsx), [bundled formation data interface](../src/data/kanjiEtymology.ts).
- [Writing configuration](../app/(app)/writing-practice-config.tsx), [writing sessions](../app/(app)/writing-practice-session.tsx).
- [Vocabulary media examples](../src/components/VocabularyDetails.tsx), [ImmersionKit service](../src/services/immersionKitService.ts).
- [Bunpro implementation and access notes](../docs/bunpro-mobile-integration.md), [web Kaijugation links](../web/src/features/bunpro/KaijugationPractice.tsx).

Consequently, external study links mainly improve convenience, Outlier would deepen existing explanations, YouGlish would broaden contextual listening, and MaruMori would personalize practice for another provider's subscribers. None should be marketed as two-way review synchronization without a verified supported API and safe write semantics.

## Kanji Study — Chase Colburn, Android

**Assessment:** feasible immediately as an Android handoff; full progress synchronization is unverified.

The provider's own changelog explicitly documents these URL schemes:

- `kanjistudy://info?kanji=日` — kanji information (introduced in version 1.8.0).
- `kanjistudy://draw?kanji=字` — drawing screen, and `kanjistudy://search?q=house` — search (4.1.0).
- `kanjistudy://word?id=1234` — word information (4.2.2).
- It also records receiving Android `ACTION_SEND` search intents and external-app importing. These are historical declarations, not a current versioned API guarantee. [Official changelog](https://kanjistudyapp.com/changelog.html)

**Practical scope:** add “Practice in Kanji Study” / “Open in Kanji Study” from the kanji and vocabulary detail screens on Android, with install fallback. Use character or search routes first; word-ID linking needs a verified mapping. Test the current installed app and return navigation before shipping. A custom-set export may be possible, but exact supported file format and import contract require confirmation. No public account/progress API was found in the reviewed official website, changelog, or publisher listing; do not promise shared SRS queues or bidirectional reviews.

**Value judgment:** useful convenience for existing Kanji Study users; low-to-medium incremental value overall because Kakehashi already includes kanji detail and writing features. This suggestion is platform-limited: the identified provider package is `com.mindtwisted.kanjistudy` on Android. [Official Play listing](https://play.google.com/store/apps/details?id=com.mindtwisted.kanjistudy&hl=en_US)

**Planning estimate, not a provider commitment:** roughly 1–3 engineering days for a small Android-only handoff and fallback, assuming existing external-link components; more for export UX. Do not estimate full sync before a provider-supported contract exists.

## Outlier Kanji Dictionary

**Assessment:** high-quality content enhancement is technically plausible, but embedding it depends on a commercial content agreement. A normal customer purchase does not establish redistribution rights.

The current official product is an add-on for **Yomiwa on iOS and Android**, activated by a purchased code. It is not presented as a standalone dictionary app. Its current page lists 3,087 kanji form explanations and meaning trees, 2,202 component breakdowns, ancient forms, and a smaller set of Expert entries. [Official product page](https://www.outlier-linguistics.com/products/outlier-kanji-dictionary-essentials-edition)

Kanji Study's historical official changelog confirms Outlier Essentials and Expert add-ons, establishing a precedent for licensing content inside another app. It does not establish that a new license is available, the price, exclusivity, an API, or portability of existing customer purchases. [Kanji Study changelog](https://kanjistudyapp.com/changelog.html)

Outlier's website terms reserve intellectual property and restrict republication, copying and redistribution. The practical next step for native content is to ask Outlier about a Kakehashi license, supplied data format, updates, entitlements, attribution, offline rights, territory and fees. No public developer API or published licensing program was found. That is an unknown, not a refusal by the provider. [Outlier terms](https://www.outlier-linguistics.com/pages/terms-and-conditions)

**Value judgment:** medium-to-high educational value for users who want historical formation and sound/meaning relationships. Kakehashi already has optional etymology sections in kanji details and lessons (`src/components/KanjiDetails.tsx`, `src/components/KanjiLessonEtymologySection.tsx`, `src/data/kanjiEtymology.ts`), so this would deepen an existing feature rather than introduce an entirely new study workflow. Avoid presenting Outlier's marketing claims about learning efficiency as independently established outcomes.

**Practical scope:** licensed rich “Kanji origins and components” panels would be the strong version. A link to the product homepage is easy but adds little. Direct handoff to a particular Outlier entry in Kanji Study or Yomiwa must be tested; no provider-supported Outlier-specific entry URL was verified.

**Planning estimate:** a licensing conversation is the first gate. After a usable data/content agreement, a simple content prototype might take several days; a production entitlement, offline cache, asset rendering and update flow is likely measured in weeks. Unknown commercial terms dominate this estimate.

## MaruMori

**Assessment:** a real API exists; narrow read-only integration is promising. A complete native MaruMori client, review submission, due-count dashboard or grammar-content import is not yet established by the reviewed public documentation.

### What is confirmed

The current official knowledge base describes a **MaruMori Public API token** used by Satori Reader to import known MaruMori kanji. That integration runs every 12 hours and lets the user choose a minimum MaruMori SRS stage. It requires MaruMori Plus / an active subscription or Lifetime account. This proves token-based external access to learned-kanji information. It does **not** prove that all account, grammar, queue or review-write endpoints are available. [Official Satori Reader integration guide](https://knowledge.marumori.io/article/433031109/)

MaruMori also officially supports WaniKani-to-MaruMori import: an active MaruMori subscriber supplies a WaniKani v2 token, chooses an SRS threshold and daily or one-time import, and matching vocabulary/kanji are marked known. Already-studied MaruMori items are protected from being overridden. This is not a transfer of WaniKani's actual SRS stage or a bidirectional review sync. [Official WaniKani integration guide](https://knowledge.marumori.io/article/433032107/)

The provider announced the public API as beta in April 2024, inviting developers to Discord. In April 2025, creator `neicul` publicly described the API as beta, largely undocumented and limited to subscribers. These statements are dated evidence; they do not establish the precise October 2026 contract. [Official API announcement](https://marumori.io/changelog?entry=172851825), [creator's April 2025 reply, post 4470](https://community.wanikani.com/t/marumoriio-kitsunio-update-quests-challenges-system-n2-complete-marudex-early-access-release-cross-platform-ocr-immersion-mining-tool-grammar-srs-in-depth-grammar-lessons-reading-exercises-vocabulary-kanji-and-more/30954?page=221)

At research time the official knowledge base's **API & Apps** section still says no articles are available. No first-party public endpoint reference, authorization-scope list, token-revocation procedure, rate-limit contract, due-count endpoint, review-write endpoint, or content-redistribution permission was located. Confirm these with the provider before committing to deeper scope. [Official API & Apps section](https://knowledge.marumori.io/api-apps/)

**Independent implementation precedent:** Nazoru's own current site advertises WaniKani/Bunpro/MaruMori connections using read-only API keys to suggest writing practice based on studied kanji. It explicitly says its practice does not submit reviews to those services. This is first-party evidence about Nazoru's implementation, not an official MaruMori API guarantee or endorsement. [Nazoru developer site](https://nazoru.net/)

### Recommended scope and value

**First spike:** confirm current API access with MaruMori, then validate a user-supplied token can read studied kanji/vocabulary and stages, subscription failures, pagination, caching, rate limits and token lifecycle. Use the result to tailor Kakehashi's writing practice or known-item selection, with source attribution. Keep the provider's review schedule authoritative unless a supported write contract is confirmed.

**Value judgment:** potentially medium-to-high for users studying on both platforms; it could save duplicate work and make practice reflect their existing knowledge. The value depends on demand and the confirmed scope. MaruMori already imports WaniKani, and Kakehashi already has Bunpro integration, so a generic “Open MaruMori” button adds far less than personalized cross-app practice. Do not assume its proprietary grammar lessons or example bank can be copied into Kakehashi.

**Planning estimate:** 2–5 days for an access and data-shape spike after provider clarification; about 1–3 weeks for a narrow read-only connection with settings, secure token storage, caching, matching, error handling and user-visible practice changes. Broader review queues, writes, analytics and content access need separate scope and support confirmation.

## Confidence and next decisions

| Provider | High-confidence feasible scope | Unresolved gate | Incremental value judgment |
| --- | --- | --- | --- |
| Kanji Study | Android entry/drawing/search handoff, subject to installed-version testing | Current scheme behavior; any progress API or export format | Low–medium, useful for existing users |
| Outlier | Discuss licensed content integration; general product link | Commercial license, data delivery, entitlements and update rights | Medium–high depth; partner-dependent |
| MaruMori | Known/studied kanji read integration precedent | Current API contract and subscription/access rules; vocab/grammar/queue/write scopes | Medium–high if it personalizes practice |

Effort estimates are engineering judgments for Kakehashi, not provider promises. No numerical retention, revenue or learning-effect uplift can be inferred from the available evidence; measure feature adoption and repeat use in a pilot.

## YouGlish

**Assessment:** the strongest immediate addition is an external lookup; an embedded Japanese player is technically supported but mobile and commercial usage require explicit provider permission.

The official JavaScript API supports Japanese queries, embedded playback, replay, previous/next results, speed controls, and result/video/caption events. This is an actual documented integration surface. It is not a general license to download the source videos, retain a corpus of captions, or turn clips into redistributed SRS assets. The developer policy specifically requires explicit permission for use in a mobile app and for commercial use. It also specifies YouTube terms/privacy references and applicable cookie disclosures. [Official JavaScript API and developer policy](https://youglish.com/api/doc/js-api)

YouGlish's own Japanese homepage links to searches such as `https://youglish.com/pronounce/%E5%AE%B6%E6%97%8F/japanese`. A user-triggered external browser link using the current vocabulary or selected phrase is a credible small first release. Automated access to that example received bot detection, so player behavior, browser handoff and quotas still need a real user-facing test; no automated bypass was attempted. [Official Japanese page](https://youglish.com/japanese)

**Value judgment:** high relative to effort. From a vocabulary detail, reader selection or saved sentence, “Hear in real videos” would broaden the contexts already offered by Kakehashi's anime-focused vocabulary examples. An embedded player could keep users in their study flow, but an external lookup already supplies much of the discovery benefit. Search availability, pronunciation ambiguity, network requirements, quotas and removed/unavailable YouTube videos remain external dependencies. The service's terms prohibit obtaining its content through scraping or other access outside the APIs. [Official terms](https://youglish.com/terms)

**Planning estimate:** approximately 1–2 engineering days for a narrow external-lookup action across existing appropriate entry points; about 1–2 weeks for an approved, production-quality embedded experience with mobile playback, sizing, navigation, errors and privacy behavior. Provider approval, prices and usage allowances are not included or established. Capturing captions for permanent sentence mining would need separate permission/scope review.

## Japanese Conjugation City — Stoic Knight / Dallas Williams

**Assessment:** a general app/store link is straightforward; targeted exercise links and data synchronization are unverified. The developer's store listings describe a standalone practice app, not an integration API.

The official developer-provided Google Play listing describes nearly 30 verb forms, four adjective conjugations, custom tests, explanations, conjugation tables and local statistics. Its linked developer website timed out during research. No published API, exercise URL scheme, progress export or review-sync documentation was found in the reviewed official material. This is an evidence limit, not proof that the developer cannot provide one. The app also has an iOS listing. [Google Play listing](https://play.google.com/store/apps/details?id=stoicknight.japaneseconjugation), [Apple listing](https://apps.apple.com/us/app/japanese-conjugation-city/id1494607355)

**Value judgment:** low for a generic “Open app” integration, moderate-to-high for the underlying conjugation-practice feature. Kakehashi already links relevant Bunpro grammar to Kaijugation. A future native drill using verbs a learner already knows could add more value than another app launcher, but it would be a separate feature with its own linguistic validation, accepted forms and pedagogical content. Existing conjugation recognition in text highlighting is not proof of a complete teaching or grading engine. No copying of this app's explanations or exercises is proposed.

**Planning estimate:** roughly a day for a generic resource/store link within a shared links interface. A targeted handoff requires the developer's supported route; full integration cannot responsibly be estimated without a contract. A first-party conjugation trainer needs its own specification and estimate.

## JapanesePod101

**Assessment:** there is a live public podcast feed, but a deep lesson/content integration is a provider-agreement project. Even lesson deep links have an explicit published consent requirement.

The provider offers a large structured audio/video library, transcripts, dialogue audio, vocabulary resources and graded subscription access. This could strengthen beginner listening pathways, but account access to paid lessons does not establish permission for Kakehashi to embed or redistribute them. [Official plans/features](https://www.japanesepod101.com/pricing?src=footer)

The public audio RSS endpoint returned HTTP 200 and 78 items during inspection; its newest dated entry was 15 October 2026. It mixes instructional content with promotional items. This verifies a live podcast distribution surface, not a supported API for account history, lesson completion or premium transcripts. Audio enclosures were inspected as metadata; no media was downloaded. [Official public feed](https://www.japanesepod101.com/wp-feed-audio.php)

The provider historically documented a personalized Premium “My Feed” for compatible podcast readers, but that announcement dates to 2008. Current paid-feed access, authentication and permitted app usage were not validated; it is not a confirmed ready-to-ship integration. [Original first-party announcement](https://www.japanesepod101.com/blog/2008/03/18/my-feed/)

The current Terms of Use, dated 4 June 2026 and loaded by the public site's Terms link, limit use to personal/noncommercial purposes absent written agreement, require prior written consent for links beyond the homepage, restrict broader copying/reuse, and require publicly documented interfaces. These published restrictions materially affect a Kakehashi lesson launcher or embedded library. Seek provider confirmation for curated lesson links, podcast playback in Kakehashi, premium feeds, transcripts or progress access before planning that scope. [Current Terms of Use, section 2](https://www.japanesepod101.com/theme/documents/terms_of_use.php)

**Value judgment:** medium potential as curated native-teacher listening, small value from a homepage link alone. A generic podcast player with user-added feeds could benefit more providers, but requires a broader product decision and would not itself grant rights to JapanesePod101's restricted material. No public developer account/progress API was found in the reviewed official material.

**Planning estimate:** a homepage resource link is trivial within the shared links interface. An explicitly authorized public-feed listening prototype is measured in days, with production playlist/resume/download features likely taking weeks. A full paid lesson and progress integration needs both rights and technical access confirmed first; no meaningful fixed estimate or licensing cost is available.

## Recommended scope, effort and validation

1. **Small first release:** contextual YouGlish external search plus Android Kanji Study kanji/drawing handoff. Budget roughly 2–5 engineering days together, including shared placement, installed-app fallback and device/browser testing. This is the best combination of useful scope and known integration surfaces; the historical Android schemes still need current-version verification.
2. **MaruMori discovery:** confirm supported token scopes and data rights, then prototype read-only studied-kanji awareness for writing practice. Budget 2–5 days for the investigation after access is clarified; 1–3 weeks for a narrow production connection if the contract supports it. Keep a clear distinction between known-item awareness and SRS/review synchronization.
3. **Outlier partnership exploration:** determine whether a Kakehashi license and data package are available, whether prior purchases can be recognized, and how updates and offline use work. Its educational value could justify a paid optional pack, but no business terms were obtained.
4. **YouGlish embed:** ask about explicit mobile/commercial permission, approved playback/privacy behavior and quotas. An external-lookup pilot can establish whether enough users want the capability to justify the deeper version.
5. **Defer deep Conjugation City and JapanesePod101 work** until stronger demand or a concrete supported partnership emerges. The former lacks a verified integration surface; the latter has both access and published permission constraints.

No provider was contacted and no implementation, deployment, native build or live study-state mutation was performed. Existing unrelated local code changes were preserved. Research alone cannot justify a percentage forecast of retention or learning improvement. A pilot should measure lookup use, repeat use, return to study, provider-connection adoption and subscriber feedback before expanding scope.
