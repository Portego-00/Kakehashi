import React from "react";

import KanjiEtymologySection from "./KanjiEtymologySection";

interface LessonSubjectForEtymology {
  object?: string | null;
  data?: {
    characters?: string | null;
  } | null;
}

interface KanjiLessonEtymologySectionProps {
  subject: LessonSubjectForEtymology;
  visible: boolean;
}

/**
 * Keeps lesson etymology scoped to kanji even if this shared lesson content is
 * rendered for a different subject type.
 */
export default function KanjiLessonEtymologySection({
  subject,
  visible,
}: KanjiLessonEtymologySectionProps) {
  if (subject.object !== "kanji") {
    return null;
  }

  return (
    <KanjiEtymologySection
      characters={subject.data?.characters}
      visible={visible}
    />
  );
}
