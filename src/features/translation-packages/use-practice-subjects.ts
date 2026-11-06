import { useEffect, useState } from "react";
import { getSubjectById } from "../../utils/cache";
import type { Subject } from "../../utils/api";

// Recover full source records for generated/restored puzzle labels. Never infer
// a translation from an ID alone or alter the stored puzzle to hold translations.
export function usePracticeSubjects(ids: number[]) {
  const key = [...new Set(ids)].sort((a, b) => a - b).join(",");
  const [loaded, setLoaded] = useState<{ key: string; subjects: Map<number, Subject> }>({ key: "", subjects: new Map() });
  useEffect(() => {
    let active = true;
    void Promise.all(key ? key.split(",").map(async id => {
      try { return await getSubjectById(Number(id)); } catch { return null; }
    }) : []).then(records => {
      if (active) setLoaded({ key, subjects: new Map(records.filter((record): record is Subject => !!record).map(record => [record.id, record])) });
    });
    return () => { active = false; };
  }, [key]);
  return loaded.key === key ? loaded.subjects : new Map<number, Subject>();
}
