"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { isDemoMode } from "@/features/demo/runtime";
import { EMPTY_PERSONAL_LIBRARY, personalLibraryPacks, personalPageSchema, type PersonalLibrary, type PersonalMutation } from "./personal-vocabulary";
import { loadPersonalLibraryCache, savePersonalLibraryCache } from "./personal-library-cache";

export async function syncPersonalLibrary(scope: string, base: PersonalLibrary, signal?: AbortSignal): Promise<PersonalLibrary> {
  let after = base.revision, afterId = "", until: number | undefined;
  const entries = { ...base.entries };
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const query = new URLSearchParams({ accountId: scope, after: String(after), afterId });
    if (until !== undefined) query.set("until", String(until));
    const response = await fetch(`/api/custom-vocabulary?${query}`, { signal, cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Your private vocabulary could not load.");
    const page = personalPageSchema.parse(payload);
    if (page.revision < base.revision || (until !== undefined && page.revision !== until)) throw new Error("Your library returned an invalid revision.");
    for (const entry of page.entries) {
      if (entry.revision > page.revision || entry.revision < after || (entry.revision === after && entry.id <= afterId)) throw new Error("Your library returned an invalid page.");
      entries[entry.id] = entry;
    }
    if (!page.cursor) return { revision: page.revision, entries };
    if (page.cursor.revision < after || (page.cursor.revision === after && page.cursor.id <= afterId)) throw new Error("Your library returned a repeated page.");
    until = page.revision; after = page.cursor.revision; afterId = page.cursor.id;
  }
  throw new Error("The library exceeded its supported size.");
}
const saveResultSchema = z.object({ revision: z.number().int().min(0), added: z.number().int().min(0), skipped: z.number().int().min(0), changed: z.number().int().min(0) });

export function usePersonalLibrary(scope: string, enabled = true, expectedRevision = 0) {
  const client = useQueryClient();
  const key = useMemo(() => ["personal-vocabulary", scope] as const, [scope]);
  const active = useRef(scope);
  useEffect(() => { active.current = scope; return () => { active.current = ""; }; }, [scope]);
  const query = useQuery({
    queryKey: key, enabled: enabled && !isDemoMode() && !["anonymous", "pending", ""].includes(scope), staleTime: 30_000, retry: 1,
    queryFn: async ({ signal }) => {
      const cached = client.getQueryData<PersonalLibrary>(key) ?? await loadPersonalLibraryCache(scope);
      const incoming = await syncPersonalLibrary(scope, cached, signal);
      const current = client.getQueryData<PersonalLibrary>(key);
      const next = current && current.revision > incoming.revision ? current : incoming;
      void savePersonalLibraryCache(scope, next);
      return next;
    },
  });
  useEffect(() => {
    if (enabled && expectedRevision > (query.data?.revision ?? 0)) void client.invalidateQueries({ queryKey: key, exact: true });
  }, [enabled, expectedRevision, client, key, query.data?.revision]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === `personal-vocabulary:${scope}:revision`) {
        void client.invalidateQueries({ queryKey: key, exact: true });
        void client.invalidateQueries({ queryKey: ["custom-srs", scope], exact: true });
      }
    };
    window.addEventListener("storage", onStorage); return () => window.removeEventListener("storage", onStorage);
  }, [client, key, scope]);
  const mutate = useCallback(async (mutation: Omit<PersonalMutation, "accountId">) => {
    if (isDemoMode()) throw new Error("Sign in to create a private vocabulary library.");
    const response = await fetch("/api/custom-vocabulary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...mutation, accountId: scope }), signal: AbortSignal.timeout(30_000) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Your vocabulary could not be saved. Your edits are still here.");
    const saved = saveResultSchema.parse(payload);
    if (active.current !== scope) throw new Error("Your account changed. Open your library again.");
    await Promise.all([client.invalidateQueries({ queryKey: key, exact: true }), client.invalidateQueries({ queryKey: ["custom-srs", scope], exact: true })]);
    try { window.localStorage.setItem(`personal-vocabulary:${scope}:revision`, `${saved.revision}:${crypto.randomUUID()}`); } catch { /* Best-effort tab notification. */ }
    return saved;
  }, [client, key, scope]);
  const library = query.data ?? EMPTY_PERSONAL_LIBRARY;
  const packs = useMemo(() => personalLibraryPacks(library), [library]);
  return { ...query, library, packs, mutate, needsSync: enabled && expectedRevision > library.revision };
}
