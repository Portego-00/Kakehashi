"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  ChartColumn,
  Clapperboard,
  GraduationCap,
  House,
  Images,
  Languages,
  Library,
  List,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Music2,
  Newspaper,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, type Variants } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { KakehashiBrand } from "@/components/brand/KakehashiBrand";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/States";
import { WebAnalyticsTracker } from "@/features/analytics/WebAnalyticsTracker";
import { SettingsApplicator } from "@/features/settings/components/SettingsApplicator";
import { DEFAULT_NAVBAR_TABS, type NavbarTabId } from "@/features/settings/settings";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { PatreonIcon } from "@/components/icons/BrandIcons";
import { PATREON_URL } from "@/lib/project-links";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { assignmentsQuery } from "@/lib/wanikani/queries";
import {
  AppShellBackActionProvider,
  type AppShellBackAction,
  type RegisterAppShellBackAction,
} from "./app-shell-back-action";
import styles from "./shell.module.css";

type Destination = {
  href: string;
  label: string;
  icon: typeof House;
  preference?: string;
  comingSoon?: boolean;
};

const home: Destination = { href: "/dashboard", label: "Home", icon: House };
const level: Destination = { href: "/progress", label: "Level", icon: BarChart3 };
const news: Destination = { href: "/news", label: "News", icon: Newspaper, preference: "news" };
const manga: Destination = { href: "/manga", label: "Manga", icon: Images, preference: "manga" };
const songs: Destination = { href: "/music", label: "Songs", icon: Music2, preference: "music" };
const search: Destination = { href: "/search", label: "Search", icon: Search, preference: "search" };
const analytics: Destination = { href: "/analytics", label: "Analytics", icon: ChartColumn, preference: "analytics" };
const items: Destination = { href: "/items", label: "Items", icon: Library, preference: "items" };
const books: Destination = { href: "/epubs", label: "Books", icon: BookOpen, preference: "epubs" };
const video: Destination = { href: "/video", label: "Video", icon: Clapperboard, preference: "video" };

const navbarDestinationById: Record<NavbarTabId, Destination> = {
  home,
  level,
  items,
  analytics,
  news,
  epubs: books,
  video,
  manga,
  music: songs,
};
const NAVBAR_TAB_VARIANTS = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.18, ease: [0.2, 0, 0, 1] } },
  exit: { opacity: 0, x: 6, transition: { duration: 0.13, ease: [0.3, 0, 1, 1] } },
} satisfies Variants;
const destinationGroups: Array<{ title: string; links: Destination[] }> = [
  {
    title: "Study",
    links: [
      { href: "/lessons", label: "Lessons", icon: GraduationCap, comingSoon: true },
      { href: "/reviews", label: "Reviews", icon: Brain, comingSoon: true },
      { href: "/study", label: "Extra study", icon: Sparkles },
    ],
  },
  {
    title: "Progress",
    links: [
      level,
      analytics,
      items,
      search,
      { href: "/lists", label: "Subject lists", icon: List, preference: "lists" },
    ],
  },
  {
    title: "Read & watch",
    links: [
      news,
      { href: "/reader", label: "Text reader", icon: BookOpen, preference: "reader" },
      books,
      manga,
      video,
      { href: "/translator", label: "Translator", icon: Languages, preference: "translator" },
      songs,
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/community", label: "Issues & feedback", icon: MessageSquareText, preference: "community" },
      { href: "/supporters", label: "Supporters", icon: Sparkles },
    ],
  },
];
const mobileNavigation = [home, level, news, { href: "/study", label: "Study", icon: Sparkles } satisfies Destination];
function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function isVisible(destination: Destination, visibleNavigation: string[]) {
  return !destination.preference || visibleNavigation.includes(destination.preference);
}

