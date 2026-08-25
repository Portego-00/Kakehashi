"use client";

import {
  BarChart3,
  BookOpen,
  Brain,
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
  Newspaper,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { KakehashiBrand } from "@/components/brand/KakehashiBrand";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/States";
import { SettingsApplicator } from "@/features/settings/components/SettingsApplicator";
import { useWorkspacePreferences } from "@/features/settings/use-workspace-preferences";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import styles from "./shell.module.css";

type Destination = {
  href: string;
  label: string;
  icon: typeof House;
  preference?: string;
};

const home: Destination = { href: "/dashboard", label: "Home", icon: House };
const level: Destination = { href: "/progress", label: "Level", icon: BarChart3 };
const news: Destination = { href: "/news", label: "News", icon: Newspaper, preference: "news" };
const manga: Destination = { href: "/manga", label: "Manga", icon: Images, preference: "manga" };
const songs: Destination = { href: "/music", label: "Songs", icon: BookOpen, preference: "music" };
const search: Destination = { href: "/search", label: "Search", icon: Search, preference: "search" };

const primaryNavigation = [home, level, news, manga, songs, search];
const destinationGroups: Array<{ title: string; links: Destination[] }> = [
  {
    title: "Study",
    links: [
      { href: "/lessons", label: "Lessons", icon: GraduationCap },
      { href: "/reviews", label: "Reviews", icon: Brain },
      { href: "/study", label: "Extra study", icon: Sparkles },
    ],
  },
  {
    title: "Progress",
    links: [
      level,
      { href: "/analytics", label: "Analytics", icon: BarChart3, preference: "analytics" },
      { href: "/items", label: "Items", icon: Library, preference: "items" },
      search,
      { href: "/lists", label: "Subject lists", icon: List, preference: "lists" },
    ],
  },
  {
    title: "Read & watch",
    links: [
      news,
      { href: "/reader", label: "Text reader", icon: BookOpen, preference: "reader" },
      { href: "/epubs", label: "Books", icon: Library, preference: "epubs" },
      manga,
      { href: "/video", label: "Video", icon: Clapperboard, preference: "video" },
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, error, signOut, refresh } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const workspace = useWorkspacePreferences(user?.data.username ?? "anonymous");
  const [moreOpen, setMoreOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const moreDialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const immersive = pathname === "/lessons" || pathname === "/reviews";

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

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
  const visiblePrimaryNavigation = primaryNavigation.filter((destination) => isVisible(destination, workspace.visibleNav));

  return <div className={styles.shell}>
    <SettingsApplicator />
    <a className={styles.skipLink} href="#main-content" inert={moreOpen ? true : undefined}>Skip to main content</a>

    <header className={styles.topbar} inert={moreOpen ? true : undefined}>
      <div className={styles.appbar}>
        <Link href="/dashboard" className={styles.identity} aria-label={`Kakehashi home for ${user.data.username}`}>
          <KakehashiBrand className={styles.brandMark} showName={false} />
          <span className={styles.identityCopy}><strong>{user.data.username}</strong><span>Level {user.data.level}</span></span>
        </Link>

        <nav className={styles.primaryNav} aria-label="Main navigation">
          {visiblePrimaryNavigation.map((destination) => <Link key={destination.href} href={destination.href} className={cn(styles.primaryLink, isActive(pathname, destination.href) && styles.primaryLinkActive)} aria-current={isActive(pathname, destination.href) ? "page" : undefined}><destination.icon className={styles.primaryIcon} size={17} aria-hidden /><span>{destination.label}</span></Link>)}
        </nav>

        <div className={styles.topActions}>
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
          {destinationGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div>{group.links.filter((destination) => isVisible(destination, workspace.visibleNav)).map((destination) => <Link key={destination.href} href={destination.href} className={cn(styles.moreLink, isActive(pathname, destination.href) && styles.moreLinkActive)} aria-current={isActive(pathname, destination.href) ? "page" : undefined} onClick={closeMore}><destination.icon size={18} aria-hidden /><span>{destination.label}</span></Link>)}</div></section>)}
          <section><h3>Account</h3><div><Link href="/settings" className={cn(styles.moreLink, isActive(pathname, "/settings") && styles.moreLinkActive)} onClick={closeMore}><Settings size={18} aria-hidden /><span>Settings</span></Link><button type="button" className={styles.moreLink} onClick={() => { setSignOutError(""); void signOut().then(() => router.replace("/login")).catch((cause) => setSignOutError(cause instanceof Error ? cause.message : "Kakehashi could not sign out.")); }}><LogOut size={18} aria-hidden /><span>Sign out</span></button></div></section>
        </nav>
      </div>
    </div> : null}
  </div>;
}
