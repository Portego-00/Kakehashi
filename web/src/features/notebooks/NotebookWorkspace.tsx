"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check, ChevronDown, ChevronRight, Copy, Download, FileText, FolderOpen, Maximize2, Menu, MoreHorizontal, Plus, Search, Star, Trash2, Undo2, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useImperativeHandle, useMemo, useRef, useState, useTransition, type Ref } from "react";
import { subjectsQuery } from "@/lib/wanikani/queries";
import { useTheme } from "@/lib/theme";
import type { Subject } from "@/types/wanikani";
import { downloadNotebook, notebookMarkdown } from "./export";
import { NOTEBOOK_TEMPLATES, templateContent } from "./templates";
import { EXAMPLE_NOTEBOOK_PAGE_IDS, EXAMPLE_NOTEBOOK_ROOT_ID } from "./example-notebook";
import { type NotebookBlock, type NotebookPage } from "./model";
import { useNotebooks } from "./use-notebooks";
import { usePageDraft } from "./use-page-draft";
import { NotebookPageIcon } from "./NotebookPageIcon";
import { NotebookEditorLoading, NotebookPageLoading, NotebookSidebarLoading, NotebookSpinner } from "./NotebookLoading";
import styles from "./notebooks.module.css";

const NotebookEditor = dynamic(() => import("./NotebookEditor"), { ssr: false, loading: () => <NotebookEditorLoading /> });
type NotebookStore = ReturnType<typeof useNotebooks>;
type DocumentHandle = { flush: () => Promise<boolean> };
const EMPTY_SUBJECTS: Subject[] = [];

function plainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(plainText).join(" ");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return [record.text, record.content, record.children, record.rows, record.cells, (record.props as Record<string, unknown> | undefined)?.label].map((part) => part ? plainText(part) : "").join(" ");
}

