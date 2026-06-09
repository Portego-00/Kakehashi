import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SUPPORTER_CACHE_DURATION_MS = 5 * 60 * 1000;

let cachedSupporterUsernames: Set<string> | null = null;
let cachedAt = 0;

function normalizeUsername(username: string | null | undefined): string {
  return username?.trim().toLowerCase() ?? "";
}

export function isPatreonSupporterUsername(
  username: string | null | undefined,
  supporterUsernames: Set<string>,
): boolean {
  const normalized = normalizeUsername(username);
  return normalized.length > 0 && supporterUsernames.has(normalized);
}

export function usePatreonSupporterUsernames() {
  const [supporterUsernames, setSupporterUsernames] = useState<Set<string>>(
    () => cachedSupporterUsernames ?? new Set(),
  );

  useEffect(() => {
    let isMounted = true;

    const loadSupporterUsernames = async () => {
      const now = Date.now();
      if (
        cachedSupporterUsernames &&
        now - cachedAt < SUPPORTER_CACHE_DURATION_MS
      ) {
        if (isMounted) {
          setSupporterUsernames(cachedSupporterUsernames);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("patreon_supporters")
          .select("wanikani_username")
          .eq("is_active", true);

        if (error) {
          const message = String(
            (error as { message?: unknown }).message ?? "",
          ).toLowerCase();
          const isMissingTable =
            String((error as { code?: unknown }).code ?? "") === "42P01" ||
            (message.includes("does not exist") &&
              message.includes("patreon_supporters"));

          if (!isMissingTable) {
            console.error("Failed to load Patreon supporter usernames:", error);
          }
          return;
        }

        const usernames = new Set<string>();
        (data ?? []).forEach((row) => {
          const normalized = normalizeUsername(
            (row as { wanikani_username?: string | null }).wanikani_username,
          );
          if (normalized) {
            usernames.add(normalized);
          }
        });

        cachedSupporterUsernames = usernames;
        cachedAt = now;

        if (isMounted) {
          setSupporterUsernames(usernames);
        }
      } catch (error) {
        console.error("Failed to load Patreon supporter usernames:", error);
      }
    };

    void loadSupporterUsernames();

    return () => {
      isMounted = false;
    };
  }, []);

  return supporterUsernames;
}
