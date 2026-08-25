"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Network } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { wkCollection, wkRequest } from "@/lib/wanikani/client";
import type { Subject } from "@/types/wanikani";
import styles from "../subjects.module.css";

export function SubjectConstellation({ id }: { id: number }) {
  const center = useQuery({ queryKey: ["wanikani", "subject", id], queryFn: () => wkRequest<Subject>(`subjects/${id}`), staleTime: 24 * 60 * 60_000 });
  const relationIds = useMemo(() => Array.from(new Set([...(center.data?.data.component_subject_ids ?? []), ...(center.data?.data.amalgamation_subject_ids ?? []), ...(center.data?.data.visually_similar_subject_ids ?? [])])).slice(0, 160), [center.data]);
  const relations = useQuery({ queryKey: ["wanikani", "subjects", `constellation:${relationIds.join(",")}`], queryFn: () => wkCollection<Subject>(`subjects?ids=${relationIds.join(",")}`), enabled: relationIds.length > 0, staleTime: 24 * 60 * 60_000 });
  if (center.isLoading || relations.isLoading) return <main className={`page ${styles.page}`} aria-busy="true"><Skeleton height="35rem" /></main>;
  if (!center.data || center.isError) return <main className={`page ${styles.page}`}><EmptyState title="Constellation unavailable" description="This subject could not be loaded." /></main>;
  const subject = center.data;
  const map = new Map((relations.data ?? []).map((item) => [item.id, item]));
  const components = (subject.data.component_subject_ids ?? []).map((relationId) => map.get(relationId)).filter((item): item is Subject => Boolean(item));
  const similar = (subject.data.visually_similar_subject_ids ?? []).map((relationId) => map.get(relationId)).filter((item): item is Subject => Boolean(item));
  const vocabulary = (subject.data.amalgamation_subject_ids ?? []).map((relationId) => map.get(relationId)).filter((item): item is Subject => Boolean(item)).slice(0, 36);
  const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.slug;

  return <main className={`page ${styles.page}`}>
    <header className="page-header"><div><Link href={`/subjects/${id}`} className={styles.backLink}><ArrowLeft size={16} /> {meaning}</Link><h1>Subject constellation</h1><p>Traverse components, lookalikes, and vocabulary that share this subject.</p></div><Badge><Network size={13} /> {components.length + similar.length + vocabulary.length} visible links</Badge></header>
    <section className={styles.constellation} aria-label={`Relationship map for ${meaning}`}>
      <ConstellationGroup title="Components" description="What this subject is built from" subjects={components} side="left" />
      <div className={styles.constellationCenter} data-type={subject.object === "kana_vocabulary" ? "vocabulary" : subject.object}><span lang="ja">{subject.data.characters ?? meaning}</span><strong>{meaning}</strong><small>Level {subject.data.level}</small></div>
      <ConstellationGroup title="Vocabulary" description="Words that use this subject" subjects={vocabulary} side="right" />
    </section>
    {similar.length ? <section className={styles.similarOrbit}><div><h2>Visually similar</h2><p>Neighboring shapes worth distinguishing.</p></div><div>{similar.map((item) => <ConstellationNode key={item.id} subject={item} />)}</div></section> : null}
    <p className={styles.constellationNote}>Select any node to make it the new center. The web layout keeps every relationship keyboard-accessible and readable without pinch-to-zoom.</p>
  </main>;
}

function ConstellationGroup({ title, description, subjects, side }: { title: string; description: string; subjects: Subject[]; side: "left" | "right" }) {
  return <section className={styles.constellationGroup} data-side={side}><div><h2>{title}</h2><p>{description}</p></div>{subjects.length ? <div>{subjects.map((subject) => <ConstellationNode key={subject.id} subject={subject} />)}</div> : <p className={styles.noRelations}>No {title.toLocaleLowerCase()} for this subject.</p>}</section>;
}

function ConstellationNode({ subject }: { subject: Subject }) {
  const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.slug;
  return <Link href={`/subjects/${subject.id}/constellation`} title={`${subject.data.characters ?? meaning}: ${meaning}`}><span lang="ja">{subject.data.characters ?? meaning}</span><small>{meaning}</small></Link>;
}
