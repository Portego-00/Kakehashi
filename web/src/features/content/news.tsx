"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { useStudyDataset } from "@/features/study/use-study-dataset";
import { JapaneseReader } from "./JapaneseReader";
import { calculateKnownKanjiPercentage, passedKanjiCharacters } from "./annotation";
import { ContentHeader, ContentPage, EmptyState, Panel } from "./ui";
import { readLocal, writeLocal } from "./storage";
import { proxyNewsImageUrl } from "./news-images";
import type { NewsArticle } from "./types";
import { useFirstContentReveal } from "./useFirstContentReveal";
import styles from "./content.module.css";

interface FeedPayload { articles: NewsArticle[]; updatedAt: string; source: "live" | "server-cache" | "browser-cache" }
type NewsSort = "date" | "known";

function KnownScore({ value }: { value: number | null }) {
  const band = value === null ? "pending" : value >= 90 ? "high" : value >= 70 ? "medium" : "low";
  return <span className={styles.knownScore} data-band={band}>{value === null ? "… Known" : `${value}% Known`}</span>;
}

function NewsImage({ article, recent = false }: { article: NewsArticle; recent?: boolean }) {
  const imageUrl = proxyNewsImageUrl(article.imageUrl, article.url);
  if (!imageUrl) return <span className={recent ? styles.recentNewsPlaceholder : styles.articleThumbnailPlaceholder} aria-hidden="true" />;
  return <span className={recent ? styles.recentNewsImage : styles.articleThumbnail}><Image src={imageUrl} alt="" fill sizes={recent ? "(max-width: 640px) 72vw, 280px" : "(max-width: 480px) 80px, 112px"} loading={recent ? "eager" : "lazy"} unoptimized /></span>;
}

export function NewsIndex() {
  const { dataset } = useStudyDataset();
  const firstNewsReveal = useFirstContentReveal();
  const [feed, setFeed] = useState<FeedPayload | null>(() => readLocal<FeedPayload | null>("news-cache", null));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<NewsSort>("date");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/news/feed", { cache: "no-store" });
      const payload = await response.json() as FeedPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "News could not be refreshed.");
      setFeed(payload);
      writeLocal("news-cache", payload);
    } catch (error) {
      setFeed((current) => current ? { ...current, source: "browser-cache" } : null);
      setMessage(error instanceof Error ? error.message : "News could not be refreshed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja");
    return feed?.articles.filter((article) => !needle || `${article.title} ${article.body}`.toLocaleLowerCase("ja").includes(needle)) ?? [];
  }, [feed, query]);
  const passedKanji = useMemo(() => dataset ? passedKanjiCharacters(dataset.subjects, dataset.assignments) : null, [dataset]);
  const knownByArticle = useMemo(() => new Map((feed?.articles ?? []).map((article) => [article.id, passedKanji ? calculateKnownKanjiPercentage(`${article.title}${article.body ?? article.summary ?? ""}`, passedKanji) : null])), [feed?.articles, passedKanji]);
  const otherArticles = useMemo(() => {
    const articles = filtered.slice(5);
    if (sort === "known") return [...articles].sort((left, right) => (knownByArticle.get(right.id) ?? -1) - (knownByArticle.get(left.id) ?? -1) || Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
    return articles;
  }, [filtered, knownByArticle, sort]);

  return (
    <ContentPage variant="library">
      <ContentHeader title="Easy news" description="Current NHK News Web Easy stories through the NHK Easier public RSS mirror, ready for word-by-word study." actions={<button className={styles.secondaryButton} type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{loading ? "Refreshing…" : "Refresh"}</button>} />
      <div className={styles.field}><label className="sr-only" htmlFor="news-search">Search articles</label><div className={styles.searchInputWrap}><Search size={18} aria-hidden="true" /><input id="news-search" className={styles.input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Japanese headlines or article text" /></div></div>
      {feed ? <p className={styles.hint}>Updated {new Date(feed.updatedAt).toLocaleString()} · {feed.source === "live" ? "live mirror feed" : feed.source.replace("-", " ")} · Article rights remain with NHK.</p> : null}
      {message ? <div className={styles.notice} role="status">{message}{feed ? " Showing the last browser copy." : ""}</div> : null}
      {filtered.length ? <div className={styles.newsSections} {...firstNewsReveal}>
        <section className={styles.newsSection} aria-labelledby="recent-news-heading"><div className={styles.sectionHead}><div><h2 id="recent-news-heading">Recent news</h2><p>The newest stories from NHK News Web Easy.</p></div></div><div className={styles.recentNewsRail}>{filtered.slice(0, 5).map((article) => <Link className={styles.recentNewsCard} href={`/news/${encodeURIComponent(article.id)}`} key={article.id}><NewsImage article={article} recent /><span className={styles.recentNewsCopy}><span className={styles.newsMeta}><time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString()}</time><KnownScore value={knownByArticle.get(article.id) ?? null} /></span><strong lang="ja">{article.title}</strong></span></Link>)}</div></section>
        {filtered.length > 5 ? <section className={styles.newsSection} aria-labelledby="other-news-heading"><div className={styles.sectionHead}><div><h2 id="other-news-heading">Other news</h2><p>{sort === "known" ? "Highest known-kanji percentage first." : "More recent stories, newest first."}</p></div><label className={styles.newsSort}><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as NewsSort)}><option value="date">Newest</option><option value="known">Known kanji %</option></select></label></div><div className={styles.articleList}>{otherArticles.map((article) => <Link className={styles.articleRow} href={`/news/${encodeURIComponent(article.id)}`} key={article.id}><NewsImage article={article} /><time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString()}</time><h2 lang="ja">{article.title}</h2><KnownScore value={knownByArticle.get(article.id) ?? null} /><span aria-hidden="true">→</span></Link>)}</div></section> : null}
      </div> : loading ? <Panel className={styles.loading}>Loading easy-news stories…</Panel> : <EmptyState title="No articles found">Try a different search. If the feed is offline, return after a connection is available so Kakehashi can create a local cache.</EmptyState>}
    </ContentPage>
  );
}

