"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Bookmark, Check, Circle, ChevronDown, ExternalLink, ListFilter, RefreshCw, Search } from "lucide-react";
import { useCachedNewsKanji } from "./use-cached-news-kanji";
import { useStudyDataset } from "@/features/study/use-study-dataset";
import { JapaneseReader } from "./JapaneseReader";
import {
  calculateKnownKanjiPercentage,
  passedKanjiCharacters,
} from "./annotation";
import { ContentHeader, ContentPage, EmptyState, Panel } from "./ui";
import { normalizeCachedArticle, normalizedArticleId, sourceFromArticleId } from "./news-cache";
import { proxyNewsImageUrl } from "./news-images";
import { NewsAudioPlayer } from "./NewsAudioPlayer";
import { readSavedNews, setNewsSaved, useSavedNews } from "./saved-news";
import { setNewsRead, useNewsReadHistory } from "./news-read-history";
import { readLocal, writeLocal } from "./storage";
import type {
  NewsArticle,
  NewsSource,
  NewsSourcePreference,
} from "./types";
import { useFirstContentReveal } from "./useFirstContentReveal";
import styles from "./content.module.css";

interface FeedPayload {
  articles: NewsArticle[];
  updatedAt: string;
  source: "live" | "server-cache" | "browser-cache";
  unavailableSources?: NewsSource[];
  cachedSources?: NewsSource[];
}

type NewsSort = "date" | "known";
type NewsContentBlock = NonNullable<NewsArticle["content"]>[number];

const NEWS_SOURCE_PREFERENCE_KEY = "news-source-preference";
const NEWS_FURIGANA_PREFERENCE_KEY = "news-show-furigana";
const NEWS_FURIGANA_EVENT = "kakehashi-news-furigana-change";
const LEGACY_NEWS_CACHE_KEY = "news-cache";
const NEWS_SOURCES = ["easy", "regular"] as const;

const SOURCE_LABELS: Record<NewsSourcePreference, string> = {
  easy: "Easy",
  regular: "Standard",
  both: "Easy + Standard",
};

function isNewsSource(value: unknown): value is NewsSource {
  return value === "easy" || value === "regular";
}

function normalizeSourcePreference(value: unknown): NewsSourcePreference {
  return value === "regular" || value === "both" ? value : "easy";
}

function subscribeToFuriganaPreference(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key.endsWith(`:${NEWS_FURIGANA_PREFERENCE_KEY}`)) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(NEWS_FURIGANA_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(NEWS_FURIGANA_EVENT, onChange);
  };
}

function readFuriganaPreference() {
  return readLocal<unknown>(NEWS_FURIGANA_PREFERENCE_KEY, true) !== false;
}

function requestedSources(preference: NewsSourcePreference): NewsSource[] {
  return preference === "both" ? [...NEWS_SOURCES] : [preference];
}

function normalizeFeedPayload(
  value: unknown,
  fallbackSource: NewsSource,
): FeedPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<FeedPayload>;
  if (!Array.isArray(candidate.articles)) return null;

  const articles = candidate.articles.flatMap((article) => {
    const normalized = normalizeCachedArticle(article, fallbackSource);
    return normalized ? [normalized] : [];
  });
  const provider =
    candidate.source === "live" || candidate.source === "server-cache"
      ? candidate.source
      : "browser-cache";
  const unavailableSources = Array.isArray(candidate.unavailableSources)
    ? [...new Set(candidate.unavailableSources.filter(isNewsSource))]
    : undefined;

  return {
    articles,
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt
        : new Date(0).toISOString(),
    source: provider,
    ...(unavailableSources?.length ? { unavailableSources } : {}),
  };
}

function sourceCacheKey(source: NewsSource) {
  return `news-cache-${source}`;
}

