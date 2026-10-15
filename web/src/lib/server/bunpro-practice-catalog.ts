import "server-only";
import { z } from "zod";
import type { PracticeGrammar } from "@/features/bunpro/practice";
import { sanitizeText } from "@/features/bunpro/model";
import { BunproError, bunproRequest } from "./bunpro";

const grammarSchema = z.object({
  id: z.string().regex(/^\d+$/),
  type: z.literal("reviewable_base_attribute_grammar_w_streak"),
  attributes: z.object({ slug: z.string().min(1), title: z.string(), meaning: z.string(), level: z.string(), streak: z.number().int().min(0).max(12).nullable() }),
});
const resourcesSchema = z.object({ included: z.array(z.unknown()) });

/** The read-only catalog used by Bunpro's Cram builder; it includes non-due and unstudied grammar. */
export async function loadBunproPracticeCatalog(token: string): Promise<{ grammar: PracticeGrammar[] }> {
  const decks = z.object({ data: z.array(z.object({ id: z.string().regex(/^\d+$/), type: z.literal("deck") })).min(1).max(10) }).safeParse(await bunproRequest(token, "/cram/load_category_decks?category=grammar"));
  if (!decks.success) throw new BunproError("Bunpro returned an unreadable grammar catalog. Try again.", 502);
  const grammar = new Map<string, PracticeGrammar>();
  for (let offset = 0; offset < decks.data.data.length; offset += 3) {
    const contents = await Promise.all(decks.data.data.slice(offset, offset + 3).map(deck => bunproRequest(token, `/cram/load_deck_contents?id=${deck.id}`)));
    for (const content of contents) {
      const parsed = resourcesSchema.safeParse(content);
      if (!parsed.success) throw new BunproError("Bunpro returned unreadable grammar progress. Try again.", 502);
      for (const resource of parsed.data.included) {
        if (!resource || typeof resource !== "object" || !("type" in resource) || resource.type !== "reviewable_base_attribute_grammar_w_streak") continue;
        const item = grammarSchema.safeParse(resource);
        if (!item.success) throw new BunproError("Bunpro returned unreadable grammar progress. Try again.", 502);
        const { slug, title, meaning, level, streak } = item.data.attributes;
        grammar.set(item.data.id, { id: item.data.id, slug, title: sanitizeText(title), meaning: sanitizeText(meaning), level, streak });
      }
    }
  }
  if (!grammar.size) throw new BunproError("Bunpro returned no grammar points. Try again.", 502);
  return { grammar: [...grammar.values()] };
}
