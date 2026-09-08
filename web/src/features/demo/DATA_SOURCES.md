# Demo study data

The level 21 account and its assignments, statistics, review history, notes, and
level progressions are synthetic. No private WaniKani account or API token was
used to produce these fixtures.

The synthetic account uses repeatable variation in level durations, assignment
stages, due dates, answer totals, and activity dates. Its timeline is anchored to
the first demo visit and saved in the dedicated demo browser store, so refreshing
does not reshuffle progress. Visitor reviews update that history locally.

`wanikani-subjects.generated.json` contains the visible level 1–21 kanji and
vocabulary facts from the repository's September 1, 2026 snapshots:

- `research/data/wanikani-kanji-levels.snapshot.json`
- `research/data/wanikani-vocabulary-exclusions.snapshot.json`

Kanji readings and visually similar kanji were verified against the corresponding
public [WaniKani kanji pages](https://www.wanikani.com/kanji) on September 7, 2026.
The 60 vocabulary audio entries link to the pronunciation recordings exposed on
the corresponding public WaniKani vocabulary pages (for example,
[日本](https://www.wanikani.com/vocabulary/%E6%97%A5%E6%9C%AC)). Each subject retains
its public source URL. Audio remains hosted by WaniKani. Context sentences were
written specifically for this demo; WaniKani mnemonics were not copied.

`radicals.generated.json`, exported as `DEMO_RADICAL_FACTS` from `radicals.ts`,
contains the complete 340-radical inventory listed on the public WaniKani level
pages for levels 1–21 on September 8, 2026. Each radical's exact subject ID was
read from its public page's `subject_id` metadata, and its level was cross-checked
against both the level listing and its own page. Names, slugs, characters, and
source URLs come from those live pages. Eight image-only radicals retain their
official hosted SVG URLs; all eight URLs were checked successfully.

The [level 21 listing](https://www.wanikani.com/level/21) contains Blade (393),
Blame (321), Half (305), Mohawk (276), Next (278), Number (280), Simultaneous
(277), and Spear (148). The fixture also includes 1,535 radical-to-kanji
relationships from the public "Found In Kanji" sections, restricted to kanji
already present in the demo's level 1–21 catalog. Six level 21 relationships
were independently checked against kanji component sections, including
[Blade → 認](https://www.wanikani.com/kanji/%E8%AA%8D),
[Half → 判](https://www.wanikani.com/kanji/%E5%88%A4), and
[Mohawk → 敵](https://www.wanikani.com/kanji/%E6%95%B5).
Live HTML was used because cached search results can show levels from before
WaniKani's recent subject releveling. No radical mnemonics were copied.

`study-examples.generated.json` contains a small curated selection of real anime
examples from [ImmersionKit](https://www.immersionkit.com/), retrieved on September
7, 2026 through its public `apiv2.immersionkit.com` search and index metadata.
Each example retains its original sentence, translation, source identifier,
title, and hosted media URLs. Candidates were checked for the intended vocabulary
sense; names, counters, and helper-verb matches were excluded. These fixtures
remove the need for live search during demo listening practice. Playback still
requires access to the media host, just as ordinary listening practice does.

Only the fictional demo account's browser storage is written by the demo
WaniKani adapter. Unknown endpoints fail locally, and no demo review, note,
lesson, or statistic is sent to WaniKani.
