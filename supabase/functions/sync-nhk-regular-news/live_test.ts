import { createNhkArticleSession, fetchBoundedText } from "./nhk_client.ts";
import { NHK_FEED_URL, normalizeFullArticle, parseNhkRss } from "./parser.ts";

Deno.test({
  name:
    "live NHK accountless reader session returns every current story safely",
  ignore: Deno.env.get("RUN_LIVE_NHK_TESTS") !== "1",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const feedItems = parseNhkRss(await fetchBoundedText(NHK_FEED_URL));
    if (feedItems.length === 0) throw new Error("NHK feed was empty");

    const session = await createNhkArticleSession(feedItems[0].id);
    for (const feedItem of feedItems) {
      const detail = await session.fetchArticle(feedItem.id);
      const row = normalizeFullArticle(detail, feedItem);

      if (!row.is_full_article || !/<(?:p|h2|h3)\b/.test(row.content_html)) {
        throw new Error(`NHK did not return complete text for ${feedItem.id}`);
      }
      if (
        /<script\b|<iframe\b|\son[a-z]+\s*=|javascript:/i.test(
          row.content_html,
        )
      ) {
        throw new Error(`Unsafe markup survived for ${feedItem.id}`);
      }
    }
  },
});
