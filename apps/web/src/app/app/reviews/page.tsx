"use client";

import {
  WEB_REVIEW_FEATURE_SUPPORT,
  getUnsupportedReviewFeatures,
} from "@kakehashi/core";
import Link from "next/link";
import { useState } from "react";
import { convertToHiragana, getFinalHiraganaInput } from "@/lib/kana-input";
import { useWaniKaniSummary } from "@/lib/use-wanikani-summary";

const unsupported = getUnsupportedReviewFeatures(WEB_REVIEW_FEATURE_SUPPORT);

export default function ReviewsPage() {
  const summary = useWaniKaniSummary();
  const [answer, setAnswer] = useState("");
  const reviewCount =
    summary.status === "loading"
      ? "..."
      : summary.session
        ? String(summary.counts.reviews)
        : "Connect";

  return (
    <section>
      <p className="text-sm font-medium text-sakura-300">Reviews</p>
      <h1 className="mt-2 text-3xl font-bold md:text-4xl">Keyboard-first review shell</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Available reviews: {reviewCount}</span>
            <span>Meaning</span>
          </div>
          <div className="mt-16 text-center">
            <div className="text-6xl font-bold text-white">橋</div>
            <p className="mt-5 text-gray-400">
              {summary.session
                ? `${reviewCount} reviews are available from WaniKani summary.`
                : "Connect WaniKani to load your review queue."}
            </p>
          </div>
          <input
            placeholder="Type an answer"
            value={answer}
            onBlur={() => setAnswer((current) => getFinalHiraganaInput(current))}
            onChange={(event) => setAnswer(convertToHiragana(event.target.value, true))}
            className="mt-16 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-sakura-300"
          />
        </div>

        <aside className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-base font-semibold">Web MVP limits</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-400">
            {unsupported.map((feature) => (
              <li key={feature}>No native {feature} in the web review MVP.</li>
            ))}
          </ul>
          {!summary.session ? (
            <Link
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-sakura-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sakura-400"
              href="/login"
            >
              Connect WaniKani
            </Link>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
