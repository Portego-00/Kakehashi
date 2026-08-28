"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { DEFAULT_WEB_SETTINGS, type WebSettings } from "@/features/settings/settings";
import { fetchImmersionExamples } from "@/features/study/immersion";
import { SubjectDetailPanels, type SubjectDetailInitialTab } from "@/features/subjects/components/SubjectDetail";
import { fetchSubjectEnrichments } from "@/features/subjects/enrichments";
import { wkCollection } from "@/lib/wanikani/client";
import type { Assignment, ReviewStatistic, StudyMaterial, Subject } from "@/types/wanikani";
import styles from "../study.module.css";

interface StudySubjectDetailsProps {
  record: Subject;
  subjects: Subject[];
  assignment?: Assignment;
  settings?: WebSettings["subjectDetails"];
  immersionSources?: string[];
  initialTab: SubjectDetailInitialTab;
  idPrefix: string;
  returnTo: string;
}

export function StudySubjectDetails({
  record,
  subjects,
  assignment,
  settings = DEFAULT_WEB_SETTINGS.subjectDetails,
  immersionSources = [],
  initialTab,
  idPrefix,
  returnTo,
}: StudySubjectDetailsProps) {
  const materialKey = ["wanikani", "study-materials", `subject:${record.id}`] as const;
  const material = useQuery({
    queryKey: materialKey,
    queryFn: () => wkCollection<StudyMaterial>(`study_materials?subject_ids=${record.id}`),
    staleTime: 5 * 60_000,
  });
  const statistic = useQuery({
    queryKey: ["wanikani", "review-statistics", `subject:${record.id}`],
    queryFn: () => wkCollection<ReviewStatistic>(`review_statistics?subject_ids=${record.id}`),
    staleTime: 15 * 60_000,
  });
  const relationIds = useMemo(() => new Set([
    ...(record.data.component_subject_ids ?? []),
    ...(record.data.amalgamation_subject_ids ?? []),
    ...(record.data.visually_similar_subject_ids ?? []),
  ]), [record]);
  const relatedSubjects = useMemo(
    () => subjects.filter((subject) => relationIds.has(subject.id)),
    [relationIds, subjects],
  );
  const characters = record.data.characters;
  const readings = useMemo(() => record.data.readings?.map((reading) => reading.reading) ?? [], [record]);
  const isVocabulary = record.object === "vocabulary" || record.object === "kana_vocabulary";
  const enrichments = useQuery({
    queryKey: ["subject-enrichments", record.id, characters, readings.join(",")],
    queryFn: ({ signal }) => fetchSubjectEnrichments({
      id: record.id,
      level: record.data.level,
      characters: characters!,
      readings,
    }, signal),
    enabled: Boolean(characters && ((settings.showPitchAccent && record.object !== "radical") || (settings.showPatternsOfUse && isVocabulary))),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });
  const immersion = useQuery({
    queryKey: ["immersion", "subject-detail", characters, immersionSources.join(",")],
    queryFn: ({ signal }) => fetchImmersionExamples(characters!, immersionSources, signal),
    enabled: Boolean(settings.showImmersionExamples && characters && isVocabulary),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  return (
    <section id="study-item-details" className={styles.itemDetails} aria-labelledby="study-item-details-title">
      <header className={styles.itemDetailsHeader}>
        <div>
          <h3 id="study-item-details-title">Subject details</h3>
          <p>Level {record.data.level} · {record.object.replace("_", " ")}</p>
        </div>
        <Link className={styles.itemDetailsLink} href={`/subjects/${record.id}`} target="_blank" rel="noopener noreferrer">
          <span>Open full subject</span>
          <ExternalLink size={15} aria-hidden />
        </Link>
      </header>

      <SubjectDetailPanels
        record={record}
        assignment={assignment}
        reviewStatistic={statistic.data?.[0]}
        material={material.data?.[0]}
        materialLoading={material.isLoading}
        materialsKey={materialKey}
        relatedSubjects={relatedSubjects}
        pitchAccents={enrichments.data?.pitchAccents ?? []}
        usagePatterns={enrichments.data?.patterns ?? []}
        immersionExamples={immersion.data ?? []}
        immersionLoading={immersion.isLoading}
        immersionFailed={immersion.isError}
        settings={settings}
        returnTo={returnTo}
        initialTab={initialTab}
        idPrefix={idPrefix}
        embedded
      />
    </section>
  );
}