function readSourceCache(source: NewsSource): FeedPayload | null {
  const current = normalizeFeedPayload(
    readLocal<unknown>(sourceCacheKey(source), null),
    source,
  );
  if (current?.articles.some((article) => article.source === source)) {
    return {
      ...current,
      articles: current.articles.filter((article) => article.source === source),
      source: "browser-cache",
      cachedSources: [source],
    };
  }

  if (source !== "easy") return null;
  const legacy = normalizeFeedPayload(
    readLocal<unknown>(LEGACY_NEWS_CACHE_KEY, null),
    "easy",
  );
  const articles =
    legacy?.articles.filter((article) => article.source === "easy") ?? [];
  if (!legacy || articles.length === 0) return null;

  const migrated = {
    ...legacy,
    articles,
    source: "browser-cache" as const,
    cachedSources: ["easy" as const],
  };
  writeLocal(sourceCacheKey("easy"), migrated);
  return migrated;
}

function newestTimestamp(feeds: FeedPayload[]) {
  let newest = 0;
  for (const feed of feeds) {
    const timestamp = Date.parse(feed.updatedAt);
    if (Number.isFinite(timestamp)) newest = Math.max(newest, timestamp);
  }
  return new Date(newest).toISOString();
}

function dateSortedArticles(articles: NewsArticle[]) {
  const byId = new Map<string, NewsArticle>();
  for (const article of articles) {
    const existing = byId.get(article.id);
    if (!existing || (!existing.isFullArticle && article.isFullArticle)) {
      byId.set(article.id, article);
    }
  }
  return [...byId.values()].sort(
    (left, right) =>
      Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
      left.id.localeCompare(right.id),
  );
}

function readCachedFeed(
  preference: NewsSourcePreference,
): FeedPayload | null {
  const feeds = requestedSources(preference).flatMap((source) => {
    const feed = readSourceCache(source);
    return feed ? [feed] : [];
  });
  if (feeds.length === 0) return null;

  return {
    articles: dateSortedArticles(feeds.flatMap((feed) => feed.articles)),
    updatedAt: newestTimestamp(feeds),
    source: "browser-cache",
    cachedSources: [
      ...new Set(feeds.flatMap((feed) => feed.cachedSources ?? [])),
    ],
  };
}

function preserveCachedFullArticles(payload: FeedPayload): FeedPayload {
  const fullById = new Map<string, NewsArticle>();
  for (const source of NEWS_SOURCES) {
    for (const article of readSourceCache(source)?.articles ?? []) {
      if (article.isFullArticle) fullById.set(article.id, article);
    }
  }

  return {
    ...payload,
    articles: payload.articles.map((article) => {
      if (article.isFullArticle) return article;
      const cached = fullById.get(article.id);
      if (!cached) return article;
      return {
        ...cached,
        ...article,
        imageUrl: article.imageUrl ?? cached.imageUrl,
        body: cached.body,
        content: cached.content,
        isFullArticle: true,
      };
    }),
  };
}

function writeSourceCaches(payload: FeedPayload) {
  for (const source of NEWS_SOURCES) {
    const articles = payload.articles.filter(
      (article) => article.source === source,
    );
    if (articles.length === 0) continue;
    writeLocal(sourceCacheKey(source), {
      articles,
      updatedAt: payload.updatedAt,
      source: payload.source,
    } satisfies FeedPayload);
  }
}

function mergeUnavailableSourceCaches(
  payload: FeedPayload,
  preference: NewsSourcePreference,
): FeedPayload {
  const articles = [...payload.articles];
  const cachedSources: NewsSource[] = [];
  for (const source of requestedSources(preference)) {
    if (articles.some((article) => article.source === source)) continue;
    const cached = readSourceCache(source);
    if (!cached?.articles.length) continue;
    articles.push(...cached.articles);
    cachedSources.push(source);
  }

  return {
    ...payload,
    articles: dateSortedArticles(articles),
    ...(cachedSources.length ? { cachedSources } : {}),
  };
}

function loadingLabel(preference: NewsSourcePreference) {
  return preference === "both"
    ? "Loading Easy and Standard stories…"
    : `Loading ${SOURCE_LABELS[preference]} stories…`;
}

