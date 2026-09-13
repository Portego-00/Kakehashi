"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Cloud, HardDrive } from "lucide-react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { SubjectDetailPanels } from "@/features/subjects/components/SubjectDetail";
import subjectStyles from "@/features/subjects/subjects.module.css";
import { fetchImmersionExamples } from "@/features/study/immersion";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";
import { customAssignmentToWaniKani, customWordToSubject, customWordUsesKanji } from "./subject-adapter";
import type { CustomVocabularyWord } from "./types";
import { useCustomSrs } from "./use-custom-srs";
import styles from "./custom-vocabulary-detail.module.css";

export function CustomVocabularyDetail({ word, packTitle }: { word: CustomVocabularyWord; packTitle: string }) {
  const { user } = useSession();
  const scope = waniKaniUserId(user) || "anonymous";
  const webSettings = useWebSettings(user?.data.username ?? "anonymous");
  const customSrs = useCustomSrs(scope, CUSTOM_VOCABULARY_PACKS);
  const customAssignment = customSrs.state.assignments[word.id];
  const assignment = customAssignment ? customAssignmentToWaniKani(customAssignment, word) : undefined;
  const subject = customWordToSubject(word);
  const usesKanji = customWordUsesKanji(word);
  const meaning = word.meanings[0] ?? word.characters;
  const characterCount = Math.min(Array.from(word.characters).length, 12);
  const usesBrowserProgress = customSrs.storageMode === "browser" || customSrs.isUnavailable;
  const ProgressIcon = usesBrowserProgress ? HardDrive : Cloud;
  const progressSource = usesBrowserProgress ? "Browser progress" : "Cloud progress";
  const stageLabel = customAssignment ? srsStageLabel(customAssignment.stage) : "Preview";
  const detailSettings = {
    ...webSettings.subjectDetails,
    showContextSentences: true,
    showPitchAccent: false,
    showKanjiReadingExamples: false,
    showStrokeOrder: false,
    showPatternsOfUse: false,
  };
  const immersionSources = webSettings.study.immersionKitAnimeSources;
  const immersion = useQuery({
    queryKey: ["immersion", "custom-vocabulary-detail", word.characters, immersionSources.join(",")],
    queryFn: ({ signal }) => fetchImmersionExamples(word.characters, immersionSources, signal),
    enabled: Boolean(detailSettings.showImmersionExamples && word.characters),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  return <main className={`page ${subjectStyles.page} ${subjectStyles.subjectDetailPage} ${styles.page}`} data-subject-detail-type="vocabulary" data-custom-vocabulary-detail>
    <header className={`${subjectStyles.subjectHero} ${styles.hero}`} data-type="vocabulary">
      <Link href="/custom-vocabulary" className={subjectStyles.subjectHeroBack}>
        <ArrowLeft size={19} aria-hidden />
        <span>Back to vocabulary packs</span>
      </Link>
      <div className={subjectStyles.subjectHeroCopy}>
        <SubjectCharacter
          subject={subject}
          imageSize="5rem"
          imageTone="subject"
          eager
          className={subjectStyles.subjectHeroCharacter}
          data-character-count={characterCount}
        />
        <h1>{meaning}</h1>
        {usesKanji ? <p lang="ja">{word.reading}</p> : null}
      </div>
      <div className={subjectStyles.subjectHeroMeta} aria-label="Custom vocabulary progress">
        <span>{packTitle}</span>
        {word.requiredLevel ? <span>WaniKani level {word.requiredLevel}+</span> : null}
        <span>{customAssignment ? <SrsStageIcon stage={customAssignment.stage} size={16} /> : null}{stageLabel}</span>
        <span><ProgressIcon size={15} aria-hidden />{customSrs.isLoading ? "Checking progress" : progressSource}</span>
      </div>
    </header>

    <SubjectDetailPanels
      record={subject}
      assignment={assignment}
      materialLoading={false}
      materialsKey={["custom-srs", word.id]}
      relatedSubjects={[]}
      pitchAccents={[]}
      usagePatterns={[]}
      immersionExamples={immersion.data ?? []}
      immersionLoading={immersion.isLoading}
      immersionFailed={immersion.isError}
      settings={detailSettings}
      showVocabularyFrequency={webSettings.study.showVocabularyFrequency}
      returnTo="/custom-vocabulary"
      idPrefix={`custom-subject-${word.id}`}
      allowStudyMaterialEditing={false}
    />
  </main>;
}
