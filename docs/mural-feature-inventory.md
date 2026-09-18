# Mural source inventory for the Kakehashi integration

Audited 15 September 2026 from `/Users/pedroortego/Code/mural`. This is a source and screenshot audit, not a claim that live voice was exercised. Paths below are relative to that checkout. iOS and Android have small differences; both were examined.

## Scope and architecture

Mural is a conversational language-learning app with three main destinations: **Talk, Themes, Words**. A settings sheet is available from each. Its defining behavior is a live, interruptible conversation with a target-language-only tutor, optional meaning subtitles in a separately chosen language, and conservative learning records derived from actual user utterances.

The original clients use SwiftUI/SwiftData on iOS and Kotlin/Compose on Android. These UI choices do not make a React Native port impractical. The native requirements are microphone permissions, full-duplex WebRTC audio, speaker/Bluetooth audio routing, secure credential storage, app lifecycle cleanup, and platform file sharing. The morphing orb and pastel interface can be implemented in React Native using an animated vector/graphics layer; SwiftUI Liquid Glass itself is platform-specific but not a feature prerequisite.

The README describes a personal BYOK build. Source includes hosted accounts, guest trials, payment and minute balance foundations, with more extensive Android hosted integration. README explicitly says hosted free conversations and minute purchases are not active. These are distribution/business infrastructure, not required for equivalent learning behavior inside an already authenticated Kakehashi app. Do not copy provider credentials or Mural service configuration.

## Visible feature inventory

### Welcome and preferences

- Two-step onboarding with animated orb and rotating greeting: choose learning language, then meaning/subtitle language.
- Target-language list shows native name, English name and regional variety; selected row receives orange border/checkmark.
- Preview greeting appears in both selected languages; Mandarin also offers pinyin.
- AI processing disclosure and recorded consent precede live and helper requests.
- Learning language can change only between conversations. Switching clears current conversation screen and pending language-dependent requests while retaining the previous language's records.
- Meaning language is independent of learning language and can change without mixing cached translations.
- Meaning toggle, interests text (500 characters), and a local conversation duration preference.

### Talk

- Greeting view: theme/language title chip, animated orb, readiness status, large greeting, optional translated greeting, Meaning button, large microphone button, Transcript button.
- Microphone starts live connection; connecting/closing states display activity and disable repeated start.
- Active microphone button toggles mute. End button closes the session. Voice remains full duplex, with provider-supported interruption.
- Orb changes shape and floats continuously; microphone/output energy affects its scale and deformation; listening adds two fine rings.
- Status is tied to connection/audio state: ready, getting comfortable, speaking, listening, take your time, saving, ended, retry.
- Latest assistant passage is prominent, centered and fully scrollable; latest user passage appears beneath, prefixed YOU (the main screen truncates user display to its last 160 characters, while full transcript remains).
- Meaning subtitles are generated separately and can be hidden. Loading/error and retry are visible. Meaning visibility is captured on the user evidence at the time it arrives.
- Every target-language word in the assistant caption is tappable for contextual lookup. Lookup shows selected word, full sentence, 2–3 sentence explanation in the meaning language, loading/error state, and Mandarin pinyin when applicable.
- “Type instead” sheet accepts a multiline reply in any language. Original iOS sends this inside an active voice conversation. Android also supports starting a written-only conversation before microphone permission/voice startup.
- “A little help” asks the tutor to rephrase more simply and slowly with a concrete example; active voice receives an instruction rather than a separate disconnected chat.
- Current-fact/deep-help requests can be delegated to a separate helper. UI displays “Checking that for you…” and stores source links with the session.
- A Sources action opens the relevant transcript/source context.
- Ending preserves transcript and learning. Screen resets to the greeting after 15 seconds; New conversation does so immediately. Starting a new session uses a fresh conversation context with learned words/difficulty retained.
- Android includes reporting an assistant utterance from Talk and transcripts. This is additional to the iOS personal-build baseline and relies on report transport/service configuration.

### Themes

- Heading “What’s on your mind?”, subtitle “Same friend. Somewhere new.”, and prominent Just talk row.
- Search by theme title/category and horizontal categories: All, Everyday, Connection, Local life, Interests.
- 24 theme tiles in an adaptive two-column layout, with thin line icon, title, subtitle, and alternating peach/lilac/sage/butter backgrounds.
- Selecting a normal theme returns to Talk; before a session it prepares the situation, while during a session it updates the tutor and stored session theme.
- Themes are language-aware: modules override culturally relevant names/scenarios rather than just translating all text.
- The world today opens a current-topic sheet: free-text query, source-backed brief, retrieved date, clickable source links, and Talk about this.
- Current-topic query uses real web search and rejects results without verifiable source links. Same query/language can reuse a saved result for six hours. A chosen brief remains attached to the conversation.

