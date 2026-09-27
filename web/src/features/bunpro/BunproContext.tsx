"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { fetchImmersionExamples } from "@/features/study/immersion";
import { AnimeContext } from "@/features/subjects/components/SubjectDetail";
import { SubjectAudioProvider } from "@/features/subjects/components/SubjectAudioControls";

export function BunproContext({ query }: { query: string }) {
  const { user } = useSession();
  const sources = useWebSettings(user?.data.username ?? "anonymous").study.immersionKitAnimeSources;
  const scenes = useQuery({
    queryKey: ["immersion", "subject-detail", query, sources.join(",")],
    queryFn: ({ signal }) => fetchImmersionExamples(query, sources, signal),
    enabled: Boolean(query),
    staleTime: 60 * 60_000,
    retry: 1,
  });
  return <SubjectAudioProvider><AnimeContext examples={scenes.data ?? []} query={query} loading={Boolean(query) && scenes.isPending} failed={scenes.isError} /></SubjectAudioProvider>;
}
