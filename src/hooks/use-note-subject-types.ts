import { useEffect, useMemo, useState } from "react";

import {
  peekNoteSubjectType,
  resolveNoteSubjectType,
} from "../utils/note-subject-metadata";
import type { SubjectType } from "../utils/subjectColors";

export function useNoteSubjectTypes(
  subjectIds: readonly number[],
): Record<number, SubjectType> {
  const subjectIdsKey = subjectIds.join(":");
  const stableSubjectIds = useMemo(
    () => [...subjectIds],
    // The joined key keeps this list stable even if a caller recreates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjectIdsKey],
  );
  const [resolvedTypes, setResolvedTypes] = useState<
    Record<number, SubjectType>
  >({});

  useEffect(() => {
    const unresolvedSubjectIds = stableSubjectIds.filter(
      (subjectId) => !peekNoteSubjectType(subjectId),
    );
    if (unresolvedSubjectIds.length === 0) return;

    let cancelled = false;
    void Promise.all(
      unresolvedSubjectIds.map(async (subjectId) => {
        const subjectType = await resolveNoteSubjectType(subjectId);
        return [subjectId, subjectType] as const;
      }),
    ).then((subjectTypes) => {
      if (cancelled) return;

      setResolvedTypes((currentTypes) => {
        const nextTypes = { ...currentTypes };
        for (const [subjectId, subjectType] of subjectTypes) {
          if (subjectType) nextTypes[subjectId] = subjectType;
        }
        return nextTypes;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [stableSubjectIds]);

  const subjectTypes: Record<number, SubjectType> = {};
  for (const subjectId of stableSubjectIds) {
    const rememberedType = peekNoteSubjectType(subjectId);
    const subjectType = rememberedType ?? resolvedTypes[subjectId];
    if (subjectType) subjectTypes[subjectId] = subjectType;
  }
  return subjectTypes;
}