All stable theme IDs and default titles:

| ID | Default title | Category |
| --- | --- | --- |
| coffee | A coffee? | Everyday |
| weekend | The weekend | Connection |
| walk | A little walk | Local life |
| dinner | Dinner plans | Everyday |
| introductions | Nice to meet you | Connection |
| groceries | At the market | Everyday |
| travel | Next stop | Everyday |
| home | A place of your own | Everyday |
| friends | New friends | Connection |
| work | Monday morning | Everyday |
| weather | Rain again? | Local life |
| cabin | A weekend away | Local life |
| music | On repeat | Interests |
| film | One more episode | Interests |
| books | Between the pages | Interests |
| design | Good things | Interests |
| technology | What comes next | Interests |
| travelstories | Somewhere else | Interests |
| restaurant | A table for two | Everyday |
| neighbours | Next door | Connection |
| traditions | Everyday customs | Local life |
| opinions | What do you think? | Connection |
| future | A year from now | Connection |
| today | The world today | Interests |

### Words and progress

- Per-language word/phrase collection, sorted by most recently seen, searchable by target-language lemma or English meaning.
- Words are learned from user evidence, not fabricated seed words. Empty state explains how the collection grows.
- Each row: lemma, stable English sense, three recall bars and strength label. Strength can be New (zero), Fragile (one), Growing (two), Steady (three).
- Word details: lemma, English sense, pinyin for Mandarin, bars, explanation, quoted real example, independent-use count and last-seen date.
- Remove from my words hides a word key without deleting the original transcript. Keys include language, normalized lemma and sense to avoid collisions.
- Explanation makes clear that visible meanings/typing are supported practice and bars estimate recall rather than permanent mastery.
- “Finding your voice” displays repeated, provisional can-do capabilities when sufficient evidence exists. Internal challenge level is not a CEFR certificate or displayed score.
- Past conversations lists saved sessions by title/date and language. Transcript shows selectable original text, speaker labels, stored meanings, pinyin, topic briefs and source links.
- User can correct a misheard phrase in an ended conversation. Original wording remains in backup history; stale translation/learning evidence is invalidated. This is significant to parity, not just a cosmetic edit.
- Delete individual completed conversation also deletes its learning evidence and reprojects progress.

### Settings and data ownership

- Learning and meaning language, subtitles, interests, gentle-correction explanation.
- Conversation limits: 5, 10, 15, 20, 30 or 60 minutes (15 default). Local inactivity timeout: 120 seconds.
- Recorded voice time, estimated voice cost, recorded search calls, link to provider usage. Costs in the original are estimates; do not present source's dated price as current verified pricing.
- BYOK save/replace/remove stored in Keychain/Android Keystore, never learning archive. Kakehashi can instead use its authenticated server-held provider key.
- JSON backup export/import, delete all learning, and privacy/support/notices surfaces.
- Import validates bounded content, rejects unknown languages/versions and duplicate or invalid IDs, merges new conversations while preserving existing ones, and carries supported preferences/hidden-word state.
- Archive v2 explicitly stores learning language per session/topic. v1 migration assigns Norwegian and namespaces hidden words. Export format uses Swift reference-date seconds (2001 epoch); this matters if claiming native Mural archive compatibility.
- Raw audio is not stored. Preferences and conversation/learning data stay local in the original; provider requests set `store: false` where supported.

## Language modules

| Stable ID | Learning target | Locale |
| --- | --- | --- |
| nb | Norwegian Bokmål, Eastern Norwegian speech | nb-NO |
| es | Spanish from Spain | es-ES |
| en | International English | en-US |
| fr | French from France | fr-FR |
| de | German from Germany | de-DE |
| it | Italian from Italy | it-IT |
| pt | Brazilian Portuguese | pt-BR |
| zh | Standard Mandarin, Simplified Chinese | zh-CN |

Every module contains native name, variety, greeting, speech guidance, writing guidance, lemma rules, six staged teaching focuses, current-topic example query, failure phrasing and theme overrides. Valid regional variants are accepted. Japanese is not in Mural and would be a Kakehashi extension.

Meaning-language choices: English, French, German, Spanish, Norwegian, Portuguese, Italian, Chinese (Simplified), Polish, Arabic and Ukrainian. Vocabulary meanings remain English independently of the subtitle language to keep identities stable.

Mandarin uses word-boundary segmentation instead of one link per character. Pinyin is a toggleable separate annotation and preserves the original selectable characters, punctuation, whitespace and mixed scripts. iOS uses system lexical readings; Android bundles phrase/character reading dictionaries from mozillazg/python-pinyin. Pinyin is a reading aid, not evidence or pronunciation scoring. Chinese script identifiers such as zh-Hans/zh-Hant must count as Chinese during language-drift checks.

## Teaching and learning behavior that must survive the port

