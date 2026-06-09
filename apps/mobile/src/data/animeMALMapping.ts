/**
 * Manual mapping overrides for ImmersionKit anime → MyAnimeList anime IDs.
 *
 * For most anime the service automatically searches MAL by title and picks the
 * best match. Only add entries here when the automatic search returns wrong
 * results or fails to find the anime.
 *
 * How to add an entry:
 *   1. Open the anime selection screen and note which anime has the wrong image.
 *   2. Find the correct anime on https://myanimelist.net
 *   3. Copy the MAL ID from the URL, e.g. https://myanimelist.net/anime/1535/Death_Note → 1535
 *   4. Add:  "immersionkit_slug": { malId: 1535 }
 *
 * You can also provide an alternative search title instead of a direct ID:
 *      "immersionkit_slug": { searchTitle: "Better Search Term" }
 */

export interface AnimeMALOverride {
  /** Direct MAL anime ID – bypasses search entirely. */
  malId?: number;
  /** Alternative title to search on MAL when the ImmersionKit title doesn't match. */
  searchTitle?: string;
}

/**
 * ImmersionKit slug → MAL override.
 *
 * The key is the ImmersionKit slug (the `id` field returned by getAvailableAnimes).
 * Add entries only for anime that aren't found correctly via automatic title search.
 */
export const ANIME_MAL_OVERRIDES: Record<string, AnimeMALOverride> = {
  // ─── Corrected entries (MAL search returned wrong series/season) ─────
  "your_name": { malId: 32281 },                                    // Kimi no Na wa (Shinkai film), not Bleach movie
  "death_note": { malId: 1535 },                                    // Main TV series, not Rewrite special
  "clannad": { malId: 2167 },                                       // TV series, not the movie
  "re_zero___starting_life_in_another_world": { malId: 31240 },     // Main TV series, not manner movie
  "steins_gate": { malId: 9253 },                                   // TV series, not the movie
  "mahou_shoujo_madoka_magica": { malId: 9756 },                    // Original Madoka Magica, not Magia Record
  "psycho_pass": { malId: 13601 },                                  // Season 1, not Season 2
  "boku_no_hero_academia_season_1": { malId: 31964 },               // Season 1, not Season 3
  "mononoke": { malId: 2246 },                                      // Mononoke (horror series), not Princess Mononoke
  "cardcaptor_sakura": { malId: 232 },                              // TV series, not the movie
  "anohana_the_flower_we_saw_that_day": { malId: 9989 },            // TV series, not the movie
  "fairy_tail": { malId: 6702 },                                    // Original series, not 2014
  "durarara__": { malId: 6746 },                                    // Season 1, not x2 Shou
  "fate_zero": { malId: 10087 },                                    // Season 1, not 2nd Season
  "sword_art_online": { malId: 11757 },                             // Season 1, not SAO II
  "girls_band_cry": { malId: 56196 },                               // TV series, not compilation movie
  "relife": { malId: 30015 },                                       // TV series, not Kanketsu-hen OVA
};