export function NotebookWorkspace({ pageId }: { pageId?: string }) {
  const store = useNotebooks();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [routing, startRouting] = useTransition();
  const [retrying, setRetrying] = useState(false);
  const [destination, setDestination] = useState<{ id?: string; title: string; icon?: string; templateId?: string }>({ title: "notebook" });
  const actionInFlight = useRef(false);
  const [removingExample, setRemovingExample] = useState(false);
  const [exampleFeedback, setExampleFeedback] = useState("");
  const documentRef = useRef<DocumentHandle>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const busy = creating || opening || routing;
  const loading = store.isLoading || (retrying && !store.available);
  useEffect(() => {
    const workspace = workspaceRef.current;
    const header = document.querySelector('nav[aria-label="Main navigation"]')?.closest("header");
    if (!workspace || !header) return;
    // The header changes height on tablets and when demo navigation wraps.
    const measure = () => workspace.style.setProperty("--notebook-header-height", `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]') ?? []);
    items()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setSidebarOpen(false); }
      if (event.key === "Tab") {
        const focusable = items(); const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [sidebarOpen]);
  const activePages = useMemo(() => store.state.pages.filter((page) => !page.trashedAt).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)), [store.state.pages]);
  const page = store.state.pages.find((item) => item.id === pageId);
  const examplePages = store.state.examples?.status === "installed" ? store.state.pages.filter((item) => Object.values(EXAMPLE_NOTEBOOK_PAGE_IDS).some((id) => id === item.id)) : [];
  const exampleDestination = examplePages.find((item) => item.id === EXAMPLE_NOTEBOOK_ROOT_ID && !item.trashedAt) ?? examplePages.find((item) => !item.trashedAt);
  const isExamplePage = examplePages.some((item) => item.id === pageId);
  const results = useMemo(() => {
    const sentences = new Map(store.state.sentences.map((item) => [item.id, `${item.japanese} ${item.kana} ${item.english}`]));
    function searchable(blocks: NotebookBlock[]): string { return blocks.map((block) => `${plainText(block)} ${block.type === "sentence" ? sentences.get(String(block.props?.sentenceId)) || "" : ""} ${searchable(block.children ?? [])}`).join(" "); }
    return store.state.pages.filter((item) => Boolean(item.trashedAt) === showTrash && (!deferredQuery || `${item.title} ${searchable(item.content)}`.toLocaleLowerCase().includes(deferredQuery)));
  }, [deferredQuery, showTrash, store.state]);

  const navigate = useCallback(async (id?: string) => {
    if (actionInFlight.current || routing) return;
    actionInFlight.current = true;
    const target = store.getState().pages.find((item) => item.id === id);
    setDestination({ id, title: target?.title || (id ? "Untitled" : "notebooks"), icon: target?.icon || "📓" });
    setOpening(true);
    setError("");
    try {
      if (documentRef.current && !await documentRef.current.flush()) return;
      setSidebarOpen(false);
      setShowTrash(false);
      startRouting(() => router.push(id ? `/notebooks/${id}` : "/notebooks"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The notebook could not be opened."); }
    finally { actionInFlight.current = false; setOpening(false); }
  }, [router, routing, store]);

  const createPage = async (templateId = "blank", parentId: string | null = null) => {
    if (actionInFlight.current || routing) return;
    // Claim the action before flushing: a second click must not create another page.
    actionInFlight.current = true;
    const template = NOTEBOOK_TEMPLATES.find((item) => item.id === templateId) ?? NOTEBOOK_TEMPLATES[0];
    setDestination({ title: templateId === "blank" ? "Untitled" : template.title, icon: template.icon, templateId });
    setCreating(true); setError("");
    try {
      if (documentRef.current && !await documentRef.current.flush()) return;
      const id = crypto.randomUUID();
      await store.mutate({ action: "create_page", page: { id, title: templateId === "blank" ? "" : template.title, icon: template.icon, parentId, content: templateContent(templateId), sortOrder: activePages.length } });
      setDestination({ id, title: templateId === "blank" ? "Untitled" : template.title, icon: template.icon, templateId });
      setShowTrash(false); setSidebarOpen(false);
      startRouting(() => router.push(`/notebooks/${id}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The page could not be created."); }
    finally { actionInFlight.current = false; setCreating(false); }
  };

  const trashAction = async (item: NotebookPage, remove = false) => {
    if (remove && !window.confirm(`Permanently delete “${item.title || "Untitled"}” and its nested pages? This cannot be undone.`)) return;
    try {
      await store.mutate({ action: remove ? "delete_page" : "restore_page", pageId: item.id, expectedRevision: item.revision });
      if (remove && pageId === item.id) router.push("/notebooks");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The page could not be updated."); }
  };

  const removeExample = async () => {
    if (removingExample || !window.confirm("Delete the example notebook and edits made to its sample pages? Pages you created will be kept. This cannot be undone.")) return;
    setRemovingExample(true);
    setError("");
    try {
      if (documentRef.current && !await documentRef.current.flush()) return;
      await store.mutate({ action: "remove_examples" });
      setExampleFeedback("Example notebook deleted.");
      if (isExamplePage) { setShowTrash(false); router.push("/notebooks"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The example notebook could not be deleted."); }
    finally { setRemovingExample(false); }
  };

  return <main ref={workspaceRef} className={styles.workspace} data-notebook-workspace="true" aria-busy={removingExample}>
    {sidebarOpen ? <button className={styles.sidebarBackdrop} aria-label="Close page browser" onClick={() => setSidebarOpen(false)} /> : null}
    <aside ref={sidebarRef} className={styles.sidebar} data-open={sidebarOpen} aria-label="Notebook pages">
      <button className={styles.notebookHome} onClick={() => void navigate()}><BookOpen size={19} aria-hidden /><span>Notebooks</span></button>
      <label className={styles.search}><Search size={15} aria-hidden /><span className="sr-only">Search notebook</span><input disabled={loading} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages and sentences" />{query ? <button aria-label="Clear notebook search" onClick={() => setQuery("")}><X size={13} /></button> : null}</label>
      <button className={styles.newPage} onClick={() => void createPage()} disabled={!store.available || busy}>{creating || (routing && destination.templateId) ? <NotebookSpinner size={16} /> : <Plus size={16} aria-hidden />}{creating || (routing && destination.templateId) ? "Creating…" : "New page"}</button>
      <div className={styles.pageNavigation}>
        {loading ? <NotebookSidebarLoading /> : !store.available ? <p className={styles.emptyTree}>Pages could not be loaded.</p> : deferredQuery ? <section><p className={styles.sectionLabel}>Search results</p>{results.length ? results.map((item) => <PageButton key={item.id} page={item} selected={pageId === item.id} onClick={() => { setShowTrash(Boolean(item.trashedAt)); void navigate(item.id); }} />) : <p className={styles.emptyTree}>No matching pages</p>}</section> : <>
          {activePages.some((item) => item.favorite) ? <section><p className={styles.sectionLabel}>Favorites</p>{activePages.filter((item) => item.favorite).map((item) => <PageButton key={item.id} page={item} selected={pageId === item.id} onClick={() => void navigate(item.id)} />)}</section> : null}
          <section><div className={styles.sectionHead}><p className={styles.sectionLabel}>Private pages</p><button aria-label="Add a page" disabled={!store.available || busy} onClick={() => void createPage()}><Plus size={14} /></button></div>
            {activePages.length ? <PageTree pages={activePages} parentId={null} selected={pageId} navigate={navigate} createPage={createPage} busy={busy} openingId={busy ? destination.id : undefined} /> : <p className={styles.emptyTree}>Your pages will appear here.</p>}
          </section>
        </>}
        {busy && destination.templateId ? <div className={styles.pendingPage} role="status"><span aria-hidden="true">{destination.icon}</span><span>Creating notebook…</span><NotebookSpinner size={13} /></div> : null}
      </div>
      <div className={styles.sidebarBottom}><button disabled={!store.available || busy} data-active={showTrash} onClick={async () => { if (documentRef.current && !await documentRef.current.flush()) return; setShowTrash((value) => !value); setSidebarOpen(false); }}><Trash2 size={16} aria-hidden />Trash{store.state.pages.some((item) => item.trashedAt) ? <span>{store.state.pages.filter((item) => item.trashedAt).length}</span> : null}</button><button disabled={!store.available || busy} onClick={async () => { if (documentRef.current && !await documentRef.current.flush()) return; downloadNotebook("Kakehashi notebooks.json", JSON.stringify(store.getState()), "application/json"); }}><Download size={16} aria-hidden />Export notebooks</button></div>
    </aside>
    <section className={styles.canvas} inert={sidebarOpen || removingExample ? true : undefined}>
      <button className={styles.mobilePages} onClick={() => setSidebarOpen(true)}><Menu size={17} aria-hidden />Pages</button>
      {exampleFeedback ? <p className={styles.exampleFeedback} role="status">{exampleFeedback}</p> : null}
      {error ? <div className={styles.error} role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div> : null}
      <div className={styles.canvasBody}>
      {busy ? <div className={styles.pendingCanvas}><NotebookPageLoading label={destination.templateId ? "Creating notebook…" : `Opening ${destination.title}…`} icon={destination.icon} /></div> : null}
      <div className={styles.canvasContent} data-pending={busy} inert={busy || undefined}>
      {loading ? <NotebookPageLoading /> : !store.available ? <div className={styles.welcome}><BookOpen size={32} /><h1>Your notebook is taking a moment</h1><p>{store.error || "Notebook storage is being set up. Please try again shortly."}</p><button className={styles.primaryButton} disabled={retrying} onClick={async () => { setRetrying(true); try { await store.refresh(); } finally { setRetrying(false); } }}>Try again</button></div> : showTrash ? <div className={styles.overview}><div className={styles.overviewHeading}><Trash2 size={23} /><h1>Trash</h1></div><p className={styles.muted}>Restore a page to bring it back, or delete it permanently.</p>{results.filter((item) => item.trashedAt).length ? <div className={styles.pageList}>{results.filter((item) => item.trashedAt).map((item) => <div className={styles.trashRow} key={item.id}><span>{item.icon || "📓"}</span><strong>{item.title || "Untitled"}</strong><button onClick={() => void trashAction(item)}><Undo2 size={15} />Restore</button><button aria-label={`Delete ${item.title || "Untitled"} permanently`} onClick={() => void trashAction(item, true)}><Trash2 size={15} /></button></div>)}</div> : <p className={styles.emptyTree}>Trash is empty.</p>}</div> : page && !page.trashedAt ? <NotebookDocument ref={documentRef} key={`${store.scope}:${page.id}`} page={page} store={store} navigate={navigate} createPage={createPage} onRemoveExample={isExamplePage ? () => void removeExample() : undefined} removingExample={removingExample} /> : pageId ? <div className={styles.welcome}><FileText size={30} /><h1>{page?.trashedAt ? "This page is in Trash" : "Page not found"}</h1><p>{page?.trashedAt ? "You can restore it from your notebook's Trash." : "It may have been deleted or belong to a different account."}</p><button className={styles.primaryButton} onClick={() => page?.trashedAt ? setShowTrash(true) : void navigate()}>{page?.trashedAt ? "Open Trash" : "Back to notebooks"}</button></div> : <div className={styles.overview}>
        <div className={styles.overviewHeading}><BookOpen size={25} aria-hidden /><h1>Your notebooks</h1></div>
        <p className={styles.introduction}>A place for the words, sentences, and ideas you want to keep.</p>
        {examplePages.length ? <section className={styles.exampleGuide} aria-label="Example notebook">
          <div><h2>Start here</h2><p>Explore an editable tour, a Japanese study note, and a writing playground.</p></div>
          <div className={styles.exampleActions}>
            {exampleDestination ? <button className={styles.primaryButton} onClick={() => void navigate(exampleDestination.id)}>Open example notebook<ChevronRight size={15} aria-hidden /></button> : null}
            <button className={styles.exampleDelete} disabled={removingExample} onClick={() => void removeExample()}><Trash2 size={14} aria-hidden />{removingExample ? "Deleting…" : "Delete example notebook"}</button>
          </div>
        </section> : null}
        <div className={styles.templates} aria-label="Page templates">{NOTEBOOK_TEMPLATES.map((template) => <button key={template.id} onClick={() => void createPage(template.id)} disabled={busy}><span className={styles.templateIcon} aria-hidden>{template.icon}</span><strong>{template.title}</strong><span>{template.description}</span></button>)}</div>
        {activePages.length ? <><h2 className={styles.recentTitle}>Recently edited</h2><div className={styles.pageList}>{[...activePages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20).map((item) => <button className={styles.recentPage} onClick={() => void navigate(item.id)} key={item.id}><span aria-hidden>{item.icon || "📓"}</span><strong>{item.title || "Untitled"}</strong><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time><ChevronRight size={15} aria-hidden /></button>)}</div></> : <div className={styles.gettingStarted}><h2>Start with a page. Make it yours.</h2><p>Write freely, use <kbd>/</kbd> to add blocks, and connect vocabulary or sentences as you learn. You can also add to a page directly from a word card.</p></div>}
        {store.isDemo ? <p className={styles.demoNote}>Demo notebooks stay in this browser. Your account’s notebooks save privately to the cloud.</p> : null}
      </div>}
      </div>
      </div>
    </section>
  </main>;
}

function PageButton({ page, selected, opening, onClick }: { page: NotebookPage; selected?: boolean; opening?: boolean; onClick: () => void }) {
  return <button className={styles.pageButton} data-selected={selected} aria-current={selected ? "page" : undefined} onClick={onClick}><span className={styles.pageIcon} aria-hidden>{opening ? <NotebookSpinner size={14} /> : page.icon || "📓"}</span><span>{page.title || "Untitled"}</span></button>;
}

function PageTree({ pages, parentId, selected, navigate, createPage, busy = false, openingId, depth = 0 }: { pages: NotebookPage[]; parentId: string | null; selected?: string; navigate: (id: string) => Promise<void>; createPage: (template?: string, parentId?: string | null) => Promise<void>; busy?: boolean; openingId?: string; depth?: number }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  if (depth > 24) return null;
  return <div className={styles.pageTree}>{pages.filter((page) => page.parentId === parentId || (parentId === null && !pages.some((candidate) => candidate.id === page.parentId))).map((page) => {
    const children = pages.some((candidate) => candidate.parentId === page.id);
    const expanded = !collapsed.has(page.id);
    return <div key={page.id}><div className={styles.treeRow}><button className={styles.expand} aria-label={`${expanded ? "Collapse" : "Expand"} ${page.title || "Untitled"}`} aria-expanded={children ? expanded : undefined} disabled={!children} onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(page.id)) next.delete(page.id); else next.add(page.id); return next; })}>{children ? expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}</button><PageButton page={page} selected={selected === page.id} opening={openingId === page.id} onClick={() => void navigate(page.id)} /><button className={styles.addChild} aria-label={`Add page inside ${page.title || "Untitled"}`} disabled={busy} onClick={() => void createPage("blank", page.id)}><Plus size={13} /></button></div>{children && expanded ? <div className={styles.nested}><PageTree pages={pages} parentId={page.id} selected={selected} navigate={navigate} createPage={createPage} busy={busy} openingId={openingId} depth={depth + 1} /></div> : null}</div>;
  })}</div>;
}

function NotebookDocument({ page, store, navigate, createPage, ref, onRemoveExample, removingExample = false }: { page: NotebookPage; store: NotebookStore; navigate: (id?: string) => Promise<void>; createPage: (template?: string, parentId?: string | null) => Promise<void>; ref: Ref<DocumentHandle>; onRemoveExample?: () => void; removingExample?: boolean }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const subjects = useQuery(subjectsQuery());
  const [wide, setWide] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [copying, setCopying] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const mutate = store.mutate;
  const writing = usePageDraft(page, store.scope, useCallback((draft) => mutate({ action: "update_page", pageId: page.id, expectedRevision: draft.baseRevision, patch: { title: draft.title, icon: draft.icon, content: draft.content } }), [page.id, mutate]));
  useImperativeHandle(ref, () => ({ flush: writing.flush }), [writing.flush]);
  const livePage = { ...page, ...writing.draft };
  const activePages = store.state.pages.filter((item) => !item.trashedAt);
  const ancestors: NotebookPage[] = [];
  let ancestor = activePages.find((item) => item.id === page.parentId);
  while (ancestor && ancestors.length < 24) { ancestors.unshift(ancestor); ancestor = activePages.find((item) => item.id === ancestor?.parentId); }
  const descendantIds = new Set([page.id]);
  for (let count = 0; count < 24; count += 1) for (const item of activePages) if (item.parentId && descendantIds.has(item.parentId)) descendantIds.add(item.id);
  const backlinkedPages = activePages.filter((item) => item.id !== page.id && JSON.stringify(item.content).includes(page.id));
  const linkedSentences = store.state.sentences.filter((sentence) => JSON.stringify(writing.draft.content).includes(sentence.id));
  const pageMenu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const menu = pageMenu.current;
    if (!menu) return;
    const dismissOutside = (event: Event) => {
      if (menu.open && !event.composedPath().includes(menu)) menu.open = false;
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (!menu.open || event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      menu.open = false;
      menu.querySelector("summary")?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissWithEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissWithEscape);
    };
  }, []);

  const run = async (action: () => Promise<unknown>) => { setActionError(""); try { if (await writing.flush()) await action(); } catch (cause) { setActionError(cause instanceof Error ? cause.message : "The page could not be updated."); } if (pageMenu.current) pageMenu.current.open = false; };
  const latest = () => store.getState().pages.find((item) => item.id === page.id) ?? page;
  const saveCopy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const id = crypto.randomUUID();
      await store.mutate({ action: "create_page", page: { id, title: `${writing.draft.title || "Untitled"} (recovered)`, icon: writing.draft.icon, content: writing.draft.content } });
      writing.discard(page);
      await navigate(id);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Your copy could not be saved."); }
    finally { setCopying(false); }
  };

  const loadSaved = async () => {
    if (copying || loadingSaved || !window.confirm("Discard your unsaved changes and load the saved version? Export this page as Markdown first if you want to keep a copy.")) return;
    setLoadingSaved(true);
    setActionError("");
    try {
      const result = await store.refresh();
      if (result.error) throw result.error;
      const saved = result.data?.state.pages.find((item) => item.id === page.id);
      if (!saved) throw new Error("The saved page could not be loaded. Your draft is still here.");
      writing.discard(saved);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "The saved page could not be loaded. Your draft is still here."); }
    finally { setLoadingSaved(false); }
  };

  return <>
    <header className={styles.documentToolbar}><nav className={styles.breadcrumb} aria-label="Page location"><button onClick={() => void navigate()}>Notebooks</button>{ancestors.map((item) => <span key={item.id}><ChevronRight size={12} aria-hidden /><button onClick={() => void navigate(item.id)}>{item.title || "Untitled"}</button></span>)}<ChevronRight size={12} aria-hidden /><span className={styles.currentCrumb}>{writing.draft.title || "Untitled"}</span></nav><div className={styles.documentActions}><span className={styles.saveStatus} role="status" aria-live="polite">{writing.status === "saved" ? <><Check size={12} />{store.isDemo ? "Saved locally" : "Saved"}</> : writing.status === "saving" ? <><NotebookSpinner size={12} />Saving…</> : writing.status === "unsaved" ? "Unsaved changes" : "Draft kept"}</span><button aria-label={page.favorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={page.favorite} onClick={() => void run(async () => { const item = latest(); await store.mutate({ action: "update_page", pageId: page.id, expectedRevision: item.revision, patch: { favorite: !item.favorite } }); })}><Star size={17} fill={page.favorite ? "currentColor" : "none"} /></button><details className={styles.pageMenu} ref={pageMenu}><summary aria-label="Page options"><MoreHorizontal size={20} /></summary><div className={styles.menuItems}><button onClick={() => { setWide((value) => !value); if (pageMenu.current) pageMenu.current.open = false; }}><Maximize2 size={15} />{wide ? "Standard width" : "Full width"}</button><button onClick={() => void run(() => createPage("blank", page.id))}><Plus size={15} />Add nested page</button><button onClick={() => { setShowMove((value) => !value); if (pageMenu.current) pageMenu.current.open = false; }}><FolderOpen size={15} />Move page</button><button onClick={() => void run(async () => { const id = crypto.randomUUID(); const source = latest(); const duplicate = (blocks: NotebookBlock[]): NotebookBlock[] => blocks.map((block) => ({ ...block, id: crypto.randomUUID(), ...(block.children ? { children: duplicate(block.children) } : {}) })); await store.mutate({ action: "create_page", page: { id, title: `${source.title || "Untitled"} (copy)`, icon: source.icon, parentId: source.parentId, content: duplicate(source.content) } }); await navigate(id); })}><Copy size={15} />Duplicate page</button><button onClick={() => { downloadNotebook(`${writing.draft.title || "Untitled"}.md`, notebookMarkdown(livePage, store.state), "text/markdown;charset=utf-8"); if (pageMenu.current) pageMenu.current.open = false; }}><Download size={15} />Export Markdown</button><button className={styles.danger} onClick={() => void run(async () => { const item = latest(); await store.mutate({ action: "trash_page", pageId: page.id, expectedRevision: item.revision }); await navigate(); })}><Trash2 size={15} />Move to Trash</button></div></details></div></header>
    {writing.message || actionError ? <div className={styles.notice} role={writing.status === "error" || writing.status === "conflict" || actionError ? "alert" : "status"}><span>{actionError || writing.message}</span>{writing.status === "error" ? <button disabled={loadingSaved} onClick={() => void writing.flush()}>Retry save</button> : null}{writing.status === "conflict" ? <button disabled={copying || loadingSaved} onClick={() => void saveCopy()}>{copying ? "Saving copy…" : "Keep as new page"}</button> : null}{writing.status === "conflict" || writing.status === "error" ? <button disabled={copying || loadingSaved} onClick={() => void loadSaved()}>{loadingSaved ? "Loading saved page…" : "Load saved version"}</button> : null}</div> : null}
    {showMove ? <div className={styles.moveBar}><label>Move to <select aria-label="Move page to" value={page.parentId ?? ""} onChange={(event) => { const parentId = event.target.value || null; void run(async () => { await store.mutate({ action: "update_page", pageId: page.id, expectedRevision: latest().revision, patch: { parentId } }); setShowMove(false); }); }}><option value="">Notebook root</option>{activePages.filter((item) => !descendantIds.has(item.id)).map((item) => <option value={item.id} key={item.id}>{item.title || "Untitled"}</option>)}</select></label><button aria-label="Close move page" onClick={() => setShowMove(false)}><X size={16} /></button></div> : null}
    <article className={styles.document} data-wide={wide}>
      {onRemoveExample ? <div className={styles.exampleDocumentNote} aria-label="Example notebook"><span>Example notebook · Try editing anything.</span><button className={styles.exampleDelete} disabled={removingExample} onClick={onRemoveExample}><Trash2 size={14} aria-hidden />{removingExample ? "Deleting…" : "Delete example notebook"}</button></div> : null}
      <h1 className="sr-only">{writing.draft.title || "Untitled"}</h1>
      <div className={styles.pageIdentity}><NotebookPageIcon value={writing.draft.icon} disabled={copying || loadingSaved} onChange={(icon) => writing.update({ icon })} /><NotebookPageTitle value={writing.draft.title} disabled={copying || loadingSaved} onChange={(title) => writing.update({ title })} /></div>
      <NotebookEditor key={`${page.id}:${writing.editorEpoch}`} readOnly={copying || loadingSaved} value={writing.draft.content} onChange={writing.setContent} sentences={store.state.sentences} pages={activePages} subjects={subjects.data ?? EMPTY_SUBJECTS} subjectsLoading={subjects.isFetching} subjectsError={subjects.isError ? "Study items could not be loaded." : null} onRetrySubjects={() => { void subjects.refetch(); }} onOpenSubject={setPreviewId} onOpenPage={(id) => void navigate(id)} theme={resolvedTheme === "dark" || resolvedTheme === "midnight" ? "dark" : "light"} onSaveSentence={async (input) => {
        const id = input.id || crypto.randomUUID();
        const result = await store.mutateResult({ action: "upsert_sentence", sentence: { id, japanese: input.japanese, kana: input.kana, english: input.english, subjectIds: input.subjectIds }, expectedRevision: input.revision ?? -1 });
        const sentence = result.state.sentences.find((item) => item.id === (result.sentenceId || id));
        if (!sentence) throw new Error("The sentence could not be found after saving.");
        return sentence;
      }} onDeleteSentence={async (sentenceId) => {
        if (!await writing.flush()) throw new Error("Save or resolve this page's draft before deleting a shared sentence.");
        const sentence = store.getState().sentences.find((item) => item.id === sentenceId);
        if (!sentence) return;
        await store.mutate({ action: "delete_sentence", sentenceId, expectedRevision: sentence.revision });
      }} />
      {activePages.some((item) => item.parentId === page.id) ? <section className={styles.childPages} aria-label="Nested pages">{activePages.filter((item) => item.parentId === page.id).map((item) => <PageButton key={item.id} page={item} onClick={() => void navigate(item.id)} />)}</section> : null}
      {linkedSentences.length || backlinkedPages.length ? <footer className={styles.documentFooter}>{linkedSentences.length ? <span>{linkedSentences.length} linked {linkedSentences.length === 1 ? "sentence" : "sentences"}</span> : null}{backlinkedPages.length ? <details><summary>Referenced in {backlinkedPages.length} {backlinkedPages.length === 1 ? "page" : "pages"}</summary>{backlinkedPages.map((item) => <PageButton key={item.id} page={item} onClick={() => void navigate(item.id)} />)}</details> : null}</footer> : null}
    </article>
    {previewId ? <WordPreview subject={subjects.data?.find((item) => item.id === previewId)} onClose={() => setPreviewId(null)} onOpen={() => void run(async () => { router.push(`/subjects/${previewId}?returnTo=${encodeURIComponent(`/notebooks/${page.id}`)}`); })} /> : null}
  </>;
}