export function NewsArticleView({ articleId }: { articleId: string }) {
  const [feed, setFeed] = useState<FeedPayload | null>(() => readLocal<FeedPayload | null>("news-cache", null));
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/news/feed", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as FeedPayload;
      setFeed(payload);
      writeLocal("news-cache", payload);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const article = feed?.articles.find((item) => item.id === articleId);
  if (!article) return <ContentPage variant="reader"><ContentHeader title="Easy news" description="Annotated Japanese news reading." /><EmptyState title={loading ? "Loading article…" : "Article unavailable"}>{loading ? "Checking the current feed and your browser cache." : "This story is no longer in the recent feed and was not saved in this browser."}</EmptyState></ContentPage>;
  const imageBlocks = article.content?.filter((block) => block.type === "image") ?? (article.imageUrl ? [{ type: "image" as const, url: article.imageUrl, alt: "Story illustration" }] : []);
  const seenImages = new Set<string>();
  const images = imageBlocks.flatMap((block) => {
    const imageUrl = proxyNewsImageUrl(block.url, article.url);
    if (!imageUrl || seenImages.has(imageUrl)) return [];
    seenImages.add(imageUrl);
    return [{ imageUrl, alt: block.alt || "Story illustration" }];
  });
  return <ContentPage variant="reader" className={styles.newsArticleReveal}><ContentHeader title={article.title} description={new Date(article.publishedAt).toLocaleString()} actions={<><Link className={styles.secondaryButton} href="/news">All stories</Link><a className={styles.secondaryButton} href={article.url} target="_blank" rel="noreferrer">Source <ExternalLink size={15} aria-hidden="true" /></a></>} />{images.length ? <div className={styles.newsArticleMedia}>{images.map((image, index) => <figure className={styles.newsArticleImage} key={image.imageUrl}><Image src={image.imageUrl} alt={image.alt} width={1200} height={675} sizes="(max-width: 960px) 100vw, 900px" loading={index === 0 ? "eager" : "lazy"} unoptimized /></figure>)}</div> : null}<JapaneseReader text={article.body || article.summary || article.title} ariaLabel={article.title} /></ContentPage>;
}
