import { supabase } from "../lib/supabase";

export const TranslationCacheService = {
  async getCachedTranslation(articleId: string): Promise<string[] | null> {
    try {
      const { data, error } = await supabase
        .from("news_translations")
        .select("translations")
        .eq("article_id", articleId)
        .single();

      if (error) {
        if (error.code !== "PGRST116") {
          // PGRST116 is "Row not found"
          console.log("Error fetching cached translation:", error);
        }
        return null;
      }

      return data?.translations || null;
    } catch (err) {
      console.error("Unexpected error fetching cached translation:", err);
      return null;
    }
  },

  async saveTranslation(
    articleId: string,
    translations: string[]
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("news_translations")
        .insert([{ article_id: articleId, translations: translations }]);

      if (error) {
        console.error("Error saving translation to cache:", error);
      }
    } catch (err) {
      console.error("Unexpected error saving translation to cache:", err);
    }
  },
};
