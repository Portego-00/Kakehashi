# Design — Kakehashi Web

Locked multi-page design system. Every route defers to this file. Amend it
intentionally; do not introduce page-local visual themes.

## System

- Genre · modern-minimal, shaped by the installed Kakehashi app rather than a generic dashboard
- Audience · committed WaniKani learners moving between daily queues, focused drills, progress, and reading tools
- Theme · studied-DNA from the installed Kakehashi app (vibe: “native study workspace, exact feedback”)
- Axes · dark-first neutral surfaces / compact grotesque / blue actions / restrained WaniKani pink signal

## Macrostructure family

- App pages · Workbench. A floating three-part app bar with centered primary navigation, compact page title, then task surfaces. The app bar condenses after a deliberate scroll threshold without changing the document’s header height.
- Authentication · Static Welcome. The login route uses a calm, cardless brand-and-form diptych on one warm neutral canvas: the full Kakehashi lockup, one short study statement, and the existing crab-throne illustration as a compact supporting asset occupy the quieter column, while WaniKani account access remains the single task. The illustration is capped at 16rem and never becomes a hero or stage. Narrow viewports collapse to one column without changing reading order. Authentication uses no product reel, feature list, full-width raster hero, video, gradient, fake device or browser chrome, glass, raised form card, decorative divider, or timed presentation.
- Study sessions · Focused Prompt. A full-width subject-colour prompt stage, a narrow prompt-type strip, then one aligned answer or lesson-detail region. Answers and hints stay hidden until the learner submits.
- Content pages · Long Document or dense media index. Reading measure is narrow; news and library indexes use image-led rows or carousels.
- Settings · A continuous section list on native with compact text, persistent quick jumps and search in the header. Desktop uses a category rail, and narrow web screens use a category selector. Illustrated selection cards handle answer modes, theme and layout. Related advanced preferences live in named disclosures; native expansion animates over 220 ms and respects Reduce Motion.

## Tokens

`tokens.css` is the single source of truth for colour, type, spacing, radius,
motion, depth, and layering. Components consume semantic variables and do not
repeat literal theme values.

## Structure

- Desktop uses the installed app’s three-part app bar inside one hovering chip: learner identity with level and Guru+ kanji count left, text-led primary destinations in the centre, and monochrome utility icons right. Detail routes add a contextual back control before the identity; it enters from the left while the identity makes room, and uses browser history with a logical parent fallback. At the top the username sits above both learner stats; after 80 px of scroll the username recedes while level and kanji remain visible as the chip visually narrows with transform-only motion. Subject detail routes reveal a compact subject-colour identity bar from behind the app bar only after the full subject stage has cleared it; the character, meaning, reading, and level remain available and return the learner to the stage when pressed.
- Authentication, startup, and app chrome use the crab-on-bridge Kakehashi mark. Do not substitute a Japanese text glyph for the project logo.
- Mobile uses an edge-to-edge bottom dock and a compact top bar. Secondary destinations live in one accessible More sheet.
- App pages begin with compact, left-aligned headers; no dashboard heroes or breadcrumb strip.
- Dashboard order follows the app: vacation or queue status, SRS and level progress, Extra Study carousel, forecast, then supporting analytics. Queue and Extra Study use native-style cards; analytical sections use a varied card grid with truthful pie and bar charts. Unrelated metrics are not paired merely because space is available.
- Lists, separators, background changes, and subject-colour stages carry hierarchy. Use at most one containment boundary per section and never nest bordered panels.
- Carousels bleed to the page edges, preserve a partial next item, and provide visible manual controls. Their cards use equal content geometry.
- Charts have a defined plotting area, visible baseline, tabular values, and a truthful scale. Zero values sit on the baseline; non-zero values visibly rise.
- Product chrome and settings use consistent Lucide outlines. Settings geometry is shared in `src/ui/settings/artwork.ts` with explicit semantic mappings; avoid substring guesses or repeating sliders for unrelated settings. Use official brand geometry for Patreon and GitHub. Native quick navigation icons are 15 px; rows are 20–24 px. Do not place icons in decorative coloured tiles.
- Reviews and lessons share one vertical grammar: progress/actions, subject-colour prompt, prompt type, answer or explanation, then controls/details. Desktop side rails are not used for answer content.
- Answer-mode settings use simplified sketches of that review layout: a kanji prompt, question strip, then typing, choices or reveal-and-grade controls. Native uses compact choices in a row; narrow web screens pair each sketch and label in a full-width row.
- WaniKani radical, kanji, and vocabulary colours indicate subject meaning only.
- Community follows the native Issues layout: status tabs, search, issue rows, and a single compose action.

## CTA voice

- Primary · action-blue fill · 10 px radius · 44 px minimum height · full width only for session-start or submit actions
- Secondary · transparent with a visible neutral border · same geometry
- Links · text or underline; never a card pretending to be a link

## Motion stance

- Silent and state-led: 100 ms press, 180–220 ms menu/content crossfade, progress change, async loading. Persistent chrome motion is reserved for the app-bar scroll morph and the subject identity bar that continues the same header transition. Authentication has no decorative, timed, or feature motion; only direct form feedback may move.
- No card lift, universal reveal, bounce, gradient motion, or decorative looping.
- Focus rings appear instantly. Reduced-motion fallback removes spatial motion and keeps functional transitions at or below 150 ms.

## Copy

- Name the action and the data. Remove redundant setup instructions and decorative eyebrows.
- Errors state what failed and the next action without “Oops” or exclamation marks.

## Exports

`tokens.css` is the source of truth for every route and theme.

- Large settings selectors preview actual screens through `src/ui/settings/screen-previews.ts`. Use enlarged content crops: plain words, filled vocabulary chips, thick parsed-word underlines or broad quiz blanks/choices. Keep one platform cue: a single native reading column versus a web inspector or video beside the lyrics. Avoid tiny titles, thumbnails and timestamps. Theme, lesson layout and Anki scope previews follow each platform’s UI. Web reader recognition previews switch between News and Lyrics without changing preferences.

- Preference rows use compact 20 px Lucide icons with explicit semantic IDs in `src/ui/settings/row-icons.ts`. Match the behavior and share a glyph when the action is the same; avoid broad label guesses or a generic sliders fallback. Keep large screen previews and brand marks. Account uses a shield/person mark and Profile uses a circled person.

- Section headings use a stronger weight and a subtle surface tint; body controls retain compact sizing. Review navigation uses a clipboard/check icon, while Bunpro uses its official mark. Theme order is System, Light, Dark, Sepia, Midnight.
- Native section jumps issue one measured scroll. Keep the destination selected during programmatic movement; direct dragging resumes normal section tracking immediately.