export function backTargetForPathname(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "subjects" && segments.length === 3 && segments[2] === "constellation") return `/subjects/${segments[1]}`;
  if (segments[0] === "subjects" && segments.length === 2) return "/search";
  if (["news", "manga", "epubs", "community"].includes(segments[0]) && segments.length === 2) return `/${segments[0]}`;
  if (segments[0] === "progress" && (segments[1] === "kanji" || segments[1] === "wrapped")) return "/progress";
  if (segments[0] === "study" && segments.length === 2) return "/study";
  if (["feature-request", "feedback", "supporters"].includes(segments[0]) && segments.length === 1) return "/community";
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, error, signOut, refresh } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const webSettings = useWebSettings(user?.data.username ?? "anonymous");
  const workspace = webSettings.workspace;
  const learnedKanji = useQuery({
    ...assignmentsQuery(),
    enabled: status === "authenticated",
    select: (assignments) => assignments.filter((assignment) => assignment.data.subject_type === "kanji" && assignment.data.srs_stage >= 5).length,
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const [floatingNav, setFloatingNav] = useState(false);
  const [hasInternalHistory, setHasInternalHistory] = useState(false);
  const [pageBackAction, setPageBackAction] = useState<AppShellBackAction | null>(null);
  const [signOutError, setSignOutError] = useState("");
  const moreDialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const previousPathRef = useRef(pathname);
  const pageBackRegistrationRef = useRef<symbol | null>(null);
  const immersive = pathname === "/lessons" || pathname === "/reviews";
  const backTarget = backTargetForPathname(pathname);
  const hasBack = Boolean(pageBackAction || backTarget);

  const registerPageBackAction = useCallback<RegisterAppShellBackAction>((action) => {
    const registration = Symbol("app-shell-back-action");
    pageBackRegistrationRef.current = registration;
    setPageBackAction(action);

    return () => {
      if (pageBackRegistrationRef.current !== registration) return;
      pageBackRegistrationRef.current = null;
      setPageBackAction(null);
    };
  }, []);

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  useEffect(() => {
    if (previousPathRef.current !== pathname) setHasInternalHistory(true);
    previousPathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    let floating = false;

    const update = () => {
      const next = window.scrollY > 80;
      if (next !== floating) {
        floating = next;
        setFloatingNav(next);
      }
      frame = 0;
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
    };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const dialog = moreDialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    const frame = window.requestAnimationFrame(() => focusable?.[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [moreOpen]);

  if (status === "unavailable") {
    return <div className={styles.loading} role="alert"><div className={styles.sessionError}><strong>Your session could not be checked</strong><span>{error}</span><Button onClick={() => void refresh()}>Try Again</Button></div></div>;
  }
  if (status !== "authenticated" || !user) {
    return (
      <main className={styles.bootstrap} aria-label="Kakehashi is starting">
        <div className={styles.bootstrapBrand} aria-hidden="true">
          <KakehashiBrand className={styles.bootstrapLogo} />
        </div>
        <LoadingState
          className={styles.bootstrapStatus}
          label="Opening your study space"
          detail="Checking your WaniKani session…"
        />
      </main>
    );
  }

  const openMore = (trigger: HTMLButtonElement) => {
    returnFocusRef.current = trigger;
    setMoreOpen(true);
  };
  const closeMore = () => setMoreOpen(false);
  const goBack = () => {
    if (pageBackAction) {
      pageBackAction.onBack();
      return;
    }
    if (!backTarget) return;
    if (hasInternalHistory) router.back();
    else router.replace(backTarget);
  };
  const visiblePrimaryNavigation = (workspace.navbarTabs ?? DEFAULT_NAVBAR_TABS).map((id) => navbarDestinationById[id]);
  const learnedKanjiLabel = learnedKanji.data?.toLocaleString() ?? (learnedKanji.isError ? "—" : "…");

  return <AppShellBackActionProvider register={registerPageBackAction}><div className={styles.shell}>
    <SettingsApplicator />
    <WebAnalyticsTracker />
    <a className={styles.skipLink} href="#main-content" inert={moreOpen ? true : undefined}>Skip to main content</a>

    <header className={styles.topbar} data-floating={floatingNav || undefined} inert={moreOpen ? true : undefined}>
      <div className={styles.appbar}>
        <div className={styles.identityArea} data-has-back={hasBack ? "true" : undefined}>
          <button type="button" className={styles.backButton} data-visible={hasBack ? "true" : undefined} aria-label={pageBackAction?.label ?? "Back"} aria-hidden={!hasBack} tabIndex={hasBack ? 0 : -1} disabled={!hasBack} onClick={goBack}>
            <ArrowLeft size={19} aria-hidden />
          </button>
          <Link href="/dashboard" className={styles.identity} aria-label={`Kakehashi home for ${user.data.username}`}>
            <UserAvatar className={styles.brandMark} email={webSettings.profile.gravatarEmail} />
            <span className={styles.identityCopy}>
              <strong>{user.data.username}</strong>
              <span className={styles.identityStats}>
                <span className={styles.identityStat}><BarChart3 size={13} aria-hidden />Lvl {user.data.level}</span>
                <span className={styles.identityStat}><BookOpen size={13} aria-hidden />{learnedKanjiLabel} Kanji</span>
              </span>
            </span>
          </Link>
        </div>

        <nav className={styles.primaryNav} aria-label="Main navigation">
          <MotionConfig reducedMotion="user">
            <AnimatePresence initial={false} mode="popLayout">
              {visiblePrimaryNavigation.map((destination) => <motion.span key={destination.href} layout="position" className={styles.primaryNavItem} data-navbar-item={destination.href} variants={NAVBAR_TAB_VARIANTS} initial="initial" animate="animate" exit="exit" transition={{ layout: { duration: 0.18, ease: [0.2, 0, 0, 1] } }}><Link href={destination.href} className={cn(styles.primaryLink, isActive(pathname, destination.href) && styles.primaryLinkActive)} aria-current={isActive(pathname, destination.href) ? "page" : undefined}><destination.icon className={styles.primaryIcon} size={17} aria-hidden /><span>{destination.label}</span></Link></motion.span>)}
            </AnimatePresence>
          </MotionConfig>
        </nav>

        <div className={styles.topActions}>
          {isVisible(search, workspace.visibleNav) ? <Link href={search.href} className={cn(styles.iconAction, isActive(pathname, search.href) && styles.iconActionActive)} aria-label="Search subjects"><Search size={18} aria-hidden /></Link> : null}
          <a href={PATREON_URL} className={styles.iconAction} target="_blank" rel="noopener noreferrer" aria-label="Support Kakehashi on Patreon">
            <PatreonIcon />
          </a>
          {workspace.visibleNav.includes("community") ? <Link href="/community" className={cn(styles.iconAction, styles.secondaryAction, isActive(pathname, "/community") && styles.iconActionActive)} aria-label="Open issues and feedback"><MessageSquareText size={18} aria-hidden /></Link> : null}
          <button type="button" className={styles.iconAction} aria-label={resolvedTheme === "light" ? "Switch to dark theme" : "Switch to light theme"} onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}>{resolvedTheme === "light" ? <Moon size={18} aria-hidden /> : <Sun size={18} aria-hidden />}</button>
          <Link href="/settings" className={cn(styles.iconAction, styles.secondaryAction, isActive(pathname, "/settings") && styles.iconActionActive)} aria-label="Open settings"><Settings size={18} aria-hidden /></Link>
          <button type="button" className={styles.iconAction} aria-label="More destinations" aria-expanded={moreOpen} aria-controls="more-navigation" onClick={(event) => openMore(event.currentTarget)}><Menu size={19} aria-hidden /></button>
        </div>
      </div>
    </header>

    {signOutError || error ? <div className={styles.topError} role="alert"><span>{signOutError || error}</span>{error ? <Button size="small" tone="ghost" onClick={() => void refresh()}>Retry session check</Button> : null}</div> : null}
    <div className={styles.content} id="main-content" tabIndex={-1} inert={moreOpen ? true : undefined}>{children}</div>

    <nav className={cn(styles.mobileNav, immersive && styles.mobileNavHidden)} aria-label="Mobile navigation" inert={moreOpen ? true : undefined}>
      {mobileNavigation.filter((destination) => isVisible(destination, workspace.visibleNav)).map((destination) => <Link key={destination.href} href={destination.href} className={cn(styles.mobileLink, isActive(pathname, destination.href) && styles.mobileLinkActive)} aria-current={isActive(pathname, destination.href) ? "page" : undefined}><destination.icon aria-hidden /><span>{destination.label}</span></Link>)}
      <button type="button" className={cn(styles.mobileLink, moreOpen && styles.mobileLinkActive)} aria-label="More" aria-expanded={moreOpen} aria-controls="more-navigation" onClick={(event) => openMore(event.currentTarget)}><Menu aria-hidden /><span>More</span></button>
    </nav>

    {moreOpen && !immersive ? <div className={styles.moreLayer}>
      <button type="button" tabIndex={-1} className={styles.moreBackdrop} aria-label="Close More menu" onClick={closeMore} />
      <div ref={moreDialogRef} className={styles.moreSheet} id="more-navigation" role="dialog" aria-modal="true" aria-labelledby="more-title">
        <div className={styles.moreHeader}><h2 id="more-title">All destinations</h2><Button className={styles.iconButton} tone="ghost" aria-label="Close More menu" onClick={closeMore}><X size={18} aria-hidden /></Button></div>
        <nav className={styles.moreNav} aria-label="All destinations">
          {destinationGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div>{group.links.filter((destination) => isVisible(destination, workspace.visibleNav)).map((destination) => destination.comingSoon
            ? <button key={destination.href} type="button" className={styles.moreLink} aria-label={`${destination.label}, coming soon`} disabled><destination.icon size={18} aria-hidden /><span>{destination.label}</span><span className={styles.moreStatus}>Coming soon</span></button>
            : <Link key={destination.href} href={destination.href} className={cn(styles.moreLink, isActive(pathname, destination.href) && styles.moreLinkActive)} aria-current={isActive(pathname, destination.href) ? "page" : undefined} onClick={closeMore}><destination.icon size={18} aria-hidden /><span>{destination.label}</span></Link>)}</div></section>)}
          <section><h3>Account</h3><div><Link href="/settings" className={cn(styles.moreLink, isActive(pathname, "/settings") && styles.moreLinkActive)} onClick={closeMore}><Settings size={18} aria-hidden /><span>Settings</span></Link><button type="button" className={styles.moreLink} onClick={() => { setSignOutError(""); void signOut().then(() => router.replace("/login")).catch((cause) => setSignOutError(cause instanceof Error ? cause.message : "Kakehashi could not sign out.")); }}><LogOut size={18} aria-hidden /><span>Sign out</span></button></div></section>
        </nav>
      </div>
    </div> : null}
  </div></AppShellBackActionProvider>;
}
