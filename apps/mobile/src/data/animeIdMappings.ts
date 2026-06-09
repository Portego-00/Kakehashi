/**
 * ID-based mappings from ImmersionKit anime slugs to MAL and AniList IDs.
 *
 * This enables reliable sync between MAL/AniList watched lists and ImmersionKit anime
 * by matching on unique IDs rather than unreliable title matching.
 *
 * How to find IDs:
 * - MAL: https://myanimelist.net/anime/{ID} (e.g., Death Note = 1535)
 * - AniList: https://anilist.co/anime/{ID} (e.g., Death Note = 1535)
 *
 * Note: MAL and AniList IDs are often the same for popular anime, but not always.
 */

export interface AnimeIdMapping {
  /** MyAnimeList anime ID */
  malId?: number;
  /** AniList anime ID */
  aniListId?: number;
}

/**
 * ImmersionKit slug → { malId, aniListId }
 *
 * The key is the ImmersionKit slug (id field from getAvailableAnimes).
 */
export const ANIME_ID_MAPPINGS: Record<string, AnimeIdMapping> = {
  // Popular/Well-known anime
  "death_note": { malId: 1535, aniListId: 1535 },
  "steins_gate": { malId: 9253, aniListId: 9253 },
  "attack_on_titan": { malId: 16498, aniListId: 16498 },
  "shingeki_no_kyojin": { malId: 16498, aniListId: 16498 },
  "fullmetal_alchemist_brotherhood": { malId: 5114, aniListId: 5114 },
  "your_name": { malId: 32281, aniListId: 21519 },
  "kimi_no_na_wa": { malId: 32281, aniListId: 21519 },
  "spirited_away": { malId: 199, aniListId: 199 },
  "sen_to_chihiro_no_kamikakushi": { malId: 199, aniListId: 199 },
  "my_neighbor_totoro": { malId: 523, aniListId: 523 },
  "tonari_no_totoro": { malId: 523, aniListId: 523 },
  "howls_moving_castle": { malId: 431, aniListId: 431 },
  "princess_mononoke": { malId: 164, aniListId: 164 },
  "mononoke_hime": { malId: 164, aniListId: 164 },

  // Slice of Life / Romance
  "toradora": { malId: 4224, aniListId: 4224 },
  "clannad": { malId: 2167, aniListId: 2167 },
  "clannad_after_story": { malId: 4181, aniListId: 4181 },
  "anohana_the_flower_we_saw_that_day": { malId: 9989, aniListId: 9989 },
  "ano_hi_mita_hana_no_namae_wo_bokutachi_wa_mada_shiranai": { malId: 9989, aniListId: 9989 },
  "your_lie_in_april": { malId: 23273, aniListId: 20665 },
  "shigatsu_wa_kimi_no_uso": { malId: 23273, aniListId: 20665 },
  "violet_evergarden": { malId: 33352, aniListId: 21827 },
  "a_silent_voice": { malId: 28851, aniListId: 20954 },
  "koe_no_katachi": { malId: 28851, aniListId: 20954 },
  "weathering_with_you": { malId: 38826, aniListId: 106286 },
  "tenki_no_ko": { malId: 38826, aniListId: 106286 },
  "k_on": { malId: 5680, aniListId: 5680 },
  "k_on_": { malId: 5680, aniListId: 5680 },
  "nichijou": { malId: 10165, aniListId: 10165 },
  "daily_lives_of_high_school_boys": { malId: 11843, aniListId: 11843 },
  "danshi_koukousei_no_nichijou": { malId: 11843, aniListId: 11843 },
  "relife": { malId: 30015, aniListId: 21049 },

  // Action / Shonen
  "naruto": { malId: 20, aniListId: 20 },
  "naruto_shippuden": { malId: 1735, aniListId: 1735 },
  "one_piece": { malId: 21, aniListId: 21 },
  "bleach": { malId: 269, aniListId: 269 },
  "dragon_ball": { malId: 223, aniListId: 223 },
  "dragon_ball_z": { malId: 813, aniListId: 813 },
  "dragon_ball_super": { malId: 30694, aniListId: 21175 },
  "hunter_x_hunter_2011": { malId: 11061, aniListId: 11061 },
  "boku_no_hero_academia": { malId: 31964, aniListId: 21459 },
  "boku_no_hero_academia_season_1": { malId: 31964, aniListId: 21459 },
  "my_hero_academia": { malId: 31964, aniListId: 21459 },
  "demon_slayer": { malId: 38000, aniListId: 101922 },
  "kimetsu_no_yaiba": { malId: 38000, aniListId: 101922 },
  "jujutsu_kaisen": { malId: 40748, aniListId: 113415 },
  "one_punch_man": { malId: 30276, aniListId: 21087 },
  "mob_psycho_100": { malId: 32182, aniListId: 21507 },
  "fairy_tail": { malId: 6702, aniListId: 6702 },
  "sword_art_online": { malId: 11757, aniListId: 11757 },
  "black_clover": { malId: 34572, aniListId: 97940 },
  "chainsaw_man": { malId: 44511, aniListId: 127230 },
  "spy_x_family": { malId: 50265, aniListId: 140960 },
  "tokyo_revengers": { malId: 42249, aniListId: 120120 },

  // Isekai / Fantasy
  "re_zero___starting_life_in_another_world": { malId: 31240, aniListId: 21355 },
  "re_zero": { malId: 31240, aniListId: 21355 },
  "god_s_blessing_on_this_wonderful_world_": { malId: 30831, aniListId: 21202 },
  "konosuba": { malId: 30831, aniListId: 21202 },
  "kono_subarashii_sekai_ni_shukufuku_wo": { malId: 30831, aniListId: 21202 },
  "no_game_no_life": { malId: 19815, aniListId: 19815 },
  "overlord": { malId: 29803, aniListId: 20832 },
  "that_time_i_got_reincarnated_as_a_slime": { malId: 37430, aniListId: 101280 },
  "tensei_shitara_slime_datta_ken": { malId: 37430, aniListId: 101280 },
  "the_rising_of_the_shield_hero": { malId: 35790, aniListId: 99263 },
  "tate_no_yuusha_no_nariagari": { malId: 35790, aniListId: 99263 },
  "mushoku_tensei": { malId: 39535, aniListId: 108465 },
  "mushoku_tensei_jobless_reincarnation": { malId: 39535, aniListId: 108465 },

  // Psychological / Thriller
  "psycho_pass": { malId: 13601, aniListId: 13601 },
  "monster": { malId: 19, aniListId: 19 },
  "parasyte": { malId: 22535, aniListId: 20623 },
  "kiseijuu_sei_no_kakuritsu": { malId: 22535, aniListId: 20623 },
  "mahou_shoujo_madoka_magica": { malId: 9756, aniListId: 9756 },
  "puella_magi_madoka_magica": { malId: 9756, aniListId: 9756 },
  "erased": { malId: 31043, aniListId: 21234 },
  "boku_dake_ga_inai_machi": { malId: 31043, aniListId: 21234 },
  "tokyo_ghoul": { malId: 22319, aniListId: 20605 },
  "death_parade": { malId: 28223, aniListId: 20931 },
  "the_promised_neverland": { malId: 37779, aniListId: 101759 },
  "yakusoku_no_neverland": { malId: 37779, aniListId: 101759 },

  // Mecha / Sci-Fi
  "neon_genesis_evangelion": { malId: 30, aniListId: 30 },
  "code_geass_season_1": { malId: 1575, aniListId: 1575 },
  "code_geass": { malId: 1575, aniListId: 1575 },
  "code_geass_lelouch_of_the_rebellion": { malId: 1575, aniListId: 1575 },
  "gurren_lagann": { malId: 2001, aniListId: 2001 },
  "tengen_toppa_gurren_lagann": { malId: 2001, aniListId: 2001 },
  "cowboy_bebop": { malId: 1, aniListId: 1 },
  "ghost_in_the_shell": { malId: 43, aniListId: 43 },
  "ghost_in_the_shell_stand_alone_complex": { malId: 467, aniListId: 467 },
  "akira": { malId: 47, aniListId: 47 },
  "86_eighty_six": { malId: 41457, aniListId: 116589 },

  // Sports
  "haikyuu": { malId: 20464, aniListId: 20464 },
  "kuroko_no_basket": { malId: 11771, aniListId: 11771 },
  "slam_dunk": { malId: 170, aniListId: 170 },
  "free": { malId: 18507, aniListId: 18507 },
  "yuri_on_ice": { malId: 32995, aniListId: 21709 },
  "run_with_the_wind": { malId: 37965, aniListId: 101903 },
  "kaze_ga_tsuyoku_fuiteiru": { malId: 37965, aniListId: 101903 },
  "blue_lock": { malId: 49596, aniListId: 137822 },

  // Romance / Drama
  "fruits_basket": { malId: 120, aniListId: 120 },
  "fruits_basket_2019": { malId: 38680, aniListId: 105334 },
  "horimiya": { malId: 42897, aniListId: 124080 },
  "kaguya_sama_love_is_war": { malId: 37999, aniListId: 101921 },
  "kaguya_sama_wa_kokurasetai": { malId: 37999, aniListId: 101921 },
  "rent_a_girlfriend": { malId: 40839, aniListId: 113813 },
  "kanojo_okarishimasu": { malId: 40839, aniListId: 113813 },
  "bunny_girl_senpai": { malId: 37450, aniListId: 101291 },
  "seishun_buta_yarou_wa_bunny_girl_senpai_no_yume_wo_minai": { malId: 37450, aniListId: 101291 },
  "oregairu": { malId: 14813, aniListId: 14813 },
  "yahari_ore_no_seishun_love_comedy_wa_machigatteiru": { malId: 14813, aniListId: 14813 },
  "quintessential_quintuplets": { malId: 38101, aniListId: 103572 },
  "go_toubun_no_hanayome": { malId: 38101, aniListId: 103572 },
  "wotakoi": { malId: 35968, aniListId: 99578 },
  "wotaku_ni_koi_wa_muzukashii": { malId: 35968, aniListId: 99578 },
  "my_dress_up_darling": { malId: 48736, aniListId: 132405 },
  "sono_bisque_doll_wa_koi_wo_suru": { malId: 48736, aniListId: 132405 },

  // Mystery / Supernatural
  "hyouka": { malId: 12189, aniListId: 12189 },
  "durarara__": { malId: 6746, aniListId: 6746 },
  "durarara": { malId: 6746, aniListId: 6746 },
  "baccano": { malId: 2251, aniListId: 2251 },
  "bungo_stray_dogs": { malId: 31478, aniListId: 21311 },
  "noragami": { malId: 20507, aniListId: 20507 },
  "mononoke": { malId: 2246, aniListId: 2246 },
  "xxxholic": { malId: 861, aniListId: 861 },

  // Comedy
  "gintama": { malId: 918, aniListId: 918 },
  "konosuba_gods_blessing_on_this_wonderful_world": { malId: 30831, aniListId: 21202 },
  "grand_blue": { malId: 37105, aniListId: 100922 },
  "grand_blue_dreaming": { malId: 37105, aniListId: 100922 },
  "asobi_asobase": { malId: 37171, aniListId: 101001 },
  "saiki_kusuo_no_psi_nan": { malId: 33255, aniListId: 21804 },
  "the_disastrous_life_of_saiki_k": { malId: 33255, aniListId: 21804 },
  "komi_cant_communicate": { malId: 48926, aniListId: 133965 },
  "komi_san_wa_comyushou_desu": { malId: 48926, aniListId: 133965 },

  // Fate Series
  "fate_stay_night": { malId: 356, aniListId: 356 },
  "fate_zero": { malId: 10087, aniListId: 10087 },
  "fate_stay_night_unlimited_blade_works": { malId: 22297, aniListId: 19603 },
  "fate_grand_order": { malId: 34321, aniListId: 97704 },

  // Other Popular Series
  "cardcaptor_sakura": { malId: 232, aniListId: 232 },
  "sailor_moon": { malId: 530, aniListId: 530 },
  "inuyasha": { malId: 249, aniListId: 249 },
  "rurouni_kenshin": { malId: 45, aniListId: 45 },
  "samurai_champloo": { malId: 205, aniListId: 205 },
  "trigun": { malId: 6, aniListId: 6 },
  "made_in_abyss": { malId: 34599, aniListId: 97986 },
  "dr_stone": { malId: 38691, aniListId: 105333 },
  "fire_force": { malId: 38671, aniListId: 105310 },
  "enen_no_shouboutai": { malId: 38671, aniListId: 105310 },
  "assassination_classroom": { malId: 24833, aniListId: 20755 },
  "ansatsu_kyoushitsu": { malId: 24833, aniListId: 20755 },
  "the_devil_is_a_part_timer": { malId: 15809, aniListId: 15809 },
  "hataraku_maou_sama": { malId: 15809, aniListId: 15809 },
  "girls_band_cry": { malId: 56196, aniListId: 163146 },
  "bocchi_the_rock": { malId: 47917, aniListId: 130003 },
  "oshi_no_ko": { malId: 52034, aniListId: 150672 },
  "frieren": { malId: 52991, aniListId: 154587 },
  "sousou_no_frieren": { malId: 52991, aniListId: 154587 },
  "frieren_beyond_journeys_end": { malId: 52991, aniListId: 154587 },
};

/**
 * Get MAL ID for an ImmersionKit anime slug
 */
export function getMalIdForAnime(slug: string): number | undefined {
  return ANIME_ID_MAPPINGS[slug]?.malId;
}

/**
 * Get AniList ID for an ImmersionKit anime slug
 */
export function getAniListIdForAnime(slug: string): number | undefined {
  return ANIME_ID_MAPPINGS[slug]?.aniListId;
}

/**
 * Get ImmersionKit slugs that match a MAL ID
 */
export function getSlugsByMalId(malId: number): string[] {
  return Object.entries(ANIME_ID_MAPPINGS)
    .filter(([_, mapping]) => mapping.malId === malId)
    .map(([slug]) => slug);
}

/**
 * Get ImmersionKit slugs that match an AniList ID
 */
export function getSlugsByAniListId(aniListId: number): string[] {
  return Object.entries(ANIME_ID_MAPPINGS)
    .filter(([_, mapping]) => mapping.aniListId === aniListId)
    .map(([slug]) => slug);
}