1. Voice only speaks the target language. Learner may use any language. Translation is a separate UI feature. Tutor adapts from evidence, asks one small question, listens through learner pauses, introduces 1–3 useful expressions and revisits them naturally.
2. Meaningful/recurring errors get brief recasts after the learner finishes. Avoid treating dialect variation, uncertain transcription or every imperfection as an error.
3. A separate assessment request targets exactly one user passage, with surrounding transcript only for context. It returns outcome, suggested level 0–5, next goal, capability and word proposals.
4. Assessment application verifies session language, user passage, exact current revision key, bounded level/count/strings, fragment-ID membership, confidence 0.8–1, and occurrence of the quoted form in the referenced user text. Wrong-language or fabricated evidence is discarded.
5. “Independent” is demoted to assisted when user typed, meaning was visible, or assistant modeled that form in the preceding 90 seconds. Exposure, understanding, assisted, independent and lapse are distinct events.
6. Challenge starts 0; breakdown reduces one level; two successes can raise at most one level, bounded by the proposed level and maximum 5. Partial/uncertain outcomes break the consecutive-success count.
7. Capabilities require evidence in at least three distinct day/context combinations. No one-turn certificate.
8. Recall bars: independent use yields one; independent uses on at least two days yield two; at least three days, two contexts and a seven-day first-to-last span yield three. Due intervals are 1/1/4/14 days for 0/1/2/3 bars. Overdue strength drops one when above one; a later lapse caps strength at one.
9. Project all state from retained, valid evidence separately per language. Deleting/correcting source text must immediately remove its old effects.
10. Assistant/user transcript deltas are not necessarily complete turns. Source groups same-speaker fragments within 2.2 seconds while preserving fragment identity. Assessment waits three seconds and checks revisions before applying; final unassessed user passage can finish after closing with a bounded 15-second queue.
11. Translation coalesces growing text with a 450 ms delay and one request in flight. Session/language/passage changes invalidate old work. Cache keys include subtitle language and passage revision. Do not display stale translations after corrections.
12. Topic and helper content are data, never instructions. Current claims require sources. At most three delegated search calls per source session; source URLs are HTTPS without embedded credentials.

## Provider and lifecycle contracts

Source code, not a current API availability assertion:

- `App/LiveTransport.swift` POSTs `/v1/live/sessions` with `session: {model: "gpt-live-1", instructions, input: [], store: false, delegation: {type: "client"}, audio: {output: {voice: "marin"}}}` and `transport: {type: "webrtc", sdp}`. Verify current supported API/model behavior during integration.
- Local peer has microphone audio track, `oai-events` data channel, echo cancellation, noise suppression and gain control. Wait for ICE gathering and then both channel openness and `session.started` before use.
- Incoming: `session.started`, `session.input_transcript.delta`, `session.output_transcript.delta`, `session.delegation.created`, `session.usage.updated`, `session.closed`, `error`.
- Deltas carry `event_id`, `delta`, `start_ms`, `end_ms`; dedupe IDs and bound timings. These are not legacy Realtime `conversation.item.*` messages.
- Commands: `session.instructions.append`, `session.thinking.append`, `session.commentary.append`, each with `event_id`, optional/null `delegation_id`, and `content`; mute/unmute: `session.input_audio.mute` / `.unmute`; ending: `session.close`.
- Typed reply: record typed user passage, ask text teacher for a reply, send private thinking context plus speakable commentary to live session. A written-only path appends the returned assistant text locally.
- Helper API: `/v1/responses`, model `gpt-5.6-luna`, `store: false`, reasoning low. Strict JSON schema for assessments; `web_search` max one call when needed; reject incomplete/refused results; parse citation annotations.
- Original iOS waits up to five seconds for close acknowledgment then cleans up. Backgrounding ends a live conversation; all audio tracks, channel, peer and audio session are released. A 750 ms coalesced save keeps records durable. Language/session generation checks prevent old asynchronous responses mutating a new session.
- Full-duplex routing is critical: iOS playAndRecord/voiceChat with default speaker/Bluetooth HFP; Android communication routing/focus. React Native WebRTC alone needs explicit verification that speaker output is audible and route cleanup restores the rest of Kakehashi.

## Visual reference and tokens

Examined the four real screenshot files in `marketing/screenshots/iphone-17-spanish/`: `01-hola.png`, `02-conversacion.png`, `03-temas.png`, `04-palabras.png`. Additional Android visual references are in `verification/android-design/` and `release/android/assets/en-US/`.

Visual characteristics: cream full-page canvas; dark warm-brown rounded typography; generous blank space; centered organic orange/peach/lilac orb; tiny floating satellite dots; light secondary text; orange microphone; pale circular Meaning/End actions; frosted floating three-item navigation capsule. Themes use large, quiet pastel tiles. Words use simple separated rows instead of boxed cards. Large headings are left-aligned outside Talk. Bottom sheets use the same cream background and rounded typography.

