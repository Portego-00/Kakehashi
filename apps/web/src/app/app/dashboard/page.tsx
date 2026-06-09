"use client";

import { type WaniKaniItemType } from "@kakehashi/core";
import {
  BookOpen,
  GraduationCap,
  Grid3X3,
  Headphones,
  Newspaper,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useWaniKaniSummary } from "@/lib/use-wanikani-summary";

const reviewType: WaniKaniItemType = "kanji";

export default function DashboardPage() {
  const summary = useWaniKaniSummary();
  const isLoading = summary.status === "loading";
  const isConnected = Boolean(summary.session);
  const queueLabel = isLoading ? "..." : isConnected ? null : "Connect";
  const dashboardItems = [
    {
      title: "Reviews",
      href: "/app/reviews",
      icon: BookOpen,
      value: queueLabel ?? String(summary.counts.reviews),
      detail: `Desktop ${reviewType} review queue from WaniKani summary`,
    },
    {
      title: "Lessons",
      href: "/app/lessons",
      icon: GraduationCap,
      value: queueLabel ?? String(summary.counts.lessons),
      detail: "Lesson queue from WaniKani summary",
    },
    {
      title: "Search",
      href: "/app/search",
      icon: Search,
      value: "Text",
      detail: "Paste Japanese text or search subjects",
    },
    {
      title: "Modes",
      href: "/app/modes",
      icon: Sparkles,
      value: "Study",
      detail: "Browser-safe practice modes and port status",
    },
    {
      title: "News",
      href: "/app/news",
      icon: Newspaper,
      value: "NHK",
      detail: "Internal reader with WaniKani and JPDB highlighting",
    },
    {
      title: "Songs",
      href: "/app/songs",
      icon: Headphones,
      value: "Lyrics",
      detail: "YouTube and LRCLIB with vocabulary tooltips",
    },
    {
      title: "Crossword",
      href: "/app/crossword",
      icon: Grid3X3,
      value: "WK",
      detail: "Crosswords generated from your learned vocabulary",
    },
    {
      title: "Settings",
      href: "/app/settings",
      icon: Settings,
      value: isConnected ? "Token" : "Setup",
      detail: "WaniKani account and token status",
    },
  ];

  return (
    <section>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-sakura-300">Kakehashi web</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Dashboard</h1>
          {summary.session ? (
            <p className="mt-3 text-sm text-gray-400">
              Connected as {summary.session.user.username}, level {summary.session.user.level}
            </p>
          ) : null}
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-200 transition-colors hover:border-sakura-300 hover:text-white"
        >
          {isConnected ? "Reconnect" : "Connect WaniKani"}
        </Link>
      </div>

      {summary.status === "error" ? (
        <p className="mt-6 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {summary.error}
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-sakura-300/60 hover:bg-white/[0.05]"
          >
            <item.icon className="h-5 w-5 text-sakura-300" />
            <div className="mt-6 text-3xl font-semibold">{item.value}</div>
            <h2 className="mt-3 text-base font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">{item.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