function unavailableMessage(
  unavailableSources: NewsSource[] | undefined,
  cachedSources: NewsSource[] | undefined,
) {
  if (!unavailableSources?.length) return "";
  const unavailable = unavailableSources
    .map((source) => SOURCE_LABELS[source])
    .join(" and ");
  const usingCache = unavailableSources.some((source) =>
    cachedSources?.includes(source),
  );
  return usingCache
    ? `${unavailable} could not refresh. Showing its saved articles.`
    : `${unavailable} news is temporarily unavailable.`;
}

function SourceBadge({ source }: { source: NewsSource }) {
  const label = SOURCE_LABELS[source];
  return (
    <span className={styles.newsSourceBadge} aria-label={`${label} source`}>
      {label}
    </span>
  );
}

function KnownScore({ value }: { value: number | null }) {
  const band =
    value === null
      ? "pending"
      : value >= 90
        ? "high"
        : value >= 70
          ? "medium"
          : "low";
  return (
    <span className={styles.knownScore} data-band={band}>
      {value === null ? "… Known" : `${value}% Known`}
    </span>
  );
}

function NewsImage({
  article,
  recent = false,
}: {
  article: NewsArticle;
  recent?: boolean;
}) {
  const imageUrl = proxyNewsImageUrl(article.imageUrl, article.url);
  if (!imageUrl) {
    return (
      <span
        className={
          recent
            ? styles.recentNewsPlaceholder
            : styles.articleThumbnailPlaceholder
        }
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={recent ? styles.recentNewsImage : styles.articleThumbnail}
    >
      <Image
        src={imageUrl}
        alt=""
        fill
        sizes={
          recent
            ? "(max-width: 640px) 72vw, 280px"
            : "(max-width: 480px) 80px, 112px"
        }
        loading={recent ? "eager" : "lazy"}
        unoptimized
      />
    </span>
  );
}

function ReadButton({
  article,
  isRead,
  onChange,
}: {
  article: NewsArticle;
  isRead: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.newsReadButton}
      aria-label={`${isRead ? "Mark unread" : "Mark as read"}: ${article.title}`}
      aria-pressed={isRead}
      title={isRead ? "Mark unread" : "Mark as read"}
      onClick={onChange}
    >
      {isRead ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
      {isRead ? "Read" : "Mark read"}
    </button>
  );
}

function SaveButton({ article, isSaved, onChange }: { article: NewsArticle; isSaved: boolean; onChange: () => void }) {
  return (
    <button type="button" className={styles.newsSaveButton}
      aria-label={`${isSaved ? "Remove saved article" : "Save article"}: ${article.title}`}
      aria-pressed={isSaved} title={isSaved ? "Remove from saved articles" : "Save article"} onClick={onChange}>
      <Bookmark size={16} aria-hidden="true" fill={isSaved ? "currentColor" : "none"} />
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}

function NewsFilters({ savedOnly, unreadOnly, onSavedChange, onUnreadChange }: {
  savedOnly: boolean;
  unreadOnly: boolean;
  onSavedChange: (value: boolean) => void;
  onUnreadChange: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return (
    <div ref={containerRef} className={styles.newsFilterControl}>
      <button ref={buttonRef} type="button" className={styles.secondaryButton}
        aria-label="Filter news" aria-expanded={open} aria-controls="news-filter-options"
        data-active={savedOnly || unreadOnly} onClick={() => setOpen((value) => !value)}>
        <ListFilter size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div id="news-filter-options" className={styles.newsFilterOptions} role="group" aria-label="Article filters">
          <label><input type="checkbox" checked={unreadOnly} onChange={(event) => onUnreadChange(event.target.checked)} />Unread only</label>
          <label><input type="checkbox" checked={savedOnly} onChange={(event) => onSavedChange(event.target.checked)} />Saved only</label>
        </div>
      ) : null}
    </div>
  );
}

export function NewsIndex() {
  const savedArticles = useSavedNews();
  const savedIds = useMemo(() => new Set(savedArticles.map((article) => article.id)), [savedArticles]);
  const [savedOnly, setSavedOnly] = useState(false);
  const readIds = useNewsReadHistory();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { dataset, user, status } = useStudyDataset();
  const firstNewsReveal = useFirstContentReveal();
  const [sourcePreference, setSourcePreference] =
    useState<NewsSourcePreference>(() =>
      normalizeSourcePreference(
        readLocal<unknown>(NEWS_SOURCE_PREFERENCE_KEY, "easy"),
      ),
    );
  const [feed, setFeed] = useState<FeedPayload | null>(() =>
    readCachedFeed(
      normalizeSourcePreference(
        readLocal<unknown>(NEWS_SOURCE_PREFERENCE_KEY, "easy"),
      ),
    ),
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<NewsSort>("date");
  const requestIdRef = useRef(0);
  const toggleRead = (article: NewsArticle) => {
    setSaveError(setNewsRead(article.id, !readIds.has(article.id))
      ? ""
      : "Could not save read status in this browser. Please try again.");
  };

  const refresh = useCallback(async (preference: NewsSourcePreference) => {
    const requestId = ++requestIdRef.current;
    const cached = readCachedFeed(preference);
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/news/feed?source=${encodeURIComponent(preference)}`,
        { cache: "no-store" },
      );
      const rawPayload = (await response.json()) as unknown;
      const errorMessage =
        rawPayload && typeof rawPayload === "object" && "error" in rawPayload
          ? String((rawPayload as { error?: unknown }).error || "")
          : "";
      if (!response.ok) {
        throw new Error(errorMessage || "News could not be refreshed.");
      }

      const normalized = normalizeFeedPayload(
        rawPayload,
        preference === "regular" ? "regular" : "easy",
      );
      if (!normalized?.articles.length) {
        throw new Error("The selected news source returned no articles.");
      }
      const preserved = preserveCachedFullArticles(normalized);
      writeSourceCaches(preserved);
      const displayed = mergeUnavailableSourceCaches(preserved, preference);
      if (requestId !== requestIdRef.current) return;

      setFeed(displayed);
      setMessage(
        unavailableMessage(
          displayed.unavailableSources,
          displayed.cachedSources,
        ),
      );
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setFeed(cached);
      setMessage(
        error instanceof Error ? error.message : "News could not be refreshed.",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void refresh(sourcePreference),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [refresh, sourcePreference]);

  const selectSource = (value: string) => {
    const next = normalizeSourcePreference(value);
    writeLocal(NEWS_SOURCE_PREFERENCE_KEY, next);
    setFeed(readCachedFeed(next));
    setMessage("");
    setSourcePreference(next);
  };

  const articles = useMemo(() => feed?.articles ?? [], [feed?.articles]);
  const toggleSaved = (article: NewsArticle) => {
    const saving = !savedIds.has(article.id);
    setSaveError(setNewsSaved(article, saving)
      ? ""
      : "Could not save articles in this browser. Storage may be full or unavailable.");
  };
  const filterArticles = useCallback((items: readonly NewsArticle[]) => {
    const needle = query.trim().toLocaleLowerCase("ja");
    return items.filter((article) =>
      (!unreadOnly || !readIds.has(article.id)) &&
      (!needle || `${article.title} ${article.body ?? ""}`.toLocaleLowerCase("ja").includes(needle)),
    );
  }, [query, unreadOnly, readIds]);
  const filtered = useMemo(() => filterArticles(articles), [articles, filterArticles]);
  const filteredSaved = useMemo(() => dateSortedArticles(filterArticles(savedArticles)), [savedArticles, filterArticles]);
  const subjects = dataset?.subjects;
  const assignments = dataset?.assignments;
  const freshPassedKanji = useMemo(
    () => subjects && assignments ? passedKanjiCharacters(subjects, assignments) : null,
    [subjects, assignments],
  );
  const passedKanji = useCachedNewsKanji(
    status === "authenticated" ? user?.data.username ?? null : null,
    freshPassedKanji,
  );
  const knownByArticle = useMemo(
    () =>
      new Map(
        [...articles, ...savedArticles].map((article) => [
          article.id,
          passedKanji
            ? calculateKnownKanjiPercentage(
                `${article.title}${article.body ?? article.summary ?? ""}`,
                passedKanji,
              )
            : null,
        ]),
      ),
    [articles, savedArticles, passedKanji],
  );
  const otherArticles = useMemo(() => {
    const articles = filtered.slice(5);
    if (sort === "known") {
      return [...articles].sort(
        (left, right) =>
          (knownByArticle.get(right.id) ?? -1) -
            (knownByArticle.get(left.id) ?? -1) ||
          Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
      );
    }
    return articles;
  }, [filtered, knownByArticle, sort]);
  const showSourceBadges = savedOnly || sourcePreference === "both";
  const sourceLabel = SOURCE_LABELS[sourcePreference];

  const renderStoryRow = (article: NewsArticle, savedSection = false) => (
    <article className={styles.newsListEntry} data-read={readIds.has(article.id)} key={article.id}>
      <Link className={styles.articleRow} href={`/news/${encodeURIComponent(article.id)}`}>
        <NewsImage article={article} />
        <time dateTime={article.publishedAt}>
          {new Date(article.publishedAt).toLocaleDateString()}
        </time>
        <h2 lang="ja">{article.title}</h2>
        <span className={styles.articleBadges}>
          {savedSection || showSourceBadges ? (
            <SourceBadge source={article.source} />
          ) : null}
          <KnownScore
            value={knownByArticle.get(article.id) ?? null}
          />
        </span>
        <span aria-hidden="true">→</span>
      </Link>
      <div className={styles.newsCardActions}>
        <ReadButton article={article} isRead={readIds.has(article.id)} onChange={() => toggleRead(article)} />
        <SaveButton article={article} isSaved={savedIds.has(article.id)} onChange={() => toggleSaved(article)} />
      </div>
    </article>
  );

  return (
    <ContentPage variant="library">
      <div className={styles.newsToolbar} role="search" aria-label="News filters">
        <div className={styles.newsSearchField}>
          <label className="sr-only" htmlFor="news-search">
            Search articles
          </label>
          <div className={styles.searchInputWrap}>
            <Search size={18} aria-hidden="true" />
            <input
              id="news-search"
              className={styles.input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Japanese headlines or article text"
            />
          </div>
        </div>
        <label className="sr-only" htmlFor="news-source">
          Source
        </label>
        <span className={`${styles.newsSelectWrap} ${styles.newsSourceControl}`}>
          <select
            id="news-source"
            className={styles.newsSourceSelect}
            value={savedOnly ? "both" : sourcePreference}
            disabled={savedOnly}
            onChange={(event) => selectSource(event.target.value)}
          >
            <option value="easy">Easy</option>
            <option value="regular">Standard</option>
            <option value="both">Both</option>
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </span>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => void refresh(sourcePreference)}
          disabled={loading}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <NewsFilters savedOnly={savedOnly} unreadOnly={unreadOnly} onSavedChange={setSavedOnly} onUnreadChange={setUnreadOnly} />
      </div>
      <div className={styles.newsReadFilters} role="group" aria-label="Reading status">
        <button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All stories</button>
        <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>
          Unread ({(savedOnly ? savedArticles : articles).filter((article) => !readIds.has(article.id)).length})
        </button>
      </div>
      {saveError ? <div className={styles.notice} role="alert">{saveError}</div> : null}
      {!savedOnly && message ? (
        <div className={styles.notice} role="status">
          {message}
          {!savedOnly && feed && feed.source === "browser-cache"
            ? " Showing the last browser copy."
            : ""}
        </div>
      ) : null}
      {(!savedOnly && filtered.length) || filteredSaved.length ? (
        <div className={styles.newsSections} {...firstNewsReveal}>
          {!savedOnly && filtered.length > 0 ? <section
            className={styles.newsSection}
            aria-labelledby="recent-news-heading"
          >
            <div className={styles.sectionHead}>
              <div>
                <h2 id="recent-news-heading">Recent news</h2>
                <p>The newest {sourceLabel} stories.</p>
              </div>
            </div>
            <div className={styles.recentNewsRail}>
              {filtered.slice(0, 5).map((article) => (
                <article className={styles.recentNewsCard} data-read={readIds.has(article.id)} key={article.id}>
                  <Link className={styles.newsStoryLink} href={`/news/${encodeURIComponent(article.id)}`}>
                    <NewsImage article={article} recent />
                    <span className={styles.recentNewsCopy}>
                      <span className={styles.newsMeta}>
                        <time dateTime={article.publishedAt}>
                          {new Date(article.publishedAt).toLocaleDateString()}
                        </time>
                        <span className={styles.newsCardBadges}>
                          {showSourceBadges ? (
                            <SourceBadge source={article.source} />
                          ) : null}
                          <KnownScore
                            value={knownByArticle.get(article.id) ?? null}
                          />
                        </span>
                      </span>
                      <strong lang="ja">{article.title}</strong>
                    </span>
                  </Link>
                  <div className={styles.newsCardActions}>
                    <ReadButton article={article} isRead={readIds.has(article.id)} onChange={() => toggleRead(article)} />
                    <SaveButton article={article} isSaved={savedIds.has(article.id)} onChange={() => toggleSaved(article)} />
                  </div>
                </article>
              ))}
            </div>
          </section> : null}
          {!savedOnly && filtered.length > 5 ? (
            <section
              className={styles.newsSection}
              aria-labelledby="other-news-heading"
            >
              <div className={styles.sectionHead}>
                <div>
                  <h2 id="other-news-heading">Other news</h2>
                  <p>
                    {sort === "known"
                      ? "Highest known-kanji percentage first."
                      : "More recent stories, newest first."}
                  </p>
                </div>
                <label className={styles.newsSort}>
                  <span>Sort</span>
                  <span className={styles.newsSelectWrap}>
                    <select
                      className={styles.newsSortSelect}
                      value={sort}
                      onChange={(event) =>
                        setSort(event.target.value as NewsSort)
                      }
                    >
                      <option value="date">Newest</option>
                      <option value="known">Known kanji %</option>
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </span>
                </label>
              </div>
              <div className={styles.articleList}>
                {otherArticles.map((article) => renderStoryRow(article))}
              </div>
            </section>
          ) : null}
          {filteredSaved.length > 0 ? (
            <section className={styles.newsSection} aria-labelledby="saved-news-heading">
              <div className={styles.sectionHead}>
                <h2 id="saved-news-heading">Saved articles</h2>
              </div>
              <div className={styles.articleList}>
                {filteredSaved.map((article) => renderStoryRow(article, true))}
              </div>
            </section>
          ) : null}
        </div>
      ) : loading && !savedOnly ? (
        <Panel className={styles.loading}>{loadingLabel(sourcePreference)}</Panel>
      ) : (
        <EmptyState title={savedOnly ? query || unreadOnly ? "No saved articles match" : "No saved articles yet" : unreadOnly && !query && feed?.articles.length ? "You’re all caught up" : "No articles found"}>
          {savedOnly ? "Use the bookmark button on a story to keep it here for later. Saved articles stay in this browser." : unreadOnly ? "Switch to All stories to see articles you’ve already read, or try another search or source." : "Try a different search or source. If the feed is offline, return when a connection is available."}
        </EmptyState>
      )}
      {!savedOnly && feed ? (
        <p className={styles.hint}>
          Updated {new Date(feed.updatedAt).toLocaleString()} · {sourceLabel}
          {feed.source === "live"
            ? " live feed"
            : feed.source === "browser-cache"
              ? " saved articles"
              : " server cache"}
          {feed.cachedSources?.length
            ? ` · saved ${feed.cachedSources.map((source) => SOURCE_LABELS[source]).join(" + ")}`
            : ""}
          {" · Article rights remain with NHK."}
        </p>
      ) : null}
    </ContentPage>
  );
}

function articleContent(article: NewsArticle): NewsContentBlock[] {
  const blocks = article.content?.length
    ? [...article.content]
    : [
        ...(article.imageUrl
          ? [{ type: "image" as const, url: article.imageUrl, alt: "" }]
          : []),
        ...((article.body || article.summary)
          ? [
              {
                type: "text" as const,
                text: article.body || article.summary || "",
              },
            ]
          : []),
      ];
  if (
    article.imageUrl &&
    !blocks.some(
      (block) => block.type === "image" && block.url === article.imageUrl,
    )
  ) {
    blocks.unshift({ type: "image", url: article.imageUrl, alt: "" });
  }
  return blocks;
}

function NewsArticleDocument({ article, showFurigana, onShowFuriganaChange }: { article: NewsArticle; showFurigana: boolean; onShowFuriganaChange: (value: boolean) => void }) {
  const seenImages = new Set<string>();
  const blocks = articleContent(article).flatMap<NewsContentBlock>((block): NewsContentBlock[] => {
    if (block.type === "text") return block.text ? [block] : [];
    const imageUrl = proxyNewsImageUrl(block.url, article.url);
    if (!imageUrl || seenImages.has(imageUrl)) return [];
    seenImages.add(imageUrl);
    return [{ ...block, url: imageUrl }];
  });
  const readerText =
    article.body ||
    blocks
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n\n") ||
    article.summary ||
    article.title;

  return (
    <section
      className={styles.newsArticleDocument}
      aria-label="Article document"
    >
      <JapaneseReader text={readerText} blocks={blocks} ariaLabel={article.title} showFurigana={showFurigana} onShowFuriganaChange={onShowFuriganaChange} />
    </section>
  );
}

function StandardNewsSummary({ article }: { article: NewsArticle }) {
  const summary =
    article.summary ||
    article.body ||
    article.content
      ?.flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n\n") ||
    "NHK did not include a summary for this article.";
  const leadImage = article.imageUrl
    ? proxyNewsImageUrl(article.imageUrl, article.url)
    : undefined;

  return (
    <section className={styles.newsSummary}>
      {leadImage ? (
        <figure className={styles.newsDocumentImage}>
          <Image
            src={leadImage}
            alt="NHK article"
            width={1200}
            height={675}
            sizes="(max-width: 960px) 100vw, 900px"
            loading="eager"
            unoptimized
          />
        </figure>
      ) : null}
      <strong className={styles.newsSummarySource}>NHK ONE News summary</strong>
      <p className={styles.newsSummaryBody} lang="ja">
        {summary}
      </p>
      <div className={styles.newsSummaryActions}>
        <a
          className={styles.button}
          href={article.url}
          target="_blank"
          rel="noreferrer"
        >
          Open on NHK <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

export function NewsArticleView({ articleId }: { articleId: string }) {
  const savedArticles = useSavedNews();
  const readIds = useNewsReadHistory();
  const [readError, setReadError] = useState("");
  const normalizedId = normalizedArticleId(
    articleId,
    sourceFromArticleId(articleId),
  );
  const articleSource = sourceFromArticleId(normalizedId);
  const [feed, setFeed] = useState<FeedPayload | null>(() => {
    const cached = readSourceCache(articleSource);
    const saved = readSavedNews().find((item) => item.id === normalizedId);
    if (!saved) return cached;
    return {
      updatedAt: cached?.updatedAt ?? new Date(0).toISOString(),
      source: cached?.source ?? "browser-cache",
      articles: [saved, ...(cached?.articles.filter((item) => item.id !== normalizedId) ?? [])],
    };
  });
  const [loading, setLoading] = useState(true);
  const showFurigana = useSyncExternalStore(subscribeToFuriganaPreference, readFuriganaPreference, () => true);

  const changeFurigana = (value: boolean) => {
    if (writeLocal(NEWS_FURIGANA_PREFERENCE_KEY, value)) window.dispatchEvent(new Event(NEWS_FURIGANA_EVENT));
  };

  useEffect(() => {
    const controller = new AbortController();
    const cachedArticle = readSavedNews().find((article) => article.id === normalizedId) ?? readSourceCache(articleSource)?.articles.find(
      (article) => article.id === normalizedId,
    );
    void fetch(`/news/feed?source=${articleSource}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = normalizeFeedPayload(
          await response.json(),
          articleSource,
        );
        if (!payload) return;
        const preserved = preserveCachedFullArticles(payload);
        writeSourceCaches(preserved);
        if (
          cachedArticle &&
          !preserved.articles.some((article) => article.id === normalizedId)
        ) {
          preserved.articles = dateSortedArticles([
            ...preserved.articles,
            cachedArticle,
          ]);
        }
        setFeed(preserved);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [articleSource, normalizedId]);

  const article = savedArticles.find((item) => item.id === normalizedId) ?? feed?.articles.find((item) => item.id === normalizedId);
  const resolvedArticleId = article?.id;
  useEffect(() => {
    if (!resolvedArticleId) return;
    const timer = window.setTimeout(() => {
      setReadError(setNewsRead(resolvedArticleId, true) ? "" : "Could not save read status in this browser. Please try again.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resolvedArticleId]);
  const sourceLabel = SOURCE_LABELS[articleSource];
  if (!article) {
    return (
      <ContentPage variant="reader">
        <ContentHeader
          title="NHK news"
          description={`${sourceLabel} Japanese news reading.`}
        />
        <EmptyState title={loading ? "Loading article…" : "Article unavailable"}>
          {loading
            ? `Checking your saved articles and the current ${sourceLabel} feed.`
            : "This story is no longer in the recent feed and was not saved in this browser."}
        </EmptyState>
      </ContentPage>
    );
  }

  const isSaved = savedArticles.some((item) => item.id === normalizedId);
  const isStandardSummary =
    article.source === "regular" && !article.isFullArticle;
  return (
    <ContentPage
      variant="reader"
      className={`${styles.newsArticleReveal} ${article.audioUrl ? styles.newsArticleWithAudio : ""}`}
    >
      <ContentHeader
        title={article.title}
        description={`${SOURCE_LABELS[article.source]} · ${new Date(article.publishedAt).toLocaleString()}`}
        actions={
          <>
            <SaveButton article={article} isSaved={isSaved} onChange={() => {
              setReadError(setNewsSaved(article, !isSaved) ? "" : "Could not save articles in this browser. Storage may be full or unavailable.");
            }} />
            <button className={styles.secondaryButton} type="button" onClick={() => {
              setReadError(setNewsRead(article.id, !readIds.has(article.id)) ? "" : "Could not save read status in this browser. Please try again.");
            }}>
              {readIds.has(article.id) ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
              {readIds.has(article.id) ? "Mark unread" : "Mark as read"}
            </button>
            <Link className={styles.secondaryButton} href="/news">
              All stories
            </Link>
            <a
              className={styles.secondaryButton}
              href={article.url}
              target="_blank"
              rel="noreferrer"
            >
              {article.source === "regular" ? "Open on NHK" : "Source"}{" "}
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </>
        }
      />
      {readError ? <div className={styles.notice} role="alert">{readError}</div> : null}
      {article.audioUrl ? (
        <NewsAudioPlayer key={article.id} src={article.audioUrl} title={article.title} />
      ) : null}
      {isStandardSummary ? (
        <StandardNewsSummary article={article} />
      ) : (
        <NewsArticleDocument article={article} showFurigana={showFurigana} onShowFuriganaChange={changeFurigana} />
      )}
    </ContentPage>
  );
}
