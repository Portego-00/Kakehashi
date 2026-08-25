"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ExternalLink, Headphones, Layers3, Network, Save } from "lucide-react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { Badge } from "@/components/ui/Badge";
import { Button, type ButtonState } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextAreaField } from "@/components/ui/Field";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { wkCollection, wkRequest } from "@/lib/wanikani/client";
import type { Assignment, ReviewStatistic, StudyMaterial, Subject } from "@/types/wanikani";
import styles from "../subjects.module.css";

const ENTITIES: Record<string, string> = { "&quot;": '"', "&#39;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };

export function plainMnemonic(value?: string) {
  if (!value) return [];
  const plain = value.replace(/<[^>]+>/g, "").replace(/&(quot|#39|amp|lt|gt|nbsp);/g, (entity) => ENTITIES[entity] ?? entity).trim();
  return plain.split(/\n\s*\n/).map((paragraph) => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function SubjectDetail({ id }: { id: number }) {
  const subject = useQuery({ queryKey: ["wanikani", "subject", id], queryFn: () => wkRequest<Subject>(`subjects/${id}`), staleTime: 24 * 60 * 60_000 });
  const assignment = useQuery({ queryKey: ["wanikani", "assignments", `subject:${id}`], queryFn: () => wkCollection<Assignment>(`assignments?subject_ids=${id}`), staleTime: 5 * 60_000 });
  const statistic = useQuery({ queryKey: ["wanikani", "review-statistics", `subject:${id}`], queryFn: () => wkCollection<ReviewStatistic>(`review_statistics?subject_ids=${id}`), staleTime: 15 * 60_000 });
  const materialsKey = ["wanikani", "study-materials", `subject:${id}`] as const;
  const material = useQuery({ queryKey: materialsKey, queryFn: () => wkCollection<StudyMaterial>(`study_materials?subject_ids=${id}`), staleTime: 5 * 60_000 });
  const relationIds = useMemo(() => {
    const data = subject.data?.data;
    return Array.from(new Set([...(data?.component_subject_ids ?? []), ...(data?.amalgamation_subject_ids ?? []), ...(data?.visually_similar_subject_ids ?? [])])).slice(0, 150);
  }, [subject.data]);
  const relations = useQuery({ queryKey: ["wanikani", "subjects", `relations:${relationIds.join(",")}`], queryFn: () => wkCollection<Subject>(`subjects?ids=${relationIds.join(",")}`), enabled: relationIds.length > 0, staleTime: 24 * 60 * 60_000 });

  if (subject.isLoading) return <main className={`page ${styles.page}`} aria-busy="true"><Skeleton height="34rem" /></main>;
  if (subject.isError || !subject.data) return <main className={`page ${styles.page}`}><EmptyState title="Subject not found" description="This subject may be outside your subscription or no longer available." action={<Link href="/search" className={styles.inlineButton}>Back to search</Link>} /></main>;

  const record = subject.data;
  const subjectAssignment = assignment.data?.[0];
  const reviewStatistic = statistic.data?.[0];
  const meaning = record.data.meanings.find((item) => item.primary)?.meaning ?? record.data.meanings[0]?.meaning ?? record.data.slug;
  const tone = record.object === "kana_vocabulary" ? "vocabulary" : record.object;
  const relationById = new Map((relations.data ?? []).map((item) => [item.id, item]));
  const meaningMnemonic = plainMnemonic(record.data.meaning_mnemonic);
  const readingMnemonic = plainMnemonic(record.data.reading_mnemonic);

  return <main className={`page ${styles.page}`}>
    <Link href="/search" className={styles.backLink}><ArrowLeft size={16} /> Subject search</Link>
    <header className={styles.subjectHero} data-type={tone}>
      <div className={styles.subjectHeroCharacter} lang="ja">{record.data.characters || meaning}</div>
      <div className={styles.subjectHeroCopy}>
        <div className="cluster"><Badge tone={tone}>{record.object.replace("_", " ")}</Badge><Badge>Level {record.data.level}</Badge>{subjectAssignment ? <Badge><SrsStageIcon stage={subjectAssignment.data.srs_stage} size={16} />{srsStageLabel(subjectAssignment.data.srs_stage)}</Badge> : <Badge>Locked</Badge>}</div>
        <h1>{meaning}</h1>
        {record.data.readings?.length ? <p lang="ja">{record.data.readings.filter((reading) => reading.primary).map((reading) => reading.reading).join(" · ") || record.data.readings[0].reading}</p> : null}
        <div className="cluster"><Link href={`/subjects/${id}/constellation`} className={styles.externalLink}><Network size={15} /> Explore constellation</Link><a href={record.data.document_url} target="_blank" rel="noreferrer" className={styles.externalLink}>Open on WaniKani <ExternalLink size={15} /></a></div>
      </div>
      {reviewStatistic ? <dl className={styles.subjectStats}><div><dt>Accuracy</dt><dd>{reviewStatistic.data.percentage_correct}%</dd></div><div><dt>Meaning streak</dt><dd>{reviewStatistic.data.meaning_current_streak}</dd></div><div><dt>Reading streak</dt><dd>{reviewStatistic.data.reading_current_streak}</dd></div></dl> : null}
    </header>

    <div className={styles.detailGrid}>
      <section className={styles.detailMain}>
        <DetailSection title="Meanings" icon={<BookOpen size={19} />}><div className={styles.definitionList}>{record.data.meanings.map((item) => <span key={item.meaning} data-primary={item.primary}>{item.meaning}{item.primary ? <small>Primary</small> : null}</span>)}</div>{meaningMnemonic.length ? <Mnemonic paragraphs={meaningMnemonic} /> : null}</DetailSection>
        {record.data.readings?.length ? <DetailSection title="Readings" icon={<Layers3 size={19} />}><dl className={styles.readingList}>{record.data.readings.map((reading) => <div key={`${reading.type}-${reading.reading}`}><dt>{reading.type?.replace("yomi", "’yomi") ?? "Reading"}</dt><dd lang="ja">{reading.reading}{reading.primary ? <small>Primary</small> : null}</dd></div>)}</dl>{readingMnemonic.length ? <Mnemonic paragraphs={readingMnemonic} /> : null}</DetailSection> : null}
        {record.data.context_sentences?.length ? <DetailSection title="Context sentences"><div className={styles.contextList}>{record.data.context_sentences.map((sentence) => <blockquote key={`${sentence.ja}-${sentence.en}`}><p lang="ja">{sentence.ja}</p><footer>{sentence.en}</footer></blockquote>)}</div></DetailSection> : null}
        {record.data.pronunciation_audios?.length ? <DetailSection title="Pronunciation" icon={<Headphones size={19} />}><div className={styles.audioList}>{uniqueAudio(record).map((audio) => <figure key={audio.metadata.source_id}><figcaption>{audio.metadata.voice_actor_name} · {audio.metadata.voice_description}</figcaption><audio controls preload="none" src={audio.url}>Audio playback is not supported by this browser.</audio></figure>)}</div></DetailSection> : null}
      </section>

      <aside className={styles.detailAside}>
        <StudyMaterialEditor key={material.data?.[0]?.id ?? `new-${id}`} subjectId={id} material={material.data?.[0]} queryKey={materialsKey} loading={material.isLoading} />
        <RelationSection title="Components" ids={record.data.component_subject_ids} subjects={relationById} />
        <RelationSection title="Visually similar" ids={record.data.visually_similar_subject_ids} subjects={relationById} />
        <RelationSection title="Found in vocabulary" ids={record.data.amalgamation_subject_ids?.slice(0, 20)} subjects={relationById} />
      </aside>
    </div>
  </main>;
}

function uniqueAudio(subject: Subject) {
  const seen = new Set<number>();
  return (subject.data.pronunciation_audios ?? []).filter((audio) => {
    if (seen.has(audio.metadata.source_id) || audio.content_type !== "audio/mpeg") return false;
    seen.add(audio.metadata.source_id);
    return true;
  });
}

function DetailSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <Card className={styles.detailSection}><div className={styles.detailTitle}>{icon}<h2>{title}</h2></div>{children}</Card>;
}

function Mnemonic({ paragraphs }: { paragraphs: string[] }) {
  return <div className={styles.mnemonic}>{paragraphs.map((paragraph, index) => <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>)}</div>;
}

function RelationSection({ title, ids, subjects }: { title: string; ids?: number[]; subjects: Map<number, Subject> }) {
  if (!ids?.length) return null;
  return <Card className={styles.relations}><h2>{title}</h2><div>{ids.map((id) => { const subject = subjects.get(id); if (!subject) return null; return <Link href={`/subjects/${id}`} key={id}><span lang="ja">{subject.data.characters ?? subject.data.meanings[0]?.meaning}</span><small>{subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.slug}</small></Link>; })}</div></Card>;
}

function StudyMaterialEditor({ subjectId, material, queryKey, loading }: { subjectId: number; material?: StudyMaterial; queryKey: readonly unknown[]; loading: boolean }) {
  const queryClient = useQueryClient();
  const [meaningNote, setMeaningNote] = useState(material?.data.meaning_note ?? "");
  const [readingNote, setReadingNote] = useState(material?.data.reading_note ?? "");
  const [synonyms, setSynonyms] = useState(material?.data.meaning_synonyms.join(", ") ?? "");
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const mutation = useMutation({
    mutationFn: () => {
      const body = { study_material: { ...(material ? {} : { subject_id: subjectId }), meaning_note: meaningNote || null, reading_note: readingNote || null, meaning_synonyms: synonyms.split(",").map((value) => value.trim()).filter(Boolean) } };
      return wkRequest<StudyMaterial>(material ? `study_materials/${material.id}` : "study_materials", { method: material ? "PUT" : "POST", body });
    },
    onMutate: () => setButtonState("loading"),
    onSuccess: (saved) => { queryClient.setQueryData(queryKey, [saved]); setButtonState("success"); window.setTimeout(() => setButtonState("idle"), 1400); },
    onError: () => setButtonState("error"),
  });

  return <Card className={styles.notesEditor}><h2>Your study material</h2><p>Notes and synonyms sync back to WaniKani.</p>{loading ? <Skeleton height="16rem" /> : <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><Field label="Meaning synonyms" helper="Separate synonyms with commas." value={synonyms} onChange={(event) => setSynonyms(event.target.value)} /><TextAreaField label="Meaning note" value={meaningNote} onChange={(event) => setMeaningNote(event.target.value)} /><TextAreaField label="Reading note" value={readingNote} onChange={(event) => setReadingNote(event.target.value)} /><Button type="submit" tone="primary" state={buttonState}><Save size={16} />{buttonState === "success" ? "Saved" : buttonState === "error" ? "Try again" : "Save notes"}</Button></form>}</Card>;
}
