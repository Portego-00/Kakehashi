"use client";

import { createLessonQueueSummary } from "@kakehashi/core";
import Link from "next/link";
import { useWaniKaniSummary } from "@/lib/use-wanikani-summary";

export default function LessonsPage() {
  const summary = useWaniKaniSummary();
  const lessonSummary = createLessonQueueSummary(summary.counts.lessons, 0);
  const availableValue =
    summary.status === "loading"
      ? "..."
      : summary.session
        ? String(lessonSummary.available)
        : "Connect";

  return (
    <section>
      <p className="text-sm font-medium text-sakura-300">Lessons</p>
      <h1 className="mt-2 text-3xl font-bold md:text-4xl">Lesson session shell</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-gray-400">Available</p>
          <div className="mt-3 text-3xl font-semibold">{availableValue}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-gray-400">Selected</p>
          <div className="mt-3 text-3xl font-semibold">{lessonSummary.selected}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-gray-400">Next extraction</p>
          <div className="mt-3 text-base font-semibold">Session ordering</div>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">Lesson preview</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
          {summary.session
            ? "WaniKani lesson availability is connected. The next step is hydrating the desktop lesson session."
            : "Connect WaniKani to load your available lessons."}
        </p>
        {!summary.session ? (
          <Link
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-sakura-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sakura-400"
            href="/login"
          >
            Connect WaniKani
          </Link>
        ) : null}
      </div>
    </section>
  );
}