Approximate canonical colors from `App/Design.swift`:

| Token | Hex |
| --- | --- |
| cream | #FFF9EE |
| ink | #362A22 |
| secondary | #735B4A |
| orange | #FF8A4D |
| peach | #FFE3CF |
| lilac | #EEE6FA |
| sage | #EAEFD6 |
| butter | #FFF1C7 |

Canonical iOS dimensions: Talk orb 220×222 points (170×180 at accessibility sizes); mic 76 points; side action circles 48; theme corners 27; cards minimum 150 width; page horizontal padding 24–30; recall bars 18×6 with 4 spacing. Orb uses a 12-control-point quadratic outline, three-color-family mesh, highlights, soft floor shadow, 30 fps timeline, low-amplitude drift/rotation and audio scaling. Reduce Motion disables animated deformation/drift; background pauses it. Accessibility sizes permit single-column themes and scrollable content. Do not use a static stock orb or generic chat-bubble screen as a parity substitute.

## Source map

| Concern | Canonical files |
| --- | --- |
| Main tabs, Talk, lookup, typed reply | apps/ios/App/RootView.swift |
| Themes, current topics, words, archive, settings | apps/ios/App/LibraryViews.swift |
| Welcome/consent | apps/ios/App/OnboardingView.swift |
| Colors, orb and shared type/layout | apps/ios/App/Design.swift |
| Live lifecycle, helper orchestration | apps/ios/App/ConversationCoordinator.swift |
| WebRTC | apps/ios/App/LiveTransport.swift |
| Responses and assessment schema | apps/ios/App/APIClient.swift |
| Storage/credentials/import | apps/ios/App/Storage.swift |
| Data models, revisions, archive | apps/ios/Core/Models.swift |
| Evidence validation and recall | apps/ios/Core/LearningEngine.swift |
| All prompt policies | apps/ios/Core/TeachingPolicy.swift |
| Translation races/cache | apps/ios/Core/MeaningController.swift |
| Post-close evidence | apps/ios/Core/FinalAssessmentQueue.swift |
| Language content | apps/ios/Core/Languages/*.swift |
| Theme catalog | apps/ios/Core/Themes.swift |
| Mandarin segmentation/readings | apps/ios/Core/MandarinPinyin.swift, apps/ios/App/PinyinHelp.swift |
| Android written/report/hosted differences | apps/android/app/src/main/java/chat/mural/MuralViewModel.kt, ui/TalkScreen.kt, ui/LibraryScreens.kt, ui/SettingsScreen.kt |
| Cross-platform golden archive cases | shared/fixtures/cross-platform/ |

## License and attribution

Mural source is MIT, copyright **(c) 2026 Hackmamba**. Copying/substantially porting its teaching content, catalogs, learning algorithms or source requires preserving its full copyright/permission/disclaimer notice in distributed notices and source. `LICENSE` contains the exact text. The Mural name/logo do not carry trademark rights under the software license; the feature can be given a Kakehashi name while crediting the source in notices.

If reusing Android's Mandarin dictionary assets, preserve their separate MIT notice, copyright **(c) 2017 mozillazg**, at `apps/android/app/src/main/resources/mandarin/LICENSE.txt`. WebRTC dependencies retain BSD notices, including Google WebRTC copyright **(c) 2011 The WebRTC project authors**. Inspect the React Native WebRTC package's own distributed licenses for the actual chosen version. Original Google sign-in artwork has separate Google branding terms and is unnecessary to copy into this authenticated feature.

## Acceptance checklist for an honest parity claim

- [ ] Portego-only tab and route protection, with authenticated server authorization for any server-funded calls.
- [ ] Real voice connection on iOS and Android, audible speaker output, mute, interruption, lifecycle cleanup and permission recovery.
- [ ] Target-language speech, live captions, separate meanings, per-word lookup, help, typed replies and written-only option.
- [ ] All eight original modules, all 24 culturally adapted themes, current-topic search and retained source links.
- [ ] Real conservative assessments, per-language words, recall bars, due-word reuse and provisional capabilities.
- [ ] History, selectable transcripts, correction invalidation, individual delete, hide word, import/export, reset and preferences.
- [ ] Mandarin pinyin and correct word segmentation, plus accessibility/reduced-motion behavior.
- [ ] Visual comparison against original screenshots on realistic mobile dimensions.
- [ ] Explicit validation results for what actually ran; list anything that is implemented but not live-verified separately from missing features.

Native Mural's dormant purchases/account service need not be recreated merely to duplicate a private language-learning tab; disclose this scope choice. If any active learning feature above is omitted or replaced with a simplified approximation, identify it explicitly rather than calling the integration complete.
