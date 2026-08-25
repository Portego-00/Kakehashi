jest.mock("../../lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

import { normalizeSupabaseRegularArticles } from "../NhkNewsService";
import fetchMock from "jest-fetch-mock";

const runLiveTests = process.env.RUN_LIVE_NHK_TESTS === "1";
const liveTest = runLiveTests ? test : test.skip;

liveTest(
  "the public Supabase response maps to complete safe regular-news items",
  async () => {
    fetchMock.dontMock();
    const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!projectUrl || !anonKey) {
      throw new Error("Live Supabase test credentials are not configured");
    }

    const response = await fetch(
      `${projectUrl}/rest/v1/nhk_regular_articles?select=id,title,canonical_url,guid,published_at,image_url,audio_url,content_html,is_full_article&is_full_article=eq.true&order=published_at.desc&limit=20`,
      { headers: { apikey: anonKey } },
    );
    if (!response.ok) {
      throw new Error(`Live Supabase query failed with ${response.status}`);
    }

    const rows = (await response.json()) as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);

    const invalidIds = rows
      .filter((row) => normalizeSupabaseRegularArticles([row]).length !== 1)
      .map((row) => row.id);
    expect(invalidIds).toEqual([]);

    const items = normalizeSupabaseRegularArticles(rows);
    expect(items).toHaveLength(rows.length);
    expect(items.every((item) => item.isFullArticle)).toBe(true);
    expect(items.every((item) => Boolean(item.imageUrl))).toBe(true);
  },
  20_000,
);
