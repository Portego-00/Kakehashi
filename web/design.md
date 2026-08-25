# Design — Kakehashi Web

Locked multi-page design system. Every route defers to this file. Amend it
intentionally; do not introduce page-local visual themes.

## System

- Genre · modern-minimal, shaped by the installed Kakehashi app rather than a generic dashboard
- Audience · committed WaniKani learners moving between daily queues, focused drills, progress, and reading tools
- Theme · studied-DNA from the installed Kakehashi app (vibe: “native study workspace, exact feedback”)
- Axes · dark-first neutral surfaces / compact grotesque / blue actions / restrained WaniKani pink signal

## Macrostructure family

- App pages · Workbench. A full-width app bar, centered segmented primary navigation, compact page title, then task surfaces.
- Authentication · Native Welcome. The login route uses the installed app’s purple-to-pink field, crab-throne illustration, full Kakehashi lockup, and a single raised light form surface. This is the only app route allowed to use that gradient and branded hero artwork.
- Study sessions · Focused Prompt. A full-width subject-colour prompt stage, a narrow prompt-type strip, then one aligned answer or lesson-detail region. Answers and hints stay hidden until the learner submits.
- Content pages · Long Document or dense media index. Reading measure is narrow; news and library indexes use image-led rows or carousels.
- Settings · Native grouped list. Horizontal category strip, section surfaces, full-width rows, and right-edge controls.

## Tokens

`tokens.css` is the single source of truth for colour, type, spacing, radius,
motion, depth, and layering. Components consume semantic variables and do not
repeat literal theme values.

## Structure

- Desktop uses the installed app’s three-part app bar: learner identity left, text-led primary destinations in the centre, and monochrome utility icons right.
- Authentication, startup, and app chrome use the crab-on-bridge Kakehashi mark. Do not substitute a Japanese text glyph for the project logo.
- Mobile uses an edge-to-edge bottom dock and a compact top bar. Secondary destinations live in one accessible More sheet.
- App pages begin with compact, left-aligned headers; no dashboard heroes or breadcrumb strip.
- Dashboard order follows the app: vacation or queue status, activity/study status, Extra Study carousel, forecast, then supporting analytics. Sections are full-width bands or grouped rows; unrelated metric cards are not paired merely because space is available.
- Lists, separators, background changes, and subject-colour stages carry hierarchy. Use at most one containment boundary per section and never nest bordered panels.
- Carousels bleed to the page edges, preserve a partial next item, and provide visible manual controls. Their cards use equal content geometry.
- Charts have a defined plotting area, visible baseline, tabular values, and a truthful scale. Zero values sit on the baseline; non-zero values visibly rise.
- Lucide is the only icon family. Product icons are 16–20 px, monochrome, and inline with labels or actions. Do not place feature icons in coloured rounded tiles.
- Reviews and lessons share one vertical grammar: progress/actions, subject-colour prompt, prompt type, answer or explanation, then controls/details. Desktop side rails are not used for answer content.
- WaniKani radical, kanji, and vocabulary colours indicate subject meaning only.
- Community follows the native Issues layout: status tabs, search, issue rows, and a single compose action.

## CTA voice

- Primary · action-blue fill · 10 px radius · 44 px minimum height · full width only for session-start or submit actions
- Secondary · transparent with a visible neutral border · same geometry
- Links · text or underline; never a card pretending to be a link

## Motion stance

- Silent and state-led: 100 ms press, 180–220 ms menu/content crossfade, progress change, async loading.
- No card lift, universal reveal, bounce, gradient motion, or decorative looping.
- Focus rings appear instantly. Reduced-motion fallback removes spatial motion and keeps functional transitions at or below 150 ms.

## Copy

- Name the action and the data. Remove redundant setup instructions and decorative eyebrows.
- Errors state what failed and the next action without “Oops” or exclamation marks.

## Exports

`tokens.css` is the source of truth for every route and theme.
