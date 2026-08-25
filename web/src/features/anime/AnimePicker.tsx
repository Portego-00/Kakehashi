"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Film, ListChecks, LoaderCircle, Search, Star, X } from "lucide-react";
import { fetchAnimeCatalog, syncAnimeList } from "./client";
import { ALL_ANIME_SOURCE, NO_ANIME_SOURCE, formatAnimeMediaType, isAllAnimeSelected, normalizeAnimeSelection, selectedAnimeIds, toggleAnimeSelection, type AnimeListProvider } from "./types";
import styles from "./anime-picker.module.css";

type SyncUsernames = { myanimelist?: string; anilist?: string };
const EMPTY_CATALOG: Awaited<ReturnType<typeof fetchAnimeCatalog>> = [];

function AnimeListProviderIcon({ provider }: { provider: AnimeListProvider }) {
  if (provider === "myanimelist") {
    return <svg data-provider-icon={provider} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.273 7.247v8.423l-2.103-.003v-5.216l-2.03 2.404-1.989-2.458-.02 5.285H.001L0 7.247h2.203l1.865 2.545 2.015-2.546 2.19.001zm8.628 2.069.025 6.335h-2.365l-.008-2.871h-2.8c.07.499.21 1.266.417 1.779.155.381.298.751.583 1.128l-1.705 1.125c-.349-.636-.622-1.337-.878-2.082a9.296 9.296 0 0 1-.507-2.179c-.085-.75-.097-1.471.107-2.212a3.908 3.908 0 0 1 1.161-1.866c.313-.293.749-.5 1.1-.687.351-.187.743-.264 1.107-.359a7.405 7.405 0 0 1 1.191-.183c.398-.034 1.107-.066 2.39-.028l.545 1.749H14.51c-.593.008-.878.001-1.341.209a2.236 2.236 0 0 0-1.278 1.92l2.663.033.038-1.81h2.309zm3.992-2.099v6.627l3.107.032-.43 1.775h-4.807V7.187l2.13.03z" fill="#2e51a2" />
    </svg>;
  }

  return <svg data-provider-icon={provider} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6.361 2.943 0 21.056h4.942l1.077-3.133H11.4l1.052 3.133H22.9c.71 0 1.1-.392 1.1-1.101V17.53c0-.71-.39-1.101-1.1-1.101h-6.483V4.045c0-.71-.392-1.102-1.101-1.102h-2.422c-.71 0-1.101.392-1.101 1.102v1.064l-.758-2.166zm2.324 5.948 1.688 5.018H7.144z" fill="#02a9ff" />
  </svg>;
}