function NotebookPageTitle({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (title: string) => void }) {
  return <div className={styles.titleSizing}>
    <span className={`${styles.titleInput} ${styles.titleMirror}`} aria-hidden="true">{value || "Untitled"}{"\u200b"}</span>
    <textarea
      className={styles.titleInput}
      aria-label="Page title"
      aria-multiline="false"
      disabled={disabled}
      placeholder="Untitled"
      value={value}
      rows={1}
      maxLength={180}
      onChange={(event) => onChange(event.target.value.replace(/[\r\n]+/g, " ").slice(0, 180))}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) event.preventDefault();
      }}
    />
  </div>;
}

function WordPreview({ subject, onClose, onOpen }: { subject?: Subject; onClose: () => void; onOpen: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={styles.wordPreview} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-label="Vocabulary preview"><div><button className={styles.previewClose} aria-label="Close vocabulary preview" onClick={onClose}><X size={18} /></button>{subject ? <><p className={styles.wordType}>{subject.object.replace("_", " ")} · Level {subject.data.level}</p><h2 lang="ja">{subject.data.characters || subject.data.slug}</h2><p lang="ja">{subject.data.readings?.map((item) => item.reading).join(" · ")}</p><p>{subject.data.meanings.filter((item) => item.primary).map((item) => item.meaning).join(", ")}</p>{subject.data.context_sentences?.[0] ? <blockquote><p lang="ja">{subject.data.context_sentences[0].ja}</p><p>{subject.data.context_sentences[0].en}</p></blockquote> : null}</> : <p>Open the word card to see this subject.</p>}<button className={styles.primaryButton} onClick={onOpen}>Open word card<ChevronRight size={15} /></button></div></dialog>;
}
