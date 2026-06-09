"use client";

import {
  BookOpen,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Music2,
  Newspaper,
  Search,
  Settings,
  Sparkles,
  UserCircle,
  Grid3X3,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  WANIKANI_SESSION_CHANGE_EVENT,
  clearWaniKaniSession,
  loadWaniKaniSession,
  type StoredWaniKaniSession,
} from "@/lib/wanikani-session";

const navItems = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Modes", href: "/app/modes", icon: Sparkles },
  { label: "Reviews", href: "/app/reviews", icon: BookOpen },
  { label: "Lessons", href: "/app/lessons", icon: GraduationCap },
  { label: "Search", href: "/app/search", icon: Search },
  { label: "News", href: "/app/news", icon: Newspaper },
  { label: "Songs", href: "/app/songs", icon: Music2 },
  { label: "Crossword", href: "/app/crossword", icon: Grid3X3 },
  { label: "Settings", href: "/app/settings", icon: Settings },
];

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<StoredWaniKaniSession | null | undefined>(
    undefined
  );

  useEffect(() => {
    function refreshSession() {
      setSession(loadWaniKaniSession());
    }

    refreshSession();
    window.addEventListener("focus", refreshSession);
    window.addEventListener("storage", refreshSession);
    window.addEventListener(WANIKANI_SESSION_CHANGE_EVENT, refreshSession);

    return () => {
      window.removeEventListener("focus", refreshSession);
      window.removeEventListener("storage", refreshSession);
      window.removeEventListener(WANIKANI_SESSION_CHANGE_EVENT, refreshSession);
    };
  }, []);

  function handleDisconnect() {
    clearWaniKaniSession();
    setSession(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-dark-950 text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/10 bg-dark-950/90 px-5 py-6 lg:flex">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/app-icon.png"
              alt="Kakehashi"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-lg font-bold">Kakehashi</span>
          </Link>

          <nav className="mt-10 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-gray-300 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <item.icon className="h-4 w-4 text-sakura-300" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.03] p-4">
          {session ? (
            <>
              <div className="flex items-center gap-3">
                <UserCircle className="h-5 w-5 text-sakura-300" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{session.user.username}</p>
                  <p className="text-xs text-gray-500">Level {session.user.level}</p>
                </div>
              </div>
              <button
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-sakura-300/60 hover:text-white"
                onClick={handleDisconnect}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </>
          ) : (
            <Link
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sakura-300/40 px-3 py-2 text-sm font-medium text-sakura-200 transition-colors hover:border-sakura-300 hover:text-white"
              href="/login"
            >
              <KeyRound className="h-4 w-4" />
              Connect WaniKani
            </Link>
          )}
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-dark-950/90 px-5 py-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/images/app-icon.png"
                alt="Kakehashi"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-bold">Kakehashi</span>
            </Link>
            <Link
              href={session ? "/app/settings" : "/login"}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-200"
            >
              <KeyRound className="h-4 w-4 text-sakura-300" />
              {session ? session.user.username : "Connect"}
            </Link>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm",
                    isActive ? "bg-white/10 text-white" : "bg-white/5 text-gray-200",
                  ].join(" ")}
                >
                  <item.icon className="h-4 w-4 text-sakura-300" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
          {session === null ? (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100 md:flex-row md:items-center md:justify-between">
              <span>Connect WaniKani to load live review and lesson queues.</span>
              <Link
                className="inline-flex items-center justify-center rounded-lg bg-amber-200 px-3 py-2 font-semibold text-dark-950 transition-colors hover:bg-amber-100"
                href="/login"
              >
                Connect
              </Link>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </main>
  );
}