export function AnimePicker({
  selectedSources,
  onChange,
  label = "Anime sources",
  description = "Choose the anime used for ImmersionKit listening scenes.",
  syncUsernames = {},
  onSyncUsernameChange,
}: {
  selectedSources: string[];
  onChange: (sources: string[]) => void;
  label?: string;
  description?: string;
  syncUsernames?: SyncUsernames;
  onSyncUsernameChange?: (provider: AnimeListProvider, username: string) => void;
}) {
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(selectedSources);
  const [usernames, setUsernames] = useState({ myanimelist: syncUsernames.myanimelist ?? "", anilist: syncUsernames.anilist ?? "" });
  const [syncMessage, setSyncMessage] = useState("");
  const catalogQuery = useQuery({ queryKey: ["anime", "catalog"], queryFn: ({ signal }) => fetchAnimeCatalog(signal), staleTime: 24 * 60 * 60_000 });
  const catalog = catalogQuery.data ?? EMPTY_CATALOG;
  const selectedIds = useMemo(() => selectedAnimeIds(selectedSources, catalog), [catalog, selectedSources]);
  const draftIds = useMemo(() => selectedAnimeIds(draft, catalog), [catalog, draft]);
  const draftSet = useMemo(() => new Set(draftIds), [draftIds]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return catalog;
    return catalog.filter((anime) => [anime.title, anime.malTitle, anime.id].some((value) => value?.toLocaleLowerCase().includes(normalized)));
  }, [catalog, query]);
  const preview = useMemo(() => catalog.filter((anime) => selectedIds.includes(anime.id) && anime.imageUrl).slice(0, 3), [catalog, selectedIds]);
  const summary = selectedSources.includes(NO_ANIME_SOURCE)
    ? "None selected"
    : isAllAnimeSelected(selectedSources)
      ? catalog.length ? `All ${catalog.length} anime` : "All anime"
      : `${selectedIds.length || selectedSources.length} selected`;

  const syncMutation = useMutation({
    mutationFn: ({ provider, username }: { provider: AnimeListProvider; username: string }) => syncAnimeList(provider, username),
    onMutate: () => setSyncMessage(""),
    onSuccess: (result) => {
      setDraft(normalizeAnimeSelection(result.matchedSources, catalog));
      setSyncMessage(`${result.matchedSources.length} of ${result.watched} watched anime matched ImmersionKit.`);
      onSyncUsernameChange?.(result.provider, result.username);
    },
  });

  const close = () => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const show = () => {
    setDraft(selectedSources.length ? selectedSources : [ALL_ANIME_SOURCE]);
    setUsernames({ myanimelist: syncUsernames.myanimelist ?? "", anilist: syncUsernames.anilist ?? "" });
    setQuery("");
    setSyncMessage("");
    syncMutation.reset();
    setOpen(true);
  };
  const apply = () => {
    onChange(draft.length ? draft : [NO_ANIME_SOURCE]);
    close();
  };
  const submitSync = (provider: AnimeListProvider) => {
    const username = usernames[provider].trim();
    if (username) syncMutation.mutate({ provider, username });
  };

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousRootOverscroll = root.style.overscrollBehavior;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyLeft = document.body.style.left;
    const previousBodyRight = document.body.style.right;
    const previousBodyWidth = document.body.style.width;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = `-${scrollX}px`;
    document.body.style.right = "0";
    document.body.style.width = "100%";
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") return close();
      if (event.key !== "Tab") return;
      const focusable = [...(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousRootOverscroll;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.left = previousBodyLeft;
      document.body.style.right = previousBodyRight;
      document.body.style.width = previousBodyWidth;
      if (window.scrollX !== scrollX || window.scrollY !== scrollY) window.scrollTo(scrollX, scrollY);
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className={styles.trigger} onClick={show} aria-label={`${label}: ${summary}. Open anime picker`}>
        <span className={styles.triggerPosters} aria-hidden>
          {preview.length ? preview.map((anime) => <Image key={anime.id} src={anime.imageUrl!} alt="" width={32} height={44} sizes="32px" />) : <Film size={19} />}
        </span>
        <span className={styles.triggerCopy}><strong>{summary}</strong><small>{description}</small></span>
        <ChevronRight size={18} aria-hidden />
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className={styles.modalHeader}>
              <div><h2 id={titleId}>Choose anime</h2><p>Posters and ratings are from MyAnimeList. Selection applies to ImmersionKit scenes.</p></div>
              <button type="button" className={styles.iconButton} onClick={close} aria-label="Close anime picker"><X size={19} /></button>
            </header>

            <div className={styles.controls}>
              <label className={styles.searchField}><Search size={17} aria-hidden /><span className="sr-only">Search anime</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search anime" /></label>
              <div className={styles.selectionActions}>
                <button type="button" onClick={() => setDraft([ALL_ANIME_SOURCE])} disabled={!catalog.length || draftIds.length === catalog.length}><ListChecks size={16} aria-hidden /> Select all</button>
                <button type="button" onClick={() => setDraft([NO_ANIME_SOURCE])} disabled={!draftIds.length}>Clear</button>
              </div>
            </div>

            <div className={styles.syncGrid} aria-label="Anime list sync">
              {(["myanimelist", "anilist"] as const).map((provider) => {
                const name = provider === "myanimelist" ? "MyAnimeList" : "AniList";
                const active = syncMutation.isPending && syncMutation.variables?.provider === provider;
                return <form key={provider} data-provider={provider} onSubmit={(event) => { event.preventDefault(); submitSync(provider); }}>
                  <label htmlFor={`${titleId}-${provider}`}><AnimeListProviderIcon provider={provider} /><span>{name}</span></label>
                  <input id={`${titleId}-${provider}`} value={usernames[provider]} onChange={(event) => setUsernames((current) => ({ ...current, [provider]: event.target.value }))} autoComplete="username" spellCheck={false} placeholder={`${name} username`} />
                  <button type="submit" disabled={!usernames[provider].trim() || syncMutation.isPending}>{active ? <LoaderCircle className={styles.spinner} size={16} aria-label={`Syncing ${name}`} /> : "Sync watched"}</button>
                </form>;
              })}
              {syncMessage ? <p className={styles.syncMessage} role="status">{syncMessage}</p> : null}
              {syncMutation.error ? <p className={styles.syncError} role="alert">{syncMutation.error.message}</p> : null}
            </div>

            <div className={styles.resultBar}>
              <span>{draftIds.length} of {catalog.length || "…"} selected</span>
              {query ? <span>{filtered.length} matches</span> : null}
            </div>

            <div className={styles.list} role="group" aria-label="Available anime">
              {catalogQuery.isLoading ? <div className={styles.state}><LoaderCircle className={styles.spinner} size={22} /><span>Loading anime catalog…</span></div> : null}
              {catalogQuery.isError ? <div className={styles.state}><p>{catalogQuery.error.message}</p><button type="button" onClick={() => void catalogQuery.refetch()}>Try again</button></div> : null}
              {!catalogQuery.isLoading && !catalogQuery.isError && !filtered.length ? <div className={styles.state}><p>No anime match “{query}”.</p></div> : null}
              {filtered.map((anime) => {
                const selected = draftSet.has(anime.id);
                const meta = [formatAnimeMediaType(anime.mediaType), anime.episodes ? `${anime.episodes} ep${anime.episodes === 1 ? "" : "s"}` : null].filter(Boolean);
                return <button type="button" key={anime.id} className={styles.animeRow} aria-pressed={selected} onClick={() => setDraft((current) => toggleAnimeSelection(current, anime.id, catalog))}>
                  <span className={styles.check} aria-hidden>{selected ? <Check size={15} /> : null}</span>
                  <span className={styles.poster} aria-hidden>{anime.imageUrl ? <Image src={anime.imageUrl} alt="" width={52} height={74} sizes="52px" /> : <Film size={19} />}</span>
                  <span className={styles.animeCopy}>
                    <strong>{anime.title}</strong>
                    {anime.malTitle && anime.malTitle !== anime.title ? <small>{anime.malTitle}</small> : null}
                    {anime.synopsis ? <span>{anime.synopsis}</span> : null}
                  </span>
                  <span className={styles.animeMeta}>{anime.score ? <strong><Star size={13} fill="currentColor" aria-hidden /> {anime.score.toFixed(2)}</strong> : null}{meta.length ? <small>{meta.join(" · ")}</small> : null}</span>
                </button>;
              })}
            </div>

            <footer className={styles.modalFooter}>
              <button type="button" onClick={close}>Cancel</button>
              <button type="button" data-primary onClick={apply}>Apply selection</button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
