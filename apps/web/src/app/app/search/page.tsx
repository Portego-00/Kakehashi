"use client";

import { createSearchQueryState } from "@kakehashi/core";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const queryState = useMemo(() => createSearchQueryState(query), [query]);

  return (
    <section>
      <p className="text-sm font-medium text-sakura-300">Search</p>
      <h1 className="mt-2 text-3xl font-bold md:text-4xl">Text and subject search shell</h1>
      <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] p-6">
        <label className="text-sm font-medium text-gray-300" htmlFor="search-query">
          Paste Japanese text or enter a subject
        </label>
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-3 focus-within:border-sakura-300">
          <Search className="h-5 w-5 text-sakura-300" />
          <input
            id="search-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="日本語, bridge, kanji..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
          />
        </div>
        <div className="mt-5 grid gap-3 text-sm text-gray-400 md:grid-cols-3">
          <div className="rounded-lg bg-white/[0.04] p-4">
            <span className="block text-gray-500">Mode</span>
            <span className="mt-1 block font-medium text-white">{queryState.mode}</span>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-4">
            <span className="block text-gray-500">Normalized</span>
            <span className="mt-1 block break-words font-medium text-white">
              {queryState.normalizedQuery || "Empty"}
            </span>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-4">
            <span className="block text-gray-500">OCR</span>
            <span className="mt-1 block font-medium text-white">Paste text only</span>
          </div>
        </div>
      </div>
    </section>
  );
}
