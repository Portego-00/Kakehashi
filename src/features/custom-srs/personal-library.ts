import { z } from "zod";
import { EMPTY_PERSONAL_LIBRARY, personalEntrySchema, personalPageSchema, personalLibraryPacks, type PersonalLibrary, type PersonalMutation as WebPersonalMutation } from "../../../web/src/features/custom-srs/personal-vocabulary";

export { EMPTY_PERSONAL_LIBRARY, personalLibraryPacks };
export type { PersonalLibrary, PersonalEntry, PersonalOperation, PersonalWordInput } from "../../../web/src/features/custom-srs/personal-vocabulary";
export type PersonalMutation = { action: "mutate_library" } & Omit<WebPersonalMutation, "accountId">;
type Request = (token: string, action: object) => Promise<unknown>;
const librarySchema = z.object({ revision: z.number().int().min(0), entries: z.record(z.string(), personalEntrySchema) });
const saveResultSchema = z.object({ revision: z.number().int().min(0), added: z.number().int().min(0), skipped: z.number().int().min(0), changed: z.number().int().min(0) });

export function parsePersonalLibrary(value: unknown): PersonalLibrary {
  const library = librarySchema.parse(value);
  for (const [id, entry] of Object.entries(library.entries)) {
    if (entry.id !== id || entry.revision > library.revision) throw new Error("Your vocabulary library cache could not be read safely.");
  }
  return library;
}

/** Read every page at one revision before exposing new definitions to study. */
export async function syncNativePersonalLibrary(token: string, base: PersonalLibrary, request: Request): Promise<PersonalLibrary> {
  let after = base.revision, afterId = "", until: number | undefined;
  const entries = { ...base.entries };
  for (let index = 0; index < 100; index++) {
    const page = personalPageSchema.parse(await request(token, { action: "read_library", after, afterId, ...(until === undefined ? {} : { until }) }));
    if (page.revision < base.revision || (until !== undefined && page.revision !== until)) throw new Error("Your vocabulary library returned an invalid revision.");
    for (const entry of page.entries) {
      if (entry.revision > page.revision || entry.revision < after || (entry.revision === after && entry.id <= afterId)) throw new Error("Your vocabulary library returned an invalid page.");
      entries[entry.id] = entry;
    }
    if (!page.cursor) return { revision: page.revision, entries };
    if (page.cursor.revision < after || (page.cursor.revision === after && page.cursor.id <= afterId)) throw new Error("Your vocabulary library returned a repeated page.");
    until = page.revision; after = page.cursor.revision; afterId = page.cursor.id;
  }
  throw new Error("The vocabulary library exceeded its supported size.");
}

export async function saveNativePersonalLibrary(token: string, mutation: PersonalMutation, request: Request) {
  return saveResultSchema.parse(await request(token, mutation));
}
