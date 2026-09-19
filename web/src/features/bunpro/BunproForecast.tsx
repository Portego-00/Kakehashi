"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { ReviewForecast, type ReviewForecastProps } from "@/features/dashboard/ReviewForecast";
import { createReviewForecast, type ReviewForecastEntry } from "@/features/dashboard/review-forecast";
import { bunpro } from "./client";
import { canAccessBunpro } from "./access";
import { bunproForecastEntries, type BunproForecastResponse } from "./forecast";
import styles from "./bunpro.module.css";
export function BunproForecast({ entries, ...props }: ReviewForecastProps & { entries: ReviewForecastEntry[] }) {
  const { user, isDemo } = useSession();
  const [source, setSource] = useState<"wanikani" | "bunpro" | "combined">("wanikani");
  const [bunproType, setBunproType] = useState<"all" | "grammar" | "vocab">("all");
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: ({ signal }) => bunpro<{ connected: boolean }>("action=connection", { signal }), enabled: !isDemo && canAccessBunpro(user?.data.username), staleTime: 30000, retry: false });
  const connected = !isDemo && canAccessBunpro(user?.data.username) && connection.data?.connected === true;
  const data = useQuery({ queryKey: ["bunpro", "forecast"], queryFn: ({ signal }) => bunpro<BunproForecastResponse>("action=forecast", { signal }), enabled: connected && source !== "wanikani", staleTime: 60000 });
  const selected = connected ? source : "wanikani";
  const mixed = selected !== "wanikani";
  const includeType = (entry: ReviewForecastEntry) => bunproType === "all" || entry.subjectType === `bunpro_${bunproType}`;
  const dailyForecast = mixed ? createReviewForecast([...(selected === "combined" ? entries : []), ...bunproForecastEntries(data.data, props.forecast.now).filter(includeType)], props.forecast.now) : props.forecast;
  const forecast = mixed ? { ...dailyForecast, hourly: createReviewForecast([...(selected === "combined" ? entries : []), ...bunproForecastEntries(data.data, props.forecast.now, true).filter(includeType)], props.forecast.now).hourly } : dailyForecast;
  return <>{connected ? <div className={styles.forecastSources} role="group" aria-label="Review forecast source">{(["wanikani", "bunpro", "combined"] as const).map((value) => <button key={value} type="button" aria-pressed={selected === value} onClick={() => setSource(value)}>{value === "wanikani" ? "WaniKani" : value === "bunpro" ? "Bunpro" : "Combined"}</button>)}</div> : null}{mixed ? <div className={styles.forecastSources} role="group" aria-label="Bunpro forecast review type"><span className={styles.forecastFilterLabel}>Bunpro</span>{(["all", "grammar", "vocab"] as const).map((value) => <button key={value} type="button" aria-pressed={bunproType === value} onClick={() => setBunproType(value)}>{value === "all" ? "All" : value === "grammar" ? "Grammar only" : "Vocabulary only"}</button>)}</div> : null}<ReviewForecast {...props} forecast={forecast} includeBunpro={mixed} breakdown={mixed && props.breakdown === "srs" ? "subject" : props.breakdown} loading={(selected !== "bunpro" && props.loading) || (mixed && data.isPending)} unavailable={mixed && data.error ? <span>Bunpro forecast unavailable. <button onClick={() => void data.refetch()}>Retry</button></span> : selected !== "bunpro" ? props.unavailable : undefined} /></>;
}
